import fs from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { config } from './config';

export const LOGIN_PATH = '/account/login';

/**
 * 로그인 여부는 화면에서 판정한다.
 *
 * 쿠키 이름으로 판정하려 했으나 실패했다. token, session, auth 같은 패턴은
 * 애널리틱스와 OAuth 헬퍼 쿠키(_hackle_session_id, webOauthCancelUrl)에도 걸려
 * 로그인하지 않은 상태를 로그인으로 오판했다.
 *
 * 헤더의 '로그인' 링크는 비로그인일 때만 노출되므로 그 유무를 신호로 쓴다.
 * 다만 부재만으로 판정하면 헤더가 아직 그려지지 않은 상태도 로그인으로 오판한다.
 * 그래서 로그인 여부와 무관하게 항상 있는 카테고리 링크로 **헤더가 렌더되었는지 먼저 확인**하고,
 * 그 다음에 로그인 링크의 부재를 본다. 부재 증명 앞에 존재 증명을 둔다.
 */
const HEADER_MARKER = { role: 'link', name: '드라마' } as const;
const LOGIN_LINK = { role: 'link', name: '로그인' } as const;

export async function isLoggedInOnPage(page: Page): Promise<boolean> {
  if (!page.url().startsWith(config.baseURL)) return false; // 소셜 로그인 중 외부 도메인
  if (new URL(page.url()).pathname.startsWith('/account')) return false;

  // 헤더가 렌더되지 않았으면 판정을 보류한다. 이 확인이 없으면 로딩 중을 로그인으로 읽는다.
  const headerReady = await page
    .getByRole(HEADER_MARKER.role, { name: HEADER_MARKER.name, exact: true })
    .first()
    .isVisible()
    .catch(() => false);
  if (!headerReady) return false;

  const loginLinks = await page
    .getByRole(LOGIN_LINK.role, { name: LOGIN_LINK.name, exact: true })
    .count();
  return loginLinks === 0;
}

export function storageStatePath(): string {
  return path.resolve(config.storageStatePath);
}

/** 저장된 세션으로 컨텍스트를 연다. 세션이 없거나 만료되면 안내와 함께 실패한다. */
export async function createLoggedInContext(browser: Browser): Promise<BrowserContext> {
  const statePath = storageStatePath();

  if (!fs.existsSync(statePath)) {
    throw new Error(
      `저장된 세션이 없습니다. 먼저 'npm run auth' 로 로그인 세션을 만드세요.`,
    );
  }

  const context = await browser.newContext({ storageState: statePath, baseURL: config.baseURL });
  const probe = await context.newPage();
  await probe.goto(config.baseURL, { waitUntil: 'domcontentloaded' });
  await probe.waitForTimeout(2_000);
  const ok = await isLoggedInOnPage(probe);
  await probe.close();

  if (ok) return context;

  await context.close();
  fs.rmSync(statePath, { force: true });
  throw new Error(`저장된 세션이 만료되었습니다. 'npm run auth' 로 다시 로그인하세요.`);
}

/** 사람이 로그인할 때까지 기다렸다가 세션을 저장한다. */
export async function waitAndSaveSession(
  context: BrowserContext,
  page: Page,
  timeoutMs: number,
): Promise<string> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await isLoggedInOnPage(page).catch(() => false)) {
      await page.waitForTimeout(2_000); // 로그인 직후 쿠키가 모두 내려올 여유
      const statePath = storageStatePath();
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      await context.storageState({ path: statePath });
      return statePath;
    }
    await page.waitForTimeout(2_000);
  }
  throw new Error(`${timeoutMs / 1000}초 안에 로그인이 확인되지 않았습니다.`);
}
