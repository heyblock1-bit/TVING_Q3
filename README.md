# TVING profileNo 추출

TVING 웹에 로그인한 뒤 네트워크 응답에서 `profileNo` 를 추출한다. Playwright + TypeScript.

## 과제 조건과 코드의 대응

> TVING 웹페이지에 로그인 후 `profileNo` 를 추출하는 코드를 작성해주세요.

| 조건 | 담당 | 실행 |
| --- | --- | --- |
| TVING 웹페이지에 로그인 | `src/auth.ts` 의 `waitAndSaveSession` | 브라우저에서 직접 로그인 |
| 로그인 후 | 같은 세션을 이어서 사용 | 별도 조작 없음 |
| `profileNo` 를 추출하는 코드 | `src/extractProfileNo.ts` 의 `loginAndExtract` | `npm run login-extract` |

```bash
npm run login-extract   # 브라우저가 열리면 로그인, 그 자리에서 profileNo 출력
```

```
브라우저에서 로그인해 주세요. 완료되면 자동으로 진행합니다.

계정 ab****12의 profileNo는 500000000 입니다.
```

**로그인 단계의 자격 입력만 사람이 한다.** 로그인 화면이 reCAPTCHA Enterprise 로 보호되어 자동 입력이 성립하지 않으며, 봇 방어는 우회 대상이 아니다. 코드가 담당하는 것은 로그인 완료 감지, 세션 저장과 만료 판정, 그리고 추출 전체다.

## 실행

```bash
npm install
npx playwright install chromium

npm run unit           # 단위 테스트 27건 (계정과 세션 불필요)

npm run login-extract  # 로그인부터 추출까지 한 번에
                       # 세션 캐시를 쓰지 않으므로 계정을 바꿔 실행하면 바뀐 계정의 값이 나온다

npm run auth           # 세션만 저장 (아래 명령들의 선행 조건)
npm run discover       # profileNo 가 어느 응답에 실려 오는지 탐지
npm run extract        # 저장된 세션으로 추출과 검증
npm run extract:value  # 저장된 세션으로 추출해 한 줄로 출력
npm run extract:raw    # 값만 출력 (파이프용)
```

**두 갈래가 있다.** `login-extract` 는 매번 로그인하므로 과제 문구에 그대로 대응한다. `auth` 이후의 명령들은 저장된 세션을 재사용해 빠르며, `auth` 없이 실행하면 안내와 함께 실패한다.

## 세부 사항

**다른 계정의 값을 보려면** `npm run login-extract` 를 실행하거나 `npm run auth` 를 다시 실행해 세션을 덮어쓴다. 두 경우 모두 깨끗한 브라우저로 시작하므로 이전 계정이 남지 않는다. 출력에 계정이 함께 나오므로 어느 계정의 값인지 확인할 수 있다.

**계정 식별자는 가려서 표시한다.** 어느 계정인지 구분하는 데는 앞뒤 몇 글자면 충분하고, 아이디나 이메일을 콘솔과 로그에 그대로 남길 이유는 없다.

**값만 필요하면** `extract:raw` 를 쓴다.

```bash
PROFILE_NO=$(npm run --silent extract:raw)
```

**보조 명령**

| 명령 | 용도 |
| --- | --- |
| `npm run typecheck` | 타입 검사 |
| `npm run extract:headed` | 추출을 브라우저를 띄운 채 실행 |
| `npm run discover:debug` | 아티팩트를 켠 채 탐지 (`PW_ARTIFACTS=1`) |
| `npm run clean` | 아티팩트 삭제 |

**`extract:value` 와 `extract:raw` 는 테스트 러너를 거치지 않고** 추출 함수를 직접 호출한다. TypeScript 파일을 그대로 실행하려고 `tsx` 를 쓴다. Node 는 `.ts` 를 ESM 으로 해석하며 import 에 확장자를 요구하는데, 그 규칙에 코드 전체를 맞추는 것보다 실행기를 두는 편이 변경 범위가 작다.

**`.auth/state.json` 은 로그인 자격과 동등하다.** 제출물이나 공유 파일에 포함하지 않는다.

## 실행 결과

```
계정 ab****12의 profileNo는 500000000 입니다.
```

위 값은 형식을 보이기 위한 예시다. 실제 계정으로 전 경로를 실행해 검증했다.

값은 마이페이지 진입 시 호출되는 `GET /v2/user/info` 응답에 실려 온다. 응답 본문의 두 곳(`body.profileList[].profileNo`, `body.profile.profileNo`)에 같은 값이 들어 있어 재귀 탐색이 둘 다 수집하며, 값이 같으므로 유일값 판정을 통과한다.

`profileNo` 는 쿠키로도 내려오지만 API 응답을 택했다. 쿠키는 서버가 언제든 내리지 않을 수 있는 부가 정보인 반면, `user/info` 는 마이페이지가 화면을 그리려면 반드시 호출하는 데이터다.

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

## 설계 결정

