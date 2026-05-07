"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Eye, Loader2, Search, Send, ShieldCheck, X } from "lucide-react";
import {
  buildDefaultWorkProgress,
  participantsToText,
  progressCategories,
  textToParticipants,
  workGroups,
  type MainProgressWork,
  type UnitWorkPage,
  type UnitWorkProgressItem,
  type WorkGroup,
  type WorkProgressSource,
} from "@/lib/work-progress";

type ConfluencePageResult = {
  id: string;
  title: string;
  url: string;
};

type ParentPagePickerProps = {
  title: string;
  description: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  pages: ConfluencePageResult[];
  selectedPage: ConfluencePageResult | null;
  onSelectPage: (page: ConfluencePageResult | null) => void;
  connectionStatus: string;
  onCheckConnection: () => void;
  onUseDefault: () => void;
  isCheckingConnection: boolean;
  isLoadingPages: boolean;
};

type ParentPageSearchPanelProps = Omit<ParentPagePickerProps, "connectionStatus" | "onCheckConnection" | "isCheckingConnection">;

type ConnectionStatusCardProps = {
  title: string;
  description: string;
  status: string;
  onCheckConnection: () => void;
  isCheckingConnection: boolean;
};

type WorkProgressModalProps = WorkProgressSource & {
  isOpen: boolean;
  onClose: () => void;
};

const fieldClass = "w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/70 focus:bg-white/[0.09]";
const textareaClass = `${fieldClass} min-h-24 resize-y leading-relaxed`;

function ConnectionStatusCard({
  title,
  description,
  onCheckConnection,
  status,
  isCheckingConnection,
}: ConnectionStatusCardProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/45">{description}</p>
        </div>
        <button
          type="button"
          onClick={onCheckConnection}
          disabled={isCheckingConnection}
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCheckingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          연결 확인
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/70">
        <ShieldCheck className="h-4 w-4 text-emerald-300" />
        {status}
      </div>
    </section>
  );
}

