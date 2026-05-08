import { buildMeetingTitle, looksLikeSourceFileName } from "./meeting-summary";

export type MeetingSourceType = "upload" | "realtime";

export type MeetingParticipantInput = {
  team?: string;
  name?: string;
};

export type MeetingTranscriptInput = {
  speaker?: string;
  text?: string;
  start?: number;
  end?: number;
  startTime?: number;
  endTime?: number;
};

export type MeetingScheduleInput = {
  task?: string;
  assignee?: string;
  dueDate?: string;
};

export type MeetingRecordInput = {
  title?: string;
  sourceType?: string;
  audioUrl?: string;
  meetingDate?: string;
  participants?: unknown;
  transcript?: unknown;
  summary?: {
    asis?: string;
    tobe?: string;
    expected_effects?: string;
    schedule?: unknown;
  } | null;
};

const asArray = <T>(value: unknown): T[] => (
  Array.isArray(value) ? value as T[] : []
);

const asText = (value: unknown, fallback = "") => (
  typeof value === "string" ? value.trim() : fallback
);

const asOptionalNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
};

export const normalizeSourceType = (value?: string): MeetingSourceType => (
  value === "realtime" ? "realtime" : "upload"
);

export function parseMeetingDate(value?: string) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function normalizeMeetingRecordInput(body: MeetingRecordInput) {
  const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
  const participants = asArray<MeetingParticipantInput>(body.participants)
    .map(participant => ({
      team: asText(participant?.team, "미지정") || "미지정",
      name: asText(participant?.name, "이름 없음") || "이름 없음",
    }));

  const transcript = asArray<MeetingTranscriptInput>(body.transcript)
    .map((item) => ({
      speaker: asText(item?.speaker, "알 수 없음") || "알 수 없음",
      text: asText(item?.text),
      start: asOptionalNumber(item?.start, item?.startTime),
      end: asOptionalNumber(item?.end, item?.endTime),
    }))
    .filter(item => item.text);

  const schedule = asArray<MeetingScheduleInput>(summary.schedule)
    .map(item => ({
      task: asText(item?.task),
      assignee: asText(item?.assignee),
      dueDate: asText(item?.dueDate),
    }))
    .filter(item => item.task || item.assignee || item.dueDate);

  const requestedTitle = asText(body.title);
  const generatedTitle = buildMeetingTitle({
    meetingDate: body.meetingDate,
    summary: {
      asis: summary.asis,
      tobe: summary.tobe,
      expected_effects: summary.expected_effects,
      schedule,
    },
    transcript,
  });

  return {
    title: requestedTitle && !looksLikeSourceFileName(requestedTitle) ? requestedTitle : generatedTitle,
    sourceType: normalizeSourceType(body.sourceType),
    audioUrl: asText(body.audioUrl),
    meetingDate: parseMeetingDate(body.meetingDate),
    participants,
    transcript,
    summary: {
      asis: asText(summary.asis),
      tobe: asText(summary.tobe),
      expected_effects: asText(summary.expected_effects),
      schedule,
    },
  };
}
