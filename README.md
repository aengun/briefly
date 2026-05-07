# 🎙️ Briefly <br/> _Premium AI Meeting Summarizer & Archive_

![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=flat&logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=flat&logo=sqlite)
![Google Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-AI-orange?style=flat&logo=google)

**Briefly**는 회의 녹음 파일을 업로드하거나 실시간으로 녹음하여 지능형 요약 보고서를 생성하고, 이를 영구적으로 보관 및 편집할 수 있는 워크플로우를 제공하는 통합 회의 관리 솔루션입니다.

---

## ✨ 핵심 기능 (Core Features)

### 1. 🤖 지능형 AI 분석 및 레이아웃 개편
- **Gemini 2.0 Flash**: 최신 모델을 사용하여 더욱 빠르고 정확한 음성 분석과 요약을 제공합니다.
- **분석 요약 중심 레이아웃**: 핵심인 '분석 요약'을 상단 중앙에 배치하고 '회의록 전문'을 하단으로 이동시켜 가독성을 극대화했습니다.
- **주제별 문단 구분**: 서로 다른 주제를 빈 줄(`\n\n`)로 구분하고, 화면 및 내보내기 시 각 문단을 독립적인 리스트 형식(`<ul>`)으로 렌더링합니다.
- **발화자 자동 명명**: 수동 매핑 없이 AI가 분석한 화자를 '참가자1', '참가자2' 등으로 자동 레이블링합니다.

### 2. 🟦 고도화된 WIKI(Confluence) 연동
- **회의록 단순 등록**: 요약 보고서를 클릭 한 번으로 `[YYYY-MM-DD] 회의제목` 형식으로 Confluence에 전송합니다.
- **일감진행(Work Progress) 연동**: 분석된 요약을 기반으로 '단위업무' 페이지를 자동 생성하고, '주요진행업무' 통합 관리 페이지의 표에 새로운 행을 추가하는 고급 워크플로우를 지원합니다.
- **전송 완료 피드백**: 전송 완료 후 성공 팝업을 통해 생성된 페이지로 즉시 이동할 수 있습니다.

### 3. 🎨 프리미엄 다크 테마 & 커스텀 UI
- **Modern UI**: 다크 모드 기반의 글래스모피즘 디자인과 세련된 그라데이션 컬러 시스템을 적용했습니다.
- **Custom Modals**: 브라우저 기본 팝업 대신 앱 테마에 맞춘 **커스텀 Alert/Confirm 모달**을 구현하여 사용자 경험을 통일했습니다.
- **Micro-animations**: Lucide 아이콘과 Framer Motion 스타일의 부드러운 전환 효과를 제공합니다.

### 4. 📝 사후 편집 및 보관소 (Archive)
- **전방위 편집 모드**: 생성된 요약 내용, 대화 내역, 일정 테이블을 자유롭게 수정하고 실시간으로 저장할 수 있습니다.
- **재분석 기능**: 기존에 저장된 회의 기록을 보관소에서 불러와 언제든지 다시 AI 분석 및 요약을 수행할 수 있습니다.
- **실시간 녹음**: 파일 업로드뿐만 아니라 브라우저에서 직접 음성을 녹음하여 분석할 수 있는 기능을 지원합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: Next.js 15 (App Router), React 19, Lucide Icons
- **Styling**: Tailwind CSS v4 (Modern Dark Theme & Glassmorphism)
- **Backend**: Next.js API Routes (Node.js Runtime)
- **Database**: SQLite with **Prisma ORM**
- **AI Engine**: Google Generative AI (Gemini 2.0 Flash)
- **Integrations**: Atlassian Confluence REST API

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 변수 설정
`.env` 파일을 생성하고 아래 정보를 입력하세요.
```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# SQLite DB Path
DATABASE_URL="file:./dev.db"

# Confluence Integration (Optional)
CONFLUENCE_DOMAIN="your-company.atlassian.net"
CONFLUENCE_EMAIL="your-email@example.com"
CONFLUENCE_API_TOKEN="your-api-token"
CONFLUENCE_SPACE_KEY="SPACE_KEY"
CONFLUENCE_PARENT_PAGE_ID="12345678" # (선택) 상위 폴더 페이지 ID
```

### 2. 설치 및 DB 설정
```bash
# 1. 패키지 설치
npm install

# 2. 데이터베이스 초기화 및 Prisma Client 생성
npx prisma db push
npx prisma generate
```

### 3. 애플리케이션 실행
```bash
npm run dev
```

---

## 💡 주요 사용법 (How to Use)

- **음성 분석**: 오디오 파일을 업로드하거나 실시간으로 녹음하세요. Gemini 2.0이 음성을 직접 분석하여 요약과 대화 내역을 생성합니다.
- **보관소 관리**: 모든 회의는 보관소에 저장되며, 이후에도 상세 내용을 수정하거나 재분석할 수 있습니다.
- **일감진행**: 회의 결과를 바탕으로 단위업무를 생성하고 주요진행업무 현황판을 자동으로 업데이트하여 업무 연속성을 보장합니다.
- **참여자 관리**: 데이터베이스에 등록된 팀원 목록을 불러와 참여자를 빠르게 등록할 수 있습니다.
