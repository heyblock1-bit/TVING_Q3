import { test } from '@playwright/test';
import { config } from '../src/config';
import { LOGIN_PATH, waitAndSaveSession } from '../src/auth';

/**
 * 최초 1회 실행. 브라우저를 띄우고 사람이 직접 로그인하면 세션을 저장한다.
 * 저장된 세션은 discover 와 extract 가 재사용한다.
 */
test('수동 로그인 후 세션을 저장한다', async ({ browser }) => {
  test.setTimeout(6 * 60_000);

  const context = await browser.newContext({ baseURL: config.baseURL });
  const page = await context.newPage();
  await page.goto(config.baseURL + LOGIN_PATH, { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('브라우저에서 직접 로그인하세요. 소셜 로그인도 괜찮습니다.');
  console.log('홈으로 돌아와 헤더의 로그인 버튼이 사라지면 세션을 저장합니다. (최대 5분 대기)');
  console.log('');

  const saved = await waitAndSaveSession(context, page, 5 * 60_000);
  console.log('');
  console.log(`세션 저장 완료: ${saved}`);
  console.log('이 파일은 로그인 자격과 같습니다. 제출물이나 공유 파일에 포함하지 마세요.');

  await context.close();
});
