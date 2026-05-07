# AIReadMe

## 작업 운영 규칙
- 이 프로젝트에서 명령을 실행하기 전에는 먼저 이 `AIReadMe.md`를 읽고 현재 주의사항을 반영한다.
- 작업 시작 전에는 `git status --short`로 작업트리를 확인한다.
- 다른 개발자나 사용자가 만든 기존 변경사항은 덮어쓰거나 되돌리지 않는다.
- 명령 실행 중 권한, 포트, 로컬 HTTP, 브라우저 실행, DB 스키마, 환경 변수 등에서 시행착오가 발생하면 이 파일에 원인과 해결방법을 짧게 기록한다.
- 같은 실패를 두 번 반복하지 않도록, 실패한 명령과 성공한 대체 명령을 같이 남긴다.

## 상황
- 이 프로젝트는 `Next.js` 앱이며, 로컬 개발 서버는 `npm run dev`로 실행한다.
- 목표는 Safari에서 `http://localhost:3000`을 새 탭으로 여는 것이다.

## 원인
- 일반 권한으로 `open -a Safari http://localhost:3000`를 실행하면 macOS `Launch Services`가 Safari를 제대로 열지 못하는 경우가 있었다.
- 에러는 `kLSNoExecutableErr`, `Connection Invalid`, `Unable to find application named 'Safari'` 같은 형태로 나타났다.
- 즉, 서버 문제가 아니라 이 실행 환경의 GUI/앱 लॉन्च 경로 문제였다.

## 해결방법
1. 프로젝트 루트에서 개발 서버를 켠다.
   - `npm run dev`
2. Safari를 여는 명령을 일반 권한으로 먼저 시도한다.
   - `open -a Safari http://localhost:3000`
3. 실패하면 같은 명령을 `require_escalated`로 다시 실행한다.
   - 이 환경에서는 권한 상승 후 정상적으로 열렸다.

## 다음 AI에게 남기는 메모
- 먼저 서버가 떠 있는지 확인한다.
- Safari 실행이 실패하면 서버 재시작보다 `open -a Safari http://localhost:3000`의 권한 문제를 먼저 의심한다.
- 일반 권한 실패 후에는 바로 권한 상승으로 재시도한다.

## 최근 시행착오 기록
- `npx prisma db push`는 `.env.local`의 `DATABASE_URL`을 자동으로 읽지 못해 실패했다.
  - 성공한 방식: `DATABASE_URL=file:./dev.db npx prisma db push`
- 로컬 Next 서버가 떠 있어도 일반 권한의 `curl`/Node HTTP 요청이 `Failed to connect`, `EPERM`으로 실패할 수 있었다.
  - 성공한 방식: 로컬 HTTP 검증 명령을 권한 상승으로 재시도한다.
- 죽은 Next 개발 서버 프로세스가 포트를 잡고 있으면 새 서버가 바로 종료될 수 있었다.
  - 성공한 방식: 해당 프로세스가 이전 작업에서 띄운 서버인지 확인한 뒤 `kill <PID>`를 권한 상승으로 실행하고 서버를 다시 띄운다.
- Confluence 연결 확인은 상위 페이지 권한 오류와 공간 조회 실패를 구분해서 봐야 한다.
  - 최근 수정: 상위 페이지 접근 실패는 연결 전체 실패로 끊지 않고, 인증/공간 조회 후 경고로만 표시하도록 바꿨다.
  - 현재 관찰: 연결 확인 API가 `상위 페이지 목록을 불러오지 못했습니다.`로 실패하면 토큰/공간 키/네트워크를 다시 확인해야 한다.
- 일감진행 팝업의 상위 페이지 목록은 “연결 확인” 블록과 분리해서 생각해야 한다.
  - 연결 확인 블록은 Confluence 인증/공간 접근만 검증한다.
  - 단위업무/주요진행업무 각 블록은 모달이 열리면 기본 목록을 즉시 불러오고, 그 다음 검색어로 재조회한다.
- Confluence 연결 확인 버튼이 `상위 페이지 목록` 오류를 내면, 먼저 인증 확인 경로를 분리해서 봐야 한다.
  - 최근 수정: 연결 확인은 페이지 검색 대신 `user/current`와 `space/{spaceKey}`를 확인하도록 바꿨다.
  - 현재 관찰: 연결 확인 API가 `WIKI 인증을 확인하지 못했습니다.`로 실패하면 API 토큰 또는 이메일 조합이 실제로 거절된 상태다.
- `WIKI 인증을 확인하지 못했습니다.`가 계속 뜨면 코드가 아니라 자격증명 자체를 다시 발급받아야 한다.
  - 이 경우에는 `CONFLUENCE_EMAIL`과 `CONFLUENCE_API_TOKEN` 조합이 Confluence에서 거절된 것이다.
  - 새 토큰을 발급받아 `.env.local`을 갱신하고 서버를 다시 띄워야 한다.
  - 실제 확인 결과: `user/current` 호출이 `403 FORBIDDEN "Request rejected because caller cannot access Confluence"`를 반환할 수 있다.
  - 이 경우는 토큰 문자열이 맞아도 사이트/제품 접근 권한이 없거나, 토큰이 다른 Atlassian 계정에 연결된 상태일 수 있다.
- `npm run build`는 샌드박스에서 Turbopack이 포트 바인딩을 시도하다 `Operation not permitted`로 실패할 수 있다.
  - 성공한 방식: 같은 빌드를 `require_escalated`로 다시 실행한다.
- Confluence 인증이 403으로 실패해도 사용자가 제공한 토큰이 맞다고 하면, 코드보다 먼저 `.env.local`의 토큰 문자열 오타/전치 여부를 원문과 한 글자 단위로 비교한다.
  - 실제 원인: 토큰 중간 일부가 `.env.local`에 잘못 입력되어 Basic Auth가 거절됐다.
  - 성공한 방식: 토큰을 정확히 교정하고 Next 개발 서버를 재시작한 뒤 `/api/confluence/connection`을 다시 호출한다.
- Confluence 검색 API(`/wiki/rest/api/search`) 결과는 페이지 `id`, `title`, `_links.webui`가 최상위가 아니라 `content` 아래에 들어올 수 있다.
  - 실패 증상: `/api/confluence/pages`는 성공처럼 보이지만 셀렉트박스에 쓸 `id`가 비거나 목록 사용이 깨진다.
  - 성공한 방식: `content.id`, `content.title`, `content._links.webui`를 우선 읽고 최상위 필드는 fallback으로만 사용한다.
- `searchConfluencePages`에서 `map(... null).filter(Boolean)` 형태는 런타임상 맞아도 Next 빌드 타입체크가 `null` 제거를 인정하지 못할 수 있다.
  - 성공한 방식: `ConfluencePageResult[]` 배열을 만들고 유효한 항목만 `push`해서 반환한다.
- GitHub 원격 push는 로컬 Git 인증 상태를 먼저 확인해야 한다.
  - 실패한 방식: `git push origin main`은 HTTPS credential이 없어 `could not read Username`으로 실패했다.
  - 실패한 방식: SSH URL push는 `github.com` host key 등록 후에도 로컬 SSH public key가 GitHub에 등록되어 있지 않아 `Permission denied (publickey)`로 실패했다.
  - 실패한 방식: GitHub 커넥터의 Git blob API는 현재 설치 권한에서 `Resource not accessible by integration` 403으로 실패했다.
  - 해결방법: 로컬에 GitHub HTTPS credential/PAT를 등록하거나, GitHub에 SSH public key를 등록한 뒤 다시 `git push origin main`을 실행한다.
