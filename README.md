# 🎙️ Briefly <br/> _Premium AI Meeting Summarizer & Archive_

![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=flat&logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=flat&logo=sqlite)
![Google Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-AI-orange?style=flat&logo=google)

**Briefly**는 회의 녹음 파일을 업로드하거나 실시간으로 녹음하여 지능형 요약 보고서를 생성하고, 이를 영구적으로 보관 및 Confluence WIKI와 연동할 수 있는 프리미엄 회의 관리 솔루션입니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 🤖 지능형 AI 분석 (Powered by Gemini 2.0)
- **Multimodal STT**: 별도의 음성 인식 엔진 없이 Gemini 2.0 Flash가 음성 데이터를 직접 분석하여 높은 정확도의 대화 내역과 요약을 생성합니다.
- **Analysis Guard**: 노이즈나 짧은 대화 등 분석 가치가 낮은 파일은 사전에 필터링하여 AI 리소스 낭비를 방지합니다.
- **발화자 자동 명명**: AI가 목소리와 문맥을 파악해 '참가자1', '참가자2' 등으로 화자를 자동 구분합니다.
- **구조화된 요약**: 현황, 개선방향, 기대효과, 일감 일정 등 4가지 핵심 카테고리로 회의를 완벽하게 정리합니다.

### 2. 🟦 고도화된 WIKI(Confluence) 자동화
- **원클릭 회의록 등록**: 분석된 내용을 즉시 표준화된 서식의 Confluence 페이지로 전송합니다.
- **일감진행(Work Progress) 워크플로우**:
  - **단위업무 자동 생성**: 회의 건별 상세 페이지를 생성합니다.
  - **주요진행업무 자동 업데이트**: 팀의 전체 현황판 페이지를 찾아 해당 파트의 테이블에 새로운 행을 자동으로 추가하고 링크를 연결합니다.
- **실시간 링크 제공**: 전송 완료 후 나타나는 팝업을 통해 생성된 페이지로 즉시 이동할 수 있습니다.

### 3. 🎨 프리미엄 UI/UX 및 가독성
- **Summary-First Layout**: 가장 중요한 '분석 요약'을 상단 중앙에 배치하고 '회의록 전문'을 하단으로 이동시켜 한눈에 핵심을 파악할 수 있습니다.
- **Glassmorphism Design**: 세련된 다크 테마와 투명도 높은 인터페이스로 몰입감 있는 작업 환경을 제공합니다.
- **Responsive Web**: 데스크탑부터 모바일까지 최적화된 화면 구성을 제공합니다.

### 4. 📝 효율적인 회의 아카이브 관리
- **영구 보관소**: 모든 회의 기록은 데이터베이스에 안전하게 보관되며 제목, 날짜, 참여자별로 관리됩니다.
- **실시간 편집 및 재분석**: 저장된 기록을 불러와 내용을 수정하거나, 새로운 프롬프트로 재분석을 수행할 수 있습니다.
- **팀원 관리**: 자주 참여하는 팀원을 DB에 등록하여 클릭 몇 번으로 참여자를 지정할 수 있습니다.

---

## 📖 사용 방법 (Detailed User Guide)

처음 사용하시는 분들을 위한 단계별 가이드입니다.

### 1단계: 회의 데이터 입력
*   **파일 업로드**: 준비된 음성 파일(mp3, wav, m4a 등)을 메인 화면의 업로드 영역에 드래그하거나 클릭하여 선택하세요.
*   **실시간 녹음**: '녹음' 탭으로 이동하여 '녹음 시작' 버튼을 누르면 브라우저에서 직접 회의를 녹음할 수 있습니다.

### 2단계: AI 분석 및 결과 확인
*   파일이 준비되면 '분석 시작하기'를 클릭합니다.
*   Gemini AI가 음성을 분석하는 동안 로딩 애니메이션이 표시됩니다.
*   분석이 완료되면 상단에는 **요약(현황/목적/효과/일정)**이, 하단에는 **대화 내역(전문)**이 나타납니다.

### 3단계: 내용 수정 및 보관소 저장
*   '편집 모드'를 활성화하여 AI가 요약한 내용 중 수정이 필요한 부분을 직접 고칠 수 있습니다.
*   참여자가 누락되었다면 상단의 참여자 관리 섹션에서 팀원을 추가하세요.
*   수정이 완료되면 '보관소에 저장'을 눌러 기록을 영구 보관합니다.

### 4단계: WIKI(Confluence) 전송
*   **단순 회의록 등록**: 우측 상단의 '회의록 등록' 버튼을 누르면 현재 내용 그대로 Confluence에 새 페이지가 생성됩니다.
*   **일감진행**: '일감진행' 버튼을 누르면 모달 창이 뜹니다. 
    1. 상위 페이지(폴더)를 검색하여 선택합니다.
    2. 추가할 '주요진행업무' 현황판 페이지를 선택합니다.
    3. 'WIKI 전송'을 누르면 단위업무 페이지 생성과 현황판 업데이트가 한 번에 이루어집니다.

---

## 🛠️ 기술 스택 (Tech Stack)

*   **Framework**: Next.js 15 (App Router)
*   **Language**: TypeScript
*   **Database**: SQLite (Development/Production) with **Prisma ORM**
*   **AI**: Google Gemini 2.0 Flash API
*   **Styling**: Tailwind CSS v4, Lucide Icons
*   **Deployment**: Node.js 환경 지원

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 변수 설정
`.env` 파일을 프로젝트 루트에 생성하고 아래 정보를 입력하세요.
```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Database URL (SQLite 예시)
DATABASE_URL="file:./dev.db"

# Confluence 설정
CONFLUENCE_DOMAIN="your-domain.atlassian.net"
CONFLUENCE_EMAIL="your-email@example.com"
CONFLUENCE_API_TOKEN="your-api-token"
CONFLUENCE_SPACE_KEY="SPACE"
CONFLUENCE_PARENT_PAGE_ID="1234567" # 기본 상위 페이지 ID
```

### 2. 설치 및 실행
```bash
# 의존성 설치
npm install

# 데이터베이스 동기화 및 클라이언트 생성
npx prisma db push
npx prisma generate

# 개발 서버 실행
npm run dev
```

---

## 💡 참고 사항
*   **분석 품질**: 녹음 환경이 조용할수록 AI의 분석 정확도가 높아집니다.
*   **보안**: 업로드된 오디오 파일은 분석 직후 삭제되거나 서버의 지정된 경로에만 안전하게 보관됩니다. (설정에 따라 다름)
