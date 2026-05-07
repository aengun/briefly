export type TranscriptLike = {
  speaker?: string;
  text?: string;
};

export type AnalyzableContentResult = {
  isAnalyzable: boolean;
  message: string;
};

const insufficientMessage = "분석 가능한 회의 내용이 부족합니다.";
const noisePatterns = [
  /^(테스트|test|음|어|아|마이크|녹음|확인|하나둘|하나 둘)$/i,
  /^[ㅋㅎㅠㅜ\s]+$/,
  /^[a-z\s]{1,8}$/i,
];

function normalizeText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseSegment(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  if (noisePatterns.some(pattern => pattern.test(normalized))) return true;

  const compact = normalized.replace(/\s+/g, "");
  const uniqueChars = new Set(Array.from(compact)).size;
  return compact.length > 8 && uniqueChars <= 2;
}

function countMeaningfulSentences(texts: string[]) {
  return texts
    .flatMap(text => normalizeText(text).split(/[.!?。！？\n]+/))
    .map(segment => segment.trim())
    .filter(segment => segment.length >= 8 && !isNoiseSegment(segment))
    .length;
}

function hasMeetingSignal(text: string) {
  return /(회의|논의|결정|검토|요청|개선|문제|이슈|일정|담당|진행|개발|설계|테스트|업무|공유|정리|처리|확인)/.test(text);
}

export function validateAnalyzableContent(transcript?: TranscriptLike[] | string): AnalyzableContentResult {
  const texts = Array.isArray(transcript)
    ? transcript.map(item => item.text || "")
    : [transcript || ""];
  const meaningfulTexts = texts
    .map(normalizeText)
    .filter(text => text && !isNoiseSegment(text));
  const joined = meaningfulTexts.join(" ");
  const compact = joined.replace(/[^가-힣a-zA-Z0-9]/g, "");
  const sentenceCount = countMeaningfulSentences(meaningfulTexts);

  if (!compact) {
    return { isAnalyzable: false, message: insufficientMessage };
  }

  if (compact.length < 80) {
    return {
      isAnalyzable: false,
      message: "회의록을 생성하려면 더 긴 음성 또는 명확한 대화 내용이 필요합니다.",
    };
  }

  if (sentenceCount < 3) {
    return {
      isAnalyzable: false,
      message: "업로드한 파일에서 충분한 회의 내용을 찾지 못했습니다.",
    };
  }

  if (!hasMeetingSignal(joined) && sentenceCount < 5) {
    return {
      isAnalyzable: false,
      message: "회의 분석에 필요한 주제, 논의 내용 또는 업무 근거가 부족합니다.",
    };
  }

  return { isAnalyzable: true, message: "" };
}
