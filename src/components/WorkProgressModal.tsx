"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, Plus, Search, Send, Trash2, X } from "lucide-react";
import {
  buildDefaultWorkProgress,
  formatDisplayMonth,
  historyCategories,
  listToText,
  mainProgressStatuses,
  textToList,
  workDifficulties,
  workGroups,
  workScheduleCategories,
  type MainProgressWork,
  type UnitWorkHistoryRow,
  type UnitWorkPage,
  type UnitWorkScheduleRow,
  type WorkGroup,
  type WorkProgressSource,
} from "@/lib/work-progress";

type ConfluencePageResult = {
  id: string;
  title: string;
  url: string;
};

type PageSearchPanelProps = {
  title: string;
  selectedText: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  pages: ConfluencePageResult[];
  selectedPage: ConfluencePageResult | null;
  onSelectPage: (page: ConfluencePageResult | null) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

type WorkProgressModalProps = WorkProgressSource & {
  isOpen: boolean;
  onClose: () => void;
};

const fieldClass = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300/70 focus:bg-white/[0.09]";
const compactFieldClass = "w-full rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-xs text-white outline-none transition focus:border-amber-300/70 focus:bg-white/[0.09]";
const textareaClass = `${fieldClass} min-h-20 resize-y leading-relaxed`;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "");
}

function filterPages(pages: ConfluencePageResult[], query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return pages;
  return pages.filter(page => normalizeSearchText(page.title).includes(normalizedQuery));
}

function overviewToText(items: string[]) {
  return items.join("\n");
}

function textToOverview(value: string) {
  return textToList(value, 2);
}

