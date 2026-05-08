import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType } from '@google/generative-ai';
import type { ResponseSchema } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { validateAnalyzableContent } from '@/lib/analysis-guard';

type SummaryPayload = {
  summary?: {
    topic?: string;
    asis?: string;
    tobe?: string;
    expected_effects?: string;
    schedule?: Array<{ task?: string; assignee?: string; dueDate?: string }>;
  };
};

type TranscriptPayload = {
  transcript?: Array<{
    id?: string;
    speaker?: string;
    text?: string;
    start?: number;
    end?: number;
    startTime?: number;
    endTime?: number;
  }>;
};

type TranscriptSegmentSchema = {
  id: string;
  speaker: string;
  text: string;
  start?: number;
  end?: number;
};

type TranscriptResponseSchema = {
  transcript: TranscriptSegmentSchema[];
};

type SummaryResponseSchema = {
  summary: {
    topic?: string;
    asis: string;
    tobe: string;
    expected_effects: string;
    schedule: Array<{
      task: string;
      assignee: string;
      dueDate: string;
    }>;
  };
};

type AnalysisErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_FILE_TYPE"
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_FAILED"
  | "TRANSCRIPTION_FAILED"
  | "INSUFFICIENT_MEETING_CONTENT"
  | "AI_ANALYSIS_FAILED"
  | "PARSE_FAILED"
  | "TIMEOUT"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR";

