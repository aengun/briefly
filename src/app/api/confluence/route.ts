import { NextRequest, NextResponse } from 'next/server';
import { confluenceErrorResponse, createConfluencePage } from '@/lib/confluence';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { title, html } = await req.json();
    const page = await createConfluencePage({
      title,
      html,
      retryDuplicateTitle: true,
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
