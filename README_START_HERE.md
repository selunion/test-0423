# START HERE — 참석 인원 숫자 자동 업데이트 + 텔레그램 봇 설치 설명서

이 설명서는 **질문 없이 그대로 따라 하면 되도록** 순서대로 써두었습니다.

---

## 이 ZIP 안의 역할

- `index.html`
  - 사이트 본문
  - `data/status.js`만 읽어서 참석 인원과 시간 표시
- `data/status.js`
  - 숫자 / 시간 표시 원본 파일
  - 사람이 직접 GitHub 웹에서 수정할 수 있음
- `bot/cloudflare_worker.js`
  - 텔레그램 메시지를 받아서 GitHub의 `data/status.js`를 자동 수정하는 서버 코드
- 이 방식은 **Cloudflare Worker**를 쓰기 때문에 **내 컴퓨터를 24시간 켜둘 필요가 없습니다.**
  Cloudflare Workers는 Cloudflare 네트워크에서 실행되는 서버리스 플랫폼입니다. citeturn536366search4

---

# 1. 먼저 바뀐 동작부터 이해하기

## 참석 숫자 파일은 이제 `data/status.js`
사이트는 더 이상 `index.html` 안의 숫자를 직접 안 씁니다.

대신 이 파일을 읽습니다.

```js
window.SITE_STATUS = {
  attend_num: 781,
  update_time_mode: 'auto',
  update_time_text: '',
  last_updated_iso: '2026-03-19T13:58:00+09:00'
};
```

## 시간 표시 규칙
- `update_time_mode: 'auto'`
  - `last_updated_iso`를 기준으로 **가장 가까운 정시로 반올림**
  - 예: `09:50` → `10시 기준`
  - 예: `13:58` → `14시 기준`
  - 예: `14:12` → `14시 기준`

- `update_time_mode: 'manual'`
  - `update_time_text`를 **그대로 화면에 표시**
  - 예: `3월 19일 14시 기준`

즉, **자동도 되고 수동도 됩니다.**

---

# 2. 먼저 이 파일을 네 사이트에 적용

## 2-1. ZIP 압축 풀기
아무 폴더에 압축을 풉니다.

## 2-2. 기존 프로젝트 폴더에 덮어쓰기
기존 Git 프로젝트 폴더:
```text
C:\Users\shbsh\Desktop\0423
```

여기에 아래를 덮어씁니다.
- `index.html`
- `data/status.js`

## 2-3. 로컬 확인
`index.html`을 더블클릭해서 엽니다.

정상이라면
- 참석 인원 `781명`
- 시간 표시가 자동 또는 수동 규칙대로 보입니다.

## 2-4. GitHub에 1회 반영
PowerShell에서 프로젝트 폴더로 이동 후:

```powershell
git add .
git commit -m "status.js + telegram worker 구조 적용"
git push
```

---

# 3. 노트북 없이 수동으로 숫자만 바꾸는 방법

이건 **가장 간단한 비상용 방법**입니다.

## 3-1. 휴대폰에서 GitHub 저장소 열기
저장소:
```text
selunion/0423
```

## 3-2. `data/status.js` 파일 열기

## 3-3. 연필(편집) 아이콘 누르기

## 3-4. 숫자 수정
예:
```js
attend_num: 812,
```

## 3-5. 시간도 원하는 방식으로 수정 가능

### 자동 시간 사용
```js
update_time_mode: 'auto',
update_time_text: '',
last_updated_iso: '2026-03-19T14:12:00+09:00'
```

### 수동 시간 사용
```js
update_time_mode: 'manual',
update_time_text: '3월 19일 14시 기준',
last_updated_iso: '2026-03-19T14:12:00+09:00'
```

## 3-6. Commit changes 누르기

이 방법은 **봇이 안 되거나 급할 때 바로 쓰는 비상 방법**입니다.

---

# 4. 텔레그램 봇으로 자동 업데이트 만들기 (추천)

이제부터는 **텔레그램에 숫자만 보내면 GitHub가 자동 반영되게** 합니다.