type AnalysisErrorBody = {
  success: false;
  errorCode: AnalysisErrorCode;
  message: string;
  userMessage: string;
  debugId: string;
  stage?: "request" | "upload" | "transcription" | "summary" | "parse" | "config";
};

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
const openAIKey = process.env.OPENAI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);
const GEMINI_STEP_TIMEOUT_MS = 300_000;
const OPENAI_STEP_TIMEOUT_MS = 600_000;
const OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
const OPENAI_SUMMARY_MODEL = "gpt-5.2";
const OPENAI_SUMMARY_FALLBACK_MODEL = "gpt-5-mini";

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = GEMINI_STEP_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`TIMEOUT:${label}:${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function createAnalysisErrorResponse(
  status: number,
  errorCode: AnalysisErrorCode,
  message: string,
  userMessage: string,
  stage?: AnalysisErrorBody["stage"],
  details?: unknown
) {
  const debugId = randomUUID();
  console.error("[summarize]", { debugId, status, errorCode, message, stage, details });
  return NextResponse.json<AnalysisErrorBody>({
    success: false,
    errorCode,
    message,
    userMessage,
    debugId,
    ...(stage ? { stage } : {}),
  }, { status });
}

function resolveUploadMimeType(file: File) {
  const providedType = file.type.trim();
  if (providedType && (providedType.startsWith("audio/") || providedType.startsWith("video/"))) {
    return providedType;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".webm")) return "audio/webm";
  if (lowerName.endsWith(".wav")) return "audio/wav";
  if (lowerName.endsWith(".m4a")) return "audio/mp4";
  if (lowerName.endsWith(".mp4")) return "video/mp4";
  if (lowerName.endsWith(".mp3")) return "audio/mpeg";
  if (lowerName.endsWith(".aac")) return "audio/aac";
  return "";
}

const transcriptResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    transcript: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          speaker: { type: SchemaType.STRING },
          text: { type: SchemaType.STRING },
          start: { type: SchemaType.INTEGER },
          end: { type: SchemaType.INTEGER },
        },
        required: ["text"],
      },
    },
  },
  required: ["transcript"],
} satisfies ResponseSchema;

const summaryResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: {
      type: SchemaType.OBJECT,
      properties: {
        asis: { type: SchemaType.STRING },
        topic: { type: SchemaType.STRING },
        tobe: { type: SchemaType.STRING },
        expected_effects: { type: SchemaType.STRING },
        schedule: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              task: { type: SchemaType.STRING },
              assignee: { type: SchemaType.STRING },
              dueDate: { type: SchemaType.STRING },
            },
            required: ["task", "assignee", "dueDate"],
          },
        },
      },
      required: ["asis", "tobe", "expected_effects", "schedule"],
    },
  },
  required: ["summary"],
} satisfies ResponseSchema;

function buildStructuredGenerationConfig(schema: typeof transcriptResponseSchema | typeof summaryResponseSchema) {
  return {
    responseMimeType: "application/json",
    responseSchema: schema,
    temperature: 0.2,
    topP: 0.8,
    topK: 20,
  };
}

function classifyUnknownError(error: unknown, stage: AnalysisErrorBody["stage"] = "request") {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("gemini_api_key") || lower.includes("permission denied")) {
    return {
      status: 500,
      errorCode: "CONFIG_ERROR" as const,
      userMessage: "분석 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
      message,
      stage,
    };
  }

  if (lower.includes("service_disabled") || lower.includes("gemini api has not been used") || lower.includes("access not configured")) {
    return {
      status: 500,
      errorCode: "CONFIG_ERROR" as const,
      userMessage: "분석 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
      message,
      stage,
    };
  }

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource exhausted")
  ) {
    return {
      status: 429,
      errorCode: "AI_ANALYSIS_FAILED" as const,
      userMessage: "현재 AI 사용량이 많아 잠시 후 다시 시도해주세요. (할당량 초과)",
      message,
      stage,
    };
  }

  if (
    lower.includes("too large") ||
    lower.includes("413") ||
    lower.includes("payload too large") ||
    lower.includes("file size") ||
    lower.includes("request entity too large") ||
    lower.includes("entity too large") ||
    lower.includes("content length")
  ) {
    return {
      status: 413,
      errorCode: "UPLOAD_TOO_LARGE" as const,
      userMessage: "업로드 가능한 파일 용량을 초과했습니다. 파일 크기를 줄인 후 다시 시도해주세요.",
      message,
      stage,
    };
  }

  if (
    lower.includes("404") &&
    (lower.includes("models/") || lower.includes("not found") || lower.includes("is not found"))
  ) {
    return {
      status: 500,
      errorCode: "CONFIG_ERROR" as const,
      userMessage: "분석 모델 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
      message,
      stage,
    };
  }

  if (
    lower.includes("openai_transcription_failed") ||
    lower.includes("openai_summary_failed") ||
    lower.includes("api.openai.com")
  ) {
    return {
      status: 500,
      errorCode: "AI_ANALYSIS_FAILED" as const,
      userMessage: "회의록 분석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      message,
      stage,
    };
  }

  if (
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline") ||
    lower.includes("econnreset") ||
    lower.includes("enotfound")
  ) {
    return {
      status: 503,
      errorCode: "TIMEOUT" as const,
      userMessage: "분석 요청 시간이 초과되었습니다. 파일이 너무 크거나 네트워크가 불안정할 수 있습니다.",
      message,
      stage,
    };
  }

  if (
    lower.includes("mime") ||
    lower.includes("media type") ||
    lower.includes("unsupported") ||
    lower.includes("invalid file") ||
    lower.includes("file type")
  ) {
    return {
      status: 415,
      errorCode: "UNSUPPORTED_FILE_TYPE" as const,
      userMessage: "지원하지 않는 파일 형식입니다. mp3, wav, m4a, mp4 등 지원 형식의 파일을 업로드해주세요.",
      message,
      stage,
    };
  }

  if (lower.includes("parse") || lower.includes("json") || lower.includes("unexpected token")) {
    return {
      status: 500,
      errorCode: "PARSE_FAILED" as const,
      userMessage: "회의록 분석 결과 형식이 맞지 않았습니다. 잠시 후 다시 시도해주세요.",
      message,
      stage,
    };
  }

  return {
    status: 500,
    errorCode: "UNKNOWN_ERROR" as const,
    userMessage: "분석 중 오류가 발생했습니다. 오류 원인을 기록했으며, 관리자 확인이 필요합니다.",
    message,
    stage,
  };
}

function extractBalancedJSONObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return text.slice(start, index + 1);
    }
  }

  return null;
}

function parseStructuredResponse<T>(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const stripped = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const extracted = extractBalancedJSONObject(stripped);
    if (!extracted) return null;
    try {
      return JSON.parse(extracted) as T;
    } catch {
      return null;
    }
  }
}

function parseJsonStringLiteral(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
  }
}

function parseLooseTranscriptResponse(text: string): TranscriptPayload | null {
  const transcript: NonNullable<TranscriptPayload["transcript"]> = [];
  const objectMatches = text.match(/\{[\s\S]*?\}/g) || [];

  for (const objectText of objectMatches) {
    if (!/"text"\s*:/.test(objectText)) continue;
    const textMatch = objectText.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (!textMatch) continue;

    const speakerMatch = objectText.match(/"speaker"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const startMatch = objectText.match(/"start"\s*:\s*(-?\d+(?:\.\d+)?)/);
    const endMatch = objectText.match(/"end"\s*:\s*(-?\d+(?:\.\d+)?)/);
    const utterance = parseJsonStringLiteral(textMatch[1]);
    if (!utterance.trim()) continue;

    transcript.push({
      id: `seg-${transcript.length + 1}`,
      speaker: speakerMatch ? parseJsonStringLiteral(speakerMatch[1]) : "화자 미분류",
      text: utterance,
      ...(startMatch ? { start: Number(startMatch[1]) } : {}),
      ...(endMatch ? { end: Number(endMatch[1]) } : {}),
    });
  }

  return transcript.length > 0 ? { transcript } : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeTranscriptSegments(
  transcript?: TranscriptPayload["transcript"],
  options: { keepTiming?: boolean } = { keepTiming: true }
) {
  return (transcript || [])
    .map((item, index) => {
      const start = options.keepTiming !== false && typeof item.start === "number"
        ? item.start
        : options.keepTiming !== false && typeof item.startTime === "number"
          ? item.startTime
          : undefined;
      const end = options.keepTiming !== false && typeof item.end === "number"
        ? item.end
        : options.keepTiming !== false && typeof item.endTime === "number"
          ? item.endTime
          : undefined;

      return {
        id: item.id || `seg-${index + 1}`,
        speaker: item.speaker || "화자 미분류",
        text: item.text || "",
        ...(typeof start === "number" ? { start } : {}),
        ...(typeof end === "number" ? { end } : {}),
      };
    })
    .filter(item => item.text.trim());
}

function compactText(value?: string) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isGenericUnknown(value?: string) {
  const text = compactText(value).toLowerCase();
  return !text || ["미정", "미확인", "없음", "unknown", "n/a", "-"].includes(text);
}

function appearsInTranscript(value: string | undefined, transcript: TranscriptPayload["transcript"]) {
  const text = compactText(value);
  if (!text || text.length < 2) return false;
  const source = compactText((transcript || []).map(item => item.text || "").join(" "));
  return source.includes(text);
}

function normalizeSummaryPayload(summaryData: SummaryPayload | Record<string, unknown>, transcript: TranscriptPayload["transcript"]): SummaryPayload {
  const summarySource = summaryData && typeof summaryData === "object" && "summary" in summaryData
    ? (summaryData as { summary?: Record<string, unknown> }).summary || {}
    : summaryData || {};
  const summary = summarySource as Record<string, unknown>;
  const schedule = Array.isArray(summary.schedule)
    ? summary.schedule
      .map(item => ({
        task: compactText((item as { task?: string })?.task),
        assignee: appearsInTranscript((item as { assignee?: string })?.assignee, transcript) && !isGenericUnknown((item as { assignee?: string })?.assignee) ? compactText((item as { assignee?: string })?.assignee) : "",
        dueDate: appearsInTranscript((item as { dueDate?: string })?.dueDate, transcript) && !isGenericUnknown((item as { dueDate?: string })?.dueDate) ? compactText((item as { dueDate?: string })?.dueDate) : "",
      }))
      .filter(item => item.task)
    : [];

  return {
    summary: {
      topic: compactText((summary.topic as string) || (summary.title as string) || (summary.mainTopic as string) || (summary.keyDiscussion as string)),
      asis: compactText(summary.asis as string),
      tobe: compactText(summary.tobe as string),
      expected_effects: compactText(summary.expected_effects as string),
      schedule,
    },
  };
}

function normalizeTranscriptPayload(transcriptData: TranscriptPayload | Record<string, unknown> | null, keepTiming = true): TranscriptPayload {
  const rawTranscript = transcriptData && typeof transcriptData === "object" && "transcript" in transcriptData
    ? (transcriptData as { transcript?: TranscriptPayload["transcript"] }).transcript
    : Array.isArray(transcriptData)
      ? transcriptData as TranscriptPayload["transcript"]
      : [];
  return {
    transcript: normalizeTranscriptSegments(rawTranscript, { keepTiming }),
  };
}

function toTranscriptRequest(fileUri: string, mimeType: string, prompt: string) {
  return [{
    role: "user",
    parts: [
      { fileData: { fileUri, mimeType } },
      { text: prompt },
    ],
  }];
}

function toSummaryRequest(prompt: string) {
  return [{
    role: "user",
    parts: [{ text: prompt }],
  }];
}

function summarizePromptFromTranscript(transcript: TranscriptPayload["transcript"]) {
  return `
