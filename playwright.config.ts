import { defineConfig, devices } from '@playwright/test';
import { config as appConfig } from './src/config';

/**
 * 아티팩트는 기본으로 끈다.
 * trace 와 screenshot 은 로그인 화면을 그대로 담기 때문에 입력된 비밀번호가
 * 평문으로 기록된다. Playwright 는 입력값을 가려주지 않는다.
 * 디버깅이 필요할 때만 PW_ARTIFACTS=1 로 켜고, 확인 후 test-results 디렉터리를 지운다.
 */
const artifacts = process.env.PW_ARTIFACTS === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // 같은 계정으로 동시 로그인하면 세션이 서로를 밀어낸다
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: appConfig.baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: artifacts ? 'retain-on-failure' : 'off',
    screenshot: artifacts ? 'only-on-failure' : 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
