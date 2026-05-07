"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
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
  onJump: (index: number) => void;
};

type DiagramNode = {
  id: string;
  step: string;
  title: string;
  detail: string[];
  icon: LucideIcon;
  tone: "cyan" | "fuchsia" | "emerald" | "amber" | "rose" | "violet" | "slate";
  x: number;
  y: number;
  w: number;
  h: number;
  segmentIndex: number;
  rounded: string;
  subtle?: string;
};

type Connector = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  dashed?: boolean;
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

const normalize = (value: string) => value
  .toLowerCase()
  .replace(/[^가-힣a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const splitCompact = (value: string) => value
  .split(/\n|\.|ㆍ|-/)
  .map(item => item.trim())
  .filter(item => item.length >= 4)
  .slice(0, 2);

const clip = (value: string, limit = 44) => {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1)}…`;
};

function findGroundedSegment(transcript: TranscriptItem[], text: string) {
  const words = normalize(text).split(" ").filter(word => word.length >= 2);
  if (words.length === 0) return -1;

  let best = { index: -1, score: 0 };
  transcript.forEach((segment, index) => {
    const normalizedText = normalize(segment.text);
    const score = words.reduce((sum, word) => sum + (normalizedText.includes(word) ? 1 : 0), 0);
    if (score > best.score) best = { index, score };
  });

  return best.score >= Math.min(2, words.length) ? best.index : -1;
}

export default function MeetingVisualization({ transcript, summary, onJump }: MeetingVisualizationProps) {
  const hasTranscript = transcript.length > 0;
  const hasTimedSegments = transcript.some(item => typeof getStart(item) === "number");

  const firstSegmentIndex = transcript.length > 0 ? 0 : -1;
  const firstTimedSegmentIndex = transcript.findIndex(item => typeof getStart(item) === "number");
  const firstTimedLabel = firstTimedSegmentIndex >= 0 ? formatTime(getStart(transcript[firstTimedSegmentIndex])) : null;

  const issueLines = splitCompact(summary.asis);
  const directionLines = splitCompact(summary.tobe);
  const effectLines = splitCompact(summary.expected_effects);
  const actionLines = summary.schedule
    .map(item => clip([item.task, item.assignee, item.dueDate].filter(Boolean).join(" · "), 42))
    .filter(Boolean)
    .slice(0, 2);

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
  const speakerIndex = speakerStats.length > 0 ? speakerStats[0][1].index : -1;

  const riskMatches = transcript
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => /(리스크|위험|문제|이슈|불가|지연|미정|확인 필요|보류)/.test(segment.text));
  const riskLines = riskMatches.slice(0, 2).map(({ segment }) => clip(segment.text, 42));
  const riskIndex = riskMatches.length > 0 ? riskMatches[0].index : -1;

  const actionIndex = summary.schedule.length > 0
    ? findGroundedSegment(transcript, summary.schedule.map(item => [item.task, item.assignee, item.dueDate].filter(Boolean).join(" ")).join(" "))
    : -1;

  const diagramNodes: DiagramNode[] = [
    {
      id: "start",
      step: "START",
      title: "회의 시작",
      detail: [
        hasTranscript ? `원문 ${transcript.length}개` : "저장된 원문 없음",
        firstTimedLabel ? `첫 구간 ${firstTimedLabel}` : "시간 정보 없음",
      ],
      icon: Gauge,
      tone: "slate",
      x: 24,
      y: 74,
      w: 176,
      h: 148,
      segmentIndex: firstSegmentIndex,
      rounded: "rounded-[30px]",
      subtle: "bg-white/10",
    },
    {
      id: "issue",
      step: "01",
      title: "현황 / 문제점",
      detail: issueLines.length > 0 ? issueLines : ["분석 결과 없음"],
      icon: AlertTriangle,
      tone: "rose",
      x: 238,
      y: 54,
      w: 228,
      h: 184,
      segmentIndex: findGroundedSegment(transcript, summary.asis),
      rounded: "rounded-[30px]",
      subtle: "bg-rose-400/10",
    },
    {
      id: "direction",
      step: "02",
      title: "개선 방향",
      detail: directionLines.length > 0 ? directionLines : ["분석 결과 없음"],
      icon: Lightbulb,
      tone: "cyan",
      x: 490,
      y: 54,
      w: 228,
      h: 184,
      segmentIndex: findGroundedSegment(transcript, summary.tobe),
      rounded: "rounded-[30px]",
      subtle: "bg-cyan-400/10",
    },
    {
      id: "effect",
      step: "03",
      title: "기대 효과",
      detail: effectLines.length > 0 ? effectLines : ["분석 결과 없음"],
      icon: CheckCircle2,
      tone: "emerald",
      x: 742,
      y: 54,
      w: 228,
      h: 184,
      segmentIndex: findGroundedSegment(transcript, summary.expected_effects),
      rounded: "rounded-[30px]",
      subtle: "bg-emerald-400/10",
    },
    {
      id: "action",
      step: "04",
      title: "일감 / 후속조치",
      detail: actionLines.length > 0 ? actionLines : ["등록된 일감 없음"],
      icon: ClipboardList,
      tone: "amber",
      x: 994,
      y: 54,
      w: 228,
      h: 184,
      segmentIndex: actionIndex,
      rounded: "rounded-[30px]",
      subtle: "bg-amber-400/10",
    },
    {
      id: "timeline",
      step: "A",
      title: "타임라인",
      detail: timelineLabel.length > 0 ? timelineLabel : ["원문 순서만 확인 가능"],
      icon: Clock3,
      tone: "violet",
      x: 72,
      y: 332,
      w: 260,
      h: 122,
      segmentIndex: hasTimedSegments ? firstTimedSegmentIndex : firstSegmentIndex,
      rounded: "rounded-[24px]",
      subtle: "bg-violet-400/10",
    },
    {
      id: "decision",
      step: "B",
      title: "결정 / 액션",
      detail: actionLines.length > 0 ? actionLines : ["근거 연결 불명확"],
      icon: Route,
      tone: "cyan",
      x: 372,
      y: 332,
      w: 260,
      h: 122,
      segmentIndex: actionIndex,
      rounded: "rounded-[24px]",
      subtle: "bg-cyan-400/10",
    },
    {
      id: "risk",
      step: "C",
      title: "리스크 / 미결정",
      detail: riskLines.length > 0 ? riskLines : ["원문에서 별도 리스크 없음"],
      icon: ShieldAlert,
      tone: "rose",
      x: 672,
      y: 332,
      w: 260,
      h: 122,
      segmentIndex: riskIndex,
      rounded: "rounded-[24px]",
      subtle: "bg-rose-400/10",
    },
    {
      id: "speaker",
      step: "D",
      title: "참여자",
      detail: [
        speakerLabel,
        speakerCount > 0 ? `${speakerCount}개 발화` : "화자 정보 없음",
      ],
      icon: UsersRound,
      tone: "fuchsia",
      x: 972,
      y: 332,
      w: 260,
      h: 122,
      segmentIndex: speakerIndex,
      rounded: "rounded-[24px]",
      subtle: "bg-fuchsia-400/10",
    },
  ];

  const connectors: Connector[] = [
    { from: { x: 200, y: 150 }, to: { x: 238, y: 150 } },
    { from: { x: 466, y: 150 }, to: { x: 490, y: 150 } },
    { from: { x: 718, y: 150 }, to: { x: 742, y: 150 } },
    { from: { x: 970, y: 150 }, to: { x: 994, y: 150 } },
    { from: { x: 202, y: 258 }, to: { x: 202, y: 332 }, dashed: true },
    { from: { x: 512, y: 258 }, to: { x: 502, y: 332 }, dashed: true },
    { from: { x: 802, y: 258 }, to: { x: 802, y: 332 }, dashed: true },
    { from: { x: 1102, y: 258 }, to: { x: 1102, y: 332 }, dashed: true },
  ];

  return (
    <div className="rounded-[32px] border border-white/10 bg-slate-950/65 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-cyan-200">
          도식 캔버스
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/55">
          {hasTranscript ? `${transcript.length}개 원문` : "원문 없음"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
        <div className="relative min-w-[1280px] h-[540px]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1280 540" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="diagram-arrow" markerWidth="12" markerHeight="12" refX="8" refY="6" orient="auto">
                <path d="M0,0 L12,6 L0,12 Z" fill="white" fillOpacity="0.28" />
              </marker>
            </defs>
            <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
              {Array.from({ length: 12 }).map((_, index) => (
                <line key={`v-${index}`} x1={index * 116} y1="0" x2={index * 116} y2="540" />
              ))}
              {Array.from({ length: 8 }).map((_, index) => (
                <line key={`h-${index}`} x1="0" y1={index * 68} x2="1280" y2={index * 68} />
              ))}
            </g>
            <g fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="3.5" markerEnd="url(#diagram-arrow)">
              {connectors.map((connector, index) => (
                <path
                  key={`connector-${index}`}
                  d={connector.dashed
                    ? `M ${connector.from.x} ${connector.from.y} C ${connector.from.x}, ${connector.from.x} ${(connector.from.y + connector.to.y) / 2}, ${connector.to.x} ${connector.to.y}`
                    : `M ${connector.from.x} ${connector.from.y} C ${connector.from.x + 28} ${connector.from.y}, ${connector.to.x - 28} ${connector.to.y}, ${connector.to.x} ${connector.to.y}`
                  }
                  strokeDasharray={connector.dashed ? "8 8" : "0"}
                />
              ))}
            </g>
          </svg>

          {diagramNodes.map(node => {
            const Icon = node.icon;
            const clickable = node.segmentIndex >= 0;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => clickable && onJump(node.segmentIndex)}
                disabled={!clickable}
                aria-label={`${node.title}${clickable ? " 원문으로 이동" : ""}`}
                className={`absolute ${node.rounded} border border-white/10 ${node.subtle || "bg-white/5"} p-4 text-left transition duration-200 ${
                  clickable ? "hover:-translate-y-1 hover:border-white/20 hover:bg-white/10" : "cursor-default opacity-75"
                }`}
                style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-black tracking-[0.25em] text-white/70">
                    {node.step}
                  </span>
                  {clickable ? <ArrowRight className="h-4 w-4 shrink-0 text-white/35" /> : null}
                </div>

                <div className={`mt-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white ${
                  node.tone === "rose"
                    ? "bg-rose-500/20 text-rose-100"
                    : node.tone === "cyan"
                      ? "bg-cyan-500/20 text-cyan-100"
                      : node.tone === "emerald"
                        ? "bg-emerald-500/20 text-emerald-100"
                        : node.tone === "amber"
                          ? "bg-amber-500/20 text-amber-100"
                          : node.tone === "fuchsia"
                            ? "bg-fuchsia-500/20 text-fuchsia-100"
                            : node.tone === "violet"
                              ? "bg-violet-500/20 text-violet-100"
                              : "bg-white/10 text-white"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>

                <div className="mt-3">
                  <p className="text-sm font-bold text-white">{node.title}</p>
                  <div className="mt-2 space-y-1 text-xs leading-relaxed text-white/70">
                    {node.detail.slice(0, 2).map(line => (
                      <p key={line}>{clip(line, node.w > 230 ? 48 : 32)}</p>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
