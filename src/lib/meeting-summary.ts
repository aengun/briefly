export const meetingSummaryStructures = [
  "기승전결",
  "문제해결",
  "안건중심",
  "쟁점대립",
  "의사결정",
  "원인분석",
  "타임라인",
  "실행계획",
] as const;

export type MeetingSummaryStructure = typeof meetingSummaryStructures[number];

export type MeetingSummaryScheduleItem = {
  task?: string;
  assignee?: string;
  dueDate?: string;
};

export type MeetingSummaryData = {
  title?: string;
  topic?: string;
  mainTopic?: string;
  keyDiscussion?: string;
  asis?: string;
  tobe?: string;
  expected_effects?: string;
  schedule?: MeetingSummaryScheduleItem[];
};

export type MeetingTranscriptSegment = {
  speaker?: string;
  text?: string;
  start?: number;
  end?: number;
  startTime?: number;
  endTime?: number;
};

export type MeetingParticipantLike = {
  name?: string;
  team?: string;
};

const insufficientMessage = "분석 가능한 회의 내용이 부족합니다.";
const summaryFallbackMessage = "분석 결과에서 요약 가능한 내용이 충분하지 않습니다.";

const compact = (value: string) => value.replace(/\s+/g, " ").trim();

function stripTopicNoise(value: string) {
  return compact(value)
    .replace(/\.(mp3|wav|m4a|mp4|mov|webm|aac)$/i, "")
    .replace(/^recording[_\-\s]?\d.*$/i, "")
    .replace(/^\[?\d{4}[-./년]\s?\d{1,2}(?:[-./월]\s?\d{1,2})?일?\]?\s*/, "")
    .replace(/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[~\-]\s*\d{1,2}:\d{2}(?::\d{2})?)?\s*/, "")
    .replace(/^(회의\s*주제|회의주제|주제|안건|요약|제목)\s*[:：-]\s*/i, "")
    .replace(/^[-*•\d.)\s]+/, "")
    .trim();
}

function isWeakTopic(value: string) {
  const text = compact(value);
  if (!text || text.length < 6) return true;
  if (/[?？]$/.test(text)) return true;
  if (/(나요|네요|어요|예요|이에요|습니까|습니다|했습니다|했어요|같아요|모르겠어요|되나요|되죠|그렇죠|아니요|네)$/.test(text)) return true;
  if (/^(지금|이제|어떤|그럼|그러면|아|음|어|네|아니|혹시)\b/.test(text)) return true;
  if (/^\d{4}[-.]\d{1,2}(?:[-.]\d{1,2})?$/.test(text)) return true;
  if (/^\d{4}년\s*\d{1,2}월/.test(text)) return true;
  if (/^(recording|audio|meeting)[_\-\s]/i.test(text)) return true;
  if (/\.(mp3|wav|m4a|mp4|mov|webm|aac)$/i.test(text)) return true;
  if (/^(회의\s*내용\s*요약|분석\s*요약|요약)$/.test(text)) return true;
  if (/분석 가능한 회의 내용이 부족/.test(text)) return true;
  return false;
}

function normalizeTitlePhrase(value: string) {
  const text = stripTopicNoise(value)
    .replace(/[?？!！.。]+$/g, "")
    .replace(/^(이번\s*)?회의에서는\s*/g, "")
    .replace(/에\s*대해\s*(논의|검토|공유|확인)(하기로\s*)?(함|했다|했습니다)?$/g, " $1")
    .replace(/하기로\s*(함|했다|했습니다)$/g, "")
    .replace(/(했습니다|했어요|합니다|해요|입니다|이에요|예요|함)$/g, "")
    .replace(/\s*(회의|미팅)$/g, "")
    .replace(/\s*관련$/g, "")
    .trim();

  if (!text) return "";
  return compact(text);
}

const cleanLines = (value?: string) => (value || "")
  .split(/\n|\.|ㆍ|-/)
  .map(item => stripTopicNoise(item))
  .filter(item => item.length >= 4);

const isMeaningfulLine = (value: string) => {
  const text = compact(value);
  if (!text) return false;
  if (text === insufficientMessage || text === summaryFallbackMessage) return false;
  if (/^(없음|미정|미확인|unknown|n\/a|-)$/.test(text.toLowerCase())) return false;
  if (looksLikeSourceFileName(text)) return false;
  return true;
};

