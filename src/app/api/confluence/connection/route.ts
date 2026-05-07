import { NextRequest, NextResponse } from "next/server";
import { checkConfluenceConnection, confluenceErrorResponse } from "@/lib/confluence";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const status = await checkConfluenceConnection(body.parentPageId);

    return NextResponse.json({
      success: true,
      ...status,
      message: "Confluence 연결이 확인되었습니다.",
    });
  } catch (error) {
    const response = confluenceErrorResponse(error);
    console.error("Confluence connection error:", response.log);
    return NextResponse.json(response.body, { status: response.status });
  }
}
