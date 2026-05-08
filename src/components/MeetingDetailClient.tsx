"use client";

import { useState, useEffect } from "react";
import { Calendar, UsersRound, Save, Loader2, Users, UserPlus, Share2, LayoutGrid, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import MeetingConfluenceModal from "./MeetingConfluenceModal";
import Modal from "./Modal";
import TranscriptPlayer from "./TranscriptPlayer";
import VisualizationPopup from "./VisualizationPopup";
import WorkProgressModal from "./WorkProgressModal";
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

type Participant = {
  id: string;
  team: string;
  name: string;
};

type TranscriptUtterance = {
  id: string;
  speaker: string;
  text: string;
  start?: number;
  end?: number;
  startTime?: number;
  endTime?: number;
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
  sourceType?: string;
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

type TeamMember = {
  id: string;
  team: string;
  name: string;
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const getSourceLabel = (sourceType?: string) => (
  sourceType === "realtime" ? "실시간 녹화" : "업로드 파일"
);

export default function MeetingDetailClient({ initialMeeting }: { initialMeeting: MeetingData }) {
  const router = useRouter();
  const [meeting, setMeeting] = useState(initialMeeting);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showTaskTemplate, setShowTaskTemplate] = useState(false);
  const [showVisualizationPopup, setShowVisualizationPopup] = useState(false);
  const [showMeetingConfluenceModal, setShowMeetingConfluenceModal] = useState(false);
  const [summaryStructure, setSummaryStructure] = useState<MeetingSummaryStructure>(() => inferMeetingSummaryStructure({
    asis: initialMeeting.asis,
    tobe: initialMeeting.tobe,
    expected_effects: initialMeeting.expected_effects,
    schedule: initialMeeting.schedule,
  }, initialMeeting.transcript));
  const [meetingOverviewText, setMeetingOverviewText] = useState(() => formatMeetingSummaryByStructure({
    structure: inferMeetingSummaryStructure({
      asis: initialMeeting.asis,
      tobe: initialMeeting.tobe,
      expected_effects: initialMeeting.expected_effects,
      schedule: initialMeeting.schedule,
    }, initialMeeting.transcript),
    summary: {
      asis: initialMeeting.asis,
      tobe: initialMeeting.tobe,
      expected_effects: initialMeeting.expected_effects,
      schedule: initialMeeting.schedule,
    },
    transcript: initialMeeting.transcript,
  }));

  // For participant management
  const [newTeam, setNewTeam] = useState("");
  const [newName, setNewName] = useState("");

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

  useEffect(() => {
    fetch("/api/team-members")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTeamMembers(data);
        }
      })
      .catch(err => console.error("Failed to fetch team members:", err));
  }, []);

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

  const handleDelete = () => {
    showModal({
      title: "회의록 삭제",
      message: `"${meeting.title}" 회의록을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`,
      type: "confirm",
      onConfirm: async () => {
        closeModal();
        try {
          const res = await fetch(`/api/meetings/${meeting.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("삭제에 실패했습니다.");
          
          router.push("/archives");
          router.refresh();
        } catch (err: unknown) {
          showModal({
            title: "오류 발생",
            message: err instanceof Error ? err.message : "삭제에 실패했습니다.",
            type: "error"
          });
        }
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meeting.title,
          sourceType: meeting.sourceType,
          meetingDate: meeting.meetingDate,
          participants: meeting.participants,
          transcript: meeting.transcript,
          summary: {
            asis: meeting.asis,
            tobe: meeting.tobe,
            expected_effects: meeting.expected_effects,
            schedule: meeting.schedule
          }
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.userMessage || data?.error || "회의록 저장에 실패했습니다. 저장소 또는 서버 연결 상태를 확인해주세요.");
      }

      setMeeting(data.meeting);
      setIsEditMode(false);
      showModal({
        title: "저장 완료",
        message: "변경 사항이 성공적으로 저장되었습니다.",
        type: "success"
      });
      router.refresh();
    } catch (err: unknown) {
      showModal({
        title: "저장 실패",
        message: getErrorMessage(err),
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToConfluence = () => {
    setShowMeetingConfluenceModal(true);
  };

  const changeSummaryStructure = (structure: MeetingSummaryStructure) => {
    setSummaryStructure(structure);
    setMeetingOverviewText(formatMeetingSummaryByStructure({
      structure,
      summary: {
        asis: meeting.asis,
        tobe: meeting.tobe,
        expected_effects: meeting.expected_effects,
        schedule: meeting.schedule,
      },
      transcript: meeting.transcript,
    }));
  };

  const meetingSummary = {
    asis: meeting.asis,
    tobe: meeting.tobe,
    expected_effects: meeting.expected_effects,
    schedule: meeting.schedule,
  };
  const displayTitle = buildMeetingTitle({
    meetingDate: meeting.meetingDate,
    summary: meetingSummary,
    transcript: meeting.transcript,
  });
  const meetingTopic = extractMeetingTopic(meetingSummary, meeting.transcript);
  const meetingDateText = formatMeetingDateDots(meeting.meetingDate);
  const participantText = formatParticipantSummary(meeting.participants, meeting.transcript);

  return (
    <>
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col justify-between items-start relative z-10 gap-6 lg:flex-row lg:gap-8">
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold text-white mb-4 leading-tight">{displayTitle}</h1>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
              meeting.sourceType === "realtime"
                ? "border-rose-400/30 bg-rose-500/15 text-rose-200"
                : "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
            }`}>
              {getSourceLabel(meeting.sourceType)}
            </span>
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
                  <span>
                    {(() => {
                      const d = new Date(meeting.meetingDate);
                      return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
                    })()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-fuchsia-400" />
                <span>{meeting.participants?.length || 0}명 참여</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isEditMode && (
              <>
                <button
                  onClick={() => setShowTaskTemplate(true)}
                  disabled={!validateAnalyzableContent(meeting.transcript).isAnalyzable}
                  title={!validateAnalyzableContent(meeting.transcript).isAnalyzable ? "분석 가능한 회의 내용이 부족해 일감진행을 생성할 수 없습니다." : undefined}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg border border-white/10 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LayoutGrid className="w-5 h-5" />
                  일감진행
                </button>
                <button
                  onClick={() => setShowVisualizationPopup(true)}
                  disabled={meeting.transcript.length === 0 && !meeting.asis.trim() && !meeting.tobe.trim() && !meeting.expected_effects.trim()}
                  className="bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg border border-white/10 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LayoutGrid className="w-5 h-5" />
                  회의내용 도식화
                </button>
                <button
                  onClick={handleSendToConfluence}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Share2 className="w-5 h-5" />
                  회의록 등록
                </button>
              </>
            )}
            <button
              onClick={handleDelete}
              className="bg-white/5 text-red-400 hover:bg-red-500/20 px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 border border-white/10"
              title="회의록 삭제"
            >
              <Trash2 className="w-5 h-5" />
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
                <option value="" disabled className="text-gray-900">팀원 추가</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={`${m.team}:${m.name}`} className="text-gray-900">
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
        {(meeting.participants.length > 0 || isEditMode) && (
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
        )}
      </div>

      <div className="w-full flex flex-col gap-8">
        <div className="w-full flex flex-col gap-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden sm:p-8">
            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-white/55">
                  {meetingDateText} {participantText}
                </p>
                <div>
                  <p className="mb-2 text-sm font-bold tracking-widest text-cyan-300">회의주제</p>
                  <h3 className="max-w-5xl text-2xl font-extrabold leading-snug text-white">
                    {meetingTopic}
                  </h3>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="meeting-detail-summary-text" className="text-sm font-bold tracking-widest text-white/70">
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
                  id="meeting-detail-summary-text"
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

        <div className="w-full flex flex-col gap-6">
          <TranscriptPlayer
            audioUrl={meeting.audioUrl}
            transcript={meeting.transcript}
            title="대화 원문"
            emptyMessage="대화 원문을 불러올 수 없습니다."
          />
        </div>
      </div>

    </div>

      <VisualizationPopup
        isOpen={showVisualizationPopup}
        onClose={() => setShowVisualizationPopup(false)}
        transcript={meeting.transcript}
        summary={meetingSummary}
      />

      <MeetingConfluenceModal
        isOpen={showMeetingConfluenceModal}
        onClose={() => setShowMeetingConfluenceModal(false)}
        meetingDate={meeting.meetingDate}
        participants={meeting.participants}
        transcript={meeting.transcript}
        summary={meetingSummary}
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

      <WorkProgressModal
        isOpen={showTaskTemplate}
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
        meetingTitle={displayTitle}
        meetingDate={meeting.meetingDate}
        participants={meeting.participants}
        summary={meetingSummary}
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
    </>
  );
}
