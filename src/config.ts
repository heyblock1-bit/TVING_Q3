/**
 * 설정값. 필요하면 환경변수로 덮어쓸 수 있다.
 * 자격증명은 다루지 않는다. 로그인은 npm run auth 로 저장한 세션을 재사용한다.
 */
export const config = {
  baseURL: process.env.TVING_BASE_URL ?? 'https://www.tving.com',
  myPagePath: process.env.TVING_MYPAGE_PATH ?? '/my',
  storageStatePath: process.env.TVING_STORAGE_STATE ?? '.auth/state.json',

  /** 응답 본문에서 찾을 키. 엔드포인트가 아니라 키를 기준으로 탐색한다. */
  targetKey: 'profileNo',
} as const;
