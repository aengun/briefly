"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Search, SkipBack, SkipForward, Volume2 } from "lucide-react";

export type TranscriptItem = {
  id?: string;
  speaker?: string;
  text: string;
  start?: number;
  end?: number;
  startTime?: number;
  endTime?: number;
  timingEstimated?: boolean;
};

export type TranscriptJumpTarget = {
  index: number;
  nonce: number;
};

type TranscriptPlayerProps = {
  audioUrl?: string | null;
  transcript: TranscriptItem[];
  emptyMessage?: string;
  title?: string;
  jumpTarget?: TranscriptJumpTarget | null;
};

const playbackRates = [0.75, 1, 1.25, 1.5, 2];

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

const hasUsableDuration = (duration: number) => (
  Number.isFinite(duration) && duration > 0.5
);

const clampSeconds = (value: number, min: number, max: number) => (
  Math.max(min, Math.min(max, value))
);

const roundSeconds = (value: number) => Number(value.toFixed(2));

const textWeight = (item: TranscriptItem) => (
  Math.max(8, item.text.replace(/\s+/g, "").length)
);

const validStart = (item: TranscriptItem, duration: number) => {
  const value = getStart(item);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > duration + 5) return undefined;
  return clampSeconds(value, 0, duration);
};

const validEnd = (item: TranscriptItem, duration: number, start: number) => {
  const value = getEnd(item);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= start || value > duration + 5) return undefined;
  return clampSeconds(value, Math.min(duration, start + 0.2), duration);
};

function fillEstimatedRange(
  result: TranscriptItem[],
  from: number,
  to: number,
  rangeStart: number,
  rangeEnd: number,
) {
  if (from > to) return;

  const safeStart = clampSeconds(rangeStart, 0, rangeEnd);
  const safeEnd = Math.max(safeStart + 0.2, rangeEnd);
  const weights = result.slice(from, to + 1).map(textWeight);
  let cursor = safeStart;

  for (let index = from; index <= to; index += 1) {
    const relative = index - from;
    const remainingWeight = weights.slice(relative).reduce((sum, weight) => sum + weight, 0);
    const remainingDuration = Math.max(0.2, safeEnd - cursor);
    const segmentDuration = index === to
      ? remainingDuration
      : Math.max(0.8, remainingDuration * (weights[relative] / Math.max(remainingWeight, 1)));
    const start = cursor;
    const end = index === to ? safeEnd : Math.min(safeEnd, cursor + segmentDuration);

    result[index] = {
      ...result[index],
      start: roundSeconds(start),
      end: roundSeconds(Math.max(end, start + 0.2)),
      timingEstimated: true,
    };
    cursor = end;
  }
}

function buildPlayableTranscript(transcript: TranscriptItem[], duration: number) {
  if (!hasUsableDuration(duration) || transcript.length === 0) return transcript;

  const result = transcript.map(item => ({ ...item }));
  let previousTimedStart = 0;

  for (let index = 0; index < result.length; index += 1) {
    const start = validStart(result[index], duration);
    if (typeof start !== "number") continue;

    const safeStart = clampSeconds(Math.max(start, previousTimedStart), 0, duration);
    const end = validEnd(result[index], duration, safeStart);
    result[index] = {
      ...result[index],
      start: roundSeconds(safeStart),
      ...(typeof end === "number" ? { end: roundSeconds(end) } : {}),
    };
    previousTimedStart = safeStart;
  }

  let index = 0;
  while (index < result.length) {
    if (typeof getStart(result[index]) === "number") {
      index += 1;
      continue;
    }

    const from = index;
    while (index < result.length && typeof getStart(result[index]) !== "number") index += 1;
    const to = index - 1;
    const previous = from > 0 ? result[from - 1] : undefined;
    const next = index < result.length ? result[index] : undefined;
    const previousEnd = previous ? getEnd(previous) ?? getStart(previous) ?? 0 : 0;
    const nextStart = next ? getStart(next) ?? duration : duration;
    const rangeStart = clampSeconds(previousEnd, 0, Math.max(0, duration - 0.2));
    const rangeEnd = clampSeconds(Math.max(nextStart, rangeStart + 0.2), Math.min(duration, rangeStart + 0.2), duration);

    fillEstimatedRange(
      result,
      from,
      to,
      rangeStart,
      rangeEnd,
    );
  }

  for (let itemIndex = 0; itemIndex < result.length; itemIndex += 1) {
    const start = getStart(result[itemIndex]);
    if (typeof start !== "number") continue;

    const end = getEnd(result[itemIndex]);
    if (typeof end === "number" && end > start) continue;

    const nextStart = itemIndex + 1 < result.length ? getStart(result[itemIndex + 1]) : duration;
    const naturalEnd = start + Math.max(1, textWeight(result[itemIndex]) / 8);
    result[itemIndex] = {
      ...result[itemIndex],
      end: roundSeconds(clampSeconds(Math.min(nextStart ?? naturalEnd, naturalEnd), Math.min(duration, start + 0.2), duration)),
      timingEstimated: true,
    };
  }

  return result;
}

