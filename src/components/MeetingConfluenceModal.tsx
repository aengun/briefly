"use client";

import { Loader2, RefreshCw, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildMeetingTitle,
  type MeetingParticipantLike,
  type MeetingSummaryData,
  type MeetingTranscriptSegment,
} from "@/lib/meeting-summary";

type ConfluencePageResult = {
  id: string;
  title: string;
  url?: string;
  spaceKey?: string;
};

type MeetingConfluenceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  meetingDate?: string;
  participants?: MeetingParticipantLike[];
  transcript?: MeetingTranscriptSegment[];
  summary?: MeetingSummaryData;
  overviewText?: string;
  onSuccess?: (page: { id?: string; title?: string; url?: string }) => void;
};

const filterText = (value: string) => value
  .normalize("NFC")
  .toLocaleLowerCase("ko-KR")
  .replace(/\s+/g, "");

export default function MeetingConfluenceModal({
  isOpen,
  onClose,
  meetingDate,
  participants = [],
  transcript = [],
  summary = {},
  overviewText = "",
  onSuccess,
}: MeetingConfluenceModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pages, setPages] = useState<ConfluencePageResult[]>([]);
  const [selectedPage, setSelectedPage] = useState<ConfluencePageResult | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const pageTitle = useMemo(() => buildMeetingTitle({ meetingDate, summary, transcript }), [meetingDate, summary, transcript]);

  const visiblePages = useMemo(() => {
    const query = filterText(searchQuery);
    if (!query) return pages;
    return pages.filter(page => filterText(page.title).includes(query));
  }, [pages, searchQuery]);

  const loadPages = async (query = searchQuery) => {
    setIsLoadingPages(true);
    setPagesError(null);
    try {
      const params = new URLSearchParams({ limit: "80" });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/confluence/pages?${params.toString()}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Confluence 페이지 목록을 불러오지 못했습니다.");
      }
      const nextPages = Array.isArray(data?.pages) ? data.pages : [];
      setPages(nextPages);
      setSelectedPage(prev => prev && nextPages.some((page: ConfluencePageResult) => page.id === prev.id) ? prev : null);
    } catch (error) {
      setPages([]);
      setPagesError(error instanceof Error ? error.message : "Confluence 페이지 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingPages(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    setSelectedPage(null);
    setPages([]);
    setPagesError(null);
    setSendError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = window.setTimeout(() => {
      void loadPages(searchQuery);
    }, 250);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchQuery]);

  const sendToConfluence = async () => {
    if (!selectedPage) {
      setSendError("회의록을 등록할 페이지를 선택해주세요.");
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      const response = await fetch("/api/confluence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentPageId: selectedPage.id,
          meeting: {
            meetingDate,
            participants,
            transcript,
            summary,
            overviewText,
          },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "회의록 전송에 실패했습니다. Confluence 권한 또는 페이지 설정을 확인해주세요.");
      }
      onSuccess?.({ id: data?.pageId, title: data?.title, url: data?.url });
      onClose();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "회의록 전송에 실패했습니다. Confluence 권한 또는 페이지 설정을 확인해주세요.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div role="dialog" aria-modal="true" className="flex h-[min(760px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.24em] text-cyan-300">CONFLUENCE</p>
            <h3 className="mt-1 truncate text-lg font-bold text-white">회의록 등록</h3>
            <p className="mt-1 line-clamp-2 text-sm text-white/55">{pageTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 p-5">
          <div className="flex h-full min-h-0 flex-col rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="페이지명 일부로 검색"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => loadPages(searchQuery)}
                className="rounded-md p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
                aria-label="페이지 새로고침"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {isLoadingPages ? (
                <div className="flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-8 text-sm text-white/55">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  페이지 목록 로딩 중
                </div>
              ) : pagesError ? (
                <div className="rounded-md border border-rose-400/25 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                  <p>{pagesError}</p>
                  <button type="button" onClick={() => loadPages(searchQuery)} className="mt-2 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20">
                    다시 시도
                  </button>
                </div>
              ) : visiblePages.length > 0 ? (
                visiblePages.map(page => {
                  const selected = selectedPage?.id === page.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setSelectedPage(page)}
                      className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-cyan-300/60 bg-cyan-400/15"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-white">{page.title}</p>
                      <p className="mt-0.5 truncate text-xs text-white/40">{page.url || page.spaceKey}</p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-8 text-center text-sm text-white/45">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </div>

          {sendError && (
            <div className="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {sendError}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-white/10 bg-white/[0.04] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
            취소
          </button>
          <button
            type="button"
            onClick={sendToConfluence}
            disabled={isSending || !selectedPage}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
