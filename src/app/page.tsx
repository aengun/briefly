"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, Save, Mic, MicOff, Square, Play, LayoutGrid, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "../components/Modal";
import MeetingConfluenceModal from "../components/MeetingConfluenceModal";
import TranscriptPlayer from "../components/TranscriptPlayer";
import VisualizationPopup from "../components/VisualizationPopup";
import WorkProgressModal from "../components/WorkProgressModal";
import { validateAnalyzableContent } from "@/lib/analysis-guard";
import {
  buildMeetingTitle,
  extractMeetingTopic,
  formatMeetingDateDots,
  formatMeetingSummaryByStructure,
  getMeetingSummaryTextareaRows,
  formatParticipantSummary,
  inferMeetingSummaryStructure,
  meetingSummaryStructures,
  type MeetingSummaryStructure,
} from "@/lib/meeting-summary";

// Define the interfaces based on our DB types
type ScheduleItem = {
  task: string;
  assignee: string;
  dueDate: string;
};

type TranscriptUtterance = {
  id?: string;
  speaker: string;
  text: string;
  start?: number;
  end?: number;
  startTime?: number;
  endTime?: number;
};

type SourceType = "upload" | "realtime";

type SummaryResult = {
  audioUrl: string;
  transcript: TranscriptUtterance[];
  summary: {
    topic?: string;
    title?: string;
    mainTopic?: string;
    keyDiscussion?: string;
    asis: string;
    tobe: string;
    expected_effects: string;
    schedule: ScheduleItem[];
  };
};

type AnalysisErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_FILE_TYPE"
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_FAILED"
  | "TRANSCRIPTION_FAILED"
  | "INSUFFICIENT_MEETING_CONTENT"
  | "AI_ANALYSIS_FAILED"
  | "PARSE_FAILED"
  | "TIMEOUT"
  | "CONFIG_ERROR"
  | "UNKNOWN_ERROR";

type AppErrorCode =
  | AnalysisErrorCode
  | "SAVE_FAILED"
  | "STORAGE_UNAVAILABLE"
  | "NORMALIZE_FAILED"
  | "NETWORK_ERROR";

type SummaryApiResponse = Partial<SummaryResult> & {
  usedModel?: string;
  error?: string;
  code?: string;
  errorCode?: AnalysisErrorCode;
  message?: string;
  userMessage?: string;
  debugId?: string;
  stage?: string;
};

type SummaryApiError = Error & {
  code?: AppErrorCode;
  userMessage?: string;
  debugId?: string;
  stage?: string;
};

type SaveApiResponse = {
  success?: boolean;
  meeting?: SavedMeeting;
  error?: string;
  message?: string;
  userMessage?: string;
  errorCode?: string;
  debugId?: string;
  stage?: string;
};

export type Participant = {
  id: string;
  team: string;
  name: string;
};