function ParentPageSearchPanel({
  title,
  description,
  searchQuery,
  onSearchQueryChange,
  pages,
  selectedPage,
  onSelectPage,
  onUseDefault,
  isLoadingPages,
}: ParentPageSearchPanelProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/45">{description}</p>
        </div>
        <button
          type="button"
          onClick={onUseDefault}
          className="rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
        >
          기본값 사용
        </button>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-white/75">상위 페이지 검색</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={searchQuery}
            onChange={event => onSearchQueryChange(event.target.value)}
            className={`${fieldClass} pl-9`}
            placeholder="제목 일부를 입력하면 실시간으로 검색됩니다"
          />
        </div>
      </label>
      <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
        {isLoadingPages ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-sm text-white/50">
            상위 페이지를 불러오는 중입니다...
          </div>
        ) : pages.length > 0 ? (
          pages.map(page => {
            const isSelected = selectedPage?.id === page.id;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelectPage(page)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-amber-300/60 bg-amber-400/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{page.title}</div>
                    <div className="mt-1 truncate text-xs text-white/45">{page.url}</div>
                  </div>
                  {isSelected && <span className="rounded-full bg-amber-300/15 px-2 py-1 text-[11px] font-bold text-amber-200">선택됨</span>}
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-sm text-white/50">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/65">
        {selectedPage
          ? `선택된 상위 페이지: ${selectedPage.title}`
          : "기본 상위 페이지를 사용합니다. 목록에서 직접 선택할 수 있습니다."}
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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string; links?: Array<{ label: string; url: string }> } | null>(null);
  const [unitParentSearchQuery, setUnitParentSearchQuery] = useState("");
  const [unitParentPages, setUnitParentPages] = useState<ConfluencePageResult[]>([]);
  const [selectedUnitParentPage, setSelectedUnitParentPage] = useState<ConfluencePageResult | null>(null);
  const [unitIsLoadingPages, setUnitIsLoadingPages] = useState(false);
  const [mainParentSearchQuery, setMainParentSearchQuery] = useState("");
  const [mainParentPages, setMainParentPages] = useState<ConfluencePageResult[]>([]);
  const [selectedMainParentPage, setSelectedMainParentPage] = useState<ConfluencePageResult | null>(null);
  const [mainIsLoadingPages, setMainIsLoadingPages] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("연결 확인 대기");
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

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
    setUnitParentSearchQuery("");
    setUnitParentPages([]);
    setSelectedUnitParentPage(null);
    setMainParentSearchQuery("");
    setMainParentPages([]);
    setSelectedMainParentPage(null);
    setConnectionStatus("연결 확인 대기");
  }, [isOpen, meetingDate, meetingTitle, participants, summary]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadUnitPages = async () => {
      setUnitIsLoadingPages(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "8");

        const res = await fetch(`/api/confluence/pages?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "상위 페이지 목록을 불러오지 못했습니다.");
        }

        if (!cancelled) {
          setUnitParentPages(Array.isArray(data.pages) ? data.pages : []);
        }
      } catch {
        if (!cancelled) setUnitParentPages([]);
      } finally {
        if (!cancelled) setUnitIsLoadingPages(false);
      }
    };

    loadUnitPages();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(async () => {
      setUnitIsLoadingPages(true);
      try {
        const params = new URLSearchParams();
        if (unitParentSearchQuery.trim()) params.set("query", unitParentSearchQuery.trim());
        params.set("limit", "8");

        const res = await fetch(`/api/confluence/pages?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "상위 페이지 목록을 불러오지 못했습니다.");
        }

        setUnitParentPages(Array.isArray(data.pages) ? data.pages : []);
      } catch {
        setUnitParentPages([]);
      } finally {
        setUnitIsLoadingPages(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [isOpen, unitParentSearchQuery]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadMainPages = async () => {
      setMainIsLoadingPages(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "8");

        const res = await fetch(`/api/confluence/pages?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "상위 페이지 목록을 불러오지 못했습니다.");
        }

        if (!cancelled) {
          setMainParentPages(Array.isArray(data.pages) ? data.pages : []);
        }
      } catch {
        if (!cancelled) setMainParentPages([]);
      } finally {
        if (!cancelled) setMainIsLoadingPages(false);
      }
    };

    loadMainPages();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(async () => {
      setMainIsLoadingPages(true);
      try {
        const params = new URLSearchParams();
        if (mainParentSearchQuery.trim()) params.set("query", mainParentSearchQuery.trim());
        params.set("limit", "8");

        const res = await fetch(`/api/confluence/pages?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "상위 페이지 목록을 불러오지 못했습니다.");
        }

        setMainParentPages(Array.isArray(data.pages) ? data.pages : []);
      } catch {
        setMainParentPages([]);
      } finally {
        setMainIsLoadingPages(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [isOpen, mainParentSearchQuery]);

  if (!isOpen || !unitWorkPage || !mainProgressWork) return null;

  const checkConnection = async () => {
    setIsCheckingConnection(true);
    setConnectionStatus("연결 확인 중");
    try {
      const res = await fetch("/api/confluence/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "연결 확인에 실패했습니다.");
      }

      if (data.parentPageError) {
        setConnectionStatus(`연결됨 · ${data.parentPageError}`);
      } else if (data.parentPage?.title) {
        setConnectionStatus(`연결됨 · 기본 상위 페이지: ${data.parentPage.title}`);
      } else {
        setConnectionStatus("연결됨");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "연결 확인에 실패했습니다.";
      setConnectionStatus(errorMessage);
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const updateProgressItem = (patch: Partial<UnitWorkProgressItem>) => {
    setUnitWorkPage(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        progressItems: prev.progressItems.length > 0
          ? prev.progressItems.map((item, itemIndex) => itemIndex === 0 ? { ...item, ...patch } : item)
          : [{
              order: 1,
              category: "보고",
              content: "",
              owner: "",
              businessOwner: "",
            }],
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
    setIsSending(true);
    setMessage(null);

    try {
      const res = await fetch("/api/confluence/work-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitWorkPage,
          mainProgressWork,
          unitParentPageId: selectedUnitParentPage?.id,
          mainParentPageId: selectedMainParentPage?.id,
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
        text: "회의록 등록이 완료되었습니다.",
        links: [
          ...(data.unitPage?.url ? [{ label: "단위업무 페이지 열기", url: data.unitPage.url }] : []),
          ...(data.mainPage?.url ? [{ label: "주요진행업무 페이지 열기", url: data.mainPage.url }] : []),
        ],
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "회의록 등록 중 오류가 발생했습니다.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-progress-title"
        className="flex max-h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold text-amber-300">회의록 등록</p>
            <h2 id="work-progress-title" className="text-2xl font-bold text-white">일감진행</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              분석된 회의록을 단위업무 페이지와 주요진행업무 양식으로 정리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="일감진행 닫기"
            className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {message && (
            <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-rose-400/30 bg-rose-500/10 text-rose-100"
            }`}>
              <div className="flex flex-wrap items-center gap-3">
                {message.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
                <span className="font-medium">{message.text}</span>
                {message.links?.map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                  >
                    {link.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white">연결 확인</h3>
              <p className="mt-1 text-sm text-white/55">
                이 영역에서는 Confluence 연결 상태만 확인합니다. 상위 페이지 선택은 아래 각 블록에서 진행합니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <ConnectionStatusCard
                title="공통 연결 상태"
                description="단위업무 페이지를 생성할 Confluence 연결 상태를 확인합니다."
                status={connectionStatus}
                onCheckConnection={checkConnection}
                isCheckingConnection={isCheckingConnection}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-4 sm:p-5">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white">단위업무 페이지</h3>
                <p className="mt-1 text-sm text-white/55">
                  생성될 업무 상세 페이지와 상위 페이지 목록을 함께 확인합니다.
                </p>
              </div>

              <div className="space-y-5">
                <ParentPageSearchPanel
                  title="단위업무 상위 페이지 목록"
                  description="검색 전에 기본 목록이 먼저 보이고, 필요하면 찾아서 선택할 수 있습니다."
                  searchQuery={unitParentSearchQuery}
                  onSearchQueryChange={setUnitParentSearchQuery}
                  pages={unitParentPages}
                  selectedPage={selectedUnitParentPage}
                  onSelectPage={setSelectedUnitParentPage}
                  onUseDefault={() => setSelectedUnitParentPage(null)}
                  isLoadingPages={unitIsLoadingPages}
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/75">페이지명</span>
                  <input
                    value={unitWorkPage.title}
                    onChange={event => setUnitWorkPage({ ...unitWorkPage, title: event.target.value })}
                    className={fieldClass}
                    placeholder="YYYY-MM-DD [회의록주제] 개발건"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white/75">참가자</span>
                  <textarea
                    value={participantsToText(unitWorkPage.participants)}
                    onChange={event => setUnitWorkPage({ ...unitWorkPage, participants: textToParticipants(event.target.value) })}
                    className={`${textareaClass} min-h-20`}
                    placeholder="참가자를 한 줄에 한 명씩 입력하세요"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/75">목적성</span>
                    <textarea
                      value={unitWorkPage.purpose}
                      onChange={event => setUnitWorkPage({ ...unitWorkPage, purpose: event.target.value })}
                      className={textareaClass}
                      placeholder="회의 또는 업무 목적을 입력하세요"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/75">문제점</span>
                    <textarea
                      value={unitWorkPage.problems}
                      onChange={event => setUnitWorkPage({ ...unitWorkPage, problems: event.target.value })}
                      className={textareaClass}
                      placeholder="논의된 문제나 개선 필요사항을 입력하세요"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/75">기대효과</span>
                    <textarea
                      value={unitWorkPage.expectedEffects}
                      onChange={event => setUnitWorkPage({ ...unitWorkPage, expectedEffects: event.target.value })}
                      className={textareaClass}
                      placeholder="완료 후 기대효과를 입력하세요"
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-white">진행내용</h4>
                      <p className="mt-1 text-xs text-white/45">한 줄 형식으로 필요한 최소 정보만 입력합니다.</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    {unitWorkPage.progressItems.slice(0, 1).map((item, index) => (
                      <div
                        key={`${item.order}-${index}`}
                        className="grid grid-cols-1 gap-3 lg:grid-cols-[72px_150px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
                      >
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold text-white/55">순서</span>
                          <input value={item.order} readOnly className={`${fieldClass} text-center`} aria-label="순서" />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold text-white/55">구분</span>
                          <select
                            value={item.category}
                            onChange={event => updateProgressItem({ category: event.target.value })}
                            className={fieldClass}
                            aria-label="진행내용 구분"
                          >
                            {progressCategories.map(category => (
                              <option key={category} value={category} className="text-gray-900">{category}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold text-white/55">내용</span>
                          <input
                            value={item.content}
                            onChange={event => updateProgressItem({ content: event.target.value })}
                            className={fieldClass}
                            aria-label="진행내용"
                            placeholder="진행 내용을 입력하세요"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold text-white/55">담당자</span>
                          <input
                            value={item.owner}
                            onChange={event => updateProgressItem({ owner: event.target.value })}
                            className={fieldClass}
                            aria-label="담당자"
                            placeholder="담당자"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold text-white/55">현업담당자</span>
                          <input
                            value={item.businessOwner}
                            onChange={event => updateProgressItem({ businessOwner: event.target.value })}
                            className={fieldClass}
                            aria-label="현업담당자"
                            placeholder="현업담당자"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.05] p-4 sm:p-5">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white">주요진행업무</h3>
                <p className="mt-1 text-sm text-white/55">
                  생성될 주요진행업무 페이지와 상위 페이지 목록을 함께 확인합니다.
                </p>
              </div>

              <div className="mb-5">
                <ParentPageSearchPanel
                  title="주요진행업무 상위 페이지 목록"
                  description="검색 전에 기본 목록이 먼저 보이고, 필요하면 찾아서 선택할 수 있습니다."
                  searchQuery={mainParentSearchQuery}
                  onSearchQueryChange={setMainParentSearchQuery}
                  pages={mainParentPages}
                  selectedPage={selectedMainParentPage}
                  onSelectPage={setSelectedMainParentPage}
                  onUseDefault={() => setSelectedMainParentPage(null)}
                  isLoadingPages={mainIsLoadingPages}
                />
              </div>

              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-semibold text-white/75">업무단 선택</span>
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

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                {mainProgressWork.rows.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)]"
                  >
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold text-white/55">주요진행업무명</span>
                      <input
                        value={row.mainWorkName}
                        onChange={event => updateMainRow(index, { mainWorkName: event.target.value })}
                        className={fieldClass}
                        aria-label="주요진행업무명"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold text-white/55">단위업무링크</span>
                      <input
                        value={row.unitWorkLink}
                        onChange={event => updateMainRow(index, { unitWorkLink: event.target.value })}
                        className={fieldClass}
                        aria-label="단위업무링크"
                        placeholder="등록 후 자동 입력됩니다"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold text-white/55">담당자</span>
                      <input
                        value={row.owner}
                        onChange={event => updateMainRow(index, { owner: event.target.value })}
                        className={fieldClass}
                        aria-label="주요진행업무 담당자"
                        placeholder="담당자"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {showPreview && (
            <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-lg font-bold text-white">미리보기</h3>
              <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/15 p-4">
                  <h4 className="font-semibold text-amber-200">{unitWorkPage.title}</h4>
                  <p className="text-sm text-white/65">참가자: {unitWorkPage.participants.join(", ") || "입력 필요"}</p>
                  <p className="text-sm text-white/65">목적성: {unitWorkPage.purpose || "입력 필요"}</p>
                  <p className="text-sm text-white/65">문제점: {unitWorkPage.problems || "입력 필요"}</p>
                  <p className="text-sm text-white/65">기대효과: {unitWorkPage.expectedEffects || "입력 필요"}</p>
                </div>
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/15 p-4">
                  <h4 className="font-semibold text-cyan-200">주요진행업무</h4>
                  <p className="text-sm text-white/65">업무단: {mainProgressWork.workGroup}</p>
                  {mainProgressWork.rows.map((row, index) => (
                    <div key={index} className="rounded-lg bg-white/[0.04] p-3 text-sm text-white/70">
                      <div className="font-semibold text-white">{row.mainWorkName || "주요진행업무명 입력 필요"}</div>
                      <div className="mt-1">담당자: {row.owner || "입력 필요"}</div>
                      <div className="mt-1">링크: {row.unitWorkLink || "등록 후 자동 입력됩니다"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.03] px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(prev => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? "미리보기 닫기" : "미리보기"}
          </button>
          <button
            type="button"
            onClick={sendToWiki}
            disabled={isSending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:from-orange-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            회의록 등록
          </button>
        </div>
      </div>
    </div>
  );
}
