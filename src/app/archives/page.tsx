import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Calendar, Users, ChevronRight, FileAudio } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ArchivesPage() {
  const meetings = (await prisma.meeting.findMany({
    orderBy: { meetingDate: 'desc' },
    include: { participants: true }
  } as any)) as any[];

  // Ensure type safety for meetingDate
  const safeMeetings = meetings.map(m => ({
    ...m,
    meetingDate: m.meetingDate || m.createdAt // Fallback just in case
  }));

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-12">
      <div className="space-y-6 max-w-2xl mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h2 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
          회의 기록 보관소
        </h2>
        <p className="text-lg text-purple-200/80 leading-relaxed">
          과거의 모든 회의 기록과 요약본을 안전하게 아카이빙합니다. 언제든지 다시 검토하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
        {meetings.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
            <h3 className="text-xl text-white/50 font-medium">저장된 회의 기록이 없습니다.</h3>
          </div>
        ) : (
          safeMeetings.map((m) => (
            <Link 
              key={m.id} 
              href={`/archives/${m.id}`}
              className="bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-lg group flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="p-3 bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 rounded-xl">
                  <FileAudio className="w-6 h-6 text-cyan-300" />
                </div>
                <div className="p-2 bg-white/5 rounded-full group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                  <ChevronRight className="w-4 h-4 text-white/60 group-hover:text-white" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white line-clamp-1">{m.title || "제목 없는 회의"}</h3>
                <div className="flex items-center gap-2 text-sm text-cyan-300 font-medium">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {(() => {
                      const d = new Date(m.meetingDate);
                      return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Users className="w-4 h-4" />
                  <span>참여자 {m.participants?.length || 0}명</span>
                </div>
              </div>

              <div className="h-px w-full bg-white/10 my-1"></div>
              
              <div className="flex-1">
                <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">
                  {m.asis || "요약 내용이 없습니다."}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
