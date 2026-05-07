"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Users, ChevronRight, FileAudio, Trash2, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { useRouter } from "next/navigation";

interface ArchiveListProps {
  initialMeetings: any[];
}

export default function ArchiveList({ initialMeetings }: ArchiveListProps) {
  const router = useRouter();
  const [meetings, setMeetings] = useState(initialMeetings);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "alert" | "confirm" | "error" | "success";
    onConfirm?: () => void;
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

  const handleDelete = async (id: string, title: string) => {
    showModal({
      title: "회의록 삭제",
      message: `"${title || '제목 없는 회의'}"를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`,
      type: "confirm",
      onConfirm: async () => {
        closeModal();
        setIsDeleting(id);
        try {
          const res = await fetch(`/api/meetings/${id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error("삭제에 실패했습니다.");
          
          setMeetings(prev => prev.filter(m => m.id !== id));
          router.refresh();
        } catch (err: any) {
          showModal({
            title: "오류 발생",
            message: err.message,
            type: "error"
          });
        } finally {
          setIsDeleting(null);
        }
      }
    });
  };

  const getSourceLabel = (sourceType?: string) => (
    sourceType === "realtime" ? "실시간 녹화" : "업로드 파일"
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
      {meetings.length === 0 ? (
        <div className="col-span-full py-12 text-center bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl">
          <h3 className="text-xl text-white/50 font-medium">저장된 회의록이 없습니다.</h3>
          <p className="mt-2 text-sm text-white/35">분석이 완료되면 회의록 보관소에 자동으로 저장됩니다.</p>
        </div>
      ) : (
        meetings.map((m) => (
          <div 
            key={m.id} 
            className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-lg group flex flex-col gap-4 relative"
          >
            <Link href={`/archives/${m.id}`} className="absolute inset-0 z-0" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="p-3 bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 rounded-xl">
                <FileAudio className="w-6 h-6 text-cyan-300" />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDelete(m.id, m.title)}
                  disabled={isDeleting === m.id}
                  className="p-2 bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 rounded-xl transition-all border border-white/10 flex items-center gap-2 text-xs font-bold"
                  title="회의록 삭제"
                >
                  {isDeleting === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  삭제
                </button>
                <Link 
                  href={`/archives/${m.id}`}
                  className="p-2 bg-white/5 rounded-full hover:bg-cyan-500 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            
            <div className="space-y-2 relative z-10 pointer-events-none">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                m.sourceType === "realtime"
                  ? "border-rose-400/30 bg-rose-500/15 text-rose-200"
                  : "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
              }`}>
                {getSourceLabel(m.sourceType)}
              </span>
              <h3 className="text-xl font-bold text-white line-clamp-1">{m.title || "제목 없는 회의"}</h3>
              <div className="flex items-center gap-2 text-sm text-cyan-300 font-medium">
                <Calendar className="w-4 h-4" />
                <span>
                  {(() => {
                    const d = new Date(m.meetingDate || m.createdAt);
                    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Users className="w-4 h-4" />
                <span>참여자 {m.participants?.length || 0}명</span>
              </div>
            </div>

            <div className="h-px w-full bg-white/10 my-1 relative z-10"></div>
            
            <div className="flex-1 relative z-10 pointer-events-none">
              <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">
                {m.asis || "요약 내용이 없습니다."}
              </p>
            </div>
          </div>
        ))
      )}

      <Modal
        isOpen={modalConfig.isOpen}
        onClose={closeModal}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
      />
    </div>
  );
}
