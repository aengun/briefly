import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { validateAnalyzableContent } from '@/lib/analysis-guard';

type SummaryPayload = {
  summary?: {
    asis?: string;
    tobe?: string;
    expected_effects?: string;
    schedule?: Array<{ task?: string; assignee?: string; dueDate?: string }>;
  };
};

type TranscriptPayload = {
  transcript?: Array<{ speaker?: string; text?: string }>;
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
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

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
  if (providedType) return providedType;

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".webm")) return "audio/webm";
  if (lowerName.endsWith(".wav")) return "audio/wav";
  if (lowerName.endsWith(".m4a")) return "audio/mp4";
  if (lowerName.endsWith(".mp4")) return "video/mp4";
  if (lowerName.endsWith(".mp3")) return "audio/mpeg";
  if (lowerName.endsWith(".aac")) return "audio/aac";
  return "";
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
      userMessage: "회의록 분석 결과를 해석하지 못했습니다. 잠시 후 다시 시도해주세요.",
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

// Robust JSON extraction helper
function extractJSON(text: string): unknown {
  try {
    // Try finding JSON block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    
    // Basic cleanup of common AI artifacts in JSON
    const jsonStr = match[0]
      .replace(/\\n/g, "\\n")
      .replace(/\\'/g, "'");
      
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse extracted JSON:', e);
    return null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

    if (!apiKey) {
      return createAnalysisErrorResponse(
        500,
        "CONFIG_ERROR",
        "GEMINI_API_KEY가 설정되지 않았습니다.",
        "분석 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
        "config"
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
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    
    const uploadPath = join(uploadDir, fileName);
    await writeFile(uploadPath, buffer);
    const audioUrl = `/uploads/${fileName}`;

    // Upload to Gemini
    let uploadResult;
    try {
      uploadResult = await fileManager.uploadFile(uploadPath, {
        mimeType,
        displayName: fileName,
      });
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

    // 시도할 모델 우선순위 목록
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];

    let lastError: unknown = null;
    let successfulModel = "";
    let summaryData: SummaryPayload | null = null;
    let transcriptData: TranscriptPayload | null = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, safetySettings });
        
        // --- STEP 1: TRANSCRIPT PASS ---
        const transcriptPrompt = `
오디오의 전체 대화 내역(transcript)을 다음 JSON 형식으로 변환해주세요.
실제로 들리는 말만 적고, 파일명/업로드 시간/녹음 시간 같은 메타데이터는 사용하지 마세요.
대화가 전혀 들리지 않거나 무음, 잡음, 짧은 테스트 음성뿐이라면 "transcript": [] 를 반환하세요.
제공된 오디오에 없는 대화, 담당자, 주제, 업무 내용은 절대 만들지 마세요.

{
  "transcript": [
    { "speaker": "성함 또는 참가자 A", "text": "대화 내용" }
  ]
}
`;
        let tResult;
        try {
          tResult = await model.generateContent([
            { fileData: { fileUri: uploadResult.file.uri, mimeType: uploadResult.file.mimeType } },
            transcriptPrompt,
          ]);
        } catch (error) {
          lastError = error;
          throw error;
        }
        transcriptData = extractJSON(tResult.response.text()) as TranscriptPayload | null;
        if (!transcriptData) {
          lastError = new Error("PARSE_FAILED: transcript");
          continue;
        }
        const validation = validateAnalyzableContent(transcriptData?.transcript || []);
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
        const summaryPrompt = `
아래 transcript에 명시적으로 등장하는 내용만 근거로 회의를 요약하세요.

[중요 지침]
1. transcript에 없는 사실은 절대 생성하지 마세요.
2. 담당자, 일정, 문제점, 기대효과, 결정사항을 추측하지 마세요.
3. 파일명, 업로드 시간, 녹음 시간만으로 회의 주제를 만들지 마세요.
4. 근거가 부족한 필드는 빈 문자열("") 또는 빈 배열([])로 반환하세요.
5. 회의 내용이 부족하면 모든 필드를 빈 값으로 반환하세요.

transcript:
${JSON.stringify(transcriptData?.transcript || [], null, 2)}

{
  "summary": {
    "asis": "현재 상황과 직면한 문제점. transcript에 있는 내용만 작성.",
    "tobe": "개선 방향과 목적. transcript에 있는 내용만 작성.",
    "expected_effects": "기대효과. transcript에 있는 내용만 작성.",
    "schedule": [
      { "task": "할 일", "assignee": "담당자", "dueDate": "기한" }
    ]
  }
}
`;
        let sResult;
        try {
          sResult = await model.generateContent(summaryPrompt);
        } catch (error) {
          lastError = error;
          throw error;
        }
        summaryData = extractJSON(sResult.response.text()) as SummaryPayload | null;
        if (!summaryData) {
          lastError = new Error("PARSE_FAILED: summary");
          continue;
        }
        
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
      ...summaryData,
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
