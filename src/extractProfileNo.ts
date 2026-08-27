import fs from 'node:fs';
import type { Browser, BrowserContext } from '@playwright/test';
import { config } from './config';
import { createLoggedInContext, LOGIN_PATH, storageStatePath, waitAndSaveSession } from './auth';
import {
  attachProfileNoCollector,
  findValuesByKey,
  resolveUniqueValue,
  type CollectError,
  type ProfileNoHit,
} from './profileNo';
import { maskIdentifier, maskUrl } from './redact';

export interface ProfileNoResult {
  /** 추출된 profileNo */
  value: string;
  /** 어느 계정의 값인지 확인하기 위한 식별자. 가려진 형태다. */
  account: string | null;
  /** 값이 실려 온 엔드포인트. 쿼리 값은 가려져 있다. */
  sources: string[];
  /** 세션을 재사용한 경우 그 세션이 저장된 시각. 새로 로그인했으면 null. */
  sessionSavedAt: Date | null;
  hits: ProfileNoHit[];
  errors: CollectError[];
}

export interface CollectResult {
  hits: ProfileNoHit[];
  errors: CollectError[];
}

/** 응답에서 계정 식별자를 찾아 가린 형태로 돌려준다. */
function findAccount(hits: ProfileNoHit[]): string | null {
  for (const key of ['emailAddress', 'userId', 'email']) {
    for (const hit of hits) {
      const [found] = findValuesByKey(hit.body, key);
      if (found) return maskIdentifier(found);
    }
  }
  return null;
}

/**
 * 이미 로그인된 컨텍스트에서 마이페이지에 진입해 응답을 모은다.
 * 값 판정은 하지 않는다. 탐지 단계는 값이 없거나 갈리는 상태도 그대로 봐야 하기 때문이다.
 */
export async function collectFromContext(
  context: BrowserContext,
  settleMs = 2_000,
): Promise<CollectResult> {
  const page = await context.newPage();
  const collector = attachProfileNoCollector(page); // 이동 전에 붙여야 응답을 놓치지 않는다

  await page.goto(config.myPagePath, { waitUntil: 'domcontentloaded' });
  await collector.waitForFirstHit().catch(() => undefined); // 없으면 호출부가 판단한다
  await page.waitForTimeout(settleMs); // 뒤따라오는 응답까지 모아 값이 갈리는지 본다

  return { hits: [...collector.hits], errors: [...collector.errors] };
}

/** 저장된 세션으로 응답을 모은다. 탐지 단계가 쓴다. */
export async function collectProfileNo(browser: Browser, settleMs = 2_000): Promise<CollectResult> {
  const context = await createLoggedInContext(browser);
  try {
    return await collectFromContext(context, settleMs);
  } finally {
    await context.close();
  }
}

function toResult(
  { hits, errors }: CollectResult,
  sessionSavedAt: Date | null,
): ProfileNoResult {
  return {
    value: resolveUniqueValue(hits.flatMap((h) => h.values)),
    account: findAccount(hits),
    sources: [...new Set(hits.map((h) => maskUrl(h.url)))],
    sessionSavedAt,
    hits,
    errors,
  };
}

/**
 * 저장된 세션으로 profileNo 를 추출한다.
 * 반복 실행이 빠르지만 값이 어느 시점 세션의 것인지 함께 알려야 한다.
 */
export async function extractProfileNo(browser: Browser): Promise<ProfileNoResult> {
  const statePath = storageStatePath();
  const savedAt = fs.existsSync(statePath) ? fs.statSync(statePath).mtime : null;
  const context = await createLoggedInContext(browser);
  try {
    return toResult(await collectFromContext(context), savedAt);
  } finally {
    await context.close();
  }
}

/**
 * 브라우저를 띄워 사람이 로그인하면 그 자리에서 추출한다.
 * 과제 문구('로그인 후 profileNo 를 추출')에 직접 대응하는 경로다.
 * 세션 캐시를 거치지 않으므로 계정을 바꿔 실행하면 바뀐 계정의 값이 나온다.
 */
export async function loginAndExtract(browser: Browser, timeoutMs = 5 * 60_000): Promise<ProfileNoResult> {
  const context = await browser.newContext({ baseURL: config.baseURL }); // 깨끗한 상태에서 시작
  try {
    const page = await context.newPage();
    await page.goto(config.baseURL + LOGIN_PATH, { waitUntil: 'domcontentloaded' });
    await waitAndSaveSession(context, page, timeoutMs);
    await page.close();
    return toResult(await collectFromContext(context), null);
  } finally {
    await context.close();
  }
}
