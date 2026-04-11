import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Save file to temp dir
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tmpPath = join(tmpdir(), file.name);
    await writeFile(tmpPath, buffer);

    // Upload to Gemini
    const uploadResult = await fileManager.uploadFile(tmpPath, {
      mimeType: file.type || 'audio/mpeg',
      displayName: file.name,
    });

    // Generate content
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
이 오디오는 회의 녹음 파일입니다. 다음 요청사항에 맞게 분석해주세요:
1. 먼저 오디오의 내용을 전체적으로 파악하여 텍스트로 변환(STT)해주세요.
2. 변환된 내용을 바탕으로 다음 포맷의 JSON으로 요약해주세요. 응답은 오직 올바른 JSON 포맷이어야 합니다.

요청 JSON 구조:
{
  "transcript": "회의 전체 내용 원본 텍스트...",
  "summary": {
    "asis": "현재 상황 (As-is)에 대한 요약",
    "tobe": "목표 또는 개선 후 상황 (To-be)에 대한 요약",
    "expected_effects": "기대 효과",
    "schedule": [
      {
        "task": "할 일",
        "assignee": "담당자 (알 수 없으면 미정)",
        "dueDate": "기한 (알 수 없으면 미정 내지 날짜)"
      }
    ]
  }
}
`;

    const result = await model.generateContent([
      {
        fileData: {
          fileUri: uploadResult.file.uri,
          mimeType: uploadResult.file.mimeType,
        },
      },
      prompt,
    ]);

    const text = result.response.text();
    // parse JSON from text (in case it includes markdown code blocks)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('\`\`\`json')) {
      jsonStr = jsonStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    } else if (jsonStr.startsWith('\`\`\`')) {
      jsonStr = jsonStr.replace(/\`\`\`/g, '').trim();
    }

    const parsed = JSON.parse(jsonStr);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Error during summarization:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
