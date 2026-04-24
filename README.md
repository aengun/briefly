# 🎙️ Briefly <br/> _Premium AI Meeting Summarizer & Archive_

![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=flat&logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=flat&logo=sqlite)
![Google Gemini](https://img.shields.io/badge/Gemini_1.5_Flash-AI-orange?style=flat&logo=google)

**Briefly**는 회의 녹음 파일을 업로드하여 지능형 요약 보고서를 생성하고, 이를 영구적으로 보관 및 편집할 수 있는 워크플로우를 제공하는 통합 회의 관리 솔루션입니다.

---

## ✨ 핵심 기능 (Core Features)

### 1. 🤖 지능형 AI 분석 및 가독성 최적화
- **Gemini 1.5 Flash**: 빠르고 정확한 음성 텍스트 변환(STT) 및 문맥 기반 요약을 지원합니다.
- **구조화된 요약**: 불필요한 번호를 제거하고 포인트별 **리스트 형식(ul/li)**으로 요약 내용을 생성하여 가독성을 극대화했습니다.
- **Robust JSON Extraction**: AI 응답의 불안정성을 극복하는 파싱 로직으로 안정적인 데이터 추출을 보장합니다.

### 2. 🟦 Confluence 원클릭 연동 (New!)
- **자동 페이지 생성**: 요약된 보고서를 클릭 한 번으로 Confluence에 직접 전송하여 저장할 수 있습니다.
- **계층 구조 지원**: 특정 상위 페이지 ID를 설정하여 원하는 폴더(부모 페이지) 하위에 자동으로 회의록을 분류할 수 있습니다.
- **서식 보존**: 표(Table)와 리스트 구조가 유지된 상태로 Confluence에 최적화된 서식으로 전송됩니다.

### 3. 👥 스마트 팀원 및 화자 관리
- **IT 팀원 데이터베이스**: 자주 회의에 참여하는 팀원 정보를 미리 등록하고 원클릭으로 참여자를 추가할 수 있습니다.
- **화자 매핑 (Speaker Mapping)**: AI가 구분한 익명의 화자(A, B, C...)를 실제 참여자 이름과 일괄 매핑하여 대화 내역을 정교하게 관리합니다.

### 4. 📝 사후 편집 및 영구 보관 (Persistence)
- **전방위 편집 모드**: 생성된 요약 내용, 대화 내역, 일정 테이블을 자유롭게 수정하고 실시간으로 저장할 수 있습니다.
- **Prisma & SQLite**: 모든 데이터는 로컬 DB에 안전하게 보관되며, `npx prisma studio`를 통해 시각적으로 관리 가능합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: Next.js 15 (App Router), React 19, Lucide Icons
- **Styling**: Tailwind CSS v4 (Modern Dark Theme & Glassmorphism)
- **Backend**: Next.js API Routes (Node.js Runtime)
- **Database**: SQLite with **Prisma ORM**
- **AI Engine**: Google Generative AI (Gemini 1.5 Flash)
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

- **Confluence 전송**: 회의 상세 페이지 상단의 'Confluence로 전송' 버튼을 클릭하세요. 전송 완료 후 생성된 페이지로 바로 이동할 수 있습니다.
- **HTML 복사**: 외부 문서 작성을 위해 요약 내용을 HTML 태그가 포함된 소스 그대로 복사할 수 있습니다.
- **팀원 자동 완성**: IT 팀원 목록에서 선택하여 참여자를 빠르게 등록하고 화자 매핑에 활용하세요.
- **Git 관리**: 개인정보 및 보안을 위해 `public/uploads` 폴더의 음성 파일은 기본적으로 Git 추적에서 제외됩니다.
