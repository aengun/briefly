import { formatDisplayMonth, type MainProgressWork, type MainProgressWorkRow, type UnitWorkPage } from "./work-progress";

type ConfluenceConfig = {
  domain: string;
  email: string;
  apiToken: string;
  spaceKey: string;
  parentPageId?: string;
};

type ConfluenceErrorData = {
  message?: string;
};

export type CreatedConfluencePage = {
  id: string;
  title: string;
  url: string;
};

export type ConfluencePageResult = {
  id: string;
  title: string;
  url: string;
  spaceKey?: string;
};

export type ConfluenceConnectionStatus = {
  connected: boolean;
  spaceKey: string;
  parentPage?: ConfluencePageResult | null;
  parentPageError?: string | null;
};

type ConfluenceSearchItem = {
  id?: string;
  title: string;
  content?: {
    id?: string;
    title?: string;
    _links?: {
      webui?: string;
    };
  };
  _links?: {
    webui?: string;
  };
  url?: string;
};

type ConfluenceStoragePage = {
  id: string;
  title: string;
  version: {
    number: number;
  };
  body?: {
    storage?: {
      value?: string;
    };
  };
};

export class ConfluenceError extends Error {
  status: number;
  userMessage: string;
  details?: unknown;

  constructor(status: number, userMessage: string, details?: unknown) {
    super(userMessage);
    this.name = "ConfluenceError";
    this.status = status;
    this.userMessage = userMessage;
    this.details = details;
  }
}

