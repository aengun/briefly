export type MainProgressStatus = "기획" | "검토" | "설계" | "진행";

export type WorkGroup =
  | "공통.OA.보안.서버.N/W."
  | "기획.수출입.구매.생산.SCM"
  | "영업.소비자.상담.회계.BI"
  | "물류.POS.고객.모바일";

export type WorkScheduleCategory = "분석" | "설계" | "개발" | "테스트";
export type WorkDifficulty = "상" | "중" | "하";
export type HistoryCategory = "분석" | "개발" | "테스트";

export type UnitWorkScheduleRow = {
  category: WorkScheduleCategory;
  difficulty: WorkDifficulty;
  content: string;
  expectedMonth: string;
  owner: string;
  weight: number;
};

export type UnitWorkHistoryRow = {
  no: number;
  date: string;
  category: HistoryCategory;
  content: string;
  itOwner: string;
  businessOwner: string;
};

export type UnitWorkPage = {
  title: string;
  statusProblemItems: string[];
  improvementGoalItems: string[];
  expectedEffectItems: string[];
  scheduleRows: UnitWorkScheduleRow[];
  historyRows: UnitWorkHistoryRow[];
};

export type MainProgressWorkRow = {
  registrationMonth: string;
  mainWorkName: string;
  status: MainProgressStatus;
  overviewItems: string[];
  unitWorkLink: string;
  itOwner: string;
  department: string;
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

export const workScheduleCategories: WorkScheduleCategory[] = ["분석", "설계", "개발", "테스트"];
export const workDifficulties: WorkDifficulty[] = ["상", "중", "하"];
export const historyCategories: HistoryCategory[] = ["분석", "개발", "테스트"];
export const mainProgressStatuses: MainProgressStatus[] = ["기획", "검토", "설계", "진행"];
export const workGroups: WorkGroup[] = [
  "공통.OA.보안.서버.N/W.",
  "기획.수출입.구매.생산.SCM",
  "영업.소비자.상담.회계.BI",
  "물류.POS.고객.모바일",
];

const defaultWeights = [25, 25, 40, 10];

export function formatWorkDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return [
    safeDate.getFullYear(),
    String(safeDate.getMonth() + 1).padStart(2, "0"),
    String(safeDate.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatDotDate(value?: string) {
  return formatWorkDate(value).replaceAll("-", ".");
}

export function formatTitleDate(value?: string) {
  return `[${formatDotDate(value)}]`;
}

export function formatWorkMonth(value?: string) {
  const base = value?.length === 7 ? `${value}-01` : value;
  const date = base ? new Date(base) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return [
    safeDate.getFullYear(),
    String(safeDate.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

export function formatDisplayMonth(value?: string) {
  return formatWorkMonth(value).replace("-", ".");
}

export function formatShortMonth(value?: string) {
  const [year, month] = formatWorkMonth(value).split("-");
  return `${year.slice(2)}.${month}`;
}

export function listToText(items: string[]) {
  return items.join("\n");
}

export function textToList(value: string, maxItems?: number) {
  const items = value
    .split(/\n/)
    .map(item => item.trim())
    .filter(Boolean);

  return typeof maxItems === "number" ? items.slice(0, maxItems) : items;
}

function trimToLength(value: string, maxLength: number) {
  const chars = Array.from(value.trim());
  return chars.length > maxLength ? chars.slice(0, maxLength).join("").trim() : value.trim();
}

function cleanTopic(value: string) {
  return value
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/^\[?\d{4}[-.]\d{2}[-.]\d{2}\]?\s*/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^회의록\s*/g, "")
    .trim();
}

function splitSummaryItems(value?: string, maxItems = 3) {
  return (value || "")
    .split(/\n|[•·]/)
    .flatMap(item => item.split(/(?<=다\.|요\.|음\.)\s+/))
    .map(item => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .map(item => trimToLength(item, 120))
    .slice(0, maxItems);
}

function firstMeaningfulLine(value?: string) {
  return (value || "")
    .split(/\n|\.|。/)
    .map(item => item.trim())
    .find(Boolean) || "";
}

function compactLine(value?: string, maxLength = 90) {
  return trimToLength(firstMeaningfulLine(value), maxLength);
}

function inferTopic(source: WorkProgressSource) {
  const firstTask = source.summary.schedule?.find(item => item.task?.trim())?.task?.trim();
  if (firstTask) return trimToLength(cleanTopic(firstTask), 42);

  const fromPurpose = firstMeaningfulLine(source.summary.tobe);
  if (fromPurpose) return trimToLength(cleanTopic(fromPurpose), 42);

  const fromProblem = firstMeaningfulLine(source.summary.asis);
  if (fromProblem) return trimToLength(cleanTopic(fromProblem), 42);

  return "제목 없는 회의록";
}

function inferStatus(text: string): MainProgressStatus {
  if (["기획", "계획", "정책"].some(keyword => text.includes(keyword))) return "기획";
  if (["설계", "구조", "아키텍처"].some(keyword => text.includes(keyword))) return "설계";
  if (["진행", "개발", "구현", "작업", "처리"].some(keyword => text.includes(keyword))) return "진행";
  return "검토";
}

function inferWorkGroup(text: string): WorkGroup {
  if (["물류", "POS", "pos", "고객", "모바일"].some(keyword => text.includes(keyword))) return "물류.POS.고객.모바일";
  if (["영업", "소비자", "상담", "회계", "BI"].some(keyword => text.includes(keyword))) return "영업.소비자.상담.회계.BI";
  if (["기획", "수출입", "구매", "생산", "SCM"].some(keyword => text.includes(keyword))) return "기획.수출입.구매.생산.SCM";
  return "공통.OA.보안.서버.N/W.";
}

function inferScheduleCategory(text: string): WorkScheduleCategory {
  if (["테스트", "검증", "QA"].some(keyword => text.includes(keyword))) return "테스트";
  if (["개발", "구현", "수정", "반영"].some(keyword => text.includes(keyword))) return "개발";
  if (["설계", "구조", "정의"].some(keyword => text.includes(keyword))) return "설계";
  return "분석";
}

function inferHistoryCategory(text: string): HistoryCategory {
  const category = inferScheduleCategory(text);
  return category === "설계" ? "분석" : category;
}

function inferDifficulty(text: string): WorkDifficulty {
  if (["복잡", "대규모", "연동", "버전", "업데이트", "파싱"].some(keyword => text.includes(keyword))) return "상";
  if (["간단", "문구", "스타일", "확인"].some(keyword => text.includes(keyword))) return "하";
  return "중";
}

function inferItOwner(source: WorkProgressSource) {
  const scheduleOwner = source.summary.schedule?.find(item => item.assignee?.trim())?.assignee?.trim();
  if (scheduleOwner) return scheduleOwner;

  const participant = source.participants.find(item => /IT|개발|전산|서버|보안/i.test(`${item.team || ""} ${item.name}`));
  return participant?.name || "";
}

function inferDepartment(source: WorkProgressSource) {
  const participant = source.participants.find(item => item.team && !/IT|개발|전산|서버|보안/i.test(item.team));
  return participant?.team || "";
}

function buildOverviewItems(source: WorkProgressSource) {
  const candidates = [
    compactLine(source.summary.tobe),
    compactLine(source.summary.expected_effects),
    ...(source.summary.schedule || []).map(item => compactLine(item.task)),
  ].filter(Boolean);

  return Array.from(new Set(candidates)).slice(0, 2);
}

function buildScheduleRows(source: WorkProgressSource, topic: string, owner: string, expectedMonth: string): UnitWorkScheduleRow[] {
  const sourceRows = (source.summary.schedule || [])
    .filter(item => item.task?.trim())
    .slice(0, 4)
    .map((item, index) => ({
      category: inferScheduleCategory(item.task || ""),
      difficulty: inferDifficulty(item.task || ""),
      content: item.task?.trim() || "",
      expectedMonth: item.dueDate ? formatShortMonth(item.dueDate) : expectedMonth,
      owner: item.assignee?.trim() || owner,
      weight: defaultWeights[index] || 10,
    }));

  if (sourceRows.length > 0) {
    const baseWeight = Math.floor(100 / sourceRows.length);
    return sourceRows.map((row, index) => ({
      ...row,
      weight: index === sourceRows.length - 1
        ? 100 - (baseWeight * (sourceRows.length - 1))
        : baseWeight,
    }));
  }

  return [
    { category: "분석", difficulty: "중", content: `${topic} 관련 현황과 Confluence 연동 구조를 분석`, expectedMonth, owner, weight: 25 },
    { category: "설계", difficulty: "중", content: `${topic} 처리 방식과 WIKI 전송 양식 설계`, expectedMonth, owner, weight: 25 },
    { category: "개발", difficulty: "상", content: `${topic} 기능 구현 및 화면 반영`, expectedMonth, owner, weight: 40 },
    { category: "테스트", difficulty: "중", content: `${topic} 전송 결과와 테이블 반영 검증`, expectedMonth, owner, weight: 10 },
  ];
}

function buildHistoryRows(source: WorkProgressSource, topic: string, date: string, itOwner: string, businessOwner: string): UnitWorkHistoryRow[] {
  const firstTask = source.summary.schedule?.find(item => item.task?.trim())?.task?.trim();
  const content = firstTask || compactLine(source.summary.tobe || source.summary.asis, 120) || `${topic} 관련 작업 내용을 정리함`;

  return [{
    no: 1,
    date,
    category: inferHistoryCategory(content),
    content,
    itOwner,
    businessOwner,
  }];
}

export function buildDefaultWorkProgress(source: WorkProgressSource) {
  const hyphenDate = formatWorkDate(source.meetingDate);
  const dotDate = formatDotDate(source.meetingDate);
  const titleDate = formatTitleDate(source.meetingDate);
  const month = formatWorkMonth(source.meetingDate);
  const shortMonth = formatShortMonth(source.meetingDate);
  const topic = inferTopic(source);
  const sourceText = [
    source.summary.asis,
    source.summary.tobe,
    source.summary.expected_effects,
    ...(source.summary.schedule || []).map(item => `${item.task || ""} ${item.assignee || ""}`),
  ].join(" ");
  const itOwner = inferItOwner(source);
  const department = inferDepartment(source);
  const statusProblemItems = splitSummaryItems(source.summary.asis);
  const improvementGoalItems = splitSummaryItems(source.summary.tobe);
  const expectedEffectItems = splitSummaryItems(source.summary.expected_effects);
  const overviewItems = buildOverviewItems(source);

  return {
    unitWorkPage: {
      title: `${titleDate} ${topic}`,
      statusProblemItems,
      improvementGoalItems,
      expectedEffectItems,
      scheduleRows: buildScheduleRows(source, topic, itOwner, shortMonth),
      historyRows: buildHistoryRows(source, topic, dotDate, itOwner, department),
    },
    mainProgressWork: {
      workGroup: inferWorkGroup(sourceText),
      rows: [{
        registrationMonth: month,
        mainWorkName: topic,
        status: inferStatus(sourceText),
        overviewItems,
        unitWorkLink: "",
        itOwner,
        department,
      }],
    },
    sourceDate: hyphenDate,
  };
}
