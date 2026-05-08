import { NextRequest, NextResponse } from 'next/server';
import { confluenceErrorResponse, createConfluencePage } from '@/lib/confluence';
import { buildMeetingConfluenceHtml, buildMeetingTitle } from '@/lib/meeting-summary';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const meeting = body?.meeting && typeof body.meeting === "object" ? body.meeting : null;
    const parentPageId = typeof body?.parentPageId === "string" ? body.parentPageId : undefined;
    const title = meeting
      ? buildMeetingTitle({
        meetingDate: meeting.meetingDate,
        summary: meeting.summary,
        transcript: Array.isArray(meeting.transcript) ? meeting.transcript : [],
      })
      : body?.title;
    const html = meeting
      ? buildMeetingConfluenceHtml({
        meetingDate: meeting.meetingDate,
        participants: Array.isArray(meeting.participants) ? meeting.participants : [],
        transcript: Array.isArray(meeting.transcript) ? meeting.transcript : [],
        summary: meeting.summary,
        overviewText: typeof meeting.overviewText === "string" ? meeting.overviewText : "",
      })
      : body?.html;

    if (typeof title !== "string" || !title.trim() || typeof html !== "string" || !html.trim()) {
      return NextResponse.json(
        { success: false, error: "회의록 전송에 필요한 제목 또는 본문이 부족합니다." },
        { status: 400 }
      );
    }

    const page = await createConfluencePage({
      title,
      html,
      retryDuplicateTitle: true,
      parentPageId,
    });

    return NextResponse.json({
      success: true,
      pageId: page.id,
      title: page.title,
      url: page.url,
    });

  } catch (error) {
    const response = confluenceErrorResponse(error);
    console.error('Confluence API route error:', response.log);
    return NextResponse.json(response.body, { status: response.status });
  }
}
