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

    // Using gemini-flash-latest (Stable 1.5)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest', 
      safetySettings
    });

    // --- STEP 1: SUMMARY PASS ---
    const summaryPrompt = `
이 오디오는 회의 녹음 파일입니다. 다음 구조의 JSON 형식으로 회의를 요약해주세요. 
반드시 올바른 JSON 형식으로 시작하고 끝내주세요. 다른 서설은 생략하세요.

[규칙]
1. 각 항목(asis, tobe, expected_effects)의 내용 앞에는 "1.", "2."와 같은 번호를 절대 붙이지 마세요.
2. 각 항목 내에서 중요한 포인트가 여러 개일 경우, 반드시 줄바꿈(\\n)으로 구분하여 작성하세요.
3. 한 문단에 모든 내용을 넣지 말고, 가독성을 위해 리스트 형태로 내용을 나누어 작성하세요.

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

    const summaryResult = await model.generateContent([
      { fileData: { fileUri: uploadResult.file.uri, mimeType: uploadResult.file.mimeType } },
      summaryPrompt,
    ]);

    const summaryText = summaryResult.response.text();
    const summaryData = extractJSON(summaryText);
    
    if (!summaryData) {
      console.error('Final attempt summary text:', summaryText);
      throw new Error("요약 데이터 추출에 실패했습니다. (AI 응답 불완전)");
    }

    // --- STEP 2: TRANSCRIPT PASS ---
    const transcriptPrompt = `
오디오의 전체 대화 내역(transcript)을 다음 JSON 형식으로 변환해주세요.
반드시 JSON 형식만 출력하세요. 다른 말은 하지 마세요.

{
  "transcript": [
    { "speaker": "성함 또는 참가자 A", "text": "대화 내용" }
  ]
}
`;

    const transcriptResult = await model.generateContent([
      { fileData: { fileUri: uploadResult.file.uri, mimeType: uploadResult.file.mimeType } },
      transcriptPrompt,
    ]);

    const transcriptText = transcriptResult.response.text();
    let transcriptData = extractJSON(transcriptText);
    
    if (!transcriptData) {
      console.error('Final attempt transcript text:', transcriptText);
      transcriptData = { transcript: [] }; // Fallback
    }

    // --- COMBINE AND RETURN ---
    return NextResponse.json({
      ...summaryData,
      ...transcriptData,
      audioUrl
    });

  } catch (error: any) {
    console.error('Error during summarization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