구조:
```text
텔레그램 메시지
→ Cloudflare Worker
→ GitHub API
→ data/status.js 수정
→ GitHub Pages 자동 반영
```

GitHub 파일 내용을 API로 수정할 때는 **Contents write 권한**이 필요합니다. GitHub 공식 문서도 "Create or update file contents" 엔드포인트에 적절한 권한이 필요하다고 안내합니다. citeturn536366search2

---

# 5. Cloudflare Worker 만들기

## 5-1. Cloudflare 접속
- Cloudflare 로그인
- 왼쪽 메뉴: **Workers & Pages**

## 5-2. 새 Worker 생성
- **Create application** 또는 **Create Worker**
- 이름 예시:
```text
attendance-telegram-bot
```

## 5-3. 코드 붙여넣기
ZIP 안의 파일:
```text
bot/cloudflare_worker.js
```

내용 전체를 복사해서 Worker 코드 편집창에 붙여넣고 저장/배포합니다.

Cloudflare Worker의 민감한 값은 **Secrets**로 넣는 게 맞고, Cloudflare 공식 문서도 비밀값은 Secrets에 저장하라고 안내합니다. citeturn536366search0

---

# 6. Worker Secrets / Variables 넣기

Worker 설정에서 **Settings → Variables and Secrets** 로 이동해서 아래를 추가합니다.

## 필수 Secrets
### 1) TELEGRAM_BOT_TOKEN
네가 이미 만든 텔레그램 봇 토큰

예:
```text
123456789:AA...
```

### 2) GITHUB_TOKEN
GitHub Personal Access Token (fine-grained 추천)

### 3) GITHUB_OWNER
```text
selunion
```

### 4) GITHUB_REPO
```text
0423
```

### 5) GITHUB_BRANCH
```text
main
```

### 6) GITHUB_FILE_PATH
```text
data/status.js
```

### 7) TELEGRAM_SECRET_TOKEN
아무 랜덤 문자열 하나 직접 정하면 됩니다.

예:
```text
my-telegram-webhook-secret-2026
```

### 8) GITHUB_COMMITTER_NAME
예:
```text
Attendance Bot
```

### 9) GITHUB_COMMITTER_EMAIL
예:
```text
attendance-bot@users.noreply.github.com
```

## 권한 제한용 (강력 추천)
봇을 아무나 쓰면 위험하므로 반드시 제한합니다.

### 10) ALLOWED_USER_IDS
허용할 텔레그램 사용자 ID 목록  
쉼표로 여러 명 가능

예:
```text
123456789,987654321
```

### 11) ALLOWED_CHAT_IDS
허용할 채팅방 ID 목록  
그룹방에서만 쓰고 싶으면 이걸 넣습니다.

예:
```text
-1001234567890
```

## 선택(캐시 즉시 비우기)
이건 나중에 필요하면 추가합니다. 일단 없어도 봇은 동작합니다.

### 12) CF_ZONE_ID
Cloudflare Zone ID

### 13) CF_API_TOKEN
Cache purge 권한 있는 Cloudflare API Token

### 14) SITE_BASE_URL
```text
https://www.파업.com
```

---

# 7. GitHub 토큰 만드는 정확한 기준

## 7-1. GitHub → Settings → Developer settings → Fine-grained personal access tokens

## 7-2. 새 토큰 생성
- 대상 owner: `selunion`
- repository: `0423`
- 권한:
  - **Contents: Read and write**

GitHub의 Contents API는 파일 생성/수정에 이 권한이 필요합니다. citeturn536366search2

---

# 8. Worker 주소 확인

Worker를 배포하면 보통 이런 주소가 생깁니다.

```text
https://attendance-telegram-bot.<계정>.workers.dev
```

Cloudflare 문서상 `workers.dev` 주소를 쓸 수 있고, 필요하면 나중에 Route나 Custom Domain으로 바꿀 수 있습니다. citeturn536366search15turn536366search5

이 주소를 기억합니다.

---

