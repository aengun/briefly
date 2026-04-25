import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// Robust JSON extraction helper
function extractJSON(text: string): any {
  try {
    // Try finding JSON block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    
    // Basic cleanup of common AI artifacts in JSON
    let jsonStr = match[0]
      .replace(/\\n/g, "\\n")
      .replace(/\\'/g, "'");
      
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse extracted JSON:', e);
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Save file to public/uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
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

    let lastError = null;
    let successfulModel = "";
    let summaryData = null;
    let transcriptData = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, safetySettings });
        
        // --- STEP 1: SUMMARY PASS ---
        const summaryPrompt = `
이 오디오는 회의 녹음 파일입니다. 다음 구조의 JSON 형식으로 회의를 요약해주세요. 

[중요 지침]
1. 만약 오디오에 의미 있는 대화가 없거나, 소음/바람 소리만 들린다면 모든 필드를 빈 문자열("") 또는 빈 배열([])로 반환하세요. 절대 내용을 지어내지 마세요.
2. 대화가 식별될 때만 아래 형식을 작성하세요.

{
  "summary": {
    "asis": "현재 상황과 직면한 문제점들을 줄바꿈으로 구분하여 요약",
    "tobe": "회의를 통해 도출된 개선 방향과 최종 목적을 줄바꿈으로 구분하여 요약",
    "expected_effects": "개선안 적용 시 예상되는 긍정적인 효과들을 줄바꿈으로 구분하여 요약",
    "schedule": [
      { "task": "할 일", "assignee": "담당자", "dueDate": "기한" }
    ]
  }
}
`;
        const sResult = await model.generateContent([
          { fileData: { fileUri: uploadResult.file.uri, mimeType: uploadResult.file.mimeType } },
          summaryPrompt,
        ]);
        summaryData = extractJSON(sResult.response.text());
        if (!summaryData) continue;

        // --- STEP 2: TRANSCRIPT PASS ---
        const transcriptPrompt = `
오디오의 전체 대화 내역(transcript)을 다음 JSON 형식으로 변환해주세요.
만약 대화가 전혀 들리지 않는다면 "transcript": [] 와 같이 빈 배열을 반환하세요. 절대 허구의 대화를 만들지 마세요.

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
        transcriptData = extractJSON(tResult.response.text());
        
        successfulModel = modelName;
        break; // 성공 시 루프 탈출
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed, trying next...`, err.message);
        continue;
      }
    }

    if (!summaryData) {
      const errMsg = lastError?.message || "";
      if (errMsg.includes("429")) return NextResponse.json({ error: "현재 AI 사용량이 많아 잠시 후 다시 시도해주세요. (할당량 초과)" }, { status: 429 });
      if (errMsg.includes("503")) return NextResponse.json({ error: "AI 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요." }, { status: 503 });
      return NextResponse.json({ error: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }

    return NextResponse.json({
      ...summaryData,
      transcript: transcriptData?.transcript || [],
      audioUrl,
      usedModel: successfulModel // 어떤 모델이 사용되었는지 반환
    });

  } catch (error: any) {
    console.error('Error during summarization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
