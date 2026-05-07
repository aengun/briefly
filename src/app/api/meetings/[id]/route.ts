import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { normalizeMeetingRecordInput, type MeetingRecordInput } from '@/lib/meeting-record';

export const runtime = 'nodejs';

type MeetingApiStage = "request" | "normalize" | "save" | "read";
type MeetingApiErrorCode = "SAVE_FAILED" | "STORAGE_UNAVAILABLE" | "UNKNOWN_ERROR";

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
  console.error("[meeting]", { debugId, status, errorCode, message, stage, details });
  return NextResponse.json({
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

  return {
    status: 500,
    errorCode: "SAVE_FAILED" as const,
    userMessage: "회의록 저장에 실패했습니다. 저장소 또는 서버 연결 상태를 확인해주세요.",
    message,
    stage,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        participants: true,
        transcript: true,
        schedule: true
      }
    });

    if (!meeting) {
      return NextResponse.json({ error: "회의록을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      ...meeting,
      summary: {
        asis: meeting.asis,
        tobe: meeting.tobe,
        expected_effects: meeting.expected_effects,
        schedule: meeting.schedule
      }
    });
  } catch (error: unknown) {
    return createMeetingErrorResponse(
      500,
      "UNKNOWN_ERROR",
      getErrorMessage(error),
      "회의록을 불러오지 못했습니다.",
      "read",
      error
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json() as MeetingRecordInput;
    const normalized = normalizeMeetingRecordInput(body);

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        title: normalized.title,
        sourceType: normalized.sourceType,
        meetingDate: normalized.meetingDate,
        audioUrl: normalized.audioUrl,
        asis: normalized.summary.asis,
        tobe: normalized.summary.tobe,
        expected_effects: normalized.summary.expected_effects,
        participants: {
          deleteMany: {},
          create: normalized.participants
        },
        transcript: {
          deleteMany: {},
          create: normalized.transcript
        },
        schedule: {
          deleteMany: {},
          create: normalized.summary.schedule
        }
      },
      include: {
        participants: true,
        transcript: true,
        schedule: true
      }
    });

    return NextResponse.json({
      success: true,
      meeting: {
        ...meeting,
        summary: {
          asis: meeting.asis,
          tobe: meeting.tobe,
          expected_effects: meeting.expected_effects,
          schedule: meeting.schedule
        }
      }
    });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    await prisma.meeting.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return createMeetingErrorResponse(
      500,
      "UNKNOWN_ERROR",
      getErrorMessage(error),
      "회의록 삭제에 실패했습니다.",
      "save",
      error
    );
  }
}
