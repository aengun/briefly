import { getMeeting } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Calendar, ChevronRight, FileAudio, UsersRound } from 'lucide-react';

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = getMeeting(id);

  if (!meeting) {
    notFound();
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl animate-in fade-in slide-in-from-top-8 duration-700">
        <h1 className="text-3xl font-extrabold text-white mb-4">{meeting.title}</h1>
        <div className="flex flex-wrap gap-6 text-white/70">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <span>{new Date(meeting.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-fuchsia-400" />
            <span>{meeting.participants?.length || 0}명 참여</span>
          </div>
        </div>
        
        {/* Participants Tag List */}
        {meeting.participants && meeting.participants.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-white/10">
            {meeting.participants.map(p => (
              <div key={p.id} className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-full text-sm font-medium text-white flex items-center gap-2">
                <span className="text-white/60">{p.team}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full flex gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        {/* Sidebar: Audio & Transcript */}
        <div className="w-[40%] flex flex-col gap-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col h-[800px]">
            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center gap-2 mb-6">
              <FileAudio className="w-6 h-6 text-cyan-400" />
              원본 및 Transcript
            </h3>

            {/* Audio Player */}
            {meeting.audioUrl && (
              <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center">
                <audio controls className="w-full grayscale invert opacity-90" src={meeting.audioUrl} />
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pb-10">
              {Array.isArray(meeting.transcript) ? (
                meeting.transcript.map((u, i) => (
                  <div key={i} className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <span className="text-xs font-bold text-fuchsia-300">{u.speaker}</span>
                    <p className="text-white/90 text-sm leading-relaxed">{u.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-white/80 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                  {String(meeting.transcript)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main Content: Summary */}
        <div className="w-[60%] flex flex-col gap-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden flex-1 h-[800px] overflow-y-auto scrollbar-thin">
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <h3 className="text-3xl font-extrabold mb-8 flex items-center gap-3">
              <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-2 text-white rounded-xl">
                <ChevronRight className="w-6 h-6" />
              </div>
              Executive Summary
            </h3>

            <div className="space-y-8 relative z-10">
              <div className="group">
                <h4 className="text-sm font-bold text-fuchsia-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400"></span> As-Is
                </h4>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-white/90 leading-relaxed">{meeting.summary?.asis}</p>
                </div>
              </div>

              <div className="group">
                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> To-Be
                </h4>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-white/90 leading-relaxed">{meeting.summary?.tobe}</p>
                </div>
              </div>

              <div className="group">
                <h4 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span> Expected Effects
                </h4>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-white/90 leading-relaxed">{meeting.summary?.expected_effects}</p>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xl font-bold text-white flex items-center gap-2">
                    Timeline & Tasks
                  </h4>
                </div>
                
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="p-4 font-semibold text-white/60 border-b border-white/10 w-1/2">Task</th>
                        <th className="p-4 font-semibold text-white/60 border-b border-white/10 w-1/4">Assignee</th>
                        <th className="p-4 font-semibold text-white/60 border-b border-white/10 w-1/4">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meeting.summary?.schedule?.map((item, idx) => (
                        <tr key={idx} className="bg-white/[0.02] border-b border-white/5 last:border-0 hover:bg-white/[0.05] transition-colors">
                          <td className="p-4 text-white">{item.task}</td>
                          <td className="p-4 border-l border-white/5 text-cyan-200">{item.assignee}</td>
                          <td className="p-4 border-l border-white/5 text-fuchsia-200">{item.dueDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