# 9. 텔레그램 Webhook 연결

Telegram Bot API의 `setWebhook`에 `secret_token`을 줄 수 있습니다. Telegram은 이 값을 `X-Telegram-Bot-Api-Secret-Token` 헤더로 보냅니다. citeturn536366search3

아래 URL을 브라우저에 그대로 넣습니다.  
`<BOT_TOKEN>`과 `<WORKER_URL>`과 `<SECRET>`만 바꿉니다.

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>/webhook&secret_token=<SECRET>
```

예시:
```text
https://api.telegram.org/bot123456789:AAxxxx/setWebhook?url=https://attendance-telegram-bot.example.workers.dev/webhook&secret_token=my-telegram-webhook-secret-2026
```

정상이라면 Telegram이:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```
같은 응답을 줍니다.

---

# 10. 제일 먼저 테스트할 명령

봇 대화창에 아래를 보내세요.

## 10-1. /whoami
```text
/whoami
```

이 명령은 **항상 허용**되도록 해놨습니다.  
즉, 권한 설정 전에도 본인 정보를 확인할 수 있습니다.

응답 예:
```text
user_id: 123456789
chat_id: 123456789
username: abc
name: 홍길동
```

이 값으로 `ALLOWED_USER_IDS` 또는 `ALLOWED_CHAT_IDS`를 채웁니다.

---

# 11. 권한 설정 방법

## 개인 사용자 1명만 허용
Secrets에서:
```text
ALLOWED_USER_IDS=123456789
```

## 여러 사람 허용
```text
ALLOWED_USER_IDS=123456789,987654321
```

## 특정 그룹방만 허용
```text
ALLOWED_CHAT_IDS=-1001234567890
```

## 둘 다 허용 가능
둘 다 넣어도 됩니다.

---

# 12. 봇 사용 방법

이제 허용된 사람만 아래 명령을 쓸 수 있습니다.

## A. 숫자만 보내기
```text
781
```
동작:
- 참석 인원 781로 변경
- `last_updated_iso`는 지금 시각으로 자동 변경
- 시간 모드가 auto면 자동 반올림 표시
- 시간 모드가 manual이면 수동 문구 유지

## B. /set 781
```text
/set 781
```
동작:
- 참석 인원을 정확히 781로 설정

## C. /inc 10
```text
/inc 10
```
동작:
- 현재 인원 +10

## D. /dec 5
```text
/dec 5
```
동작:
- 현재 인원 -5
- 0 아래로는 내려가지 않음

## E. /time auto
```text
/time auto
```
동작:
- 자동 시간 표시 모드로 전환
- 가장 가까운 정시 기준으로 표시

## F. /time 3월 19일 14시 기준
```text
/time 3월 19일 14시 기준
```
동작:
- 수동 시간 문구로 고정

## G. /status
```text
/status
```
동작:
- 현재 숫자 / 시간 모드 / 실제 값 확인

## H. /help
```text
/help
```
동작:
- 사용법 전체 표시

## I. /ping
```text
/ping
```
동작:
- 봇 살아있는지 확인

---

# 13. 실제 사용 예시

## 숫자만 바꾸고 자동 시간 사용
```text
781
```
결과:
- `attend_num: 781`
- `last_updated_iso: 지금`
- 화면에는 자동 반올림된 시간 표시

예:
- 실제 전송 시각 13:58
- 화면 표시 `3월 19일 14시 기준`

## 숫자는 바꾸되 시간 문구 고정
```text
/time 3월 19일 14시 기준
/set 812
```
결과:
- 숫자는 812
- 시간 문구는 계속 `3월 19일 14시 기준`

## 다시 자동으로 복귀
```text
/time auto
```

---

# 14. 봇이 GitHub에 실제로 무엇을 바꾸는가

봇은 항상 `data/status.js` 파일만 수정합니다.

예시 최종 결과:
```js
window.SITE_STATUS = {
  attend_num: 812,
  update_time_mode: 'manual',
  update_time_text: '3월 19일 14시 기준',
  last_updated_iso: '2026-03-19T14:12:00+09:00'
};
```

