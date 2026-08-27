# TVING profileNo 추출

TVING 웹에 로그인한 뒤 네트워크 응답에서 `profileNo` 를 추출한다. Playwright + TypeScript.

## 과제 조건과 코드의 대응

> TVING 웹페이지에 로그인 후 `profileNo` 를 추출하는 코드를 작성해주세요.

| 조건 | 담당 |
| --- | --- |
| TVING 웹페이지에 로그인 | `src/auth.ts` 의 `waitAndSaveSession` |
| 로그인 후 | 같은 세션을 이어서 사용 |
| `profileNo` 를 추출하는 코드 | `src/extractProfileNo.ts` 의 `loginAndExtract` |

## 실행

```bash
npm install
npx playwright install chromium

npm run login-extract
```

브라우저가 열리면 직접 로그인한다. 로그인이 확인되면 마이페이지로 이동해 값을 추출하고 출력한다.

```
계정 ab****12의 profileNo는 500000000 입니다.
```

로그인 화면이 reCAPTCHA 로 보호되어 자격 입력 자동화는 성립하지 않는다. 봇 방어를 우회하지 않으므로 그 단계만 사람이 하고, 나머지는 코드가 처리한다.

## 명령

| 명령 | 설명 |
| --- | --- |
| `npm run login-extract` | 로그인부터 추출까지. 계정을 바꿔 실행하면 바뀐 계정의 값이 나온다 |
| `npm run auth` | 로그인해 세션만 저장 |
| `npm run extract:value` | 저장된 세션으로 추출 |
| `npm run extract:raw` | 값만 출력 (파이프용) |
| `npm run discover` | `profileNo` 가 어느 응답에 실려 오는지 탐지 |
| `npm run unit` | 단위 테스트 27건. 계정과 세션 없이 실행된다 |

`auth` 로 저장한 세션은 `extract` 계열과 `discover` 가 재사용한다. 세션이 없거나 만료되면 안내와 함께 실패한다.

추출 결과를 단언까지 확인하려면 `npx playwright test tests/profileNo.spec.ts` 를 쓴다.

```bash
PROFILE_NO=$(npm run --silent extract:raw)
```

## 동작

`profileNo` 는 마이페이지 진입 시 호출되는 `GET /v2/user/info` 응답에 실려 온다. 본문의 두 곳(`body.profileList[].profileNo`, `body.profile.profileNo`)에 같은 값이 들어 있다.

**엔드포인트를 하드코딩하지 않는다.** 응답 본문을 재귀 탐색해 키 이름으로 찾으므로 API 경로가 바뀌어도 키가 유지되면 동작한다. 값이 여러 개로 갈리면 예외를 던진다. 어느 값을 쓸지는 코드가 임의로 정할 문제가 아니기 때문이다.

**로그인 상태는 세션으로 재사용한다.** `storageState` 로 쿠키와 스토리지를 저장하고 이후 실행이 복원한다. 매번 로그인하면 느리고, 자동화 브라우저에서의 반복 로그인은 봇 탐지에 걸린다.

**출력과 리포트에서 민감 정보를 가린다.** `user/info` 응답에는 이름, 나이, 이메일이 함께 실리고 요청 URL 에는 `apiKey` 가 붙는다. 추출 대상인 `profileNo` 만 남기고 마스킹한다. Playwright 의 trace 와 스크린샷도 기본으로 끈다.

## 구조

```
src/
  config.ts             설정값
  auth.ts               로그인 판정, 세션 저장과 재사용
  profileNo.ts          응답 수집, 키 기반 재귀 탐색, 유일값 판정
  extractProfileNo.ts   추출 함수 본체 (세션 재사용 경로와 새 로그인 경로)
  redact.ts             개인정보, 시크릿, API 키 마스킹
scripts/
  printProfileNo.ts     CLI (--login 새 로그인, --raw 값만 출력)
tests/
  unit.spec.ts          순수 로직 단위 테스트
  isLoggedIn.spec.ts    로그인 판정 회귀 테스트
  auth.setup.spec.ts    수동 로그인 세션 저장
  discover.spec.ts      탐지
  profileNo.spec.ts     추출
```

## 제약

**로그인은 사람이 한 번 해야 한다.** CI 에서 돌리려면 세션 파일을 시크릿으로 주입하고 만료 시 갱신하는 운영이 필요하다.

**프로필이 여러 개인 계정은 실계정으로 검증하지 못했다.** 값이 갈리면 예외를 던지며 그 동작은 단위 테스트로 확인했으나, 어느 프로필의 값을 쓸지는 요구사항으로 확정되어야 한다.

`.auth/state.json` 은 로그인 자격과 동등하므로 공유하지 않는다.
