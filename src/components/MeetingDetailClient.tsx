"use client";

import { useState } from "react";
import { Calendar, ChevronRight, FileAudio, UsersRound, Save, Loader2, Users, UserPlus, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

type Participant = {
  id: string;
  team: string;
  name: string;
};

type TranscriptUtterance = {
  id: string;
  speaker: string;
  text: string;
};

type ScheduleItem = {
  id: string;
  task: string;
  assignee: string;
  dueDate: string;
};

type MeetingData = {
  id: string;
  title: string;
  audioUrl: string;
  asis: string;
  tobe: string;
  expected_effects: string;
  createdAt: string;
  meetingDate: string;
  participants: Participant[];
  transcript: TranscriptUtterance[];
  schedule: ScheduleItem[];
};

const IT_TEAM_MEMBERS = [
  { team: "IT팀", name: "강상규 책임" },
  { team: "IT팀", name: "김건영 선임" },
  { team: "IT팀", name: "김재윤 선임" },
];

export default function MeetingDetailClient({ initialMeeting }: { initialMeeting: MeetingData }) {
  const router = useRouter();
  const [meeting, setMeeting] = useState(initialMeeting);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // For participant management
  const [newTeam, setNewTeam] = useState("");
  const [newName, setNewName] = useState("");

  // For Speaker Mapping in Edit Mode
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});

  const handleAddParticipant = () => {
    if (!newTeam || !newName) return;
    const newP = { id: crypto.randomUUID(), team: newTeam, name: newName };
    setMeeting({ ...meeting, participants: [...meeting.participants, newP] });
    setNewTeam("");
    setNewName("");
  };

  const handleAddITMember = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value) return;
    const [team, name] = e.target.value.split(":");
    if (meeting.participants.some(p => p.name === name)) return;
    const newP = { id: crypto.randomUUID(), team, name };
    setMeeting({ ...meeting, participants: [...meeting.participants, newP] });
    e.target.value = "";
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Apply speaker mapping if any
      const updatedTranscript = meeting.transcript.map(u => ({
        ...u,
        speaker: speakerMap[u.speaker] || u.speaker
      }));

      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meeting.title,
          meetingDate: meeting.meetingDate,
          participants: meeting.participants,
          transcript: updatedTranscript,
          summary: {
            asis: meeting.asis,
            tobe: meeting.tobe,
            expected_effects: meeting.expected_effects,
            schedule: meeting.schedule
          }
        })
      });

      if (!res.ok) throw new Error(await res.text());
      
      const data = await res.json();
      setMeeting(data.meeting);
      setSpeakerMap({});
      setIsEditMode(false);
      alert("변경 사항이 저장되었습니다.");
      router.refresh();
    } catch (err: any) {
      alert("저장 실패: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex justify-between items-start relative z-10">
          <div className="flex-1">
            {isEditMode ? (
              <input
                type="text"
                value={meeting.title}
                onChange={e => setMeeting({ ...meeting, title: e.target.value })}
                className="text-3xl font-extrabold text-white bg-white/10 border border-white/20 rounded-xl px-4 py-2 w-full outline-none focus:border-cyan-400 transition-all"
              />
            ) : (
              <h1 className="text-3xl font-extrabold text-white mb-4">{meeting.title}</h1>
            )}
            <div className="flex flex-wrap gap-6 text-white/70 mt-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                {isEditMode ? (
                  <input
                    type="date"
                    value={meeting.meetingDate ? meeting.meetingDate.split('T')[0] : ''}
                    onChange={e => setMeeting({ ...meeting, meetingDate: e.target.value })}
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white outline-none focus:border-cyan-400 text-sm"
                  />
                ) : (
                  <span>{new Date(meeting.meetingDate).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-fuchsia-400" />
                <span>{meeting.participants?.length || 0}명 참여</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                isEditMode ? "bg-white/20 text-white" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {isEditMode ? "취소" : "편집 모드"}
            </button>
            {isEditMode && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                변경 사항 저장
              </button>
            )}
          </div>
        </div>

        {/* Participant Management (In Edit Mode) */}
        {isEditMode && (
          <div className="mt-8 pt-8 border-t border-white/10 animate-in fade-in duration-300">
             <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-white">
              <Users className="w-5 h-5 text-cyan-400" />
              참여자 수정
            </h3>
            <div className="flex gap-4 mb-4">
              <select
                onChange={handleAddITMember}
                defaultValue=""
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white focus:border-cyan-400 transition-colors"
              >
                <option value="" disabled className="text-gray-900">IT 팀원 추가</option>
                {IT_TEAM_MEMBERS.map(m => (
                  <option key={m.name} value={`${m.team}:${m.name}`} className="text-gray-900">
                    {m.team} {m.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2 flex-1">
                <input
                  type="text"
                  placeholder="팀명"
                  value={newTeam}
                  onChange={e => setNewTeam(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white focus:border-fuchsia-400 transition-colors"
                />
                <input
                  type="text"
                  placeholder="이름/직급"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white focus:border-fuchsia-400 transition-colors"
                />
                <button
                  onClick={handleAddParticipant}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-3 rounded-xl transition-colors flex items-center justify-center"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Participants Tag List */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-white/10">
          {meeting.participants.map((p) => (
            <div key={p.id} className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-full text-sm font-medium text-white flex items-center gap-2">
              <span className="text-white/60">{p.team}</span>
              <span>{p.name}</span>
              {isEditMode && (
                <button
                  onClick={() => setMeeting({ ...meeting, participants: meeting.participants.filter(x => x.id !== p.id) })}
                  className="text-white/40 hover:text-red-400 ml-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full flex gap-8">
        {/* Sidebar: Audio & Transcript */}
        <div className="w-[40%] flex flex-col gap-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col h-[800px]">
            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center gap-2 mb-6">
              <FileAudio className="w-6 h-6 text-cyan-400" />
              Transcript
            </h3>

            {meeting.audioUrl && (
              <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center">
                <audio controls className="w-full grayscale invert opacity-90" src={meeting.audioUrl} />
              </div>
            )}

            {/* Speaker Mapping in Edit Mode */}
            {isEditMode && (
              <div className="bg-white/5 p-4 rounded-xl mb-4 border border-white/10 space-y-3 animate-in slide-in-from-top-2">
                <h4 className="text-sm font-semibold text-white/80">화자 재매핑 (Speaker Re-map)</h4>
                {Array.from(new Set(meeting.transcript.map(u => u.speaker))).map(speaker => (
                  <div key={speaker} className="flex items-center gap-2">
                    <span className="w-20 text-xs text-cyan-300 font-mono truncate" title={speaker}>{speaker}</span>
                    <span className="text-white/40">→</span>
                    <select
                      value={speakerMap[speaker] || ""}
                      onChange={e => setSpeakerMap({ ...speakerMap, [speaker]: e.target.value })}
                      className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 outline-none text-white text-xs flex-1"
                    >
                      <option value="" className="text-gray-900">원본 유지 ({speaker})</option>
                      {meeting.participants.map(p => (
                        <option key={p.id} value={`${p.team} ${p.name}`} className="text-gray-900">
                          {p.team} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pb-10">
              {meeting.transcript.map((u, i) => (
                <div key={i} className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <span className="text-xs font-bold text-fuchsia-300">
                    {isEditMode ? (speakerMap[u.speaker] || u.speaker) : u.speaker}
                  </span>
                  <p className="text-white/90 text-sm leading-relaxed">{u.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content: Summary */}
        <div className="w-[60%] flex flex-col gap-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden flex-1 h-[800px] overflow-y-auto scrollbar-thin">
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
                {isEditMode ? (
                  <textarea
                    value={meeting.asis}
                    onChange={e => setMeeting({ ...meeting, asis: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-2xl p-5 text-white outline-none focus:border-fuchsia-500/50 min-h-[100px]"
                  />
                ) : (
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-white/90 leading-relaxed font-pre-line">{meeting.asis}</p>
                  </div>
                )}
              </div>

              <div className="group">
                <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> To-Be
                </h4>
                {isEditMode ? (
                  <textarea
                    value={meeting.tobe}
                    onChange={e => setMeeting({ ...meeting, tobe: e.target.value })}
                    className="w-full bg-white/5 border border-white/20 rounded-2xl p-5 text-white outline-none focus:border-cyan-500/50 min-h-[100px]"
                  />
                ) : (
                  <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                    <p className="text-white/90 leading-relaxed font-pre-line">{meeting.tobe}</p>
                  </div>
                )}
              </div>

              <div className="mt-12 pt-8 border-t border-white/10">
                 <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xl font-bold text-white flex items-center gap-2">
                    Timeline & Tasks
                  </h4>
                   {isEditMode && (
                     <button
                       onClick={() => setMeeting({ ...meeting, schedule: [...meeting.schedule, { id: crypto.randomUUID(), task: "", assignee: "", dueDate: "" }] })}
                       className="text-sm px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors"
                     >
                       + Add Row
                     </button>
                   )}
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
                      {meeting.schedule.map((item, idx) => (
                        <tr key={item.id || idx} className="bg-white/[0.02] border-b border-white/5 last:border-0 hover:bg-white/[0.05] transition-colors">
                          <td className="p-0 border-r border-white/5">
                            {isEditMode ? (
                              <input
                                type="text"
                                value={item.task}
                                onChange={e => {
                                  const newS = [...meeting.schedule];
                                  newS[idx].task = e.target.value;
                                  setMeeting({ ...meeting, schedule: newS });
                                }}
                                className="w-full bg-transparent p-4 outline-none text-white focus:bg-white/10"
                              />
                            ) : (
                              <div className="p-4 text-white">{item.task}</div>
                            )}
                          </td>
                          <td className="p-0 border-r border-white/5">
                            {isEditMode ? (
                              <input
                                type="text"
                                value={item.assignee}
                                onChange={e => {
                                  const newS = [...meeting.schedule];
                                  newS[idx].assignee = e.target.value;
                                  setMeeting({ ...meeting, schedule: newS });
                                }}
                                className="w-full bg-transparent p-4 outline-none text-cyan-200 focus:bg-white/10"
                              />
                            ) : (
                              <div className="p-4 text-cyan-200">{item.assignee}</div>
                            )}
                          </td>
                          <td className="p-0">
                            {isEditMode ? (
                              <input
                                type="text"
                                value={item.dueDate}
                                onChange={e => {
                                  const newS = [...meeting.schedule];
                                  newS[idx].dueDate = e.target.value;
                                  setMeeting({ ...meeting, schedule: newS });
                                }}
                                className="w-full bg-transparent p-4 outline-none text-fuchsia-200 focus:bg-white/10"
                              />
                            ) : (
                              <div className="p-4 text-fuchsia-200">{item.dueDate}</div>
                            )}
                          </td>
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
    </div>
  );
}
