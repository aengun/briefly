export type ProgressCategory = "보고" | "요청" | "결정" | "이슈" | "후속조치";

export type WorkGroup = "공통" | "기획생산" | "물류포스" | "영업회계";

export type UnitWorkProgressItem = {
  order: number;
  category: ProgressCategory | string;
  content: string;
  owner: string;
  businessOwner: string;
};

export type UnitWorkPage = {
  title: string;
  participants: string[];
  purpose: string;
  problems: string;
  expectedEffects: string;
  progressItems: UnitWorkProgressItem[];
};

export type MainProgressWorkRow = {
  mainWorkName: string;
  unitWorkLink: string;
  owner: string;
};

export type MainProgressWork = {
  workGroup: WorkGroup;
  rows: MainProgressWorkRow[];
};

export type WorkProgressSource = {
  meetingTitle: string;
  meetingDate?: string;
  participants: Array<{ team?: string; name: string }>;
  summary: {
    asis?: string;
    tobe?: string;
    expected_effects?: string;
    schedule?: Array<{ task?: string; assignee?: string; dueDate?: string }>;
  };
};

const improvementKeywords = ["개선", "수정", "버그", "오류", "장애", "문제", "이슈", "보완", "요청"];
const developmentKeywords = ["개발", "구현", "신규", "연동", "자동화", "추가", "생성"];

export const progressCategories: ProgressCategory[] = ["보고", "요청", "결정", "이슈", "후속조치"];
export const workGroups: WorkGroup[] = ["공통", "기획생산", "물류포스", "영업회계"];

export function formatWorkDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return [
    safeDate.getFullYear(),
    String(safeDate.getMonth() + 1).padStart(2, "0"),
    String(safeDate.getDate()).padStart(2, "0"),
  ].join("-");
}

export function participantsToText(participants: string[]) {
  return participants.join("\n");
}

export function textToParticipants(value: string) {
  return value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

function cleanTopic(value: string) {
  return value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMeaningfulLine(value?: string) {
  return (value || "")
    .split(/\n|\./)
    .map(item => item.trim())
    .find(Boolean) || "";
}

function inferTopic(source: WorkProgressSource) {
  const fromTitle = cleanTopic(source.meetingTitle);
  if (fromTitle) return fromTitle;

  const firstTask = source.summary.schedule?.find(item => item.task?.trim())?.task?.trim();
  if (firstTask) return cleanTopic(firstTask);

  const fromPurpose = firstMeaningfulLine(source.summary.tobe);
  if (fromPurpose) return cleanTopic(fromPurpose).slice(0, 24);

  return "회의록 분석";
}

function inferWorkKind(text: string) {
  if (improvementKeywords.some(keyword => text.includes(keyword))) return "개선건";
  if (developmentKeywords.some(keyword => text.includes(keyword))) return "개발건";
  return "개발건";
}

function inferCategory(text: string): ProgressCategory {
  if (["결정", "확정", "합의"].some(keyword => text.includes(keyword))) return "결정";
  if (["문제", "이슈", "장애", "오류"].some(keyword => text.includes(keyword))) return "이슈";
  if (["요청", "필요", "개선"].some(keyword => text.includes(keyword))) return "요청";
  if (["후속", "진행", "처리", "담당"].some(keyword => text.includes(keyword))) return "후속조치";
  return "보고";
}

function inferWorkGroup(text: string): WorkGroup {
  if (["물류", "포스", "POS", "pos"].some(keyword => text.includes(keyword))) return "물류포스";
  if (["영업", "회계", "정산", "매출"].some(keyword => text.includes(keyword))) return "영업회계";
  if (["기획", "생산", "상품"].some(keyword => text.includes(keyword))) return "기획생산";
  return "공통";
}

function participantLabel(participant: { team?: string; name: string }) {
  return [participant.team, participant.name].filter(Boolean).join(" ").trim();
}

export function buildDefaultWorkProgress(source: WorkProgressSource) {
  const date = formatWorkDate(source.meetingDate);
  const topic = inferTopic(source);
  const sourceText = [
    source.meetingTitle,
    source.summary.asis,
    source.summary.tobe,
    source.summary.expected_effects,
    ...(source.summary.schedule || []).map(item => item.task || ""),
  ].join(" ");
  const workKind = inferWorkKind(sourceText);
  const title = `${date} [${topic}] ${workKind}`;
  const participants = source.participants.map(participantLabel).filter(Boolean);
  const schedule = source.summary.schedule || [];
  const primaryScheduleItem = schedule.find(item => item.task?.trim() || item.assignee?.trim());
  const progressItems = [{
    order: 1,
    category: inferCategory(`${primaryScheduleItem?.task || ""} ${primaryScheduleItem?.assignee || ""}`),
    content: primaryScheduleItem?.task || "",
    owner: primaryScheduleItem?.assignee || participants[0] || "",
    businessOwner: "",
  }];
  const owner = progressItems[0].owner || participants[0] || "";

  return {
    unitWorkPage: {
      title,
      participants,
      purpose: source.summary.tobe || "",
      problems: source.summary.asis || "",
      expectedEffects: source.summary.expected_effects || "",
      progressItems,
    },
    mainProgressWork: {
      workGroup: inferWorkGroup(sourceText),
      rows: [{
        mainWorkName: title,
        unitWorkLink: "",
        owner,
      }],
    },
  };
}
