"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, ChevronRight, Download, Users, UserPlus, Save, Mic, MicOff, Square, Play, RefreshCcw, LayoutGrid, CheckSquare, X, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "../components/Modal";

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

type TeamMember = {
  id: string;
  team: string;
  name: string;
};

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
  const [autoAddParticipants, setAutoAddParticipants] = useState(true);

  // Diarization Mapping
  const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [isSendingToConfluence, setIsSendingToConfluence] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Custom Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "alert" | "confirm" | "error" | "success";
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "alert"
  });

  const showModal = (config: Omit<typeof modalConfig, "isOpen">) => {
    setModalConfig({ ...config, isOpen: true });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Recording state
  const [activeTab, setActiveTab] = useState<"upload" | "record">("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(12).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobEvent["data"][]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedFileRef = useRef<File | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [showTaskTemplate, setShowTaskTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 재분석(Re-analyze) 감지 로직
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meetingId = params.get("reanalyze");
    
    if (meetingId) {
      const loadAndAnalyze = async () => {
        setIsUploading(true);
        try {
          // 1. 회의 정보 조회
          const res = await fetch(`/api/meetings/${meetingId}`);
          if (!res.ok) throw new Error("회의 정보를 불러오지 못했습니다.");
          const meeting = await res.json();
          
          if (!meeting.audioUrl) throw new Error("오디오 파일 경로가 없습니다.");
          
          // 2. 오디오 파일 페치 및 파일 객체화
          const audioRes = await fetch(meeting.audioUrl);
          const blob = await audioRes.blob();
          const fileName = meeting.audioUrl.split("/").pop() || "reanalysis.mp3";
          const reanalysisFile = new File([blob], fileName, { type: blob.type });
          
          // 3. 기존 참여자 정보가 있다면 세팅 (선택사항)
          if (meeting.participants && meeting.participants.length > 0) {
            setParticipants(meeting.participants.map((p: any) => ({
              id: p.id || crypto.randomUUID(),
              team: p.team,
              name: p.name
            })));
          }

          setFile(reanalysisFile);
          // 4. 분석 시작
          handleUpload(reanalysisFile);
          
          // URL 파라미터 정리 (무한 루프 방지)
          window.history.replaceState({}, document.title, "/");
        } catch (err: any) {
          setError(`재분석 실패: ${err.message}`);
          setIsUploading(false);
        }
      };
      loadAndAnalyze();
    }
  }, []);

  // Prevent Hydration mismatch by setting initial date on client only
  useEffect(() => {
    setMeetingDate(new Date().toISOString().split('T')[0]);
    
    // Fetch team members from DB
    fetch("/api/team-members")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTeamMembers(data);
        }
      })
      .catch(err => console.error("Failed to fetch team members:", err));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Web Audio API - 음파 시각화
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevels = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const bands = 12;
        const binSize = Math.floor(data.length / bands);
        // 고주파수 영역도 더 잘 보이도록 로그 스케일에 가깝게 매핑 조정
        const levels = Array.from({ length: bands }, (_, i) => {
          const start = Math.floor(Math.pow(i / bands, 1.5) * data.length);
          const end = Math.floor(Math.pow((i + 1) / bands, 1.5) * data.length);
          const slice = data.slice(start, Math.max(end, start + 1));
          const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
          return avg / 255;
        });
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // 애니메이션 중지
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioLevels(Array(12).fill(0));

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // ref에 즉시 저장 (state 업데이트 지연 방지)
        const recordedFile = new File([blob], `recording_${Date.now()}.webm`, { type: "audio/webm" });
        recordedFileRef.current = recordedFile;
        setFile(recordedFile);
        setResult(null);
        setError(null);
        stream.getTracks().forEach(track => track.stop());
        audioCtx.close();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedBlob(null);
      setAudioUrl(null);
      recordedFileRef.current = null;
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      setError("마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setAudioUrl(null);
    setFile(null);
    setRecordingTime(0);
    setError(null);
  };

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

  const handleUpload = async (fileOverride?: File) => {
    const targetFile = fileOverride ?? file;
    if (!targetFile) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", targetFile);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      setResult(data);
      setMeetingTitle(targetFile.name.replace(/\.[^/.]+$/, ""));

      if (data.usedModel) {
        console.log(`Used AI Model: ${data.usedModel}`);
      }
      
      const initialMap: Record<string, string> = {};
      if (Array.isArray(data.transcript)) {
        data.transcript.forEach((u: TranscriptUtterance) => {
          if (!initialMap[u.speaker]) initialMap[u.speaker] = "";
        });
      }
      setSpeakerMap(initialMap);

      // 자동 참여자 추가: transcript 화자 → participants
      if (autoAddParticipants && Array.isArray(data.transcript)) {
        const uniqueSpeakers = [...new Set(
          data.transcript.map((u: TranscriptUtterance) => u.speaker)
        )] as string[];
        
        setParticipants(prev => {
          const existingNames = new Set(prev.map(p => p.name));
          const newOnes = uniqueSpeakers
            .filter(speaker => !existingNames.has(speaker))
            .map(speaker => ({
              id: crypto.randomUUID(),
              team: "미지정",
              name: speaker
            }));
          return [...prev, ...newOnes];
        });
      }
    } catch (err: any) {
      let friendlyError = "분석 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      if (err.message.includes("429")) {
        friendlyError = "현재 AI 사용량이 많아 잠시 후 다시 시도해 주세요. (할당량 초과)";
      } else if (err.message.includes("503") || err.message.includes("Service Unavailable")) {
        friendlyError = "AI 서버가 일시적으로 바쁩니다. 약 1분 후 다시 시도해 주세요.";
      } else if (err.message.includes("403")) {
        friendlyError = "API 권한 오류가 발생했습니다. 키 설정을 확인해 주세요.";
      }
      setError(friendlyError);
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

  const renderAsList = (text: string) => {
    return text.split("\n\n")
      .filter(p => p.trim())
      .map(p => {
        const items = p.split("\n")
          .filter(line => line.trim())
          .map(line => `<li>${line.trim()}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      })
      .join("\n");
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
      showModal({
        title: "저장 완료",
        message: "보관소에 성공적으로 저장되었습니다!",
        type: "success"
      });
      router.push("/archives");
    } catch (err: any) {
      showModal({
        title: "저장 실패",
        message: err.message,
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyHtml = () => {
    if (!result) return;

    const { summary } = result;
    const html = `
<h3>1. 현황 및 문제점</h3>
${renderAsList(summary.asis)}
<h3>2. 개선방향 (목적)</h3>
${renderAsList(summary.tobe)}
<h3>3. 기대효과</h3>
${renderAsList(summary.expected_effects)}
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
      showModal({
        title: "복사 완료",
        message: "HTML 형식이 클립보드에 복사되었습니다.",
        type: "success"
      });
    }).catch(err => {
      console.error("복사 실패:", err);
      showModal({
        title: "복사 실패",
        message: "복사 중 오류가 발생했습니다.",
        type: "error"
      });
    });
  };

  const handleSendToConfluence = () => {
    showModal({
      title: "WIKI 전송",
      message: "이 내용을 Confluence로 전송하시겠습니까?",
      type: "confirm",
      onConfirm: async () => {
        closeModal();
        await executeSendToConfluence();
      }
    });
  };

  const executeSendToConfluence = async () => {
    if (!result) return;
    setIsSendingToConfluence(true);
    try {
      const { summary } = result;
      const html = `
<h3>1. 현황 및 문제점</h3>
${renderAsList(summary.asis)}
<h3>2. 개선방향 (목적)</h3>
${renderAsList(summary.tobe)}
<h3>3. 기대효과</h3>
${renderAsList(summary.expected_effects)}
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
    ${summary.schedule.map((item: ScheduleItem) => `
    <tr>
      <td style="padding: 8px;">${item.task}</td>
      <td style="padding: 8px;">${item.assignee}</td>
      <td style="padding: 8px;">${item.dueDate}</td>
    </tr>
    `).join("")}
  </tbody>
</table>
      `.trim();

      const dateObj = new Date(meetingDate);
      const formattedDate = dateObj.getFullYear().toString() + "-" + 
                          (dateObj.getMonth() + 1).toString().padStart(2, '0') + "-" + 
                          dateObj.getDate().toString().padStart(2, '0');

      const res = await fetch("/api/confluence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[${formattedDate}] ${meetingTitle}`,
          html: html
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confluence 전송 실패");

      showModal({
        title: "전송 완료",
        message: "Confluence 페이지가 생성되었습니다.",
        type: "confirm",
        confirmText: "확인하기",
        cancelText: "닫기",
        onConfirm: () => {
          closeModal();
          window.open(data.url, "_blank");
        }
      });
    } catch (err: any) {
      showModal({
        title: "전송 실패",
        message: err.message,
        type: "error"
      });
    } finally {
      setIsSendingToConfluence(false);
    }
  };

  return (
    <>
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
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-cyan-400" />
            회의 참여자 관리
          </h3>
          {/* 자동 참여자 추가 슬라이드 토글 */}
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <span className={`text-sm font-medium transition-colors duration-200 ${
              autoAddParticipants ? "text-cyan-300" : "text-white/30"
            }`}>
              AI 자동인식
            </span>
            <button
              role="switch"
              aria-checked={autoAddParticipants}
              onClick={() => setAutoAddParticipants(prev => !prev)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${
                autoAddParticipants
                  ? "bg-cyan-500"
                  : "bg-white/15"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                autoAddParticipants ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </label>
        </div>
        <div className="flex flex-wrap md:flex-nowrap gap-4 mb-4">
          <select
            onChange={handleAddITMember}
            defaultValue=""
            disabled={autoAddParticipants}
            className={`bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white focus:border-cyan-400 transition-colors w-full md:w-auto min-w-[200px] ${
              autoAddParticipants ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <option value="" disabled className="text-gray-900">IT 팀원 선택 (필수참여)</option>
            {teamMembers.map(m => (
              <option key={m.id} value={`${m.team}:${m.name}`} className="text-gray-900">
                {m.team} {m.name}
              </option>
            ))}
          </select>

          <div className="flex gap-2 flex-1 w-full min-w-0">
            <input
              type="text"
              placeholder="팀명"
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              disabled={autoAddParticipants}
              className={`flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white focus:border-fuchsia-400 transition-colors min-w-0 ${
                autoAddParticipants ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            <input
              type="text"
              placeholder="이름/직급"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              disabled={autoAddParticipants}
              className={`flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 outline-none text-white focus:border-fuchsia-400 transition-colors min-w-0 ${
                autoAddParticipants ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            <button
              onClick={handleAddParticipant}
              disabled={autoAddParticipants}
              className={`bg-white/20 hover:bg-white/30 text-white px-4 py-3 rounded-xl transition-colors flex items-center justify-center shrink-0 ${
                autoAddParticipants ? "opacity-50 cursor-not-allowed" : ""
              }`}
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

      {/* 3. Upload / Record Section */}
      {!result && (
        <section className="w-full max-w-3xl mx-auto flex flex-col gap-6">
          {/* Tab Switcher */}
          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1.5 gap-1">
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                activeTab === "upload"
                  ? "bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white shadow-lg"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              파일 업로드
            </button>
            <button
              onClick={() => setActiveTab("record")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                activeTab === "record"
                  ? "bg-gradient-to-r from-rose-600 to-orange-500 text-white shadow-lg"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Mic className="w-4 h-4" />
              직접 녹음
            </button>
          </div>

          {/* Upload Tab */}
          {activeTab === "upload" && (
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
                ) : file && activeTab === "upload" ? (
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
                    <div className="bg-white/10 p-5 rounded-full ring-1 ring-white/20 mb-2">
                      <FileAudio className="w-10 h-10 text-cyan-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">오디오 파일 업로드 (또는 드래그 앤 드롭)</h3>
                    <p className="text-purple-300/80 text-sm">MP3, WAV, M4A 등 지원</p>
                  </>
                )}
              </div>
              <input type="file" accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} disabled={isUploading} />
            </div>
          )}

          {/* Record Tab */}
          {activeTab === "record" && (
            <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-white/20 bg-white/5 transition-all duration-300">
              <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                {isUploading ? (
                  <>
                    <div className="relative">
                      <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
                      <div className="absolute inset-0 blur-xl bg-cyan-500/30 rounded-full animate-pulse" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">AI가 회의를 분석하고 있습니다...</h3>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-cyan-300/80 text-sm italic animate-pulse">최적의 모델을 찾아 분석을 진행 중입니다...</p>
                      <p className="text-white/40 text-[11px] mt-2 font-medium bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        파일 크기에 따라 10초 ~ 40초 정도 소요됩니다
                      </p>
                    </div>
                  </>
                ) : recordedBlob && audioUrl ? (
                  // 녹음 완료 상태
                  <>
                    <div className="bg-green-500/20 p-4 rounded-full ring-1 ring-green-500/50">
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-semibold text-white">녹음 완료!</h3>
                      <p className="text-purple-300/80 text-sm">총 녹음 시간: {formatTime(recordingTime)}</p>
                    </div>
                    <audio controls src={audioUrl} className="w-full max-w-sm rounded-xl" />
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => handleUpload(recordedFileRef.current ?? undefined)}
                        className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg transform hover:-translate-y-0.5"
                      >
                        <Play className="w-4 h-4" />
                        분석 및 요약 시작하기
                      </button>
                      <button
                        onClick={resetRecording}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full font-semibold transition-all"
                      >
                        <MicOff className="w-4 h-4" />
                        다시 녹음
                      </button>
                    </div>
                  </>
                ) : isRecording ? (
                  // 녹음 중 상태
                  <>
                    {/* 음파 시각화 */}
                    <div className="flex items-end justify-center gap-1 h-16 w-48">
                      {audioLevels.map((level, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full bg-gradient-to-t from-rose-600 to-orange-400 transition-all duration-75"
                          style={{
                            height: `${Math.max(6, level * 64)}px`,
                            opacity: Math.max(0.3, level + 0.3),
                          }}
                        />
                      ))}
                    </div>
                    <div className="relative flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-rose-500/20 ring-2 ring-rose-500/50 flex items-center justify-center">
                        <Mic className="w-10 h-10 text-rose-400" />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-rose-500/10 animate-ping" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-mono font-bold text-rose-300">{formatTime(recordingTime)}</h3>
                      <p className="text-rose-300/70 text-sm">녹음 중...</p>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg transform hover:-translate-y-0.5"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      녹음 중지
                    </button>
                  </>
                ) : (
                  // 초기 상태
                  <>
                    <div className="bg-rose-500/10 p-5 rounded-full ring-1 ring-rose-500/30">
                      <Mic className="w-10 h-10 text-rose-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-white">실시간 녹음</h3>
                      <p className="text-purple-300/80 text-sm">버튼을 눌러 마이크로 회의를 바로 녹음하세요</p>
                    </div>
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg transform hover:-translate-y-0.5"
                    >
                      <Mic className="w-4 h-4" />
                      녹음 시작하기
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

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
          <div className="flex items-end gap-4 flex-1 bg-white/5 border border-white/10 p-4 pb-5 rounded-2xl backdrop-blur-xl">
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
            <div className="w-px h-10 bg-white/10 mx-2 mb-1" />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold ml-2">Meeting Date</label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white outline-none focus:border-cyan-400 transition-all text-sm h-[42px]"
              />
            </div>
            <div className="ml-auto flex items-center gap-3 mb-0.5">
              <button
                onClick={() => setShowTaskTemplate(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg border border-white/10"
              >
                <LayoutGrid className="w-5 h-5" />
                일감진행
              </button>
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
              {/* Speaker Mapping Section */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-xl">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {Object.keys(speakerMap).map((speaker) => (
                    <div key={speaker} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-cyan-400/80 ml-1 truncate">{speaker}</label>
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
                
                <h4 className="text-sm font-bold text-white/50 mb-4 uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-white/5">
                  <FileText className="w-4 h-4" />
                  대화 내역 (Transcript)
                </h4>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin max-h-[500px]">
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
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                      {result.summary.asis.split("\n\n").filter(p => p.trim()).map((p, pIdx) => (
                        <ul key={pIdx} className="list-disc list-inside space-y-2 text-white/90 leading-relaxed">
                          {p.split("\n").filter(line => line.trim()).map((line, i) => (
                            <li key={i}>{line.trim()}</li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  </div>
                  <div className="group">
                    <h4 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span> 2. 개선방향 (목적)
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                      {result.summary.tobe.split("\n\n").filter(p => p.trim()).map((p, pIdx) => (
                        <ul key={pIdx} className="list-disc list-inside space-y-2 text-white/90 leading-relaxed">
                          {p.split("\n").filter(line => line.trim()).map((line, i) => (
                            <li key={i}>{line.trim()}</li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  </div>
                  <div className="group">
                    <h4 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span> 3. 기대효과
                    </h4>
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                      {result.summary.expected_effects.split("\n\n").filter(p => p.trim()).map((p, pIdx) => (
                        <ul key={pIdx} className="list-disc list-inside space-y-2 text-white/90 leading-relaxed">
                          {p.split("\n").filter(line => line.trim()).map((line, i) => (
                            <li key={i}>{line.trim()}</li>
                          ))}
                        </ul>
                      ))}
                    </div>
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


      {/* Task Template Modal */}
      {showTaskTemplate && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-amber-500/10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500 rounded-2xl text-white">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">일감 진행 초안 생성</h3>
                  <p className="text-orange-200/60 text-sm">회의 내용을 기반으로 단위/중점 업무 양식을 구성했습니다.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTaskTemplate(false)}
                className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-thin max-h-[calc(90vh-200px)]">
              {/* 단위업무 Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                  <h4 className="text-xl font-bold text-white">단위 업무 (Unit Tasks)</h4>
                </div>
                <div className="space-y-3">
                  {result.summary.schedule.map((task, idx) => (
                    <div key={idx} className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl group hover:bg-white/[0.08] transition-all">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-12 gap-4">
                        <div className="col-span-7">
                          <label className="text-[10px] font-bold text-white/30 uppercase block mb-1">Task Name</label>
                          <input 
                            type="text" 
                            defaultValue={task.task}
                            className="bg-transparent text-white font-medium outline-none w-full"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] font-bold text-white/30 uppercase block mb-1">Assignee</label>
                          <input 
                            type="text" 
                            defaultValue={task.assignee}
                            className="bg-transparent text-amber-200 outline-none w-full"
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <label className="text-[10px] font-bold text-white/30 uppercase block mb-1">Due Date</label>
                          <input 
                            type="text" 
                            defaultValue={task.dueDate}
                            className="bg-transparent text-white/60 text-sm outline-none w-full text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-white/40 font-medium hover:bg-white/5 hover:border-white/20 transition-all">
                    + 업무 추가하기
                  </button>
                </div>
              </section>

              {/* 중점업무 Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                  <h4 className="text-xl font-bold text-white">중점 업무 (Key Tasks)</h4>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/30 transition-colors">
                    <label className="text-[10px] uppercase font-bold text-orange-400 mb-2 block tracking-widest">Strategic Goal</label>
                    <textarea 
                      className="w-full bg-transparent text-white text-lg font-medium leading-relaxed outline-none resize-none min-h-[100px]"
                      defaultValue={result.summary.tobe}
                    />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/30 transition-colors">
                    <label className="text-[10px] uppercase font-bold text-orange-400 mb-2 block tracking-widest">Expected Outcome</label>
                    <textarea 
                      className="w-full bg-transparent text-white/80 leading-relaxed outline-none resize-none min-h-[80px]"
                      defaultValue={result.summary.expected_effects}
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-white/10 bg-white/[0.02] flex items-center justify-end gap-4">
              <button 
                onClick={() => setShowTaskTemplate(false)}
                className="px-6 py-3 rounded-xl text-white font-semibold hover:bg-white/10 transition-all"
              >
                취소
              </button>
              <button 
                onClick={handleSendToConfluence}
                disabled={isSendingToConfluence}
                className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl font-bold shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isSendingToConfluence ? <Loader2 className="w-5 h-5 animate-spin" /> : "WIKI 전송"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />
    </main>
    </>
  );
}