**엔드포인트를 하드코딩하지 않는다.** 응답 본문을 재귀 탐색해 키 이름으로 찾으므로 API 경로가 바뀌어도 키가 유지되면 동작한다. 어느 응답에 실려 오는지 모르는 상태에서 URL 을 추측해 박으면 처음부터 틀린 코드가 된다. 그래서 탐지(`discover`)와 추출(`extract`)을 나눴다.

**같은 조립을 두 경로가 공유한다.** `loginAndExtract` 는 새로 로그인하고 `extractProfileNo` 는 저장된 세션을 쓰지만, 마이페이지 진입부터 값 판정까지는 `collectFromContext` 하나를 함께 쓴다. 경로가 갈려도 추출 로직은 한 곳에만 있다.

**조립을 테스트 밖에 둔다.** 처음에는 로그인부터 판정까지를 spec 안에서 조립했다. 동작은 했지만 값을 다른 코드가 가져다 쓸 방법이 없었고 같은 조립이 두 spec 에 중복됐다. 추출 함수를 `src` 로 올리자 중복이 사라지고 CLI 를 붙일 수 있게 됐다.

**로그인 판정에 존재 증명을 먼저 둔다.** 쿠키 이름을 `/token|session|auth/i` 로 검사했더니 `webOauthCancelUrl` 과 `_hackle_session_id` 에 걸려 **비로그인 상태를 로그인으로 통과시켰다.** 헤더의 '로그인' 링크 유무로 바꿨지만 그것만으로는 부족하다. 링크의 부재는 로그인일 수도, 헤더가 아직 안 그려진 것일 수도 있다. 항상 존재하는 카테고리 링크로 렌더를 먼저 확인하고 그 다음에 부재를 본다. `tests/isLoggedIn.spec.ts` 가 로딩 중 오판 케이스를 고정한다.

**리포트에서 개인정보와 API 키를 가린다.** `user/info` 응답에는 이름, 나이, 이메일이 함께 실리고 요청 URL 에는 `apiKey` 가 붙는다. 추출 대상인 `profileNo` 만 남기고 마스킹한다. Playwright 의 trace 와 스크린샷도 화면을 그대로 담으므로 기본으로 끄고, 디버깅에 필요할 때만 `discover:debug` 로 켠 뒤 `clean` 으로 지운다.

**찾지 못한 것을 통과로 남기지 않는다.** 탐지가 아무것도 못 찾으면 실패로 기록한다. 추출값은 `toBeTruthy` 대신 관측된 형식(`/^\d+$/`)을 단언한다. 느슨한 단언은 `'undefined'` 같은 문자열도 통과시킨다.

## 로그인 자동화가 성립하지 않는 이유

자격증명을 주입해 로그인하는 구조로 먼저 만들었으나 실제로 돌려보니 성립하지 않았다.

```
PAGE.ERROR  ReferenceError: grecaptcha is not defined
REQ POST    https://www.tving.com/<난독화된 경로>            (봇 탐지 센서)
```

자동화 브라우저에서는 `grecaptcha` 가 로드되지 않아 버튼을 눌러도 **로그인 API 요청 자체가 발생하지 않는다.** 그래서 최초 1회 사람이 로그인하고 세션을 재사용하는 구조로 바꿨다. 부수 효과로 자격증명이 코드에도 환경변수에도 남지 않는다.

사람이 직접 로그인하더라도 **자동화 브라우저에서의 반복 로그인은 봇 탐지에 걸린다.** 개발 중 반복 실행하다 로그인이 일시적 오류로 막혔고, 같은 계정이 일반 브라우저에서는 정상 로그인되는 것을 확인해 계정 문제가 아니라 자동화 감지임을 가렸다. 그 상황에서도 저장된 세션으로 추출은 계속 동작했다.

세션 재사용이 필요한 이유가 둘인 셈이다. 로그인을 시작조차 할 수 없다는 것과, 반복하면 막힌다는 것이다. 후자는 실무에서 세션을 재사용하는 일반적인 이유이기도 하다.

## 실제 화면에서 확인한 것

추측으로 짠 셀렉터와 경로는 대부분 틀렸다.

| 항목 | 확인 결과 |
| --- | --- |
| 홈 로그인 진입 | button 이 아니라 link |
| 로그인 화면 | 2단계다. `/account/login` 에서 수단을 고르고 `/account/login/tving` 에서 입력한다 |
| 입력 필드 | label 이 없고 placeholder 만 있다. `getByRole('textbox', { name })` 으로 잡아야 한다 |
| 마이페이지 경로 | `/my` |

`waitUntil: 'networkidle'` 도 쓰지 않는다. 분석 스크립트와 소켓이 연결을 유지해 유휴 상태가 오지 않는다.

## 한계

**로그인은 사람이 한 번 해야 한다.** CI 에서 돌리려면 세션 파일을 시크릿으로 주입하고 만료 시 갱신하는 운영이 필요하다.

**프로필이 여러 개인 계정은 실계정으로 검증하지 못했다.** 값이 갈리면 예외를 던지며 그 동작은 `resolveUniqueValue` 단위 테스트로 확인했으나, 어느 프로필의 값을 쓸지는 요구사항으로 확정되어야 한다.