즉, 사이트 핵심 코드 전체를 건드리지 않고 **숫자 파일 하나만 안정적으로 바꾸는 구조**입니다.

---

# 15. 예외 처리 / 안전장치

이 Worker는 아래를 자동 처리합니다.

- 숫자에 쉼표가 있어도 인식
  - 예: `1,234`
- 숫자만 보낸 메시지도 인식
- 음수로 줄이다가 0 밑으로 내려가지 않음
- 권한 없는 사람 차단
- `/whoami`는 항상 허용
- GitHub 업데이트 실패 시 텔레그램에 실패 원인 회신
- Telegram webhook secret 헤더 검사
- 잘못된 명령이면 `/help` 유도

즉, 일반적인 실수는 대부분 막아뒀습니다.

---

# 16. 자주 막히는 포인트

## 1) `/whoami`는 되는데 `/set 781`이 안 된다
원인:
- `ALLOWED_USER_IDS` 또는 `ALLOWED_CHAT_IDS`에 자기 ID/채팅 ID를 안 넣음

해결:
- `/whoami` 결과를 보고 Secrets에 추가

## 2) 텔레그램 응답은 오는데 GitHub 반영이 안 된다
원인:
- `GITHUB_TOKEN` 권한 부족
- `Contents: Read and write` 없음
- owner/repo/branch/path 오타

## 3) GitHub는 바뀌는데 사이트 반영이 느리다
원인:
- GitHub Pages 반영 시간
- Cloudflare 캐시

해결:
- 조금 기다리기
- 필요 시 optional purge 설정 추가

## 4) 시간 표시가 이상하다
원인:
- `update_time_mode`가 `manual`인데 `update_time_text`가 예전 문구
- 또는 `auto`인데 `last_updated_iso`가 예전 값

해결:
- `/time auto`
- 또는 `/time 원하는문구`

---

# 17. 내가 추천하는 실제 운영 방식

## 평소
- 숫자만 바꿀 때: 숫자만 보내기
  - 예: `812`

## 특정 시각 기준 문구를 꼭 고정하고 싶을 때
- `/time 3월 19일 14시 기준`
- 그 다음 숫자 업데이트

## 행사 중 급하게 수정할 때
- 텔레그램 봇 사용
- 봇이 안 되면 휴대폰 GitHub에서 `data/status.js` 직접 편집

---

# 18. 가장 짧은 실제 설치 순서 요약

1. ZIP의 `index.html`, `data/status.js`를 프로젝트에 덮어쓰기
2. GitHub에 push
3. Cloudflare Worker 생성
4. `bot/cloudflare_worker.js` 붙여넣기
5. Secrets 넣기
6. Worker 배포
7. Telegram `setWebhook`
8. `/whoami`로 ID 확인
9. `ALLOWED_USER_IDS` 또는 `ALLOWED_CHAT_IDS` 설정
10. `781` 보내서 실제 반영 확인

---

# 19. 설치 후 첫 테스트 추천 순서

1. `/whoami`
2. `/help`
3. `/status`
4. `781`
5. `/time auto`
6. `/time 3월 19일 14시 기준`
7. `/inc 10`
8. `/dec 5`

이 순서대로 되면 설치 완료입니다.

---

# 20. 마지막으로

이 구조는 **PC를 켜둘 필요가 없고**,  
업데이트 담당자가 텔레그램만 열 수 있으면 숫자를 바꿀 수 있게 만든 방식입니다.

필요한 원리:
- Cloudflare Worker가 항상 대기
- 텔레그램이 Worker로 webhook 전송
- Worker가 GitHub `data/status.js`를 수정
- GitHub Pages가 사이트 반영

Cloudflare Worker 비밀값은 Dashboard Secrets에 보관하고, GitHub Contents API는 write 권한 토큰으로 파일을 수정하며, Telegram webhook은 secret token 검증이 가능합니다. citeturn536366search0turn536366search2turn536366search3
