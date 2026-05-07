import { NextRequest, NextResponse } from "next/server";
import {
  appendMainProgressWorkToPage,
  buildUnitWorkPageHtml,
  ConfluenceError,
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

    if (!unitParentPageId) {
      return NextResponse.json(
        { error: "단위업무 상위페이지를 선택해주세요." },
        { status: 400 }
      );
    }

    if (!mainParentPageId) {
      return NextResponse.json(
        { error: "수정할 주요진행업무 페이지를 선택해주세요." },
        { status: 400 }
      );
    }

    if (!unitWorkPage?.title?.trim() || !mainProgressWork?.rows?.length) {
      return NextResponse.json(
        { error: "일감진행 전송에 필요한 입력값이 부족합니다." },
        { status: 400 }
      );
    }

    const unitPageHtml = buildUnitWorkPageHtml(unitWorkPage);
    let unitPage;
    try {
      unitPage = await createConfluencePage({
        title: unitWorkPage.title,
        html: unitPageHtml,
        retryDuplicateTitle: true,
        parentPageId: unitParentPageId,
      });
    } catch (error) {
      throw new ConfluenceError(
        error instanceof ConfluenceError ? error.status : 500,
        "단위업무 생성에 실패했습니다. Confluence 권한 또는 상위페이지 설정을 확인해주세요.",
        { stage: "unitWorkPage" }
      );
    }

    const updatedMainProgressWork: MainProgressWork = {
      ...mainProgressWork,
      rows: mainProgressWork.rows.map(row => ({
        ...row,
        unitWorkLink: row.unitWorkLink || unitPage.url,
      })),
    };
    let mainPage;
    try {
      mainPage = await appendMainProgressWorkToPage({
        pageId: mainParentPageId,
        mainProgressWork: updatedMainProgressWork,
      });
    } catch (error) {
      throw new ConfluenceError(
        error instanceof ConfluenceError ? error.status : 500,
        error instanceof ConfluenceError
          ? error.userMessage
          : "주요진행업무 페이지 수정에 실패했습니다. 페이지 권한 또는 버전 충돌 여부를 확인해주세요.",
        { stage: "mainProgressWork" }
      );
    }

    return NextResponse.json({
      success: true,
      message: "회의록 등록이 완료되었습니다.",
      unitPage,
      mainPage,
      mainProgressWork: updatedMainProgressWork,
    });
  } catch (error) {
    const response = confluenceErrorResponse(error);
    console.error("Confluence work progress error:", response.log);

    return NextResponse.json(response.body, { status: response.status });
  }
}
