import { formatDisplayMonth, type MainProgressWork, type MainProgressWorkRow, type UnitWorkPage } from "./work-progress";

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

export function buildMainProgressRowHtml(row: MainProgressWorkRow, firstCell = "") {
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

export function buildMainProgressAppendTable(mainProgressWork: MainProgressWork) {
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
