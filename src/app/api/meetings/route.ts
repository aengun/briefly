import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveMeeting, Meeting } from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  try {
    const db = getDb();
    return NextResponse.json(db.meetings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // validate
    if (!body.title || !body.audioUrl || !body.summary || !body.transcript) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const meeting: Meeting = {
      id: crypto.randomUUID(),
      title: body.title,
      createdAt: new Date().toISOString(),
      audioUrl: body.audioUrl,
      participants: body.participants || [],
      transcript: body.transcript,
      summary: body.summary,
    };

    saveMeeting(meeting);

    return NextResponse.json({ success: true, meeting });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
