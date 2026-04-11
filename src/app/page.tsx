"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, ChevronRight, Download } from "lucide-react";

type ScheduleItem = {
  task: string;
  assignee: string;
  dueDate: string;
};

type SummaryResult = {
  transcript: string;
  summary: {
    asis: string;
    tobe: string;
    expected_effects: string;
    schedule: ScheduleItem[];
  };
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "오류가 발생했습니다.");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white font-sans selection:bg-fuchsia-500 selection:text-white">
      {/* Header */}
      <header className="px-8 py-6 w-full border-b border-white/10 backdrop-blur-md bg-white/5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 p-2 rounded-xl shadow-lg">
              <UploadCloud className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Briefly</h1>
          </div>
          <div className="text-sm font-medium text-purple-200 bg-purple-900/40 px-4 py-2 rounded-full ring-1 ring-purple-500/30">
            Internal Meeting Summarizer
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 flex flex-col gap-12">
        {/* Hero Section */}
        {!result && (
          <div className="text-center space-y-6 max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400">
              Transform meetings<br />into actionable insights.
            </h2>
            <p className="text-lg text-purple-200/80 leading-relaxed">
              오디오 녹음 파일을 업로드하세요. Briefly가 STT를 통해 텍스트로 변환하고
              현업 요구사항에 맞춘 As-is, To-be, 기대효과, 일정 테이블을 자동 생성합니다.
            </p>
          </div>
        )}

        {/* Upload Section */}
        <div className="w-full max-w-2xl mx-auto">
          <div
            className={`relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 backdrop-blur-xl ${
              isUploading ? "border-purple-500/50 bg-purple-900/20" : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 cursor-pointer"
            }`}
            onDragOver={handleDragOver}
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
                  <p className="text-purple-300/80 text-sm">STT 변환 및 문맥 요약 중입니다. 잠시만 기다려주세요.</p>
                </>
              ) : file ? (
                <>
                  <div className="bg-green-500/20 p-4 rounded-full ring-1 ring-green-500/50 mb-2">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white truncate max-w-[250px]">{file.name}</h3>
                  <p className="text-purple-300/80 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload();
                    }}
                    className="mt-6 bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-[0_0_20px_rgba(192,38,211,0.4)] hover:shadow-[0_0_30px_rgba(192,38,211,0.6)] transform hover:-translate-y-0.5"
                  >
                    요약 시작하기
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-sm text-purple-300 hover:text-white mt-4 underline decoration-purple-500/50 underline-offset-4 transition-colors"
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
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm flex items-start gap-3">
              <span className="shrink-0 font-bold bg-red-500/20 text-red-400 p-1 rounded-md">Error</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="w-full flex gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Sidebar (Full Transcript) */}
            <div className="w-1/3 flex flex-col gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col h-[700px]">
                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 flex items-center gap-2 mb-6">
                  <FileAudio className="w-6 h-6 text-cyan-400" />
                  STT Transcript
                </h3>
                <div className="flex-1 overflow-y-auto pr-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                  <p className="text-white/80 leading-relaxed font-mono text-sm whitespace-pre-wrap">
                    {result.transcript}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content (Summary) */}
            <div className="w-2/3 flex flex-col gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <h3 className="text-3xl font-extrabold mb-8 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-2 text-white rounded-xl">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                  Executive Summary
                </h3>

                <div className="space-y-8 relative z-10">
                  {/* As-Is */}
                  <div className="group">
                    <h4 className="text-sm font-bold text-fuchsia-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-400"></span> As-Is
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 group-hover:border-fuchsia-500/30 transition-colors">
                      <p className="text-white/90 leading-relaxed">{result.summary.asis}</p>
                    </div>
                  </div>

                  {/* To-Be */}
                  <div className="group">
                    <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span> To-Be
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 group-hover:border-cyan-500/30 transition-colors">
                      <p className="text-white/90 leading-relaxed">{result.summary.tobe}</p>
                    </div>
                  </div>

                  {/* Expected Effects */}
                  <div className="group">
                    <h4 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span> Expected Effects
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 group-hover:border-green-500/30 transition-colors">
                      <p className="text-white/90 leading-relaxed">{result.summary.expected_effects}</p>
                    </div>
                  </div>

                  {/* Schedule Table */}
                  <div className="mt-12 pt-8 border-t border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xl font-bold text-white flex items-center gap-2">
                        Timeline & Tasks
                      </h4>
                      <button
                        onClick={handleAddSchedule}
                        className="text-sm px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors"
                      >
                        + Add Row
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto rounded-xl border border-white/10">
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
                            <tr key={idx} className="bg-white/[0.02] hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                              <td className="p-0">
                                <input
                                  type="text"
                                  value={item.task}
                                  onChange={(e) => updateSchedule(idx, "task", e.target.value)}
                                  className="w-full bg-transparent p-4 outline-none text-white focus:bg-white/5 transition-colors placeholder:text-white/20"
                                  placeholder="What needs to be done..."
                                />
                              </td>
                              <td className="p-0 border-l border-white/5">
                                <input
                                  type="text"
                                  value={item.assignee}
                                  onChange={(e) => updateSchedule(idx, "assignee", e.target.value)}
                                  className="w-full bg-transparent p-4 outline-none text-cyan-200 focus:bg-white/5 transition-colors placeholder:text-white/20"
                                  placeholder="Who..."
                                />
                              </td>
                              <td className="p-0 border-l border-white/5">
                                <input
                                  type="text"
                                  value={item.dueDate}
                                  onChange={(e) => updateSchedule(idx, "dueDate", e.target.value)}
                                  className="w-full bg-transparent p-4 outline-none text-fuchsia-200 focus:bg-white/5 transition-colors placeholder:text-white/20"
                                  placeholder="When..."
                                />
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
        )}
      </main>
    </div>
  );
}
