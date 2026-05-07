import { NextRequest, NextResponse } from "next/server";
import { confluenceErrorResponse, searchConfluencePages } from "@/lib/confluence";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const limit = Number(searchParams.get("limit") || "8");

    const pages = await searchConfluencePages(query, Number.isFinite(limit) ? limit : 8);

    return NextResponse.json({ success: true, pages });
  } catch (error) {
    const response = confluenceErrorResponse(error);
    console.error("Confluence page search error:", response.log);
    return NextResponse.json(response.body, { status: response.status });
  }
}
