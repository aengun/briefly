import prisma from '@/lib/prisma';
import ArchiveList from '@/components/ArchiveList';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type MeetingWithParticipants = Prisma.MeetingGetPayload<{
  include: { participants: true };
}>;

export default async function ArchivesPage() {
  let meetings: MeetingWithParticipants[] = [];
  try {
    meetings = await prisma.meeting.findMany({
      orderBy: { createdAt: 'desc' },
      include: { participants: true }
    });
  } catch (err) {
    console.error("Archive fetch error:", err);
    meetings = [];
  }

  // Convert dates to ISO strings for the client component
  const safeMeetings = (meetings || []).map(m => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    meetingDate: (m.meetingDate || m.createdAt).toISOString(),
    participants: m.participants.map(p => ({ ...p }))
  }));

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-12">
      <div className="space-y-6 max-w-2xl mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
          회의록 보관소
        </h2>
        <p className="text-lg text-purple-200/80 leading-relaxed">
          저장된 회의록과 분석 결과를 한곳에서 안전하게 관리하고 확인하세요.
        </p>
      </div>

      <ArchiveList initialMeetings={safeMeetings} />
    </main>
  );
}
