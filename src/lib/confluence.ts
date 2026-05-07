import type { MainProgressWork, UnitWorkPage } from "./work-progress";

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
      "WIKI 연동 환경변수가 설정되지 않았습니다.",
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

function paragraphHtml(value: string, fallback = "입력 필요") {
  const text = value.trim();
  if (!text) return `<p><em>${escapeHtml(fallback)}</em></p>`;

  return text
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function listHtml(items: string[], fallback = "입력 필요") {
  const safeItems = items.map(item => item.trim()).filter(Boolean);
  if (safeItems.length === 0) return `<p><em>${escapeHtml(fallback)}</em></p>`;

  return `<ul>${safeItems.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function tableCell(value: unknown) {
  return `<td style="padding: 8px; border: 1px solid #dfe1e6; vertical-align: top;">${escapeHtml(value)}</td>`;
}

function tableHeader(value: string) {
  return `<th style="padding: 8px; border: 1px solid #dfe1e6; text-align: left; background: #f4f5f7;">${escapeHtml(value)}</th>`;
}

export function buildUnitWorkPageHtml(unitWorkPage: UnitWorkPage) {
  const rows = unitWorkPage.progressItems.length > 0
    ? unitWorkPage.progressItems
    : [{ order: 1, category: "", content: "", owner: "", businessOwner: "" }];

  return `
<h2>참가자</h2>
${listHtml(unitWorkPage.participants)}
<h2>목적성</h2>
${paragraphHtml(unitWorkPage.purpose)}
<h2>문제점</h2>
${paragraphHtml(unitWorkPage.problems)}
<h2>기대효과</h2>
${paragraphHtml(unitWorkPage.expectedEffects)}
<h2>진행내용</h2>
<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      ${tableHeader("순서")}
      ${tableHeader("구분")}
      ${tableHeader("내용")}
      ${tableHeader("담당자")}
      ${tableHeader("현업담당자")}
    </tr>
  </thead>
  <tbody>
    ${rows.map(item => `
    <tr>
      ${tableCell(item.order)}
      ${tableCell(item.category)}
      ${tableCell(item.content)}
      ${tableCell(item.owner)}
      ${tableCell(item.businessOwner)}
    </tr>`).join("")}
  </tbody>
</table>
  `.trim();
}

export function buildMainProgressWorkHtml(mainProgressWork: MainProgressWork) {
  const rows = mainProgressWork.rows.length > 0
    ? mainProgressWork.rows
    : [{ mainWorkName: "", unitWorkLink: "", owner: "" }];

  return `
<h2>업무단</h2>
<p>${escapeHtml(mainProgressWork.workGroup)}</p>
<h2>주요진행업무</h2>
<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      ${tableHeader("주요진행업무명")}
      ${tableHeader("단위업무링크")}
      ${tableHeader("담당자")}
    </tr>
  </thead>
  <tbody>
    ${rows.map(item => `
    <tr>
      ${tableCell(item.mainWorkName)}
      ${tableCell(item.unitWorkLink || "WIKI 생성 후 자동 입력됩니다")}
      ${tableCell(item.owner)}
    </tr>`).join("")}
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

function buildPageResult(config: ConfluenceConfig, data: { id: string; title: string; _links?: { webui?: string } }) {
  return {
    id: data.id,
    title: data.title,
    url: buildConfluenceUrl(config, `/wiki${data._links?.webui || ""}`),
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
    throw new ConfluenceError(400, "WIKI 페이지명이 비어 있습니다.");
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
    const message = errorData?.message || response.statusText || "WIKI 요청이 실패했습니다.";
    throw new ConfluenceError(
      response.status,
      "WIKI 전송에 실패했습니다. 권한, 공간 키, 상위 페이지 설정을 확인해 주세요.",
      { status: response.status, message }
    );
  }

  const data = await response.json();
  return {
    id: data.id,
    title: finalTitle,
    url: buildConfluenceUrl(config, `/wiki${data._links.webui}`),
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
      "WIKI 인증을 확인하지 못했습니다. 이메일과 API 토큰을 다시 확인해 주세요.",
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
      "WIKI 공간을 확인하지 못했습니다. 공간 키와 권한을 다시 확인해 주세요.",
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

export async function searchConfluencePages(query: string, limit = 10): Promise<ConfluencePageResult[]> {
  const config = getConfluenceConfig();
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const escaped = query.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const cql = escaped
    ? `space="${config.spaceKey}" AND type=page AND title ~ "${escaped}" ORDER BY lastmodified DESC`
    : `space="${config.spaceKey}" AND type=page ORDER BY lastmodified DESC`;
  const response = await fetch(
    buildConfluenceUrl(config, `/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=${limit}`),
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
  const pages: ConfluencePageResult[] = [];

  for (const item of data.results || []) {
    const id = item.content?.id || item.id;
    const title = item.content?.title || item.title;
    const webui = item.content?._links?.webui || item._links?.webui || item.url || "";

    if (!id || !title) continue;

    pages.push({
      id,
      title,
      url: buildConfluenceUrl(config, `/wiki${webui}`),
      spaceKey: config.spaceKey,
    });
  }

  return pages;
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
    body: { error: "WIKI 처리 중 알 수 없는 오류가 발생했습니다." },
    log: { status: 500, message },
  };
}
