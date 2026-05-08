"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Lightbulb,
  Route,
  ShieldAlert,
  UsersRound,
  Gauge,
} from "lucide-react";
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

type MeetingVisualizationProps = {
  transcript: TranscriptItem[];
  summary: MeetingSummary;
};

type DiagramNode = {
  id: string;
  title: string;
  detail: string[];
  icon: LucideIcon;
  tone: "cyan" | "fuchsia" | "emerald" | "amber" | "rose" | "violet" | "slate";
  subtle?: string;
  group: "flow" | "context";
};

const getStart = (item: TranscriptItem) => (
  typeof item.start === "number" ? item.start : typeof item.startTime === "number" ? item.startTime : undefined
);

const getEnd = (item: TranscriptItem) => (
  typeof item.end === "number" ? item.end : typeof item.endTime === "number" ? item.endTime : undefined
);

const formatTime = (seconds?: number) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

const splitCompact = (value: string) => value
  .split(/\n|\.|ㆍ|-/)
  .map(item => item.trim())
  .filter(item => item.length >= 4);

export default function MeetingVisualization({ transcript, summary }: MeetingVisualizationProps) {
  const hasTranscript = transcript.length > 0;

  const firstTimedSegmentIndex = transcript.findIndex(item => typeof getStart(item) === "number");
  const firstTimedLabel = firstTimedSegmentIndex >= 0 ? formatTime(getStart(transcript[firstTimedSegmentIndex])) : null;

  const issueLines = splitCompact(summary.asis);
  const directionLines = splitCompact(summary.tobe);
  const effectLines = splitCompact(summary.expected_effects);
  const actionLines = summary.schedule
    .map(item => [item.task, item.assignee, item.dueDate].filter(Boolean).join(" · "))
    .filter(Boolean);

  const timelineLabel = transcript.slice(0, 3).map((segment, index) => {
    const start = formatTime(getStart(segment));
    const end = formatTime(getEnd(segment));
    return start ? `${start}${end ? `-${end}` : ""}` : `순서 ${index + 1}`;
  });

  const speakerStats = Array.from(
    transcript.reduce((map, segment, index) => {
      const speaker = segment.speaker || "화자 미분류";
      const current = map.get(speaker) || { count: 0, sample: segment.text, index };
      map.set(speaker, { count: current.count + 1, sample: current.sample, index: current.index });
      return map;
    }, new Map<string, { count: number; sample: string; index: number }>())
  ).sort((a, b) => b[1].count - a[1].count);

  const speakerLabel = speakerStats.length > 0 ? speakerStats[0][0] : "화자 정보 없음";
  const speakerCount = speakerStats.length > 0 ? speakerStats[0][1].count : 0;

  const riskMatches = transcript
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => /(리스크|위험|문제|이슈|불가|지연|미정|확인 필요|보류)/.test(segment.text));
  const riskLines = riskMatches.map(({ segment }) => segment.text);

  const toneClass = (tone: DiagramNode["tone"]) => {
    if (tone === "rose") return "bg-rose-500/20 text-rose-100";
    if (tone === "cyan") return "bg-cyan-500/20 text-cyan-100";
    if (tone === "emerald") return "bg-emerald-500/20 text-emerald-100";
    if (tone === "amber") return "bg-amber-500/20 text-amber-100";
    if (tone === "fuchsia") return "bg-fuchsia-500/20 text-fuchsia-100";
    if (tone === "violet") return "bg-violet-500/20 text-violet-100";
    return "bg-white/10 text-white";
  };

  const diagramNodes: DiagramNode[] = [
    {
      id: "start",
      title: "회의 시작",
      detail: [
        hasTranscript ? `원문 ${transcript.length}개` : "저장된 원문 없음",
        firstTimedLabel ? `첫 구간 ${firstTimedLabel}` : "시간 정보 없음",
      ],
      icon: Gauge,
      tone: "slate",
      subtle: "bg-white/10",
      group: "flow",
    },
    {
      id: "issue",
      title: "현황 / 문제점",
      detail: issueLines.length > 0 ? issueLines : ["분석 결과 없음"],
      icon: AlertTriangle,
      tone: "rose",
      subtle: "bg-rose-400/10",
      group: "flow",
    },
    {
      id: "direction",
      title: "개선 방향",
      detail: directionLines.length > 0 ? directionLines : ["분석 결과 없음"],
      icon: Lightbulb,
      tone: "cyan",
      subtle: "bg-cyan-400/10",
      group: "flow",
    },
    {
      id: "effect",
      title: "기대 효과",
      detail: effectLines.length > 0 ? effectLines : ["분석 결과 없음"],
      icon: CheckCircle2,
      tone: "emerald",
      subtle: "bg-emerald-400/10",
      group: "flow",
    },
    {
      id: "action",
      title: "일감 / 후속조치",
      detail: actionLines.length > 0 ? actionLines : ["등록된 일감 없음"],
      icon: ClipboardList,
      tone: "amber",
      subtle: "bg-amber-400/10",
      group: "flow",
    },
    {
      id: "timeline",
      title: "타임라인",
      detail: timelineLabel.length > 0 ? timelineLabel : ["원문 순서만 확인 가능"],
      icon: Clock3,
      tone: "violet",
      subtle: "bg-violet-400/10",
      group: "context",
    },
    {
      id: "decision",
      title: "결정 / 액션",
      detail: actionLines.length > 0 ? actionLines : ["근거 연결 불명확"],
      icon: Route,
      tone: "cyan",
      subtle: "bg-cyan-400/10",
      group: "context",
    },
    {
      id: "risk",
      title: "리스크 / 미결정",
      detail: riskLines.length > 0 ? riskLines : ["원문에서 별도 리스크 없음"],
      icon: ShieldAlert,
      tone: "rose",
      subtle: "bg-rose-400/10",
      group: "context",
    },
    {
      id: "speaker",
      title: "참여자",
      detail: [
        speakerLabel,
        speakerCount > 0 ? `${speakerCount}개 발화` : "화자 정보 없음",
      ],
      icon: UsersRound,
      tone: "fuchsia",
      subtle: "bg-fuchsia-400/10",
      group: "context",
    },
  ];

  const flowNodes = diagramNodes.filter(node => node.group === "flow");
  const contextNodes = diagramNodes.filter(node => node.group === "context");
  const renderCard = (node: DiagramNode, size: "flow" | "context") => {
    const Icon = node.icon;
    return (
      <section
        key={node.id}
        aria-label={node.title}
        className={`flex min-h-0 flex-col rounded-3xl border border-white/10 ${node.subtle || "bg-white/5"} p-4 text-left sm:p-5 ${
          size === "flow" ? "h-[300px]" : "h-[260px]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 ${toneClass(node.tone)}`}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="min-w-0 text-base font-bold leading-snug text-white">{node.title}</p>
        </div>
        <div className="mt-4 min-h-0 flex-1 overscroll-contain rounded-2xl border border-white/5 bg-black/10 px-3 py-3 text-sm leading-6 text-white/78 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {node.detail.map((line, index) => (
            <p key={index} className="break-words border-l border-white/10 pl-3">{line}</p>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="rounded-[32px] border border-white/10 bg-slate-950/65 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-200">
          도식 캔버스
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/55">
          {hasTranscript ? `${transcript.length}개 원문` : "원문 없음"}
        </span>
      </div>

      <div className="space-y-5 rounded-[28px] border border-white/10 bg-slate-900/40 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-sm font-extrabold tracking-wide text-white/80">핵심 흐름</h5>
          <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </div>
        <div className="grid gap-4 xl:grid-cols-5">
          {flowNodes.map(node => renderCard(node, "flow"))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <h5 className="text-sm font-extrabold tracking-wide text-white/80">참고 정보</h5>
          <div className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {contextNodes.map(node => renderCard(node, "context"))}
        </div>
      </div>
    </div>
  );
}