export function getConfluenceConfig(): ConfluenceConfig {
  const config = {
    domain: process.env.CONFLUENCE_DOMAIN,
    email: process.env.CONFLUENCE_EMAIL,
    apiToken: process.env.CONFLUENCE_API_TOKEN,
    spaceKey: process.env.CONFLUENCE_SPACE_KEY,
    parentPageId: process.env.CONFLUENCE_PARENT_PAGE_ID,
  };
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== "parentPageId" && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new ConfluenceError(
      500,
      "회의록 시스템 연동 환경변수가 설정되지 않았습니다.",
      { missing }
    );
  }

  return config as ConfluenceConfig;
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function listHtml(items: string[], fallback = "입력 필요") {
  const safeItems = items.map(item => item.trim()).filter(Boolean);
  if (safeItems.length === 0) return `<p><em>${escapeHtml(fallback)}</em></p>`;

  return `<ul>${safeItems.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function tableCell(value: unknown) {
  return `<td style="padding: 8px; border: 1px solid #dfe1e6; vertical-align: top;">${escapeHtml(value)}</td>`;
}

function tableHtmlCell(value: string) {
  return `<td style="padding: 8px; border: 1px solid #dfe1e6; vertical-align: top;">${value}</td>`;
}

function tableHeader(value: string) {
  return `<th style="padding: 8px; border: 1px solid #dfe1e6; text-align: left; background: #f4f5f7;">${escapeHtml(value)}</th>`;
}

export function buildUnitWorkPageHtml(unitWorkPage: UnitWorkPage) {
  const scheduleRows = unitWorkPage.scheduleRows.length > 0
    ? unitWorkPage.scheduleRows
    : [{ category: "분석" as const, difficulty: "중" as const, content: "", expectedMonth: "", owner: "", weight: 100 }];
  const historyRows = unitWorkPage.historyRows.length > 0
    ? unitWorkPage.historyRows
    : [{ no: 1, date: "", category: "분석" as const, content: "", itOwner: "", businessOwner: "" }];

  return `
<h3>1. 현황/문제점</h3>
${listHtml(unitWorkPage.statusProblemItems)}
<h3>2. 개선방향(목적)</h3>
${listHtml(unitWorkPage.improvementGoalItems)}
<h3>3. 기대효과</h3>
${listHtml(unitWorkPage.expectedEffectItems)}
<h3>4. 일감내용 및 일정</h3>
<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      ${tableHeader("구분")}
      ${tableHeader("개발 난이도")}
      ${tableHeader("내용")}
      ${tableHeader("예상일정")}
      ${tableHeader("담당")}
      ${tableHeader("비중")}
    </tr>
  </thead>
  <tbody>
    ${scheduleRows.map(item => `
    <tr>
      ${tableCell(item.category)}
      ${tableCell(item.difficulty)}
      ${tableCell(item.content)}
      ${tableCell(item.expectedMonth)}
      ${tableCell(item.owner)}
      ${tableCell(item.weight)}
    </tr>`).join("")}
</tbody>
</table>
<h3>5. 진행 내역(히스토리)</h3>
<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      ${tableHeader("NO")}
      ${tableHeader("일자")}
      ${tableHeader("구분")}
      ${tableHeader("작업 내용")}
      ${tableHeader("IT 담당자")}
      ${tableHeader("현업 담당자")}
    </tr>
  </thead>
  <tbody>
    ${historyRows.map((item, index) => `
    <tr>
      ${tableCell(item.no || index + 1)}
      ${tableCell(item.date)}
      ${tableCell(item.category)}
      ${tableCell(item.content)}
      ${tableCell(item.itOwner)}
      ${tableCell(item.businessOwner)}
    </tr>`).join("")}
  </tbody>
</table>
  `.trim();
}

function buildMainProgressRowHtml(row: MainProgressWorkRow, firstCell = "") {
  return `
    <tr>
      ${tableCell(firstCell)}
      ${tableCell(formatDisplayMonth(row.registrationMonth))}
      ${tableHtmlCell(`${escapeHtml(row.mainWorkName)}<br /><small>${escapeHtml(row.status)}</small>`)}
      ${tableHtmlCell(listHtml(row.overviewItems, "업무 개요를 입력해 주세요."))}
      ${tableHtmlCell(row.unitWorkLink ? `<a href="${escapeHtml(row.unitWorkLink)}">단위업무 보기</a>` : escapeHtml("단위업무 전송 후 자동 입력됩니다."))}
      ${tableCell(row.itOwner)}
      ${tableCell(row.department)}
    </tr>`;
}

export function buildMainProgressWorkHtml(mainProgressWork: MainProgressWork) {
  return `
<h2>주요진행업무</h2>
<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      ${tableHeader("")}
      ${tableHeader("등록일(월)")}
      ${tableHeader("주요 진행중 업무 제목")}
      ${tableHeader("업무 개요(간략)")}
      ${tableHeader("진행경과")}
      ${tableHeader("IT 담당")}
      ${tableHeader("담당부서")}
    </tr>
  </thead>
  <tbody>
    <tr>
      ${tableCell(mainProgressWork.workGroup)}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
    </tr>
    ${mainProgressWork.rows.map(item => buildMainProgressRowHtml(item)).join("")}
  </tbody>
</table>
  `.trim();
}

function normalizeTableText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "")
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR");
}

function getTableBodyContent(tableHtml: string) {
  return tableHtml.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || tableHtml;
}

function getFirstBodyRowText(tableHtml: string) {
  const body = getTableBodyContent(tableHtml);
  return body.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] || "";
}

function tableMatchesWorkGroup(tableHtml: string, workGroup: string) {
  const rowText = normalizeTableText(getFirstBodyRowText(tableHtml));
  const groupText = normalizeTableText(workGroup);

  if (!rowText || !groupText) return false;
  return rowText === groupText || rowText.includes(groupText) || groupText.includes(rowText);
}

function appendRowToTable(tableHtml: string, rowHtml: string) {
  if (/<\/tbody>/i.test(tableHtml)) {
    return tableHtml.replace(/<\/tbody>/i, `${rowHtml}\n  </tbody>`);
  }

  return tableHtml.replace(/<\/table>/i, `${rowHtml}\n</table>`);
}

function buildMainProgressAppendTable(mainProgressWork: MainProgressWork) {
  return `
<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      ${tableHeader("")}
      ${tableHeader("등록일(월)")}
      ${tableHeader("주요 진행중 업무 제목")}
      ${tableHeader("업무 개요(간략)")}
      ${tableHeader("진행경과")}
      ${tableHeader("IT 담당")}
      ${tableHeader("담당부서")}
    </tr>
  </thead>
  <tbody>
    <tr>
      ${tableCell(mainProgressWork.workGroup)}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
      ${tableCell("")}
    </tr>
    ${mainProgressWork.rows.map(row => buildMainProgressRowHtml(row)).join("")}
  </tbody>
</table>
  `.trim();
}

function titleWithTimestamp(title: string) {
  const now = new Date();
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");

  return `${title} ${time}`;
}

async function readConfluenceError(response: Response): Promise<ConfluenceErrorData> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text || response.statusText };
  }
}

function buildConfluenceUrl(config: ConfluenceConfig, path: string) {
  return `https://${config.domain}${path}`;
}

