import { test, expect } from '@playwright/test';
import { config } from '../src/config';
import { isLoggedInOnPage } from '../src/auth';

/**
 * 로그인 판정 회귀 테스트.
 * 실제 계정 없이 헤더 상태만 흉내내어 판정 로직을 검증한다.
 * 세 번째 케이스가 이 테스트의 이유다. 헤더가 아직 그려지지 않은 상태를
 * 로그인으로 오판하면 npm run auth 가 빈 세션을 저장한다.
 */
async function serve(page: import('@playwright/test').Page, bodyHtml: string, path = '/') {
  await page.route(`${config.baseURL}${path}`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<html><body>${bodyHtml}</body></html>` }),
  );
  await page.goto(`${config.baseURL}${path}`, { waitUntil: 'domcontentloaded' });
}

const HEADER = '<a href="/drama">드라마</a><a href="/movie">영화</a>';

test('비로그인: 헤더와 로그인 링크가 모두 있으면 false', async ({ page }) => {
  await serve(page, `${HEADER}<a href="/account/login">로그인</a>`);
  expect(await isLoggedInOnPage(page)).toBe(false);
});

test('로그인: 헤더는 있고 로그인 링크가 없으면 true', async ({ page }) => {
  await serve(page, `${HEADER}<a href="/my">마이</a>`);
  expect(await isLoggedInOnPage(page)).toBe(true);
});

test('로딩 중: 헤더가 없으면 로그인 링크가 없어도 false', async ({ page }) => {
  await serve(page, '<div>loading…</div>');
  expect(await isLoggedInOnPage(page)).toBe(false);
});

test('로그인 화면(/account/*)에서는 항상 false', async ({ page }) => {
  await serve(page, HEADER, '/account/login');
  expect(await isLoggedInOnPage(page)).toBe(false);
});

test('외부 도메인에서는 false', async ({ page }) => {
  await page.goto('data:text/html,<a href="#">드라마</a>');
  expect(await isLoggedInOnPage(page)).toBe(false);
});
