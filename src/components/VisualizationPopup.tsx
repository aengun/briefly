"use client";

import { X } from "lucide-react";
import MeetingVisualization from "./MeetingVisualization";
import type { TranscriptItem } from "./TranscriptPlayer";

type ScheduleItem = {
  task: string;
  assignee: string;
  dueDate: string;
};

type MeetingSummary = {
  asis: string;
  tobe: string;
  expected_effects: string;
  schedule: ScheduleItem[];
};

type VisualizationPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  transcript: TranscriptItem[];
  summary: MeetingSummary;
  onJump: (index: number) => void;
};

export default function VisualizationPopup({
  isOpen,
  onClose,
  transcript,
  summary,
  onJump,
}: VisualizationPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-[1440px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-cyan-300">회의 분석 자료</p>
            <h3 className="mt-1 text-lg font-bold text-white">회의내용 도식화</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/55 transition hover:bg-white/10 hover:text-white"
            aria-label="도식화 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <MeetingVisualization transcript={transcript} summary={summary} onJump={onJump} />
        </div>
      </div>
    </div>
  );
}
