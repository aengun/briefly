import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { normalizeMeetingRecordInput, type MeetingRecordInput } from '@/lib/meeting-record';

export const runtime = 'nodejs';

type MeetingApiErrorCode =
  | "SAVE_FAILED"
  | "STORAGE_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "UNKNOWN_ERROR";

type MeetingApiStage = "request" | "normalize" | "save" | "read";

type MeetingApiErrorBody = {
  success: false;
  errorCode: MeetingApiErrorCode;
  message: string;
  userMessage: string;
  debugId: string;
  stage: MeetingApiStage;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createMeetingErrorResponse(
  status: number,
  errorCode: MeetingApiErrorCode,
  message: string,
  userMessage: string,
  stage: MeetingApiStage,
  details?: unknown
) {
  const debugId = randomUUID();
  console.error("[meetings]", { debugId, status, errorCode, message, stage, details });
  return NextResponse.json<MeetingApiErrorBody>({
    success: false,
    errorCode,
    message,
    userMessage,
    debugId,
    stage,
  }, { status });
}

function classifyMeetingError(error: unknown, stage: MeetingApiStage = "save") {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("no such column") ||
    (lower.includes("column") && lower.includes("does not exist")) ||
    (lower.includes("prisma client") && lower.includes("generated"))
  ) {
    return {
      status: 500,
      errorCode: "STORAGE_UNAVAILABLE" as const,
      userMessage: "회의록 저장소 구조가 최신 코드와 맞지 않습니다. 서버를 재시작한 뒤 다시 시도해주세요.",
      message,
      stage,
    };
  }

  if (lower.includes("json") || lower.includes("invalid")) {
    return {
      status: 400,
      errorCode: "INVALID_REQUEST" as const,
      userMessage: "회의록 저장 데이터 형식이 올바르지 않습니다. 분석을 다시 실행해주세요.",
      message,
      stage,
    };
  }

  return {
    status: 500,
    errorCode: "SAVE_FAILED" as const,
    userMessage: "회의록 저장에 실패했습니다. 저장소 또는 서버 연결 상태를 확인해주세요.",
    message,
    stage,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const meetings = await prisma.meeting.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        participants: true,
        transcript: true,
        schedule: true,
      }
    });

    const formatted = meetings.map(m => ({
      ...m,
      summary: {
        asis: m.asis,
        tobe: m.tobe,
        expected_effects: m.expected_effects,
        schedule: m.schedule
      }
    }));

    return NextResponse.json(formatted);
  } catch (error: unknown) {
    return createMeetingErrorResponse(
      500,
      "UNKNOWN_ERROR",
      getErrorMessage(error),
      "회의록 목록을 불러오지 못했습니다.",
      "read",
      error
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as MeetingRecordInput;
    const normalized = normalizeMeetingRecordInput(body);

    const meeting = await prisma.meeting.create({
      data: {
        title: normalized.title,
        sourceType: normalized.sourceType,
        audioUrl: normalized.audioUrl,
        asis: normalized.summary.asis,
        tobe: normalized.summary.tobe,
        expected_effects: normalized.summary.expected_effects,
        meetingDate: normalized.meetingDate,
        participants: {
          create: normalized.participants
        },
        transcript: {
          create: normalized.transcript
        },
        schedule: {
          create: normalized.summary.schedule
        }
      },
      include: {
        participants: true,
        transcript: true,
        schedule: true
      }
    });

    return NextResponse.json({ success: true, meeting });
  } catch (error: unknown) {
    const classified = classifyMeetingError(error, "save");
    return createMeetingErrorResponse(
      classified.status,
      classified.errorCode,
      classified.message,
      classified.userMessage,
      classified.stage,
      error
    );
  }
}
