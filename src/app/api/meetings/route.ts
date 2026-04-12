import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const meetings = (await prisma.meeting.findMany({
      orderBy: { meetingDate: 'desc' },
      include: {
        participants: true,
        transcript: true,
        schedule: true,
      }
    } as any)) as any[];

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
  } catch (error: any) {
    console.error('GET /api/meetings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.title || !body.audioUrl || !body.summary || !body.transcript) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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
        title: body.title,
        audioUrl: body.audioUrl,
        asis: body.summary.asis || "",
        tobe: body.summary.tobe || "",
        expected_effects: body.summary.expected_effects || "",
        meetingDate: mDate,
        participants: {
          create: body.participants?.map((p: any) => ({
            team: p.team,
            name: p.name
          })) || []
        },
        transcript: {
          create: body.transcript?.map((t: any) => ({
            speaker: t.speaker,
            text: t.text
          })) || []
        },
        schedule: {
          create: body.summary.schedule?.map((s: any) => ({
            task: s.task,
            assignee: s.assignee,
            dueDate: s.dueDate
          })) || []
        }
      } as any,
      include: {
        participants: true,
        transcript: true,
        schedule: true
      }
    } as any);

    return NextResponse.json({ success: true, meeting });
  } catch (error: any) {
    console.error('POST /api/meetings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
