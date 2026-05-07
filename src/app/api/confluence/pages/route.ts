import { NextRequest, NextResponse } from "next/server";
import { confluenceErrorResponse, searchConfluencePages } from "@/lib/confluence";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const limit = Number(searchParams.get("limit") || "50");
    const start = Number(searchParams.get("start") || "0");

    const pages = await searchConfluencePages(
      query,
      Number.isFinite(limit) ? limit : 50,
      Number.isFinite(start) ? start : 0
    );

    return NextResponse.json({ success: true, pages });
  } catch (error) {
    const response = confluenceErrorResponse(error);
    console.error("Confluence page search error:", response.log);
    return NextResponse.json(response.body, { status: response.status });
  }
}
