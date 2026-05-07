import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

interface ParticipantInput {
  team: string;
  name: string;
}

interface TranscriptInput {
  speaker: string;
  text: string;
}

interface ScheduleInput {
  task: string;
  assignee: string;
  dueDate: string;
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
    console.error("GET meeting error:", error);
    return NextResponse.json({ error: "회의록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        title: body.title,
        sourceType: body.sourceType,
        meetingDate: body.meetingDate ? new Date(body.meetingDate) : undefined,
        audioUrl: body.audioUrl,
        asis: body.summary?.asis,
        tobe: body.summary?.tobe,
        expected_effects: body.summary?.expected_effects,
        participants: body.participants ? {
          deleteMany: {},
          create: body.participants.map((p: ParticipantInput) => ({
            team: p.team || "미지정",
            name: p.name || "이름 없음"
          }))
        } : undefined,
        transcript: body.transcript ? {
          deleteMany: {},
          create: body.transcript.map((t: TranscriptInput) => ({
            speaker: t.speaker || "알 수 없음",
            text: t.text || ""
          }))
        } : undefined,
        schedule: body.summary?.schedule ? {
          deleteMany: {},
          create: body.summary.schedule.map((s: ScheduleInput) => ({
            task: s.task || "",
            assignee: s.assignee || "",
            dueDate: s.dueDate || ""
          }))
        } : undefined
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
    console.error("PATCH meeting error:", error);
    return NextResponse.json({ error: "회의록 수정에 실패했습니다." }, { status: 500 });
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
    console.error("DELETE meeting error:", error);
    return NextResponse.json({ error: "회의록 삭제에 실패했습니다." }, { status: 500 });
  }
}
