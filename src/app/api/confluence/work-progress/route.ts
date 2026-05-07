import { NextRequest, NextResponse } from "next/server";
import {
  buildMainProgressWorkHtml,
  buildUnitWorkPageHtml,
  confluenceErrorResponse,
  createConfluencePage,
} from "@/lib/confluence";
import type { MainProgressWork, UnitWorkPage } from "@/lib/work-progress";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const unitWorkPage = body.unitWorkPage as UnitWorkPage | undefined;
    const mainProgressWork = body.mainProgressWork as MainProgressWork | undefined;
    const unitParentPageId = typeof body.unitParentPageId === "string" ? body.unitParentPageId : undefined;
    const mainParentPageId = typeof body.mainParentPageId === "string" ? body.mainParentPageId : undefined;

    if (!unitWorkPage?.title || !mainProgressWork?.rows) {
      return NextResponse.json(
        { error: "일감진행 전송에 필요한 입력값이 부족합니다." },
        { status: 400 }
      );
    }

    const unitPageHtml = buildUnitWorkPageHtml(unitWorkPage);
    const unitPage = await createConfluencePage({
      title: unitWorkPage.title,
      html: unitPageHtml,
      retryDuplicateTitle: true,
      parentPageId: unitParentPageId,
    });

    const updatedMainProgressWork: MainProgressWork = {
      ...mainProgressWork,
      rows: mainProgressWork.rows.map(row => ({
        ...row,
        unitWorkLink: row.unitWorkLink || unitPage.url,
      })),
    };
    const mainPageTitle = updatedMainProgressWork.rows[0]?.mainWorkName?.trim() || unitWorkPage.title;
    const mainProgressHtml = buildMainProgressWorkHtml(updatedMainProgressWork);
    const mainPage = await createConfluencePage({
      title: mainPageTitle,
      html: mainProgressHtml,
      retryDuplicateTitle: true,
      parentPageId: mainParentPageId,
    });

    return NextResponse.json({
      success: true,
      message: "WIKI 전송이 완료되었습니다.",
      unitPage,
      mainPage,
      mainProgressWork: updatedMainProgressWork,
      mainProgressHtml,
    });
  } catch (error) {
    const response = confluenceErrorResponse(error);
    console.error("Confluence work progress error:", response.log);

    return NextResponse.json(response.body, { status: response.status });
  }
}