const uniqueMeaningfulLines = (lines: string[]) => {
  const seen = new Set<string>();
  return lines
    .map(compact)
    .filter(isMeaningfulLine)
    .filter(line => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const clipTitle = (value: string, maxLength: number) => {
  const text = compact(value);
  if (text.length <= maxLength) return text;

  const clipped = text.slice(0, maxLength);
  const lastWordBreak = Math.max(
    clipped.lastIndexOf(" "),
    clipped.lastIndexOf("/"),
    clipped.lastIndexOf(","),
    clipped.lastIndexOf("·")
  );

  return compact(lastWordBreak >= 8 ? clipped.slice(0, lastWordBreak) : clipped);
};

export const looksLikeSourceFileName = (value: string) => {
  const text = value.trim().toLowerCase();
  return (
    /^recording[_-]?\d+/.test(text) ||
    /\.(webm|wav|m4a|mp4|mp3|aac|mov)$/i.test(text) ||
    /^(audio|meeting|recording)[_-]?\d*/.test(text)
  );
};

export function formatMeetingDateDash(value?: string | Date | null) {
  const fallback = new Date();
  if (typeof value === "string") {
    const dashed = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
    const dotted = value.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (dotted) return `${dotted[1]}-${dotted[2]}-${dotted[3]}`;
  }

  const date = value ? new Date(value) : fallback;
  const safeDate = Number.isNaN(date.getTime()) ? fallback : date;
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, "0")}-${String(safeDate.getDate()).padStart(2, "0")}`;
}

export function formatMeetingDateDots(value?: string | Date | null) {
  return formatMeetingDateDash(value).replace(/-/g, ".");
}

export function getStartSeconds(segment: MeetingTranscriptSegment) {
  return typeof segment.start === "number"
    ? segment.start
    : typeof segment.startTime === "number"
      ? segment.startTime
      : undefined;
}

export function getEndSeconds(segment: MeetingTranscriptSegment) {
  return typeof segment.end === "number"
    ? segment.end
    : typeof segment.endTime === "number"
      ? segment.endTime
      : undefined;
}

export function formatSeconds(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "";
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function getParticipantNames(participants: MeetingParticipantLike[] = [], transcript: MeetingTranscriptSegment[] = []) {
  const fromParticipants = participants
    .map(item => compact(item.name || ""))
    .filter(name => name && name !== "이름 없음" && name !== "미확인");

  if (fromParticipants.length > 0) {
    return Array.from(new Set(fromParticipants));
  }

  return Array.from(new Set(
    transcript
      .map(item => compact(item.speaker || ""))
      .filter(name => name && !["알 수 없음", "화자 미분류", "미확인"].includes(name))
  ));
}

export function formatParticipantSummary(participants: MeetingParticipantLike[] = [], transcript: MeetingTranscriptSegment[] = []) {
  const names = getParticipantNames(participants, transcript);
  if (names.length === 0) return "참석자 미확인";
  if (names.length === 1) return `참석자 ${names[0]}`;
  return `참석자 ${names[0]} 외 ${names.length - 1}명`;
}

export function extractMeetingTopic(summary: MeetingSummaryData = {}, transcript: MeetingTranscriptSegment[] = []) {
  const primaryCandidates = [
    summary.title,
    summary.topic,
    summary.mainTopic,
    summary.keyDiscussion,
    ...(summary.schedule || []).map(item => item.task || ""),
    ...cleanLines(summary.tobe),
    ...cleanLines(summary.asis),
    ...cleanLines(summary.expected_effects),
  ];

  const topic = primaryCandidates
    .map(item => normalizeTitlePhrase(item || ""))
    .find(item => item.length >= 4 && !looksLikeSourceFileName(item) && !isWeakTopic(item));

  if (topic) return clipTitle(topic, 56);

  const transcriptTopic = transcript
    .slice(0, 12)
    .map(item => normalizeTitlePhrase(item.text || ""))
    .find(item => item.length >= 8 && !looksLikeSourceFileName(item) && !isWeakTopic(item));

  return transcriptTopic ? clipTitle(transcriptTopic, 56) : "제목 없는 회의록";
}

export function buildMeetingTitle(input: {
  meetingDate?: string | Date | null;
  summary?: MeetingSummaryData;
  transcript?: MeetingTranscriptSegment[];
}) {
  const date = formatMeetingDateDash(input.meetingDate);
  const topic = extractMeetingTopic(input.summary || {}, input.transcript || []);
  return `${date} ${topic}`;
}

export function getMeetingSummaryTextareaRows(value: string) {
  const text = value || "";
  const hardLines = text.split("\n").length;
  const softLines = Math.ceil(text.length / 72);
  return Math.min(Math.max(hardLines + softLines + 4, 18), 64);
}

export function inferMeetingSummaryStructure(summary: MeetingSummaryData = {}, transcript: MeetingTranscriptSegment[] = []): MeetingSummaryStructure {
  const text = [
    summary.asis,
    summary.tobe,
    summary.expected_effects,
    ...(summary.schedule || []).map(item => item.task),
    ...transcript.slice(0, 12).map(item => item.text),
  ].join(" ");

  if ((summary.schedule || []).length > 0) return "실행계획";
  if (/(결정|확정|승인|합의|채택)/.test(text)) return "의사결정";
  if (/(원인|왜|때문|발생|문제)/.test(text)) return "문제해결";
  if (/(리스크|위험|쟁점|반대|이견|대립)/.test(text)) return "쟁점대립";
  if (transcript.some(item => typeof getStartSeconds(item) === "number")) return "타임라인";
  return "안건중심";
}

const section = (title: string, lines: string[]) => {
  const filtered = uniqueMeaningfulLines(lines);
  if (filtered.length === 0) return "";
  return `${title}\n${filtered.map(line => `- ${line}`).join("\n")}`;
};

function fallbackDiscussion(summary: MeetingSummaryData) {
  return [
    ...cleanLines(summary.asis),
    ...cleanLines(summary.tobe),
    ...cleanLines(summary.expected_effects),
    ...(summary.schedule || []).map(item => compact(item.task || "")),
  ].filter(Boolean);
}

const finalizeSummarySections = (sections: string[]) => {
  const text = sections.filter(Boolean).join("\n\n").trim();
  return text || summaryFallbackMessage;
};

export function formatMeetingSummaryByStructure(input: {
  structure: MeetingSummaryStructure;
  summary?: MeetingSummaryData;
  transcript?: MeetingTranscriptSegment[];
}) {
  const summary = input.summary || {};
  const asis = cleanLines(summary.asis);
  const tobe = cleanLines(summary.tobe);
  const effects = cleanLines(summary.expected_effects);
  const schedule = (summary.schedule || []).filter(item => isMeaningfulLine(item.task || ""));
  const taskLines = uniqueMeaningfulLines(schedule.map(item => item.task || ""));

  if (fallbackDiscussion(summary).length === 0 && taskLines.length === 0) {
    return insufficientMessage;
  }

  const actionLines = taskLines;

  if (input.structure === "기승전결") {
    return finalizeSummarySections([
      section("배경", asis.slice(0, 2)),
      section("전개", tobe.slice(0, 2)),
      section("핵심 논의", tobe.slice(0, 3)),
      section("결론", [...effects.slice(0, 2), ...actionLines.slice(0, 1)]),
    ]);
  }

  if (input.structure === "문제해결") {
    return finalizeSummarySections([
      section("문제 상황", asis.slice(0, 3)),
      section("원인 또는 제약", asis.filter(line => /(원인|제약|문제|어려움|불가|지연|한계)/.test(line)).slice(0, 3)),
      section("해결 방향", tobe.slice(0, 3)),
      section("후속 조치", actionLines.slice(0, 4)),
    ]);
  }

  if (input.structure === "쟁점대립") {
    return finalizeSummarySections([
      section("쟁점", asis.filter(line => /(쟁점|이슈|문제|리스크|이견|충돌|우려)/.test(line)).slice(0, 3)),
      section("확인된 입장", tobe.slice(0, 3)),
      section("조율 또는 결론", [...tobe, ...actionLines].slice(0, 3)),
    ]);
  }

  if (input.structure === "의사결정") {
    return finalizeSummarySections([
      section("결정이 필요한 사안", [...asis, ...tobe].slice(0, 3)),
      section("검토 내용", tobe.slice(0, 4)),
      section("결정사항", effects.slice(0, 3)),
      section("후속조치", actionLines.slice(0, 4)),
    ]);
  }

  if (input.structure === "원인분석") {
    return finalizeSummarySections([
      section("발생 현상", asis.slice(0, 3)),
      section("원인 후보", asis.filter(line => /(원인|때문|이유|문제|제약)/.test(line)).slice(0, 3)),
      section("확인된 원인", asis.filter(line => /(원인|때문|이유)/.test(line)).slice(0, 2)),
      section("대응 방향", tobe.slice(0, 3)),
    ]);
  }

  if (input.structure === "타임라인") {
    return finalizeSummarySections([
      section("논의 흐름", [
        ...asis.map(line => `현재 상황: ${line}`),
        ...tobe.map(line => `개선 방향: ${line}`),
        ...effects.map(line => `기대효과: ${line}`),
        ...actionLines.map(line => `후속조치: ${line}`),
      ].slice(0, 8)),
    ]);
  }

  if (input.structure === "실행계획") {
    return finalizeSummarySections([
      section("목표", tobe.slice(0, 2)),
      section("해야 할 일", actionLines.length > 0 ? actionLines : tobe.slice(0, 3)),
      section("확인 필요 사항", [...asis, ...effects].slice(0, 2)),
    ]);
  }

  return finalizeSummarySections([
    section("안건 1", asis.slice(0, 2)),
    section("안건 2", tobe.slice(0, 2)),
    section("안건 3", effects.slice(0, 2)),
    section("결론 및 후속조치", actionLines.slice(0, 4)),
  ]);
}

export function buildMeetingOverviewText(input: {
  summary?: MeetingSummaryData;
  transcript?: MeetingTranscriptSegment[];
}) {
  const structure = inferMeetingSummaryStructure(input.summary, input.transcript);
  return formatMeetingSummaryByStructure({ structure, summary: input.summary, transcript: input.transcript });
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildMeetingConfluenceHtml(input: {
  meetingDate?: string | Date | null;
  participants?: MeetingParticipantLike[];
  transcript?: MeetingTranscriptSegment[];
  summary?: MeetingSummaryData;
  overviewText?: string;
}) {
  const summary = input.summary || {};
  const transcript = input.transcript || [];
  const participantNames = getParticipantNames(input.participants || [], transcript);
  const topic = extractMeetingTopic(summary, transcript);
  const date = formatMeetingDateDots(input.meetingDate);
  const overview = compact(input.overviewText || buildMeetingOverviewText({ summary, transcript }));

  const firstStart = transcript.map(getStartSeconds).find(value => typeof value === "number");
  const lastEnd = [...transcript].reverse().map(getEndSeconds).find(value => typeof value === "number");
  const timeRange = typeof firstStart === "number" && typeof lastEnd === "number"
    ? `${formatSeconds(firstStart)}~${formatSeconds(lastEnd)}`
    : "";

  const discussionContent = overview && overview !== insufficientMessage
    ? overview
    : compact([summary.asis, summary.tobe, summary.expected_effects].filter(Boolean).join(" "));

  const conclusion = compact([
    summary.expected_effects,
    ...(summary.schedule || []).map(item => item.task),
  ].filter(Boolean).join(" "));

  return `
<h2>날짜</h2>
<p>${escapeHtml(date)}</p>
<h2>참석자</h2>
${participantNames.length > 0
    ? `<ul>${participantNames.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`
    : "<p>참석자 미확인</p>"}
<h2>회의주제</h2>
<ul><li>${escapeHtml(topic)}</li></ul>
<h2>논의 항목</h2>
<table>
  <thead>
    <tr>
      <th>시간</th>
      <th>항목</th>
      <th>누구와</th>
      <th>내용</th>
    </tr>
  </thead>
  <tbody>
    ${discussionContent
    ? `<tr><td>${escapeHtml(timeRange || "전체")}</td><td>논의</td><td>${participantNames.length > 0 ? "전체" : ""}</td><td>${escapeHtml(discussionContent)}</td></tr>`
    : `<tr><td></td><td>논의</td><td></td><td>분석 가능한 논의 항목이 부족합니다.</td></tr>`}
    ${conclusion ? `<tr><td></td><td>결론</td><td></td><td>${escapeHtml(conclusion)}</td></tr>` : ""}
  </tbody>
</table>
`.trim();
}