아래 transcript에 명시적으로 등장하는 내용만 근거로 회의를 요약하세요.

[중요 지침]
1. transcript에 없는 사실은 절대 생성하지 마세요.
2. 담당자, 일정, 문제점, 기대효과, 결정사항을 추측하지 마세요.
3. 파일명, 업로드 시간, 녹음 시간만으로 회의 주제를 만들지 마세요.
4. 근거가 부족한 필드는 빈 문자열("") 또는 빈 배열([])로 반환하세요.
5. 회의 내용이 부족하면 모든 필드를 빈 값으로 반환하세요.
6. topic은 간략하고 명료하게 작성하세요. 읽는 사람이 회의 주제를 즉시 알 수 있어야 합니다.
7. topic은 줄임말이나 말줄임표로 끝내지 말고 완전한 단어로 끝내세요.
8. topic 끝에 "관련 회의", "개선회의", "미팅", "검토 회의" 같은 포괄적인 회의 유형 표현을 붙이지 마세요.

transcript:
${JSON.stringify(transcript || [])}

{
  "summary": {
    "topic": "회의 주제. transcript에 있는 내용만 기반으로 간략하고 명료하게 작성. 근거가 부족하면 빈 문자열.",
    "asis": "현재 상황과 직면한 문제점. transcript에 있는 내용만 작성.",
    "tobe": "개선 방향과 목적. transcript에 있는 내용만 작성.",
    "expected_effects": "기대효과. transcript에 있는 내용만 작성.",
    "schedule": [
      { "task": "할 일", "assignee": "담당자", "dueDate": "기한" }
    ]
  }
}
`;
}

async function transcribeWithOpenAI(uploadPath: string, mimeType: string, fileName: string) {
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const audioBuffer = await readFile(uploadPath);
  const audioFile = new File([audioBuffer], fileName, { type: mimeType });
  const formData = new FormData();
  formData.append("model", OPENAI_TRANSCRIPTION_MODEL);
  formData.append("file", audioFile);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  const response = await withTimeout(fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIKey}`,
    },
    body: formData,
  }), "openai:transcription", OPENAI_STEP_TIMEOUT_MS);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OPENAI_TRANSCRIPTION_FAILED:${response.status}:${text.slice(0, 300)}`);
  }

  const data = await response.json().catch(() => null) as {
    text?: string;
    segments?: Array<{ id?: number; start?: number; end?: number; text?: string }>;
  } | null;

  const transcript = Array.isArray(data?.segments)
    ? data.segments.map((segment, index) => ({
      id: `seg-${index + 1}`,
      speaker: "화자 미분류",
      text: segment.text || "",
      ...(typeof segment.start === "number" ? { start: segment.start } : {}),
      ...(typeof segment.end === "number" ? { end: segment.end } : {}),
    })).filter(item => item.text.trim())
    : (data?.text ? [{
      id: "seg-1",
      speaker: "화자 미분류",
      text: data.text,
    }] : []);

  const validation = validateAnalyzableContent(transcript);
  if (!validation.isAnalyzable) {
    throw new Error(`INSUFFICIENT_MEETING_CONTENT:${validation.message}`);
  }

  const summaryPrompt = summarizePromptFromTranscript(transcript);
  let summaryData: SummaryPayload | null = null;
  let lastSummaryError: unknown = null;

  for (const modelName of [OPENAI_SUMMARY_MODEL, OPENAI_SUMMARY_FALLBACK_MODEL]) {
    try {
      const summaryResponse = await withTimeout(fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0.1,
          max_completion_tokens: 1200,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: summaryPrompt,
            },
          ],
        }),
      }), `openai:summary:${modelName}`, OPENAI_STEP_TIMEOUT_MS);

      if (!summaryResponse.ok) {
        const text = await summaryResponse.text().catch(() => "");
        throw new Error(`OPENAI_SUMMARY_FAILED:${modelName}:${summaryResponse.status}:${text.slice(0, 300)}`);
      }

      const summaryJson = await summaryResponse.json().catch(() => null) as {
        choices?: Array<{ message?: { content?: string } }>;
      } | null;

      const summaryText = summaryJson?.choices?.[0]?.message?.content || "";
      summaryData = parseStructuredResponse<SummaryResponseSchema>(summaryText) as SummaryPayload | null;
      if (summaryData) {
        return {
          summaryData: normalizeSummaryPayload(summaryData, transcript),
          transcriptData: { transcript },
          usedModel: `openai:${modelName}`,
        };
      }

      lastSummaryError = new Error(`PARSE_FAILED: openai-summary:${modelName}`);
    } catch (error) {
      lastSummaryError = error;
    }
  }

  throw lastSummaryError instanceof Error ? lastSummaryError : new Error("PARSE_FAILED: openai-summary");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return createAnalysisErrorResponse(
        400,
        "INVALID_REQUEST",
        "분석할 오디오 파일이 없습니다.",
        "분석할 파일이 없습니다.",
        "request"
      );
    }

    if (!apiKey && !openAIKey) {
      return createAnalysisErrorResponse(
        500,
        "CONFIG_ERROR",
        "GEMINI_API_KEY 또는 OPENAI_API_KEY가 설정되지 않았습니다.",
        "분석 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
        "config"
      );
    }

    const mimeType = resolveUploadMimeType(file);
    if (!mimeType) {
      return createAnalysisErrorResponse(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "파일 형식을 확인할 수 없습니다.",
        "지원하지 않는 파일 형식입니다. mp3, wav, m4a, mp4 등 지원 형식의 파일을 업로드해주세요.",
        "request"
      );
    }

    // Save file to public/uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length < 1024) {
      return createAnalysisErrorResponse(
        422,
        "INSUFFICIENT_MEETING_CONTENT",
        "분석 가능한 회의 내용이 부족합니다.",
        "분석 가능한 회의 내용이 부족합니다.",
        "request"
      );
    }

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    
    const uploadPath = join(uploadDir, fileName);
    await writeFile(uploadPath, buffer);
    const audioUrl = `/uploads/${fileName}`;

    let openAIPrimaryError: unknown = null;
    if (openAIKey) {
      try {
        const openAIResult = await transcribeWithOpenAI(uploadPath, mimeType, fileName);
        return NextResponse.json({
          ...openAIResult.summaryData,
          transcript: openAIResult.transcriptData.transcript,
          audioUrl,
          usedModel: openAIResult.usedModel
        });
      } catch (error: unknown) {
        openAIPrimaryError = error;
        console.warn("OpenAI primary path failed, trying Gemini...", getErrorMessage(error));
      }
    }

    if (!apiKey) {
      const classified = classifyUnknownError(openAIPrimaryError || new Error("OPENAI_ANALYSIS_FAILED"), "transcription");
      return createAnalysisErrorResponse(
        classified.status,
        classified.errorCode,
        classified.message,
        classified.userMessage,
        classified.stage,
        openAIPrimaryError
      );
    }

    // Upload to Gemini
    let uploadResult;
    try {
      uploadResult = await withTimeout(fileManager.uploadFile(uploadPath, {
        mimeType,
        displayName: fileName,
      }), "upload");
    } catch (error) {
      const classified = classifyUnknownError(error, "upload");
      return createAnalysisErrorResponse(
        classified.status,
        classified.errorCode,
        classified.message,
        classified.userMessage,
        classified.stage,
        error
      );
    }

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    let lastError: unknown = null;
    let successfulModel = "";
    let summaryData: SummaryPayload | null = null;
    let transcriptData: TranscriptPayload | null = null;

    // 시도할 모델 우선순위 목록
    const modelsToTry = [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, safetySettings });
        
        // --- STEP 1: TRANSCRIPT PASS ---
        const transcriptPrompt = `
