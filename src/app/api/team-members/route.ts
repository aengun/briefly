import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    // @ts-ignore
    const members = await prisma.teamMember.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(members);
  } catch (error: any) {
    console.error('GET /api/team-members error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { team, name } = body;
    
    if (!team || !name) {
      return NextResponse.json({ error: 'Missing team or name' }, { status: 400 });
    }
    
    // @ts-ignore
    const member = await prisma.teamMember.create({
      data: { team, name }
    });
    return NextResponse.json(member);
  } catch (error: any) {
    console.error('POST /api/team-members error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    
    // @ts-ignore
    await prisma.teamMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/team-members error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