export default function TranscriptPlayer({
  audioUrl,
  transcript,
  emptyMessage = "대화 원문을 불러올 수 없습니다.",
  title = "대화 원문",
  jumpTarget,
}: TranscriptPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [audioErrorState, setAudioErrorState] = useState({ audioUrl: "", hasError: false });
  const audioError = Boolean(audioUrl && audioErrorState.audioUrl === audioUrl && audioErrorState.hasError);

  const playableTranscript = useMemo(() => buildPlayableTranscript(transcript, duration), [duration, transcript]);
  const hasTimedSegments = playableTranscript.some(item => typeof getStart(item) === "number");
  const usesEstimatedTiming = playableTranscript.some(item => item.timingEstimated);
  const speakers = useMemo(() => (
    Array.from(new Set(playableTranscript.map(item => item.speaker || "화자 미분류"))).filter(Boolean)
  ), [playableTranscript]);

  const filteredTranscript = playableTranscript
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      const speaker = item.speaker || "화자 미분류";
      const matchesSpeaker = speakerFilter === "all" || speaker === speakerFilter;
      const matchesQuery = !query.trim() || item.text.toLowerCase().includes(query.trim().toLowerCase());
      return matchesSpeaker && matchesQuery;
    });

  const lastTimedStart = playableTranscript.reduce((max, item) => {
    const start = getStart(item);
    return typeof start === "number" ? Math.max(max, start) : max;
  }, 0);
  const durationMismatch = Boolean(duration && lastTimedStart && lastTimedStart > duration + 5);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (currentIndex < 0) return;
    const activeLine = lineRefs.current[currentIndex];
    if (!activeLine) return;
    activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentIndex]);

  const getSegmentIndexForTime = (time: number) => {
    if (!hasTimedSegments) return -1;
    const transcriptTime = Math.max(0, time - syncOffset);

    let fallback = -1;
    for (let index = 0; index < playableTranscript.length; index += 1) {
      const item = playableTranscript[index];
      const start = getStart(item);
      const end = getEnd(item);
      if (typeof start !== "number") continue;
      if (start <= transcriptTime) fallback = index;
      if (typeof end === "number" && start <= transcriptTime && transcriptTime <= end) return index;
    }
    return fallback;
  };

  const seekToSegment = useCallback((index: number) => {
    const segment = playableTranscript[index];
    if (!segment) return;

    setCurrentIndex(index);
    const start = getStart(segment);
    const audio = audioRef.current;
    if (!audio || !audioUrl || typeof start !== "number") return;

    const nextTime = Math.max(0, start + syncOffset);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    audio.play().catch(() => undefined);
  }, [audioUrl, playableTranscript, syncOffset]);

  useEffect(() => {
    if (!jumpTarget) return;
    const timer = window.setTimeout(() => seekToSegment(jumpTarget.index), 0);
    return () => window.clearTimeout(timer);
  }, [jumpTarget, seekToSegment]);

  const skip = (deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min((audio.currentTime || 0) + deltaSeconds, duration || audio.currentTime));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    if (hasTimedSegments) setCurrentIndex(getSegmentIndexForTime(nextTime));
  };

  const handleScrub = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    if (hasTimedSegments) setCurrentIndex(getSegmentIndexForTime(nextTime));
  };

  const adjustSyncOffset = (delta: number) => {
    setSyncOffset(value => Number(Math.max(-5, Math.min(5, value + delta)).toFixed(1)));
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl">
      <div className="sticky top-0 z-10 -mx-6 -mt-6 border-b border-white/10 bg-slate-950/80 px-6 py-5 backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white">{title}</h3>
            <p className="mt-1 text-xs text-white/45">
              {playableTranscript.length > 0 ? `${playableTranscript.length}개 원문 구간` : "저장된 원문 없음"}
            </p>
          </div>

          {audioUrl && !audioError ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => skip(-10)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
                <SkipBack className="h-4 w-4" />
                10초
              </button>
              <button
                type="button"
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  if (audio.paused) audio.play().catch(() => undefined);
                  else audio.pause();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "일시정지" : "재생"}
              </button>
              <button type="button" onClick={() => skip(10)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10">
                <SkipForward className="h-4 w-4" />
                10초
              </button>
              <button
                type="button"
                onClick={() => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  audio.currentTime = 0;
                  setCurrentTime(0);
                  setCurrentIndex(-1);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" />
                처음
              </button>
            </div>
          ) : null}
        </div>

        {audioUrl && !audioError ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <audio
              ref={audioRef}
              className="hidden"
              src={audioUrl}
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onCanPlay={() => setAudioErrorState({ audioUrl: audioUrl || "", hasError: false })}
              onError={() => setAudioErrorState({ audioUrl: audioUrl || "", hasError: true })}
              onLoadedMetadata={e => {
                const audio = e.currentTarget as HTMLAudioElement;
                setDuration(audio.duration || 0);
                setCurrentTime(audio.currentTime || 0);
                setIsPlaying(false);
              }}
              onRateChange={e => setPlaybackRate((e.currentTarget as HTMLAudioElement).playbackRate)}
              onTimeUpdate={e => {
                const nextTime = (e.currentTarget as HTMLAudioElement).currentTime;
                setCurrentTime(nextTime);
                if (!isSeeking && hasTimedSegments) setCurrentIndex(getSegmentIndexForTime(nextTime));
              }}
            />

            <div className="flex items-center justify-between text-xs text-white/45">
              <span>{formatTime(currentTime) || "00:00"}</span>
              <span>{formatTime(duration) || "00:00"}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.1}
              value={currentTime}
              onPointerDown={() => setIsSeeking(true)}
              onPointerUp={() => setIsSeeking(false)}
              onPointerCancel={() => setIsSeeking(false)}
              onChange={e => handleScrub(Number(e.target.value))}
              className="mt-2 w-full accent-cyan-400"
            />

            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white/45">배속</span>
                {playbackRates.map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${playbackRate === rate ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-white/45">
                <Volume2 className="h-4 w-4" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className="w-28 accent-cyan-400"
                />
              </label>
            </div>
            {hasTimedSegments ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                <span className="font-bold text-white/60">싱크 보정</span>
                <button type="button" onClick={() => adjustSyncOffset(-0.5)} className="rounded-lg bg-white/5 px-2 py-1 font-semibold text-white hover:bg-white/10">-0.5초</button>
                <span className="min-w-14 text-center font-bold text-cyan-100">{syncOffset.toFixed(1)}초</span>
                <button type="button" onClick={() => adjustSyncOffset(0.5)} className="rounded-lg bg-white/5 px-2 py-1 font-semibold text-white hover:bg-white/10">+0.5초</button>
                <button type="button" onClick={() => setSyncOffset(0)} className="rounded-lg bg-white/5 px-2 py-1 font-semibold text-white hover:bg-white/10">초기화</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/50">
            {audioError ? "음성 파일을 재생할 수 없습니다." : "저장된 음성 파일이 없습니다."}
          </div>
        )}

        {audioUrl && transcript.length > 0 && !hasTimedSegments ? (
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {hasUsableDuration(duration) ? "이 회의록은 시간 정보가 없어 음성 위치 이동을 지원하지 않습니다." : "음성 길이를 확인한 뒤 원문 위치 이동을 준비합니다."}
          </div>
        ) : null}
        {audioUrl && usesEstimatedTiming ? (
          <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            일부 원문 구간은 오디오 길이와 주변 문장 기준으로 위치를 보정했습니다. 싱크 보정으로 미세 조정할 수 있습니다.
          </div>
        ) : null}
        {durationMismatch ? (
          <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            음성 길이와 전사 시간 정보가 일치하지 않습니다. 일부 앵커가 정확하지 않을 수 있습니다.
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="원문 검색"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-400/50"
          />
        </div>
        <select
          value={speakerFilter}
          onChange={e => setSpeakerFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
        >
          <option value="all">전체 화자</option>
          {speakers.map(speaker => (
            <option key={speaker} value={speaker}>{speaker}</option>
          ))}
        </select>
      </div>

      <div className="mt-5 max-h-[640px] space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {filteredTranscript.length > 0 ? (
          filteredTranscript.map(({ item, index }) => {
            const active = index === currentIndex;
            const start = getStart(item);
            const end = getEnd(item);
            const timeLabel = [formatTime(start), formatTime(end)].filter(Boolean).join(" - ");

            return (
              <button
                key={item.id || `${index}-${item.speaker}`}
                type="button"
                ref={el => {
                  lineRefs.current[index] = el;
                }}
                onClick={() => seekToSegment(index)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${active ? "border-cyan-400/40 bg-cyan-500/15" : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {timeLabel ? (
                    <span className="rounded-md border border-white/10 bg-slate-950/50 px-2 py-1 text-[11px] font-semibold text-cyan-100">
                      {timeLabel}{item.timingEstimated ? " 추정" : ""}
                    </span>
                  ) : (
                    <span className="rounded-md border border-white/10 bg-slate-950/50 px-2 py-1 text-[11px] font-semibold text-white/35">시간 정보 없음</span>
                  )}
                  <span className={`text-xs font-bold ${active ? "text-cyan-200" : "text-fuchsia-300"}`}>
                    {item.speaker || "화자 미분류"}
                  </span>
                </div>
                <p className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${active ? "text-white" : "text-white/85"}`}>
                  {item.text}
                </p>
              </button>
            );
          })
        ) : (
          <div className="py-8 text-center text-sm text-white/35">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}
