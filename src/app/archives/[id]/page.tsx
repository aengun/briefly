import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import MeetingDetailClient from '@/components/MeetingDetailClient';
import type { Prisma } from '@prisma/client';

type MeetingDetailRecord = Prisma.MeetingGetPayload<{
  include: {
    participants: true;
    transcript: true;
    schedule: true;
  };
}>;

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const meetingRecord: MeetingDetailRecord | null = await prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: true,
      transcript: {
        orderBy: { id: 'asc' }
      },
      schedule: true
    }
  });

  if (!meetingRecord) {
    notFound();
  }

  // Format record to match component expectations
  const meeting = {
    ...meetingRecord,
    createdAt: meetingRecord.createdAt.toISOString(),
    meetingDate: meetingRecord.meetingDate?.toISOString() || meetingRecord.createdAt.toISOString(),
    participants: meetingRecord.participants.map(p => ({
      id: p.id,
      team: p.team,
      name: p.name
    })),
    transcript: meetingRecord.transcript.map(u => ({
      id: u.id,
      speaker: u.speaker,
      text: u.text
    })),
    schedule: meetingRecord.schedule.map(s => ({
      id: s.id,
      task: s.task,
      assignee: s.assignee,
      dueDate: s.dueDate
    }))
  };

  return (
    <main className="min-h-screen bg-[#030014] text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <MeetingDetailClient initialMeeting={meeting} />
      </div>
    </main>
  );
}
