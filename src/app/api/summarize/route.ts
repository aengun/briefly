import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';
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

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

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
      return NextResponse.json({ error: '분석할 오디오 파일이 없습니다.' }, { status: 400 });
    }

    // Save file to public/uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length < 1024) {
      return NextResponse.json({
        error: "분석 가능한 회의 내용이 부족합니다.",
        code: "INSUFFICIENT_MEETING_CONTENT",
      }, { status: 422 });
    }

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    
    const uploadPath = join(uploadDir, fileName);
    await writeFile(uploadPath, buffer);
    const audioUrl = `/uploads/${fileName}`;

    // Upload to Gemini
    const uploadResult = await fileManager.uploadFile(uploadPath, {
      mimeType: file.type || 'audio/mpeg',
      displayName: fileName,
    });

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // 시도할 모델 우선순위 목록
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-pro-latest',
      'gemini-flash-latest',
      'gemini-1.5-flash'
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
        const tResult = await model.generateContent([
          { fileData: { fileUri: uploadResult.file.uri, mimeType: uploadResult.file.mimeType } },
          transcriptPrompt,
        ]);
        transcriptData = extractJSON(tResult.response.text()) as TranscriptPayload | null;
        const validation = validateAnalyzableContent(transcriptData?.transcript || []);
        if (!validation.isAnalyzable) {
          return NextResponse.json({
            error: validation.message,
            code: "INSUFFICIENT_MEETING_CONTENT",
            transcript: transcriptData?.transcript || [],
            audioUrl,
          }, { status: 422 });
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
        const sResult = await model.generateContent(summaryPrompt);
        summaryData = extractJSON(sResult.response.text()) as SummaryPayload | null;
        if (!summaryData) continue;
        
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
      if (errMsg.includes("429")) return NextResponse.json({ error: "현재 AI 사용량이 많아 잠시 후 다시 시도해주세요. (할당량 초과)" }, { status: 429 });
      if (errMsg.includes("503")) return NextResponse.json({ error: "분석 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
      return NextResponse.json({ error: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }

    return NextResponse.json({
      ...summaryData,
      transcript: transcriptData?.transcript || [],
      audioUrl,
      usedModel: successfulModel // 어떤 모델이 사용되었는지 반환
    });

  } catch (error: unknown) {
    console.error('Error during summarization:', error);
    return NextResponse.json({ error: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