function buildConfluenceWebUrl(config: ConfluenceConfig, path: string) {
  if (!path) return buildConfluenceUrl(config, "/wiki");
  if (/^https?:\/\//i.test(path)) return path;
  return buildConfluenceUrl(config, path.startsWith("/wiki") ? path : `/wiki${path}`);
}

function buildPageResult(config: ConfluenceConfig, data: { id: string; title: string; _links?: { webui?: string } }) {
  return {
    id: data.id,
    title: data.title,
    url: buildConfluenceWebUrl(config, data._links?.webui || ""),
    spaceKey: config.spaceKey,
  };
}

function isDuplicateTitle(status: number, message: string) {
  const normalized = message.toLowerCase();
  return status === 400 && (
    normalized.includes("already exists") ||
    normalized.includes("same title") ||
    normalized.includes("duplicate")
  );
}

async function postPage(config: ConfluenceConfig, title: string, html: string, parentPageId?: string) {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const body: Record<string, unknown> = {
    type: "page",
    title,
    space: { key: config.spaceKey },
    body: {
      storage: {
        value: html,
        representation: "storage",
      },
    },
  };

  const ancestorId = parentPageId || config.parentPageId;
  if (ancestorId) {
    body.ancestors = [{ id: ancestorId }];
  }

  return fetch(buildConfluenceUrl(config, "/wiki/rest/api/content"), {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function createConfluencePage(input: {
  title: string;
  html: string;
  retryDuplicateTitle?: boolean;
  parentPageId?: string;
}): Promise<CreatedConfluencePage> {
  const config = getConfluenceConfig();
  const initialTitle = input.title.trim();

  if (!initialTitle) {
    throw new ConfluenceError(400, "페이지명이 비어 있습니다.");
  }

  let finalTitle = initialTitle;
  let response = await postPage(config, finalTitle, input.html, input.parentPageId);
  let errorData: ConfluenceErrorData | null = null;

  if (!response.ok) {
    errorData = await readConfluenceError(response);
    const message = errorData?.message || response.statusText || "";

    if (input.retryDuplicateTitle !== false && isDuplicateTitle(response.status, message)) {
      finalTitle = titleWithTimestamp(initialTitle);
      response = await postPage(config, finalTitle, input.html, input.parentPageId);
      errorData = response.ok ? null : await readConfluenceError(response);
    }
  }

  if (!response.ok) {
    const message = errorData?.message || response.statusText || "요청이 실패했습니다.";
    throw new ConfluenceError(
      response.status,
      "회의록 등록에 실패했습니다. 권한, 공간 키, 상위 페이지 설정을 확인해 주세요.",
      { status: response.status, message }
    );
  }

  const data = await response.json();
  return {
    id: data.id,
    title: finalTitle,
    url: buildConfluenceWebUrl(config, data._links.webui),
  };
}

export async function getConfluencePageById(pageId: string): Promise<ConfluencePageResult> {
  const config = getConfluenceConfig();
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const response = await fetch(buildConfluenceUrl(config, `/wiki/rest/api/content/${encodeURIComponent(pageId)}?expand=space,version`), {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await readConfluenceError(response);
    throw new ConfluenceError(
      response.status,
      "상위 페이지를 확인하지 못했습니다. 선택한 페이지 권한을 다시 확인해 주세요.",
      { status: response.status, message: errorData.message }
    );
  }

  const data = await response.json();
  return buildPageResult(config, data);
}

async function getConfluencePageStorageById(config: ConfluenceConfig, pageId: string): Promise<ConfluenceStoragePage> {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const response = await fetch(
    buildConfluenceUrl(config, `/wiki/rest/api/content/${encodeURIComponent(pageId)}?expand=body.storage,version`),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await readConfluenceError(response);
    throw new ConfluenceError(
      response.status,
      "주요진행업무 페이지를 불러오지 못했습니다. 페이지 권한을 확인해주세요.",
      { status: response.status, message: errorData.message }
    );
  }

  return response.json();
}

async function updateConfluencePageStorage(config: ConfluenceConfig, page: ConfluenceStoragePage, html: string) {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const response = await fetch(
    buildConfluenceUrl(config, `/wiki/rest/api/content/${encodeURIComponent(page.id)}`),
    {
      method: "PUT",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: page.id,
        type: "page",
        title: page.title,
        version: { number: page.version.number + 1 },
        body: {
          storage: {
            value: html,
            representation: "storage",
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await readConfluenceError(response);
    const message = response.status === 409
      ? "Confluence 페이지 업데이트 중 버전 충돌이 발생했습니다. 페이지를 새로고침한 후 다시 시도해주세요."
      : "주요진행업무 페이지 수정에 실패했습니다. 페이지 권한 또는 버전 충돌 여부를 확인해주세요.";

    throw new ConfluenceError(
      response.status,
      message,
      { status: response.status, message: errorData.message }
    );
  }

  const data = await response.json();
  return {
    id: data.id,
    title: data.title,
    url: buildConfluenceWebUrl(config, data._links?.webui || ""),
  };
}

function appendMainProgressRowsToStorage(storageHtml: string, mainProgressWork: MainProgressWork) {
  const rowsHtml = mainProgressWork.rows.map(row => buildMainProgressRowHtml(row)).join("");
  const tableRegex = /<table\b[\s\S]*?<\/table>/gi;
  let matched = false;

  const nextHtml = storageHtml.replace(tableRegex, tableHtml => {
    if (matched || !tableMatchesWorkGroup(tableHtml, mainProgressWork.workGroup)) {
      return tableHtml;
    }

    matched = true;
    return appendRowToTable(tableHtml, rowsHtml);
  });

  if (matched) return nextHtml;

  const newTable = buildMainProgressAppendTable(mainProgressWork);
  return `${storageHtml}${storageHtml.trim() ? "\n" : ""}${newTable}`;
}

export async function appendMainProgressWorkToPage(input: {
  pageId: string;
  mainProgressWork: MainProgressWork;
}): Promise<CreatedConfluencePage> {
  const config = getConfluenceConfig();
  const page = await getConfluencePageStorageById(config, input.pageId);
  const storageHtml = page.body?.storage?.value;

  if (typeof storageHtml !== "string") {
    throw new ConfluenceError(
      500,
      "선택한 주요진행업무 페이지의 테이블 구조를 해석하지 못했습니다.",
      { pageId: input.pageId }
    );
  }

  const nextHtml = appendMainProgressRowsToStorage(storageHtml, input.mainProgressWork);
  return updateConfluencePageStorage(config, page, nextHtml);
}

async function getCurrentUser(config: ConfluenceConfig) {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const response = await fetch(buildConfluenceUrl(config, "/wiki/rest/api/user/current"), {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await readConfluenceError(response);
    throw new ConfluenceError(
      response.status,
      "회의록 시스템 인증을 확인하지 못했습니다. 이메일과 API 토큰을 다시 확인해 주세요.",
      { status: response.status, message: errorData.message }
    );
  }

  return response.json();
}

async function getSpace(config: ConfluenceConfig) {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const response = await fetch(buildConfluenceUrl(config, `/wiki/rest/api/space/${encodeURIComponent(config.spaceKey)}?expand=homepage`), {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await readConfluenceError(response);
    throw new ConfluenceError(
      response.status,
      "공간을 확인하지 못했습니다. 공간 키와 권한을 다시 확인해 주세요.",
      { status: response.status, message: errorData.message, spaceKey: config.spaceKey }
    );
  }

  const data = await response.json();
  return buildPageResult(config, {
    id: data.id,
    title: data.name || config.spaceKey,
    _links: { webui: data._links?.webui },
  });
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "");
}

function toPageResults(config: ConfluenceConfig, items: ConfluenceSearchItem[]) {
  const pages: ConfluencePageResult[] = [];

  for (const item of items) {
    const id = item.content?.id || item.id;
    const title = item.content?.title || item.title;
    const webui = item.content?._links?.webui || item._links?.webui || item.url || "";

    if (!id || !title) continue;

    pages.push({
      id,
      title,
      url: buildConfluenceWebUrl(config, webui),
      spaceKey: config.spaceKey,
    });
  }

  return pages;
}

function mergePages(pages: ConfluencePageResult[]) {
  const seen = new Set<string>();
  const merged: ConfluencePageResult[] = [];

  for (const page of pages) {
    if (seen.has(page.id)) continue;
    seen.add(page.id);
    merged.push(page);
  }

  return merged;
}

async function fetchSpacePages(config: ConfluenceConfig, auth: string, limit: number, start: number) {
  const params = new URLSearchParams({
    spaceKey: config.spaceKey,
    type: "page",
    limit: String(limit),
    start: String(start),
  });
  const response = await fetch(
    buildConfluenceUrl(config, `/wiki/rest/api/content?${params.toString()}`),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await readConfluenceError(response);
    throw new ConfluenceError(
      response.status,
      "상위 페이지 목록을 불러오지 못했습니다.",
      { status: response.status, message: errorData.message }
    );
  }

  const data = await response.json() as { results?: ConfluenceSearchItem[] };
  return toPageResults(config, data.results || []);
}

async function searchPagesByCql(config: ConfluenceConfig, auth: string, query: string, limit: number) {
  const escaped = query.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  if (!escaped) return [];

  const cql = `space="${config.spaceKey}" AND type=page AND title ~ "${escaped}*" ORDER BY lastmodified DESC`;
  const response = await fetch(
    buildConfluenceUrl(config, `/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=${limit}`),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) return [];

  const data = await response.json() as { results?: ConfluenceSearchItem[] };
  return toPageResults(config, data.results || []);
}

export async function searchConfluencePages(query: string, limit = 50, start = 0): Promise<ConfluencePageResult[]> {
  const config = getConfluenceConfig();
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeStart = Math.max(start, 0);
  const searchText = query.trim();
  const normalizedQuery = normalizeSearchText(searchText);

  if (!normalizedQuery) {
    return fetchSpacePages(config, auth, safeLimit, safeStart);
  }

  const matches: ConfluencePageResult[] = [];
  let offset = 0;
  const batchLimit = 100;
  const maxScannedPages = 500;

  while (matches.length < safeLimit && offset < maxScannedPages) {
    const pages = await fetchSpacePages(config, auth, batchLimit, offset);
    if (pages.length === 0) break;

    matches.push(...pages.filter(page => normalizeSearchText(page.title).includes(normalizedQuery)));
    offset += pages.length;

    if (pages.length < batchLimit) break;
  }

  const cqlMatches = await searchPagesByCql(config, auth, searchText, safeLimit);
  return mergePages([...matches, ...cqlMatches]).slice(0, safeLimit);
}

export async function checkConfluenceConnection(parentPageId?: string): Promise<ConfluenceConnectionStatus> {
  const config = getConfluenceConfig();
  await getCurrentUser(config);
  const space = await getSpace(config);

  const resolvedParentPageId = parentPageId || config.parentPageId;
  let parent: ConfluencePageResult | null = null;
  let parentPageError: string | null = null;

  if (resolvedParentPageId) {
    try {
      parent = await getConfluencePageById(resolvedParentPageId);
    } catch (error) {
      parentPageError = error instanceof ConfluenceError
        ? error.userMessage
        : "상위 페이지를 확인하지 못했습니다. 선택한 페이지 권한을 다시 확인해 주세요.";
    }
  }

  return {
    connected: true,
    spaceKey: config.spaceKey,
    parentPage: parent ?? space,
    parentPageError,
  };
}

export function confluenceErrorResponse(error: unknown) {
  if (error instanceof ConfluenceError) {
    return {
      status: error.status,
      body: { error: error.userMessage },
      log: { status: error.status, message: error.message, details: error.details },
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    status: 500,
    body: { error: "회의록 등록 중 알 수 없는 오류가 발생했습니다." },
    log: { status: 500, message },
  };
}
