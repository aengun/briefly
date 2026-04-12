# 🎙️ Briefly <br/> _Internal Meeting Summarizer_

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat&logo=tailwind-css)
![Google Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-AI-orange?style=flat&logo=google)

**Briefly**는 회의 녹음 파일(Audio)을 업로드하면 음성을 텍스트로 자동 변환(STT)하고, 이를 바탕으로 구조화된 업무 요약 보고서를 생성해 주는 지능형 웹 애플리케이션입니다.

## ✨ 주요 기능 (Features)

- 🎧 **손쉬운 파일 업로드**: MP3, WAV, M4A 등 다양한 형식의 회의 오디오 녹음 파일 지원 및 드래그 앤 드롭 기능
- 👥 **참여자 관리 및 화자 분리(Diarization)**: 회의 참여자(IT팀 등)를 명시하고, AI가 대화 문맥을 파악해 화자별(Speaker)로 분리된 STT 텍스트 제공 및 실시간 이름 매핑 기능
- 📝 **STT 변환 (Speech-to-Text)**: 최신 Google Gemini AI(2.5 Flash) 기반의 고성능 음성 텍스트 변환
- 📊 **자동 요약 보고서 (Executive Summary)**:
  - **As-Is**: 현재 문제점 및 회의 현황/배경 정리
  - **To-Be**: 회의를 통해 도출된 개선된 목표 상황
  - **Expected Effects**: 목표 달성 시의 기대 효과
  - **Timeline & Tasks**: 할 일(Task), 담당자, 기한이 포함된 동적 일정 테이블(직접 텍스트 수정 및 행 추가 가능)
- 🗄️ **회의 기록 보관소 (Archiving)**: 요약 완료 후 원본 오디오 및 문서를 로컬 파일시스템에 저장하여 언제든 다시 열람할 수 있는 독립된 보관소 페이지 제공

## 🚀 시작하기 (Getting Started)

### 1. 환경 변수 설정
프로젝트 최상단 루트 디렉토리에 `.env.local` 파일을 생성하고 발급받은 실제 Gemini API Key를 입력하세요.

```env
GEMINI_API_KEY=당신의_제미나이_API_키를_입력하세요
```

### 2. 패키지 설치 및 실행
아래 명령어를 통해 의존성을 설치하고 개발 서버를 시작합니다.

```bash
# 1. 패키지 설치
npm install

# 2. 개발 서버 실행
npm run dev
```

서버가 실행되면 웹 브라우저를 열고 [http://localhost:3000](http://localhost:3000) 에 접속하여 애플리케이션을 확인할 수 있습니다.

## 🛠️ 기술 스택 (Tech Stack)

- **Framework**: [Next.js](https://nextjs.org/) (App Router 기반)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Model**: [Google Generative AI](https://ai.google.dev/) (`gemini-2.5-flash` 모델 사용)

## 💡 사용 방법

1. 메인 화면 중앙의 업로드 영역을 클릭하거나 오디오 파일을 직접 끌어다 놓으세요.
2. 오디오가 정상적으로 첨부된 것을 확인한 후, **`요약 시작하기`** 버튼을 클릭합니다.
3. 잠시 로딩(AI 문맥 요약 중) 후, 화면이 좌우로 나뉘며 정보가 표시됩니다.
   - **왼쪽**: AI가 실제로 오디오에서 추출한 모든 대화 텍스트 원본 (STT Transcript)
   - **오른쪽**: 비즈니스 포맷으로 정돈된 요약 정보 및 액션 아이템들 (Executive Summary)
4. 생성된 일정표(Timeline & Tasks)는 클릭하여 내용을 수정할 수 있으며, `+ Add Row` 버튼을 눌러 항목을 추가할 수 있습니다.
