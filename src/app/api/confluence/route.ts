import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { title, html } = await req.json();

    const domain = process.env.CONFLUENCE_DOMAIN;
    const email = process.env.CONFLUENCE_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN;
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
    const parentPageId = process.env.CONFLUENCE_PARENT_PAGE_ID;

    if (!domain || !email || !apiToken || !spaceKey) {
      return NextResponse.json(
        { error: 'Confluence configuration is missing in environment variables.' },
        { status: 500 }
      );
    }

    // Prepare Confluence API request
    const url = `https://${domain}/wiki/rest/api/content`;
    
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    const body: any = {
      type: 'page',
      title: title,
      space: {
        key: spaceKey,
      },
      body: {
        storage: {
          value: html,
          representation: 'storage',
        },
      },
    };

    // Add ancestors if parentPageId is provided to create page under a specific folder/page
    if (parentPageId) {
      body.ancestors = [{ id: parentPageId }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Confluence API Error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to create Confluence page.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const pageUrl = `https://${domain}/wiki${data._links.webui}`;

    return NextResponse.json({
      success: true,
      pageId: data.id,
      url: pageUrl,
    });

  } catch (error: any) {
    console.error('Error in Confluence API Route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
