import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(members);
  } catch (error: unknown) {
    console.error('GET /api/team-members error:', error);
    return NextResponse.json({ error: "팀원 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { team, name } = body;
    
    if (!team || !name) {
      return NextResponse.json({ error: '팀명과 이름을 입력해 주세요.' }, { status: 400 });
    }
    
    const member = await prisma.teamMember.create({
      data: { team, name }
    });
    return NextResponse.json(member);
  } catch (error: unknown) {
    console.error('POST /api/team-members error:', error);
    return NextResponse.json({ error: "팀원 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json({ error: '삭제할 팀원 정보가 없습니다.' }, { status: 400 });
    }
    
    await prisma.teamMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('DELETE /api/team-members error:', error);
    return NextResponse.json({ error: "팀원 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