async function fetchPages(query: string) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  if (trimmedQuery) params.set("query", trimmedQuery);
  params.set("limit", "60");

  const res = await fetch(`/api/confluence/pages?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Confluence 페이지 목록을 불러오지 못했습니다.");
  }

  return Array.isArray(data.pages) ? data.pages as ConfluencePageResult[] : [];
}

function PageSearchPanel({
  title,
  selectedText,
  searchQuery,
  onSearchQueryChange,
  pages,
  selectedPage,
  onSelectPage,
  isLoading,
  error,
  onRetry,
}: PageSearchPanelProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-black/15 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <button
          type="button"
          onClick={() => onSelectPage(null)}
          className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/65 transition hover:bg-white/15"
        >
          선택 해제
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-white/55">페이지 검색</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={searchQuery}
            onChange={event => onSearchQueryChange(event.target.value)}
            className={`${compactFieldClass} pl-8`}
            placeholder="페이지 제목 일부 입력"
          />
        </div>
      </label>
      <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-xs text-white/50">
            Confluence 페이지를 불러오는 중입니다...
          </div>
        ) : error ? (
          <div className="rounded-md border border-rose-400/25 bg-rose-500/10 px-3 py-3 text-xs text-rose-100">
            <p>{error}</p>
            <p className="mt-1 text-rose-100/75">환경변수, API 토큰, Confluence 권한을 확인해주세요.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20"
            >
              다시 시도
            </button>
          </div>
        ) : pages.length > 0 ? (
          pages.map(page => {
            const isSelected = selectedPage?.id === page.id;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelectPage(page)}
                className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
                  isSelected
                    ? "border-amber-300/60 bg-amber-400/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">{page.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-white/40">{page.url}</div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-xs text-white/50">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
      <div className="mt-2 truncate rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/60">
        {selectedPage ? `${selectedText}: ${selectedPage.title}` : selectedText}
      </div>
    </section>
  );
}

export default function WorkProgressModal({
  isOpen,
  onClose,
  meetingTitle,
  meetingDate,
  participants,
  summary,
}: WorkProgressModalProps) {
  const [unitWorkPage, setUnitWorkPage] = useState<UnitWorkPage | null>(null);
  const [mainProgressWork, setMainProgressWork] = useState<MainProgressWork | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [unitSearchQuery, setUnitSearchQuery] = useState("");
  const [unitPages, setUnitPages] = useState<ConfluencePageResult[]>([]);
  const [selectedUnitParentPage, setSelectedUnitParentPage] = useState<ConfluencePageResult | null>(null);
  const [unitIsLoadingPages, setUnitIsLoadingPages] = useState(false);
  const [unitPagesError, setUnitPagesError] = useState<string | null>(null);

  const [mainSearchQuery, setMainSearchQuery] = useState("");
  const [mainPages, setMainPages] = useState<ConfluencePageResult[]>([]);
  const [selectedMainPage, setSelectedMainPage] = useState<ConfluencePageResult | null>(null);
  const [mainIsLoadingPages, setMainIsLoadingPages] = useState(false);
  const [mainPagesError, setMainPagesError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const defaults = buildDefaultWorkProgress({
      meetingTitle,
      meetingDate,
      participants,
      summary,
    });
    setUnitWorkPage(defaults.unitWorkPage);
    setMainProgressWork(defaults.mainProgressWork);
    setShowPreview(false);
    setMessage(null);
    setUnitSearchQuery("");
    setUnitPages([]);
    setSelectedUnitParentPage(null);
    setMainSearchQuery("");
    setMainPages([]);
    setSelectedMainPage(null);
    setUnitPagesError(null);
    setMainPagesError(null);
  }, [isOpen, meetingDate, meetingTitle, participants, summary]);

  const loadUnitPages = async (query = unitSearchQuery) => {
    setUnitIsLoadingPages(true);
    setUnitPagesError(null);
    try {
      const pages = await fetchPages(query);
      setUnitPages(pages);
      setSelectedUnitParentPage(prev => prev && pages.some(page => page.id === prev.id) ? prev : null);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Confluence 페이지 목록을 불러오지 못했습니다.";
      setUnitPages([]);
      setUnitPagesError(text);
    } finally {
      setUnitIsLoadingPages(false);
    }
  };

  const loadMainPages = async (query = mainSearchQuery) => {
    setMainIsLoadingPages(true);
    setMainPagesError(null);
    try {
      const pages = await fetchPages(query);
      setMainPages(pages);
      setSelectedMainPage(prev => prev && pages.some(page => page.id === prev.id) ? prev : null);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Confluence 페이지 목록을 불러오지 못했습니다.";
      setMainPages([]);
      setMainPagesError(text);
    } finally {
      setMainIsLoadingPages(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setUnitIsLoadingPages(true);
      setUnitPagesError(null);
      try {
        const pages = await fetchPages(unitSearchQuery);
        if (!cancelled) {
          setUnitPages(pages);
          setSelectedUnitParentPage(prev => prev && pages.some(page => page.id === prev.id) ? prev : null);
        }
      } catch (error) {
        if (!cancelled) {
          const text = error instanceof Error ? error.message : "Confluence 페이지 목록을 불러오지 못했습니다.";
          setUnitPages([]);
          setUnitPagesError(text);
        }
      } finally {
        if (!cancelled) setUnitIsLoadingPages(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, unitSearchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setMainIsLoadingPages(true);
      setMainPagesError(null);
      try {
        const pages = await fetchPages(mainSearchQuery);
        if (!cancelled) {
          setMainPages(pages);
          setSelectedMainPage(prev => prev && pages.some(page => page.id === prev.id) ? prev : null);
        }
      } catch (error) {
        if (!cancelled) {
          const text = error instanceof Error ? error.message : "Confluence 페이지 목록을 불러오지 못했습니다.";
          setMainPages([]);
          setMainPagesError(text);
        }
      } finally {
        if (!cancelled) setMainIsLoadingPages(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isOpen, mainSearchQuery]);

  const updateScheduleRow = (index: number, patch: Partial<UnitWorkScheduleRow>) => {
    setUnitWorkPage(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scheduleRows: prev.scheduleRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
      };
    });
  };

  const addScheduleRow = () => {
    setUnitWorkPage(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scheduleRows: [
          ...prev.scheduleRows,
          { category: "개발", difficulty: "중", content: "", expectedMonth: "", owner: "", weight: 0 },
        ],
      };
    });
  };

  const removeScheduleRow = (index: number) => {
    setUnitWorkPage(prev => {
      if (!prev) return prev;
      const nextRows = prev.scheduleRows.filter((_, rowIndex) => rowIndex !== index);
      return {
        ...prev,
        scheduleRows: nextRows.length > 0 ? nextRows : [{ category: "분석", difficulty: "중", content: "", expectedMonth: "", owner: "", weight: 100 }],
      };
    });
  };

  const updateHistoryRow = (index: number, patch: Partial<UnitWorkHistoryRow>) => {
    setUnitWorkPage(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        historyRows: prev.historyRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
      };
    });
  };

  const addHistoryRow = () => {
    setUnitWorkPage(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        historyRows: [
          ...prev.historyRows,
          { no: prev.historyRows.length + 1, date: "", category: "개발", content: "", itOwner: "", businessOwner: "" },
        ],
      };
    });
  };

  const removeHistoryRow = (index: number) => {
    setUnitWorkPage(prev => {
      if (!prev) return prev;
      const nextRows = prev.historyRows
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row, rowIndex) => ({ ...row, no: rowIndex + 1 }));
      return {
        ...prev,
        historyRows: nextRows.length > 0 ? nextRows : [{ no: 1, date: "", category: "분석", content: "", itOwner: "", businessOwner: "" }],
      };
    });
  };

  const updateMainRow = (index: number, patch: Partial<MainProgressWork["rows"][number]>) => {
    setMainProgressWork(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
      };
    });
  };

  const sendToWiki = async () => {
    if (!unitWorkPage || !mainProgressWork) return;

    if (!selectedUnitParentPage) {
      setMessage({ type: "error", text: "단위업무 상위페이지를 선택해주세요." });
      return;
    }

    if (!selectedMainPage) {
      setMessage({ type: "error", text: "수정할 주요진행업무 페이지를 선택해주세요." });
      return;
    }

    if (!unitWorkPage.title.trim()) {
      setMessage({ type: "error", text: "단위업무 페이지명을 입력해주세요." });
      return;
    }

    if (!mainProgressWork.workGroup) {
      setMessage({ type: "error", text: "주요진행업무 파트를 선택해주세요." });
      return;
    }

    setIsSending(true);
    setMessage(null);

    try {
      const res = await fetch("/api/confluence/work-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitWorkPage,
          mainProgressWork,
          unitParentPageId: selectedUnitParentPage.id,
          mainParentPageId: selectedMainPage.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "회의록 등록 중 오류가 발생했습니다.");
      }

      if (data.mainProgressWork) {
        setMainProgressWork(data.mainProgressWork);
      }

      setMessage({
        type: "success",
        text: "WIKI 전송이 완료되었습니다.",
      });
      setTimeout(onClose, 600);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "회의록 등록 중 오류가 발생했습니다.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !unitWorkPage || !mainProgressWork) return null;

  const visibleUnitPages = filterPages(unitPages, unitSearchQuery);
  const visibleMainPages = filterPages(mainPages, mainSearchQuery);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-progress-title"
        className="flex max-h-[92vh] w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold text-amber-300">회의록 기반 WIKI 전송</p>
            <h2 id="work-progress-title" className="text-xl font-bold text-white">일감진행</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              분석된 회의록을 단위업무로 생성하고 주요진행업무 페이지의 표에 추가합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="일감진행 닫기"
            className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {message && (
            <div className={`mb-3 rounded-lg border px-3 py-2.5 text-sm ${
              message.type === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-rose-400/30 bg-rose-500/10 text-rose-100"
            }`}>
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-amber-300/20 bg-amber-400/[0.06] p-4">
              <div className="mb-3">
                <h3 className="text-base font-bold text-white">단위업무</h3>
                <p className="mt-1 text-xs text-white/50">새로 생성할 단위업무 페이지의 위치와 본문 양식입니다.</p>
              </div>

              <div className="space-y-3">
                <PageSearchPanel
                  title="단위업무 상위페이지 선택"
                  selectedText="상위페이지를 선택해주세요."
                  searchQuery={unitSearchQuery}
                  onSearchQueryChange={setUnitSearchQuery}
                  pages={visibleUnitPages}
                  selectedPage={selectedUnitParentPage}
                  onSelectPage={setSelectedUnitParentPage}
                  isLoading={unitIsLoadingPages}
                  error={unitPagesError}
                  onRetry={() => loadUnitPages(unitSearchQuery)}
                />

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/65">페이지명</span>
                  <input
                    value={unitWorkPage.title}
                    onChange={event => setUnitWorkPage({ ...unitWorkPage, title: event.target.value })}
                    className={fieldClass}
                    placeholder="[YYYY.MM.DD] 제목 없는 회의록"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <label className="block rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <span className="mb-2 block border-b border-white/10 pb-2 text-sm font-bold text-white">1. 현황/문제점</span>
                    <textarea
                      value={listToText(unitWorkPage.statusProblemItems)}
                      onChange={event => setUnitWorkPage({ ...unitWorkPage, statusProblemItems: textToList(event.target.value) })}
                      className={`${textareaClass} min-h-32 border-white/10 bg-black/20 leading-7`}
                      placeholder="항목을 줄바꿈으로 입력"
                    />
                  </label>
                  <label className="block rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <span className="mb-2 block border-b border-white/10 pb-2 text-sm font-bold text-white">2. 개선방향(목적)</span>
                    <textarea
                      value={listToText(unitWorkPage.improvementGoalItems)}
                      onChange={event => setUnitWorkPage({ ...unitWorkPage, improvementGoalItems: textToList(event.target.value) })}
                      className={`${textareaClass} min-h-32 border-white/10 bg-black/20 leading-7`}
                      placeholder="항목을 줄바꿈으로 입력"
                    />
                  </label>
                  <label className="block rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <span className="mb-2 block border-b border-white/10 pb-2 text-sm font-bold text-white">3. 기대효과</span>
                    <textarea
                      value={listToText(unitWorkPage.expectedEffectItems)}
                      onChange={event => setUnitWorkPage({ ...unitWorkPage, expectedEffectItems: textToList(event.target.value) })}
                      className={`${textareaClass} min-h-32 border-white/10 bg-black/20 leading-7`}
                      placeholder="항목을 줄바꿈으로 입력"
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white">4. 일감내용 및 일정</h4>
                    <button
                      type="button"
                      onClick={addScheduleRow}
                      className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      추가
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/10">
                    <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-left text-xs text-white/75">
                      <thead className="bg-slate-900/90 text-white">
                        <tr>
                          <th className="w-28 border-b border-white/10 p-3 font-bold">구분</th>
                          <th className="w-28 border-b border-white/10 p-3 font-bold">개발 난이도</th>
                          <th className="min-w-[420px] border-b border-white/10 p-3 font-bold">내용</th>
                          <th className="w-28 border-b border-white/10 p-3 font-bold">예상일정</th>
                          <th className="w-36 border-b border-white/10 p-3 font-bold">담당</th>
                          <th className="w-20 border-b border-white/10 p-3 font-bold">비중</th>
                          <th className="w-12 border-b border-white/10 p-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {unitWorkPage.scheduleRows.map((row, index) => (
                          <tr key={index} className="align-top odd:bg-white/[0.025] even:bg-white/[0.045]">
                            <td className="border-b border-white/5 p-3">
                              <select
                                value={row.category}
                                onChange={event => updateScheduleRow(index, { category: event.target.value as UnitWorkScheduleRow["category"] })}
                                className={compactFieldClass}
                              >
                                {workScheduleCategories.map(category => <option key={category} value={category} className="text-gray-900">{category}</option>)}
                              </select>
                            </td>
                            <td className="border-b border-white/5 p-3">
                              <select
                                value={row.difficulty}
                                onChange={event => updateScheduleRow(index, { difficulty: event.target.value as UnitWorkScheduleRow["difficulty"] })}
                                className={compactFieldClass}
                              >
                                {workDifficulties.map(difficulty => <option key={difficulty} value={difficulty} className="text-gray-900">{difficulty}</option>)}
                              </select>
                            </td>
                            <td className="border-b border-white/5 p-3">
                              <textarea
                                value={row.content}
                                onChange={event => updateScheduleRow(index, { content: event.target.value })}
                                className={`${compactFieldClass} min-h-16 resize-y leading-6`}
                                placeholder="작업 내용을 입력하세요"
                              />
                            </td>
                            <td className="border-b border-white/5 p-3">
                              <input
                                value={row.expectedMonth}
                                onChange={event => updateScheduleRow(index, { expectedMonth: event.target.value })}
                                className={compactFieldClass}
                                placeholder="26.05"
                              />
                            </td>
                            <td className="border-b border-white/5 p-3">
                              <input
                                value={row.owner}
                                onChange={event => updateScheduleRow(index, { owner: event.target.value })}
                                className={compactFieldClass}
                                placeholder="담당"
                              />
                            </td>
                            <td className="border-b border-white/5 p-3">
                              <input
                                type="number"
                                value={row.weight}
                                onChange={event => updateScheduleRow(index, { weight: Number(event.target.value) })}
                                className={compactFieldClass}
                              />
                            </td>
                            <td className="border-b border-white/5 p-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeScheduleRow(index)}
                                aria-label="일감내용 삭제"
                                className="rounded-md p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white">5. 진행 내역(히스토리)</h4>
                    <button
                      type="button"
                      onClick={addHistoryRow}
                      className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      추가
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="min-w-[860px] w-full border-collapse text-left text-xs text-white/70">
                      <thead className="bg-white/[0.08] text-white">
                        <tr>
                          <th className="w-16 p-2 font-semibold">NO</th>
                          <th className="w-28 p-2 font-semibold">일자</th>
                          <th className="w-24 p-2 font-semibold">구분</th>
                          <th className="p-2 font-semibold">작업 내용</th>
                          <th className="w-32 p-2 font-semibold">IT 담당자</th>
                          <th className="w-32 p-2 font-semibold">현업 담당자</th>
                          <th className="w-12 p-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {unitWorkPage.historyRows.map((row, index) => (
                          <tr key={index} className="border-t border-white/10 bg-white/[0.02] align-top">
                            <td className="p-2">
                              <input value={row.no} readOnly className={`${compactFieldClass} text-center`} />
                            </td>
                            <td className="p-2">
                              <input
                                value={row.date}
                                onChange={event => updateHistoryRow(index, { date: event.target.value })}
                                className={compactFieldClass}
                                placeholder="2026.05.07"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={row.category}
                                onChange={event => updateHistoryRow(index, { category: event.target.value as UnitWorkHistoryRow["category"] })}
                                className={compactFieldClass}
                              >
                                {historyCategories.map(category => <option key={category} value={category} className="text-gray-900">{category}</option>)}
                              </select>
                            </td>
                            <td className="p-2">
                              <textarea
                                value={row.content}
                                onChange={event => updateHistoryRow(index, { content: event.target.value })}
                                className={`${compactFieldClass} min-h-12 resize-y`}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                value={row.itOwner}
                                onChange={event => updateHistoryRow(index, { itOwner: event.target.value })}
                                className={compactFieldClass}
                                placeholder="IT 담당자"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                value={row.businessOwner}
                                onChange={event => updateHistoryRow(index, { businessOwner: event.target.value })}
                                className={compactFieldClass}
                                placeholder="현업 담당자"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeHistoryRow(index)}
                                aria-label="진행 내역 삭제"
                                className="rounded-md p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-cyan-300/20 bg-cyan-400/[0.05] p-4">
              <div className="mb-3">
                <h3 className="text-base font-bold text-white">주요진행업무</h3>
                <p className="mt-1 text-xs text-white/50">선택한 기존 페이지의 파트별 테이블에 row를 추가합니다.</p>
              </div>

              <div className="space-y-3">
                <PageSearchPanel
                  title="수정할 주요진행업무 페이지 선택"
                  selectedText="수정할 페이지를 선택해주세요."
                  searchQuery={mainSearchQuery}
                  onSearchQueryChange={setMainSearchQuery}
                  pages={visibleMainPages}
                  selectedPage={selectedMainPage}
                  onSelectPage={setSelectedMainPage}
                  isLoading={mainIsLoadingPages}
                  error={mainPagesError}
                  onRetry={() => loadMainPages(mainSearchQuery)}
                />

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/65">파트 선택</span>
                  <select
                    value={mainProgressWork.workGroup}
                    onChange={event => setMainProgressWork({ ...mainProgressWork, workGroup: event.target.value as WorkGroup })}
                    className={fieldClass}
                  >
                    {workGroups.map(group => (
                      <option key={group} value={group} className="text-gray-900">{group}</option>
                    ))}
                  </select>
                </label>

                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="min-w-[980px] w-full border-collapse text-left text-xs text-white/70">
                    <thead className="bg-white/[0.08] text-white">
                      <tr>
                        <th className="w-40 p-2 font-semibold">공란</th>
                        <th className="w-28 p-2 font-semibold">등록일(월)</th>
                        <th className="w-48 p-2 font-semibold">주요 진행중 업무 제목<br /><span className="font-normal text-white/55">기획 / 검토 / 설계 / 진행</span></th>
                        <th className="w-56 p-2 font-semibold">업무 개요(간략)</th>
                        <th className="w-48 p-2 font-semibold">진행경과<br /><span className="font-normal text-white/55">단위페이지 링크</span></th>
                        <th className="w-32 p-2 font-semibold">IT 담당</th>
                        <th className="w-32 p-2 font-semibold">담당부서</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mainProgressWork.rows.map((row, index) => (
                        <tr key={index} className="border-t border-white/10 bg-white/[0.02] align-top">
                          <td className="p-2">
                            <div className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-white/80">
                              {mainProgressWork.workGroup}
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              type="month"
                              value={row.registrationMonth}
                              onChange={event => updateMainRow(index, { registrationMonth: event.target.value })}
                              className={compactFieldClass}
                            />
                            <div className="mt-1 text-[11px] text-white/45">{formatDisplayMonth(row.registrationMonth)}</div>
                          </td>
                          <td className="p-2">
                            <input
                              value={row.mainWorkName}
                              onChange={event => updateMainRow(index, { mainWorkName: event.target.value })}
                              className={compactFieldClass}
                            />
                            <select
                              value={row.status}
                              onChange={event => updateMainRow(index, { status: event.target.value as MainProgressWork["rows"][number]["status"] })}
                              className={`${compactFieldClass} mt-1`}
                            >
                              {mainProgressStatuses.map(status => (
                                <option key={status} value={status} className="text-gray-900">{status}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <textarea
                              value={overviewToText(row.overviewItems)}
                              onChange={event => updateMainRow(index, { overviewItems: textToOverview(event.target.value) })}
                              className={`${compactFieldClass} min-h-20 resize-y`}
                              placeholder="최대 2개 항목을 줄바꿈으로 입력"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              value={row.unitWorkLink}
                              readOnly
                              className={compactFieldClass}
                              placeholder="단위업무 전송 후 자동 입력됩니다."
                            />
                            <p className="mt-1 text-[11px] text-white/45">단위업무 전송 후 자동 입력됩니다.</p>
                          </td>
                          <td className="p-2">
                            <input
                              value={row.itOwner}
                              onChange={event => updateMainRow(index, { itOwner: event.target.value })}
                              className={compactFieldClass}
                              placeholder="IT 담당"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              value={row.department}
                              onChange={event => updateMainRow(index, { department: event.target.value })}
                              className={compactFieldClass}
                              placeholder="담당부서"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {showPreview && (
            <section className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h3 className="text-base font-bold text-white">미리보기</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-white/10 bg-black/15 p-3 text-xs text-white/65">
                  <h4 className="font-semibold text-amber-200">{unitWorkPage.title}</h4>
                  <p>현황/문제점: {unitWorkPage.statusProblemItems.length}건</p>
                  <p>개선방향: {unitWorkPage.improvementGoalItems.length}건</p>
                  <p>기대효과: {unitWorkPage.expectedEffectItems.length}건</p>
                  <p>일감내용 및 일정: {unitWorkPage.scheduleRows.length}건</p>
                  <p>진행 내역: {unitWorkPage.historyRows.length}건</p>
                </div>
                <div className="space-y-2 rounded-lg border border-white/10 bg-black/15 p-3 text-xs text-white/65">
                  <h4 className="font-semibold text-cyan-200">주요진행업무</h4>
                  <p>파트: {mainProgressWork.workGroup}</p>
                  <p>수정 페이지: {selectedMainPage?.title || "선택 필요"}</p>
                  {mainProgressWork.rows.map((row, index) => (
                    <div key={index} className="rounded-md bg-white/[0.04] p-2 text-white/70">
                      <div className="font-semibold text-white">{row.mainWorkName || "주요 진행중 업무 제목 입력 필요"} · {row.status}</div>
                      <div className="mt-1">등록일: {formatDisplayMonth(row.registrationMonth)}</div>
                      <div className="mt-1">진행경과: {row.unitWorkLink || "단위업무 전송 후 자동 입력됩니다."}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 bg-white/[0.03] px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(prev => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "미리보기 닫기" : "미리보기"}
          </button>
          <button
            type="button"
            onClick={sendToWiki}
            disabled={isSending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-orange-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            WIKI로 전송
          </button>
        </div>
      </div>
    </div>
  );
}
