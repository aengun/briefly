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

### 1. 🤖 지능형 AI 분석 파이프라인
- **Gemini 1.5 Flash**: 빠르고 정확한 음성 텍스트 변환(STT) 및 문맥 기반 요약을 지원합니다.
- **Robust JSON Extraction**: AI 응답의 불안정성을 극복하는 독자적인 파싱 로직으로 안정적인 데이터 추출을 보장합니다.

### 2. 👥 정밀한 참여자 및 화자 관리
- **실시간 참여자 등록**: 회의 분석 전후로 참여자를 자유롭게 추가/제거할 수 있습니다.
- **화자 매핑 (Speaker Mapping)**: AI가 구분한 익명의 화자(A, B, C...)를 실제 참여자 이름과 매핑하여 대화 내역의 가독성을 높입니다.

### 3. 📝 사후 편집 및 영구 보관 (Persistence)
- **전방위 편집 모드**: 생성된 요약 내용(As-Is, To-Be, 기대효과)과 대화 내역, 일정 테이블을 언제든 수정할 수 있습니다.
- **Prisma & SQLite**: 분석된 모든 데이터는 로컬 데이터베이스에 영구 저장되어 유실 걱정이 없습니다.
- **회의 날짜 관리**: 자동 생성된 날짜 외에 실제 회의가 진행된 날짜를 수동으로 지정하여 아카이브를 관리할 수 있습니다.

### 4. 🗄️ 고도화된 아카이브 (Archives)
- **스마트 정렬**: 등록된 '회의 날짜(Meeting Date)' 순으로 과거 기록을 편리하게 조회할 수 있습니다.
- **딥 다이브 뷰**: 보관된 기록을 클릭하여 당시의 대화 원본과 요약본, 오디오 파일을 다시 확인할 수 있습니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: Next.js 15 (App Router), React 19, Lucide Icons
- **Styling**: Tailwind CSS v4 (Modern Dark Theme & Glassmorphism)
- **Backend**: Next.js API Routes (Serverless Functions)
- **Database**: SQLite with **Prisma ORM**
- **AI Engine**: Google Generative AI (Gemini 1.5 Flash)

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 변수 설정
`.env` 파일을 생성하고 아래 정보를 입력하세요.
```env
# Google AI Studio에서 발급받은 API 키
GEMINI_API_KEY=your_gemini_api_key_here

# SQLite DB 경로 (기본값)
DATABASE_URL="file:./prisma/dev.db"
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
이제 [http://localhost:3000](http://localhost:3000)에서 실시간으로 서비스를 확인하실 수 있습니다.

---

## 💡 사용 팁 (Usage Tips)

- **분석 전 참여자 등록**: 분석을 시작하기 전에 참여자를 미리 등록해두면, 분석 결과 화면에서 화자 매핑을 더 쉽고 빠르게 할 수 있습니다.
- **보관소 편집**: 저장된 데이터가 마음에 들지 않는다면, 보관소 상세 페이지의 **'편집 모드'**를 통해 언제든 내용을 수정하고 업데이트할 수 있습니다.
- **DB 확인**: 저장된 원본 데이터를 직접 확인하고 싶다면 `npx prisma studio`를 실행하여 브라우저에서 DB를 관리할 수 있습니다.
