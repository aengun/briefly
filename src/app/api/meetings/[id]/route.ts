import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { title, participants, transcript, summary } = body;

    // Use a transaction to ensure atomic updates
    const updatedMeeting = await prisma.$transaction(async (tx) => {
      // 1. Update basic fields
      await tx.meeting.update({
        where: { id },
        data: {
          title: title || undefined,
          asis: summary?.asis || undefined,
          tobe: summary?.tobe || undefined,
          expected_effects: summary?.expected_effects || undefined,
          meetingDate: body.meetingDate ? new Date(body.meetingDate) : undefined,
        } as any
      });

      // 2. Sync Participants (Delete and Re-create for simplicity)
      if (participants) {
        await tx.participant.deleteMany({ where: { meetingId: id } });
        await tx.participant.createMany({
          data: participants.map((p: any) => ({
            meetingId: id,
            team: p.team,
            name: p.name
          }))
        });
      }

      // 3. Sync Transcript (Delete and Re-create)
      if (transcript) {
        await tx.transcript.deleteMany({ where: { meetingId: id } });
        await tx.transcript.createMany({
          data: transcript.map((t: any) => ({
            meetingId: id,
            speaker: t.speaker,
            text: t.text
          }))
        });
      }

      // 4. Sync Schedule (Delete and Re-create)
      if (summary?.schedule) {
        await tx.schedule.deleteMany({ where: { meetingId: id } });
        await tx.schedule.createMany({
          data: summary.schedule.map((s: any) => ({
            meetingId: id,
            task: s.task,
            assignee: s.assignee,
            dueDate: s.dueDate
          }))
        });
      }

      return tx.meeting.findUnique({
        where: { id },
        include: {
          participants: true,
          transcript: true,
          schedule: true
        }
      });
    });

    return NextResponse.json({ success: true, meeting: updatedMeeting });
  } catch (error: any) {
    console.error('Error updating meeting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.meeting.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
