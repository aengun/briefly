"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, ChevronRight, Download, Users, UserPlus, Save, Calendar as CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";

// Define the interfaces based on our DB types
type ScheduleItem = {
  task: string;
  assignee: string;
  dueDate: string;
};

type TranscriptUtterance = {
  speaker: string;
  text: string;
};

type SummaryResult = {
  audioUrl: string;
  transcript: TranscriptUtterance[];
  summary: {
    asis: string;
    tobe: string;
    expected_effects: string;
    schedule: ScheduleItem[];
  };
};

export type Participant = {
  id: string;
  team: string;
  name: string;
};

const IT_TEAM_MEMBERS = [
  { team: "IT팀", name: "강상규 책임" },
  { team: "IT팀", name: "김건영 선임" },
  { team: "IT팀", name: "김재윤 선임" },
];

export default function Home() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Participant Management
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newTeam, setNewTeam] = useState("");
  const [newName, setNewName] = useState("");

  // Diarization Mapping
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent Hydration mismatch by setting initial date on client only
  useEffect(() => {
    setMeetingDate(new Date().toISOString().split('T')[0]);
  }, []);

  const handleAddParticipant = () => {
    if (!newTeam || !newName) return;
    const newP = { id: crypto.randomUUID(), team: newTeam, name: newName };
    setParticipants([...participants, newP]);
    setNewTeam("");
    setNewName("");
  };

  const handleAddITMember = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!e.target.value) return;
    const [team, name] = e.target.value.split(":");
    if (participants.some(p => p.name === name)) return;
    const newP = { id: crypto.randomUUID(), team, name };
    setParticipants([...participants, newP]);
    e.target.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (participants.length === 0) {
      if (!confirm("참여자가 없습니다. 계속하시겠습니까?")) return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      setResult(data);
      setMeetingTitle(file.name.replace(/\.[^/.]+$/, ""));

      const initialMap: Record<string, string> = {};
      if (Array.isArray(data.transcript)) {
        data.transcript.forEach((u: TranscriptUtterance) => {
          if (!initialMap[u.speaker]) initialMap[u.speaker] = "";
        });
      }
      setSpeakerMap(initialMap);
    } catch (err: any) {
      setError(err.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSchedule = () => {
    if (result) {
      const newSchedule = [...result.summary.schedule, { task: "", assignee: "", dueDate: "" }];
      setResult({ ...result, summary: { ...result.summary, schedule: newSchedule } });
    }
  };

  const updateSchedule = (index: number, field: keyof ScheduleItem, value: string) => {
    if (result) {
      const newSchedule = [...result.summary.schedule];
      newSchedule[index] = { ...newSchedule[index], [field]: value };
      setResult({ ...result, summary: { ...result.summary, schedule: newSchedule } });
    }
  };

  const handleSaveToArchive = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const mappedTranscript = result.transcript.map(u => ({
        speaker: speakerMap[u.speaker] || u.speaker,
        text: u.text
      }));

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meetingTitle || "제목 없음",
          meetingDate: meetingDate,
          audioUrl: result.audioUrl,
          participants,
          transcript: mappedTranscript,
          summary: result.summary,
        })
      });

      if (!res.ok) throw new Error(await res.text());
      alert("보관소에 저장되었습니다!");
      router.push("/archives");
    } catch (err: any) {
      alert("저장 실패: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyHtml = () => {
    if (!result) return;

    const { summary } = result;
    const html = `
<h3>1. 현황 및 문제점</h3>
<p>${summary.asis.replace(/\n/g, "<br/>")}</p>
<h3>2. 개선방향 (목적)</h3>
<p>${summary.tobe.replace(/\n/g, "<br/>")}</p>
<h3>3. 기대효과</h3>
<p>${summary.expected_effects.replace(/\n/g, "<br/>")}</p>
<h3>4. 일감내용 및 일정</h3>
<table border="1" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background-color: #f2f2f2;">
      <th style="padding: 8px; text-align: left;">Task</th>
      <th style="padding: 8px; text-align: left;">Assignee</th>
      <th style="padding: 8px; text-align: left;">Due Date</th>
    </tr>
  </thead>
  <tbody>
    ${summary.schedule.map(item => `
    <tr>
      <td style="padding: 8px;">${item.task}</td>
      <td style="padding: 8px;">${item.assignee}</td>
      <td style="padding: 8px;">${item.dueDate}</td>
    </tr>
    `).join("")}
  </tbody>
</table>
    `.trim();

    navigator.clipboard.writeText(html).then(() => {
      alert("HTML 형식이 클립보드에 복사되었습니다.");
    }).catch(err => {
      console.error("복사 실패:", err);
      alert("복사 중 오류가 발생했습니다.");
    });
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-12">
      {/* 1. Intro Section */}
      {!result && (
        <div className="text-center space-y-6 max-w-2xl mx-auto mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h2 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400">
            Transform meetings<br />into actionable insights.
          </h2>
          <p className="text-lg text-purple-200/80 leading-relaxed">
            오디오 녹음 파일을 업로드하세요. Briefly가 참석자 식별과 함께 STT를 진행하고,
            현업 요구사항에 맞춘 As-is, To-be, 기대효과, 일정 테이블을 자동 생성합니다.
          </p>
        </div>
      )}

      {/* 2. Participant Management (Shared) */}
      <section className="w-full max-w-3xl mx-auto bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
        <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-white">
          <Users className="w-5 h-5 text-cyan-400" />
          회의 참여자 관리
        </h3>
        <div className="flex gap-4 mb-4">
          <select
            onChange={handleAddITMember}
            defaultValue=""
            className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white focus:border-cyan-400 transition-colors"
          >
            <option value="" disabled className="text-gray-900">IT 팀원 선택 (필수참여)</option>
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

        {participants.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {participants.map(p => (
              <div key={p.id} className="bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-white/10 px-3 py-1.5 rounded-full text-sm font-medium text-white flex items-center gap-2">
                <span className="text-white/60">{p.team}</span>
                <span>{p.name}</span>
                <button
                  onClick={() => setParticipants(participants.filter(x => x.id !== p.id))}
                  className="text-white/40 hover:text-red-400 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Upload Section */}
      {!result && (
        <section className="w-full max-w-3xl mx-auto flex flex-col gap-6">
          <div
            className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 ${
              isUploading ? "border-purple-500/50 bg-purple-900/20" : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 cursor-pointer"
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
              {isUploading ? (
                <>
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-fuchsia-400 animate-spin" />
                    <div className="absolute inset-0 blur-xl bg-fuchsia-500/30 rounded-full animate-pulse" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">AI가 회의를 분석하고 있습니다...</h3>
                  <p className="text-purple-300/80 text-sm">참석자 식별 및 문맥 요약 중입니다. 잠시만 기다려주세요.</p>
                </>
              ) : file ? (
                <>
                  <div className="bg-green-500/20 p-4 rounded-full ring-1 ring-green-500/50 mb-2">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white truncate max-w-[250px]">{file.name}</h3>
                  <p className="text-purple-300/80 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                    className="mt-6 bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg transform hover:-translate-y-0.5"
                  >
                    분석 및 요약 시작하기
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-sm text-purple-300 hover:text-white mt-4 underline underline-offset-4 transition-colors"
                  >
                    다른 파일 선택
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-white/10 p-5 rounded-full ring-1 ring-white/20 mb-2 group-hover:scale-110 transition-transform duration-300">
                    <FileAudio className="w-10 h-10 text-cyan-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">오디오 파일 업로드 (또는 드래그 앤 드롭)</h3>
                  <p className="text-purple-300/80 text-sm">MP3, WAV, M4A 등 지원</p>
                </>
              )}
            </div>
            <input type="file" accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} disabled={isUploading} />
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm flex items-start gap-3">
              <span className="shrink-0 font-bold bg-red-500/20 text-red-400 p-1 rounded-md">Error</span>
              <span>{error}</span>
            </div>
          )}
        </section>
      )}

      {/* 4. Result Section */}
      {result && (
        <section className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center gap-4 flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Meeting Title</label>
              <input
                type="text"
                value={meetingTitle}
                onChange={e => setMeetingTitle(e.target.value)}
                className="bg-transparent text-2xl font-bold text-white outline-none focus:border-b focus:border-white/20 px-2 py-1 w-full"
                placeholder="회의 제목을 입력하세요"
              />
            </div>
            <div className="w-px h-10 bg-white/10 mx-2" />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Meeting Date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white outline-none focus:border-cyan-400 transition-all text-sm"
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={handleCopyHtml}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-xl font-semibold transition-all border border-white/10"
              >
                <Download className="w-5 h-5" />
                HTML로 복사
              </button>
              <button
                onClick={handleSaveToArchive}
                disabled={isSaving}
                className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                보관소에 저장
              </button>
            </div>
          </div>

          <div className="w-full flex gap-8">
            {/* Transcript */}
            <div className="w-[40%] flex flex-col gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col h-[800px]">
                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center gap-2 mb-6">
                  <FileAudio className="w-6 h-6 text-cyan-400" />
                  Transcript
                </h3>
                <div className="bg-white/5 p-4 rounded-xl mb-4 border border-white/10 space-y-3">
                  <h4 className="text-sm font-semibold text-white/80">화자 매핑 (Speaker Map)</h4>
                  {Object.keys(speakerMap).map(speaker => (
                    <div key={speaker} className="flex items-center gap-2">
                      <span className="w-20 text-sm text-cyan-300 font-mono truncate">{speaker}</span>
                      <span className="text-white/40">→</span>
                      <select
                        value={speakerMap[speaker]}
                        onChange={e => setSpeakerMap({ ...speakerMap, [speaker]: e.target.value })}
                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 outline-none text-white text-sm flex-1"
                      >
                        <option value="" className="text-gray-900">알 수 없음</option>
                        {participants.map(p => (
                          <option key={p.id} value={`${p.team} ${p.name}`} className="text-gray-900">{p.team} {p.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto pr-4 space-y-4 scrollbar-thin">
                  {result.transcript.map((u, i) => (
                    <div key={i} className="flex flex-col gap-1 p-3 bg-white/[0.03] rounded-xl border border-white/5">
                      <span className="text-xs font-bold text-fuchsia-300">{speakerMap[u.speaker] || u.speaker}</span>
                      <p className="text-white/90 text-sm leading-relaxed">{u.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="w-[60%] flex flex-col gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden flex-1 h-[800px] overflow-y-auto scrollbar-thin">
                <h3 className="text-3xl font-extrabold mb-8 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-2 text-white rounded-xl"><ChevronRight className="w-6 h-6" /></div>
                  Executive Summary
                </h3>
                <div className="space-y-8 relative z-10">
                  <div className="group">
                    <h4 className="text-sm font-bold text-fuchsia-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-400"></span> 1. 현황 및 문제점
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10"><p className="text-white/90 leading-relaxed font-pre-wrap">{result.summary.asis}</p></div>
                  </div>
                  <div className="group">
                    <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 2. 개선방향 (목적)
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10"><p className="text-white/90 leading-relaxed font-pre-wrap">{result.summary.tobe}</p></div>
                  </div>
                  <div className="group">
                    <h4 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span> 3. 기대효과
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10"><p className="text-white/90 leading-relaxed font-pre-wrap">{result.summary.expected_effects}</p></div>
                  </div>
                  <div className="mt-12 pt-8 border-t border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xl font-bold text-white">4. 일감내용 및 일정</h4>
                      <button onClick={handleAddSchedule} className="text-sm px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors">+ Add Row</button>
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
                          {result.summary.schedule.map((item, idx) => (
                            <tr key={idx} className="bg-white/[0.02] border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                              <td className="p-0 border-r border-white/5"><input type="text" value={item.task} onChange={(e) => updateSchedule(idx, "task", e.target.value)} className="w-full bg-transparent p-4 outline-none text-white focus:bg-white/10" /></td>
                              <td className="p-0 border-r border-white/5"><input type="text" value={item.assignee} onChange={(e) => updateSchedule(idx, "assignee", e.target.value)} className="w-full bg-transparent p-4 outline-none text-cyan-200 focus:bg-white/10" /></td>
                              <td className="p-0"><input type="text" value={item.dueDate} onChange={(e) => updateSchedule(idx, "dueDate", e.target.value)} className="w-full bg-transparent p-4 outline-none text-fuchsia-200 focus:bg-white/10" /></td>
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
        </section>
      )}
    </main>
  );
}
