import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

type MeetingParticipantInput = {
  team: string;
  name: string;
};

type MeetingTranscriptInput = {
  speaker: string;
  text: string;
};

type MeetingScheduleInput = {
  task: string;
  assignee: string;
  dueDate: string;
};

type MeetingSourceType = "upload" | "realtime";

type CreateMeetingBody = {
  title?: string;
  sourceType?: string;
  audioUrl?: string;
  meetingDate?: string;
  participants?: MeetingParticipantInput[];
  transcript?: MeetingTranscriptInput[];
  summary?: {
    asis?: string;
    tobe?: string;
    expected_effects?: string;
    schedule?: MeetingScheduleInput[];
  };
};

const normalizeSourceType = (value?: string): MeetingSourceType => (
  value === "realtime" ? "realtime" : "upload"
);

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
    console.error('GET /api/meetings error:', error);
    return NextResponse.json({ error: "회의록 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as CreateMeetingBody;

    // Validate meetingDate
    let mDate = new Date();
    if (body.meetingDate) {
      const parsed = new Date(body.meetingDate);
      if (!isNaN(parsed.getTime())) {
        mDate = parsed;
      }
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: body.title?.trim() || "제목 없는 회의록",
        sourceType: normalizeSourceType(body.sourceType),
        audioUrl: body.audioUrl || "",
        asis: body.summary?.asis || "",
        tobe: body.summary?.tobe || "",
        expected_effects: body.summary?.expected_effects || "",
        meetingDate: mDate,
        participants: {
          create: body.participants?.map((p) => ({
            team: p.team || "미지정",
            name: p.name || "이름 없음"
          })) || []
        },
        transcript: {
          create: body.transcript?.map((t) => ({
            speaker: t.speaker || "알 수 없음",
            text: t.text || ""
          })) || []
        },
        schedule: {
          create: body.summary?.schedule?.map((s) => ({
            task: s.task || "",
            assignee: s.assignee || "",
            dueDate: s.dueDate || ""
          })) || []
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
    console.error('POST /api/meetings error:', error);
    return NextResponse.json({ error: "회의록 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