오디오의 전체 대화 내역(transcript)을 다음 JSON 형식으로 변환해주세요.
한국어 회의 음성을 우선 가정하고, 들리지 않는 단어는 억지로 보정하지 마세요.
실제로 들리는 말만 적고, 파일명/업로드 시간/녹음 시간 같은 메타데이터는 사용하지 마세요.
대화가 전혀 들리지 않거나 무음, 잡음, 짧은 테스트 음성뿐이라면 "transcript": [] 를 반환하세요.
제공된 오디오에 없는 대화, 담당자, 주제, 업무 내용은 절대 만들지 마세요.
정확한 timestamp를 제공할 수 없으면 start/end를 넣지 마세요. 추정 timestamp는 금지합니다.

{
  "transcript": [
    { "id": "seg-1", "speaker": "성함 또는 참가자 A", "text": "대화 내용" }
  ]
}
`;
        let tResult;
        try {
          tResult = await withTimeout(model.generateContent({
            contents: toTranscriptRequest(uploadResult.file.uri, uploadResult.file.mimeType, transcriptPrompt),
            generationConfig: buildStructuredGenerationConfig(transcriptResponseSchema),
          }), `transcription:${modelName}`, GEMINI_STEP_TIMEOUT_MS);
        } catch (error) {
          lastError = error;
          throw error;
        }
        const transcriptText = tResult.response.text();
        const parsedTranscript = (
          parseStructuredResponse<TranscriptResponseSchema>(transcriptText) ||
          parseLooseTranscriptResponse(transcriptText)
        ) as TranscriptPayload | null;
        if (!parsedTranscript) {
          console.warn(`Transcript parse failed for ${modelName}, trying OpenAI fallback...`, transcriptText.slice(0, 200));
          if (openAIKey) {
            try {
              const fallbackResult = await transcribeWithOpenAI(uploadPath, mimeType, fileName);
              return NextResponse.json({
                ...fallbackResult.summaryData,
                transcript: fallbackResult.transcriptData.transcript,
                audioUrl,
                usedModel: fallbackResult.usedModel
              });
            } catch (fallbackError: unknown) {
              lastError = fallbackError;
              console.warn("OpenAI transcript fallback failed after Gemini parse miss", getErrorMessage(fallbackError));
            }
          }
          lastError = new Error(`PARSE_FAILED: transcript:${modelName}`);
          continue;
        }
        transcriptData = normalizeTranscriptPayload(parsedTranscript, false);
        const normalizedTranscript = transcriptData.transcript;
        const validation = validateAnalyzableContent(normalizedTranscript);
        if (!validation.isAnalyzable) {
          return createAnalysisErrorResponse(
            422,
            "INSUFFICIENT_MEETING_CONTENT",
            validation.message,
            sourceMessageForInsufficientContent(validation.message),
            "transcription"
          );
        }

        // --- STEP 2: SUMMARY PASS ---
        const summaryPrompt = summarizePromptFromTranscript(transcriptData?.transcript || []);
        let sResult;
        try {
          sResult = await withTimeout(model.generateContent({
            contents: toSummaryRequest(summaryPrompt),
            generationConfig: buildStructuredGenerationConfig(summaryResponseSchema),
          }), `summary:${modelName}`, GEMINI_STEP_TIMEOUT_MS);
        } catch (error) {
          lastError = error;
          throw error;
        }
        const parsedSummary = parseStructuredResponse<SummaryResponseSchema>(sResult.response.text()) as SummaryPayload | null;
        if (!parsedSummary) {
          lastError = new Error(`PARSE_FAILED: summary:${modelName}`);
          continue;
        }
        summaryData = normalizeSummaryPayload(parsedSummary, transcriptData.transcript);
        
        successfulModel = modelName;
        break; // 성공 시 루프 탈출
      } catch (err: unknown) {
        lastError = err;
        console.warn(`Model ${modelName} failed, trying next...`, getErrorMessage(err));
        continue;
      }
    }

    if (!summaryData) {
      const errMsg = getErrorMessage(lastError);
      if (errMsg.includes("429")) {
        return createAnalysisErrorResponse(
          429,
          "AI_ANALYSIS_FAILED",
          errMsg,
          "현재 AI 사용량이 많아 잠시 후 다시 시도해주세요. (할당량 초과)",
          "summary",
          lastError
        );
      }
      if (errMsg.includes("503")) {
        return createAnalysisErrorResponse(
          503,
          "TIMEOUT",
          errMsg,
          "분석 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
          "summary",
          lastError
        );
      }
      const classified = classifyUnknownError(lastError, transcriptData ? "summary" : "transcription");
      return createAnalysisErrorResponse(
        classified.status,
        classified.errorCode,
        classified.message,
        classified.userMessage,
        classified.stage,
        lastError
      );
    }

    return NextResponse.json({
      summary: normalizeSummaryPayload(summaryData, transcriptData?.transcript || []).summary,
      transcript: transcriptData?.transcript || [],
      audioUrl,
      usedModel: successfulModel // 어떤 모델이 사용되었는지 반환
    });

  } catch (error: unknown) {
    const classified = classifyUnknownError(error);
    return createAnalysisErrorResponse(
      classified.status,
      classified.errorCode,
      classified.message,
      classified.userMessage,
      classified.stage,
      error
    );
  }
}

function sourceMessageForInsufficientContent(message: string) {
  if (message.includes("더 긴 음성") || message.includes("명확한 대화")) {
    return "녹음된 내용이 부족해 회의록을 생성할 수 없습니다. 회의 분석을 위해 더 충분한 대화 내용을 녹음해주세요.";
  }
  return message;
}