type SavedMeeting = {
  id: string;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const getStageLabel = (stage?: string) => {
  if (stage === "request") return "파일 확인 중";
  if (stage === "upload") return "파일 업로드 중";
  if (stage === "transcription") return "대화 내용 변환 중";
  if (stage === "summary") return "회의 내용 분석 중";
  if (stage === "save") return "회의록 저장 중";
  if (stage === "read") return "회의록 조회 중";
  return "";
};

const buildSaveError = (data: SaveApiResponse | null) => {
  const message = data?.userMessage || data?.error || data?.message || "회의록 저장에 실패했습니다. 저장소 또는 서버 연결 상태를 확인해주세요.";
  const error = new Error(message) as SummaryApiError;
  error.code = (data?.errorCode || "SAVE_FAILED") as AppErrorCode;
  error.userMessage = message;
  error.debugId = data?.debugId;
  error.stage = data?.stage || "save";
  return error;
};

const buildSummaryApiError = (
  response: Response,
  data: SummaryApiResponse | null,
  sourceType: SourceType
) => {
  const code = data?.errorCode || (data?.code as AnalysisErrorCode | undefined);
  const serverMessage = data?.userMessage || data?.error || data?.message || "";
  const title = sourceType === "realtime" ? "녹음 분석 오류" : "분석 오류";

  const fallbackMessageByCode: Partial<Record<AnalysisErrorCode, string>> = {
    INVALID_REQUEST: "분석할 파일이 없습니다.",
    UNSUPPORTED_FILE_TYPE: "지원하지 않는 파일 형식입니다. mp3, wav, m4a, mp4 등 지원 형식의 파일을 업로드해주세요.",
    UPLOAD_TOO_LARGE: "업로드 가능한 파일 용량을 초과했습니다. 파일 크기를 줄인 후 다시 시도해주세요.",
    UPLOAD_FAILED: "녹화파일을 불러오지 못했습니다. 파일 접근 권한 또는 저장 상태를 확인해주세요.",
    TRANSCRIPTION_FAILED: sourceType === "realtime"
      ? "녹음된 내용이 부족해 회의록을 생성할 수 없습니다. 회의 분석을 위해 더 충분한 대화 내용을 녹음해주세요."
      : "녹화파일에서 음성을 텍스트로 변환하지 못했습니다. 음성이 포함되어 있는지 확인해주세요.",
    INSUFFICIENT_MEETING_CONTENT: sourceType === "realtime"
      ? "녹음된 내용이 부족해 회의록을 생성할 수 없습니다. 회의 분석을 위해 더 충분한 대화 내용을 녹음해주세요."
      : "분석 가능한 회의 내용이 부족합니다. 업로드한 파일에서 충분한 회의 내용을 찾지 못했습니다.",
    AI_ANALYSIS_FAILED: "회의록 분석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    PARSE_FAILED: "회의록 분석 결과 형식이 맞지 않았습니다. 잠시 후 다시 시도해주세요.",
    TIMEOUT: "분석 요청 시간이 초과되었습니다. 파일이 너무 크거나 네트워크가 불안정할 수 있습니다.",
    CONFIG_ERROR: "분석 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.",
    UNKNOWN_ERROR: "분석 중 오류가 발생했습니다. 오류 원인을 기록했으며, 관리자 확인이 필요합니다.",
  };

  const message =
    serverMessage ||
    (code && fallbackMessageByCode[code]) ||
    (response.status === 413 ? fallbackMessageByCode.UPLOAD_TOO_LARGE : "") ||
    (response.status === 415 ? fallbackMessageByCode.UNSUPPORTED_FILE_TYPE : "") ||
    (response.status === 422 ? fallbackMessageByCode.INSUFFICIENT_MEETING_CONTENT : "") ||
    (response.status === 429 ? "현재 AI 사용량이 많아 잠시 후 다시 시도해주세요. (할당량 초과)" : "") ||
    (response.status === 503 ? "분석 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요." : "") ||
    (response.status >= 500 ? fallbackMessageByCode.UNKNOWN_ERROR : "") ||
    "분석 중 오류가 발생했습니다. 오류 원인을 기록했으며, 관리자 확인이 필요합니다.";

  const error = new Error(message) as SummaryApiError;
  error.code = code;
  error.userMessage = message;
  error.stage = data?.stage;
  error.debugId = data?.debugId;
  return { error, title, message };
};

const normalizeSummaryResult = (value: Partial<SummaryResult>): SummaryResult => ({
  audioUrl: value.audioUrl || "",
  transcript: Array.isArray(value.transcript)
    ? value.transcript.map((item, index) => ({
      id: item?.id || `seg-${index + 1}`,
      speaker: item?.speaker || "알 수 없음",
      text: item?.text || "",
      start: typeof item?.start === "number" ? item.start : typeof item?.startTime === "number" ? item.startTime : undefined,
      end: typeof item?.end === "number" ? item.end : typeof item?.endTime === "number" ? item.endTime : undefined,
    }))
    : [],
  summary: {
    topic: value.summary?.topic || "",
    title: value.summary?.title || "",
    mainTopic: value.summary?.mainTopic || "",
    keyDiscussion: value.summary?.keyDiscussion || "",
    asis: value.summary?.asis || "",
    tobe: value.summary?.tobe || "",
    expected_effects: value.summary?.expected_effects || "",
    schedule: Array.isArray(value.summary?.schedule)
      ? value.summary.schedule.map((item) => ({
        task: item?.task || "",
        assignee: item?.assignee || "",
        dueDate: item?.dueDate || ""
      }))
      : []
  }
});

const recordingMimeCandidates = [
  "audio/mp4",
  "audio/aac",
  "audio/webm;codecs=opus",
  "audio/webm",
];

const getSupportedRecordingMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return recordingMimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const getRecordingExtension = (mimeType: string) => {
  if (/mp4|aac|m4a/i.test(mimeType)) return "m4a";
  if (/wav/i.test(mimeType)) return "wav";
  return "webm";
};

export default function Home() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [participants] = useState<Participant[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisTime, setAnalysisTime] = useState(0);
  const [analysisStage, setAnalysisStage] = useState("");
  const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);
  const [resultSourceType, setResultSourceType] = useState<SourceType>("upload");
  const [archiveStatusMessage, setArchiveStatusMessage] = useState<string | null>(null);
  const [archiveErrorMessage, setArchiveErrorMessage] = useState<string | null>(null);

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
  const audioUrlRef = useRef<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(12).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobEvent["data"][]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedFileRef = useRef<File | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [showTaskTemplate, setShowTaskTemplate] = useState(false);
  const [showVisualizationPopup, setShowVisualizationPopup] = useState(false);
  const [showMeetingConfluenceModal, setShowMeetingConfluenceModal] = useState(false);
  const [summaryStructure, setSummaryStructure] = useState<MeetingSummaryStructure>("안건중심");
  const [meetingOverviewText, setMeetingOverviewText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent Hydration mismatch by setting initial date on client only
  useEffect(() => {
    setMeetingDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const replaceAudioUrl = (nextUrl: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  };

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

      const recordingMimeType = getSupportedRecordingMimeType();
      const mediaRecorder = recordingMimeType
        ? new MediaRecorder(stream, { mimeType: recordingMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // 애니메이션 중지
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioLevels(Array(12).fill(0));

        const blobType = mediaRecorder.mimeType || recordingMimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        replaceAudioUrl(url);
        // ref에 즉시 저장 (state 업데이트 지연 방지)
        const recordedFile = new File([blob], `recording_${Date.now()}.${getRecordingExtension(blobType)}`, { type: blobType });
        recordedFileRef.current = recordedFile;
        setFile(recordedFile);
        setResult(null);
        setError(null);
        setSavedMeetingId(null);
        setArchiveStatusMessage(null);
        setArchiveErrorMessage(null);
        stream.getTracks().forEach(track => track.stop());
        audioCtx.close();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedBlob(null);
      replaceAudioUrl(null);
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
    replaceAudioUrl(null);
    setFile(null);
    setRecordingTime(0);
    setError(null);
    setSavedMeetingId(null);
    setArchiveStatusMessage(null);
    setArchiveErrorMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setRecordedBlob(null);
      recordedFileRef.current = null;
      replaceAudioUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
      setSavedMeetingId(null);
      setArchiveStatusMessage(null);
      setArchiveErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setRecordedBlob(null);
      recordedFileRef.current = null;
      replaceAudioUrl(URL.createObjectURL(droppedFile));
      setResult(null);
      setError(null);
      setSavedMeetingId(null);
      setArchiveStatusMessage(null);
      setArchiveErrorMessage(null);
    }
  };


  const persistMeetingToArchive = async ({
    meetingResult,
    title,
    sourceType,
    participantsForSave,
    existingMeetingId
  }: {
    meetingResult: SummaryResult;
    title: string;
    sourceType: SourceType;
    participantsForSave: Participant[];
    existingMeetingId?: string | null;
  }) => {
    const mappedTranscript = Array.isArray(meetingResult.transcript) ? meetingResult.transcript.map(u => ({
      id: u.id,
      speaker: u.speaker || "알 수 없음",
      text: u.text || "",
      start: typeof u.start === "number" ? u.start : typeof u.startTime === "number" ? u.startTime : undefined,
      end: typeof u.end === "number" ? u.end : typeof u.endTime === "number" ? u.endTime : undefined,
    })).filter(u => u.text.trim()) : [];

    const schedule = Array.isArray(meetingResult.summary?.schedule)
      ? meetingResult.summary.schedule.map(item => ({
        task: item?.task || "",
        assignee: item?.assignee || "",
        dueDate: item?.dueDate || "",
      }))
      : [];

    const payload = {
      title: title.trim() || "제목 없는 회의록",
      sourceType,
      meetingDate: meetingDate || new Date().toISOString().split("T")[0],
      audioUrl: meetingResult.audioUrl,
      participants: Array.isArray(participantsForSave) ? participantsForSave.map(p => ({
        team: p.team || "미지정",
        name: p.name || "이름 없음"
      })) : [],
      transcript: mappedTranscript,
      summary: {
        asis: meetingResult.summary?.asis || "",
        tobe: meetingResult.summary?.tobe || "",
        expected_effects: meetingResult.summary?.expected_effects || "",
        schedule,
      }
    };

    const res = await fetch(existingMeetingId ? `/api/meetings/${existingMeetingId}` : "/api/meetings", {
      method: existingMeetingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null) as SaveApiResponse | null;
    if (!res.ok) {
      throw buildSaveError(data);
    }

    if (!data?.meeting?.id) {
      throw new Error("회의록 저장 응답을 확인하지 못했습니다.");
    }

    return data.meeting;
  };

  const handleUpload = async (fileOverride?: File, sourceTypeOverride?: SourceType) => {
    const targetFile = fileOverride ?? file;
    if (!targetFile) return;
    const sourceType = sourceTypeOverride ?? (activeTab === "record" ? "realtime" : "upload");
    if (targetFile.size < 1024) {
      const message = sourceType === "realtime"
        ? "녹음된 음성이 비어 있거나 너무 짧습니다. 회의 분석을 위해 더 충분한 대화를 녹음해주세요."
        : "분석 가능한 회의 내용이 부족합니다. 더 긴 회의 음성 또는 명확한 대화가 포함된 파일을 업로드해주세요.";
      setError(message);
      showModal({
        title: sourceType === "realtime" ? "녹음 내용 부족" : "분석 내용 부족",
        message,
        type: "error"
      });
      return;
    }

    setIsUploading(true);
    setAnalysisTime(0);
    setAnalysisStage("파일 확인 중");
    setError(null);
    setSavedMeetingId(null);
    setResultSourceType(sourceType);
    setArchiveStatusMessage(null);
    setArchiveErrorMessage(null);

    // 분석 타이머 시작
    analysisTimerRef.current = setInterval(() => {
      setAnalysisTime(prev => prev + 1);
    }, 1000);

    const formData = new FormData();
    formData.append("file", targetFile);

    try {
      setAnalysisStage("대화 내용 변환 중");
      const response = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null) as SummaryApiResponse | null;
      if (!response.ok) {
        const apiError = buildSummaryApiError(response, data, sourceType);
        throw apiError.error;
      }
      if (!data) {
        throw new Error("분석 응답을 확인하지 못했습니다.");
      }

      setAnalysisStage("회의 내용 분석 중");
      const normalizedResult = normalizeSummaryResult(data);
      const validation = validateAnalyzableContent(normalizedResult.transcript);
      if (!validation.isAnalyzable) {
        throw new Error(validation.message);
      }
      const inferredStructure = inferMeetingSummaryStructure(normalizedResult.summary, normalizedResult.transcript);
      const generatedTitle = buildMeetingTitle({
        meetingDate: meetingDate || new Date(),
        summary: normalizedResult.summary,
        transcript: normalizedResult.transcript,
      });
      setSummaryStructure(inferredStructure);
      setMeetingOverviewText(formatMeetingSummaryByStructure({
        structure: inferredStructure,
        summary: normalizedResult.summary,
        transcript: normalizedResult.transcript,
      }));
      setResult(normalizedResult);
      setMeetingTitle(generatedTitle);

      if (data.usedModel) {
        console.log(`Used AI Model: ${data.usedModel}`);
      }
      
      // 발화자 자동 명명 (참가자1, 참가자2...)
      if (Array.isArray(normalizedResult.transcript)) {
        const speakerNames: Record<string, string> = {};
        let speakerCount = 0;
        normalizedResult.transcript = normalizedResult.transcript.map(u => {
          if (!speakerNames[u.speaker]) {
            speakerCount++;
            speakerNames[u.speaker] = `참가자${speakerCount}`;
          }
          return { ...u, speaker: speakerNames[u.speaker] };
        });
      }

      try {
        setAnalysisStage("회의록 저장 중");
        const savedMeeting = await persistMeetingToArchive({
          meetingResult: normalizedResult,
          title: generatedTitle,
          sourceType,
          participantsForSave: participants,
          existingMeetingId: null
        });
        setSavedMeetingId(savedMeeting.id);
        setArchiveStatusMessage("회의록 보관소에 저장되었습니다.");
        showModal({
          title: "저장 완료",
          message: "회의록 보관소에 저장되었습니다.",
          type: "success"
        });
      } catch (saveErr: unknown) {
        const saveMessage = getErrorMessage(saveErr) || "회의록 저장에 실패했습니다. 저장소 또는 서버 연결 상태를 확인해주세요.";
        setArchiveErrorMessage(saveMessage);
        showModal({
          title: "저장 실패",
          message: saveMessage,
          type: "error"
        });
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      const typedError = err as Partial<SummaryApiError> & { status?: number };
      let friendlyError = typedError.userMessage || message || "분석 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      let modalTitle = sourceType === "realtime" ? "녹음 분석 오류" : "분석 오류";
      const stageLabel = getStageLabel(typedError.stage);

      if (
        typedError.code === "INSUFFICIENT_MEETING_CONTENT" ||
        message.includes("분석 가능한") ||
        message.includes("충분한 회의") ||
        message.includes("더 긴 음성") ||
        message.includes("회의 분석에 필요한")
      ) {
        modalTitle = sourceType === "realtime" ? "녹음 내용 부족" : "분석 내용 부족";
        friendlyError = sourceType === "realtime"
          ? "녹음된 내용이 부족해 회의록을 생성할 수 없습니다. 회의 분석을 위해 더 충분한 대화 내용을 녹음해주세요."
          : "분석 가능한 회의 내용이 부족합니다. 업로드한 파일에서 충분한 회의 내용을 찾지 못했습니다.";
        setResult(null);
        setShowTaskTemplate(false);
      } else if (
        typedError.code === "UNSUPPORTED_FILE_TYPE" ||
        message.includes("지원하지 않는 파일 형식")
      ) {
        friendlyError = "지원하지 않는 파일 형식입니다. mp3, wav, m4a, mp4 등 지원 형식의 파일을 업로드해주세요.";
      } else if (
        typedError.code === "UPLOAD_TOO_LARGE" ||
        message.includes("용량을 초과") ||
        message.includes("file is too large")
      ) {
        friendlyError = "업로드 가능한 파일 용량을 초과했습니다. 파일 크기를 줄인 후 다시 시도해주세요.";
      } else if (
        typedError.code === "TRANSCRIPTION_FAILED" ||
        message.includes("음성을 텍스트로 변환하지 못했습니다")
      ) {
        friendlyError = sourceType === "realtime"
          ? "녹음된 내용이 부족해 회의록을 생성할 수 없습니다. 회의 분석을 위해 더 충분한 대화 내용을 녹음해주세요."
          : "녹화파일에서 음성을 텍스트로 변환하지 못했습니다. 음성이 포함되어 있는지 확인해주세요.";
      } else if (typedError.code === "CONFIG_ERROR") {
        friendlyError = "분석 서비스 설정에 문제가 있습니다. 관리자에게 문의해주세요.";
      } else if (typedError.code === "TIMEOUT" || message.includes("시간이 초과")) {
        friendlyError = "분석 요청 시간이 초과되었습니다. 파일이 너무 크거나 네트워크가 불안정할 수 있습니다.";
      } else if (
        typedError.code === "AI_ANALYSIS_FAILED" ||
        message.includes("회의록 분석 처리 중 오류") ||
        message.includes("분석 서버가 일시적으로 응답하지 않습니다.")
      ) {
        friendlyError = "회의록 분석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      } else if (typedError.code === "PARSE_FAILED") {
        friendlyError = "회의록 분석 결과 형식이 맞지 않았습니다. 잠시 후 다시 시도해주세요.";
      } else if (
        message.includes("Failed to fetch") ||
        message.includes("NetworkError") ||
        message.includes("fetch failed")
      ) {
        friendlyError = "분석 요청 시간이 초과되었습니다. 파일이 너무 크거나 네트워크가 불안정할 수 있습니다.";
      } else if (message.includes("403") || message.includes("권한")) {
        friendlyError = "연동 권한 오류가 발생했습니다. 키 설정을 확인해 주세요.";
      } else if (message.includes("Gemini API has not been used") || message.includes("SERVICE_DISABLED")) {
        friendlyError = "분석 서비스가 현재 활성화되어 있지 않습니다. 관리자에게 문의해주세요.";
      } else if (typedError.status === 429 || message.includes("429")) {
        friendlyError = "현재 AI 사용량이 많아 잠시 후 다시 시도해 주세요. (할당량 초과)";
      } else if (typedError.status === 503 || message.includes("503") || message.includes("Service Unavailable")) {
        friendlyError = "분석 서버가 일시적으로 바쁩니다. 약 1분 후 다시 시도해 주세요.";
      }
      if (stageLabel && typedError.code !== "INSUFFICIENT_MEETING_CONTENT" && !friendlyError.includes(stageLabel)) {
        friendlyError = `${stageLabel} 오류가 발생했습니다. ${friendlyError}`;
      }
      setError(friendlyError);
      showModal({
        title: modalTitle,
        message: friendlyError,
        type: "error"
      });
    } finally {
      setIsUploading(false);
      setAnalysisStage("");
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }
    }
  };

  const changeSummaryStructure = (structure: MeetingSummaryStructure) => {
    setSummaryStructure(structure);
    if (!result) return;
    setMeetingOverviewText(formatMeetingSummaryByStructure({
      structure,
      summary: result.summary,
      transcript: result.transcript,
    }));
  };

  const handleSaveToArchive = async () => {
    if (!result) return;
    setIsSaving(true);
    setArchiveStatusMessage(null);
    setArchiveErrorMessage(null);
    try {
      const savedMeeting = await persistMeetingToArchive({
        meetingResult: result,
        title: meetingTitle || "제목 없는 회의록",
        sourceType: resultSourceType,
        participantsForSave: participants,
        existingMeetingId: savedMeetingId
      });
      setSavedMeetingId(savedMeeting.id);
      setArchiveStatusMessage("회의록 보관소에 저장되었습니다.");
      showModal({
        title: "저장 완료",
        message: "회의록 보관소에 저장되었습니다.",
        type: "success"
      });
      router.push("/archives");
    } catch (err: unknown) {
      const saveMessage = getErrorMessage(err) || "회의록 저장에 실패했습니다. 저장소 또는 서버 연결 상태를 확인해주세요.";
      setArchiveErrorMessage(saveMessage);
      showModal({
        title: "저장 실패",
        message: saveMessage,
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentMeetingTopic = result ? extractMeetingTopic(result.summary, result.transcript) : "제목 없는 회의록";
  const currentMeetingDateText = formatMeetingDateDots(meetingDate || new Date());
  const currentParticipantText = result ? formatParticipantSummary(participants, result.transcript) : "참석자 미확인";

  return (
    <>
    <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-12">
      {/* 1. Intro Section */}
      {!result && (
        <div className="text-center space-y-6 max-w-2xl mx-auto mt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h2 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400">
            회의 녹음을<br />실행 가능한 회의록으로
          </h2>
          <p className="text-lg text-purple-200/80 leading-relaxed">
            오디오 녹음 파일을 업로드하세요. Briefly가 참석자 식별과 회의록 분석을 진행하고,
            현업 요구사항에 맞춘 현황, 개선방향, 기대효과, 일감 일정을 자동 생성합니다.
          </p>
        </div>
      )}

      {/* 2. Upload / Record Section */}
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
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-2xl font-mono font-bold text-fuchsia-300">{formatTime(analysisTime)}</span>
                      <p className="text-purple-300/80 text-sm">{analysisStage || "회의 내용을 처리 중입니다."}</p>
                    </div>
                  </>
                ) : file && activeTab === "upload" ? (
                  <>
                    <div className="bg-green-500/20 p-4 rounded-full ring-1 ring-green-500/50 mb-2">
                      <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white truncate max-w-[250px]">{file.name}</h3>
                    <p className="text-purple-300/80 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUpload(undefined, "upload"); }}
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
                    <h3 className="text-xl font-semibold text-white">음성/영상 파일 업로드 (또는 드래그 앤 드롭)</h3>
                    <p className="text-purple-300/80 text-sm">MP3, WAV, M4A, MP4, WEBM 등 지원</p>
                  </>
                )}
              </div>
              <input type="file" accept="audio/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} disabled={isUploading} />
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
                      <span className="text-2xl font-mono font-bold text-cyan-300">{formatTime(analysisTime)}</span>
                      <p className="text-cyan-300/80 text-sm">{analysisStage || "회의 내용을 처리 중입니다."}</p>
                      <p className="text-cyan-300/80 text-sm italic animate-pulse mt-2">최적의 모델을 찾아 분석을 진행 중입니다...</p>
                      <p className="text-white/40 text-[11px] mt-1 font-medium bg-white/5 px-3 py-1 rounded-full border border-white/10">
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
                        onClick={() => handleUpload(recordedFileRef.current ?? undefined, "realtime")}
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
              <span className="shrink-0 font-bold bg-red-500/20 text-red-400 p-1 rounded-md">오류</span>
              <span>{error}</span>
            </div>
          )}
        </section>
      )}

      {/* 4. Result Section */}
      {result && (
        <section className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-col gap-4 bg-white/5 border border-white/10 p-4 pb-5 rounded-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] tracking-widest text-white/40 font-bold ml-2">회의록 제목</label>
              <textarea
                value={meetingTitle}
                onChange={e => setMeetingTitle(e.target.value)}
                rows={2}
                className="min-h-[74px] w-full resize-y rounded-xl border border-transparent bg-black/10 px-3 py-2 text-2xl font-bold leading-snug text-white outline-none transition focus:border-white/20"
                placeholder="회의 제목을 입력하세요"
              />
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] tracking-widest text-white/40 font-bold ml-2">회의일</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={e => {
                      const nextDate = e.target.value;
                      setMeetingDate(nextDate);
                      if (result) {
                        setMeetingTitle(buildMeetingTitle({
                          meetingDate: nextDate,
                          summary: result.summary,
                          transcript: result.transcript,
                        }));
                      }
                    }}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white outline-none focus:border-cyan-400 transition-all text-sm h-[42px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] tracking-widest text-white/40 font-bold ml-2">분석 출처</label>
                  <span className={`inline-flex h-[42px] items-center rounded-xl border px-4 text-sm font-bold ${
                    resultSourceType === "realtime"
                      ? "border-rose-400/30 bg-rose-500/15 text-rose-200"
                      : "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
                  }`}>
                    {resultSourceType === "realtime" ? "실시간 녹화" : "업로드 파일"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-0.5">
              <button
                onClick={() => setShowTaskTemplate(true)}
                disabled={!validateAnalyzableContent(result.transcript).isAnalyzable}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg border border-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                title={!validateAnalyzableContent(result.transcript).isAnalyzable ? "분석 가능한 회의 내용이 부족해 일감진행을 생성할 수 없습니다." : undefined}
              >
                <LayoutGrid className="w-5 h-5" />
                일감진행
              </button>
              <button
                onClick={() => setShowVisualizationPopup(true)}
                disabled={result.transcript.length === 0 && !result.summary.asis.trim() && !result.summary.tobe.trim() && !result.summary.expected_effects.trim()}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg border border-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LayoutGrid className="w-5 h-5" />
                회의내용 도식화
              </button>
              <button
                onClick={() => setShowMeetingConfluenceModal(true)}
                disabled={!validateAnalyzableContent(result.transcript).isAnalyzable}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                title={!validateAnalyzableContent(result.transcript).isAnalyzable ? "분석 가능한 회의 내용이 부족해 회의록을 등록할 수 없습니다." : undefined}
              >
                <Share2 className="w-5 h-5" />
                회의록 등록
              </button>
              <button
                onClick={handleSaveToArchive}
                disabled={isSaving}
                className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {savedMeetingId ? "보관소 업데이트" : "보관소에 저장"}
              </button>
              </div>
            </div>
          </div>
          {(archiveStatusMessage || archiveErrorMessage) && (
            <div className={`rounded-2xl border px-5 py-3 text-sm font-medium ${
              archiveErrorMessage
                ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                : "border-green-500/30 bg-green-500/10 text-green-100"
            }`}>
              {archiveErrorMessage || archiveStatusMessage}
            </div>
          )}

          <div className="w-full flex flex-col gap-8">
            <div className="w-full flex flex-col gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden sm:p-8">
                <div className="flex flex-col gap-6">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white/55">
                      {currentMeetingDateText} {currentParticipantText}
                    </p>
                    <div>
                      <p className="mb-2 text-sm font-bold tracking-widest text-cyan-300">회의주제</p>
                      <h3 className="max-w-5xl text-2xl font-extrabold leading-snug text-white">
                        {currentMeetingTopic}
                      </h3>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label htmlFor="meeting-summary-text" className="text-sm font-bold tracking-widest text-white/70">
                        회의 내용 요약
                      </label>
                      <select
                        value={summaryStructure}
                        onChange={event => changeSummaryStructure(event.target.value as MeetingSummaryStructure)}
                        className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300"
                      >
                        {meetingSummaryStructures.map(option => (
                          <option key={option} value={option} className="text-gray-900">{option}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      id="meeting-summary-text"
                      value={meetingOverviewText}
                      onChange={event => setMeetingOverviewText(event.target.value)}
                      rows={getMeetingSummaryTextareaRows(meetingOverviewText)}
                      className="min-h-[520px] w-full resize-y overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-5 text-[15px] leading-8 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/60"
                      placeholder="분석 가능한 회의 내용이 부족합니다."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 회의록 전문 (하단 배치) */}
            <div className="w-full flex flex-col gap-6">
              <TranscriptPlayer
                audioUrl={audioUrl || result.audioUrl}
                transcript={result.transcript}
                title="대화 원문"
                emptyMessage="대화 원문을 불러올 수 없습니다."
              />
            </div>
          </div>
        </section>
      )}


      <WorkProgressModal
        isOpen={showTaskTemplate && Boolean(result)}
        onClose={() => setShowTaskTemplate(false)}
        onSuccess={(data) => {
          setShowTaskTemplate(false);
          showModal({
            title: "전송 완료",
            message: "WIKI 전송이 완료되었습니다. 등록된 단위업무 페이지를 보시겠습니까?",
            type: "confirm",
            confirmText: "예",
            cancelText: "아니오",
            onConfirm: () => {
              closeModal();
              if (data.unitPage?.url) window.open(data.unitPage.url, "_blank");
            }
          });
        }}
        meetingTitle={meetingTitle}
        meetingDate={meetingDate}
        participants={participants}
        summary={result?.summary || { asis: "", tobe: "", expected_effects: "", schedule: [] }}
        />
      <VisualizationPopup
        isOpen={showVisualizationPopup && Boolean(result)}
        onClose={() => setShowVisualizationPopup(false)}
        transcript={result?.transcript || []}
        summary={result?.summary || { asis: "", tobe: "", expected_effects: "", schedule: [] }}
      />
      <MeetingConfluenceModal
        isOpen={showMeetingConfluenceModal && Boolean(result)}
        onClose={() => setShowMeetingConfluenceModal(false)}
        meetingDate={meetingDate}
        participants={participants}
        transcript={result?.transcript || []}
        summary={result?.summary || { asis: "", tobe: "", expected_effects: "", schedule: [] }}
        overviewText={meetingOverviewText}
        onSuccess={(page) => {
          showModal({
            title: "등록 완료",
            message: "회의록이 Confluence에 등록되었습니다.",
            type: "confirm",
            confirmText: "페이지 확인",
            cancelText: "닫기",
            onConfirm: () => {
              closeModal();
              if (page.url) window.open(page.url, "_blank");
            }
          });
        }}
      />
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
