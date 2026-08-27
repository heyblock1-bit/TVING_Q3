import type { Page, Response } from '@playwright/test';
import { config } from './config';

export interface CollectError {
  url: string;
  reason: string;
}

export interface ProfileNoHit {
  url: string;
  status: number;
  values: string[];
  body: unknown;
}

/**
 * 중첩 구조 어디에 있든 키 이름으로 값을 찾는다.
 * 엔드포인트 URL 이나 응답 스키마를 하드코딩하지 않기 위한 장치다.
 * API 경로가 바뀌어도 키 이름이 유지되면 그대로 동작한다.
 */
export function findValuesByKey(node: unknown, key: string): string[] {
  const found: string[] = [];
  const seen = new WeakSet<object>();

  const walk = (n: unknown): void => {
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n === null || typeof n !== 'object') return;
    if (seen.has(n)) return; // 순환 참조 방어
    seen.add(n);

    for (const [k, v] of Object.entries(n)) {
      if (k === key && (typeof v === 'string' || typeof v === 'number')) {
        found.push(String(v));
      }
      walk(v);
    }
  };

  walk(node);
  return found;
}

/** 본문을 읽을 가치가 있는 응답인지 먼저 거른다. 전 응답을 파싱하면 느리고 불안정하다. */
async function readJsonBody(res: Response): Promise<unknown | undefined> {
  if (!res.ok()) return undefined;
  if (res.status() === 204) return undefined;

  const contentType = res.headers()['content-type'] ?? '';
  if (!contentType.includes('json')) return undefined;

  try {
    return await res.json();
  } catch {
    // 스트리밍 응답이나 이미 소비된 본문은 읽을 수 없다. 조용히 넘긴다.
    return undefined;
  }
}

/**
 * 페이지에 응답 수집기를 붙인다.
 * 반드시 페이지 이동 전에 호출해야 한다. 이후 발생하는 응답만 수집된다.
 */
export function attachProfileNoCollector(page: Page, key: string = config.targetKey) {
  const hits: ProfileNoHit[] = [];
  const errors: CollectError[] = [];
  const waiters: Array<(hit: ProfileNoHit) => void> = [];

  /**
   * async 이벤트 핸들러에서 던져진 예외는 아무도 받지 않는다.
   * 그대로 두면 unhandled rejection 이 되고 응답을 놓친 사실조차 드러나지 않는다.
   * 검증 도구가 조용히 실패하는 것을 막기 위해 전체를 감싸고 실패를 기록한다.
   */
  page.on('response', (res) => {
    void (async () => {
      try {
        const body = await readJsonBody(res);
        if (body === undefined) return;

        const values = findValuesByKey(body, key);
        if (values.length === 0) return;

        const hit: ProfileNoHit = { url: res.url(), status: res.status(), values, body };
        hits.push(hit);
        waiters.splice(0).forEach((resolve) => resolve(hit));
      } catch (err) {
        errors.push({ url: res.url(), reason: err instanceof Error ? err.message : String(err) });
      }
    })();
  });

  return {
    /** 지금까지 수집된 전체 히트. 탐지 단계에서 쓴다. */
    hits,

    /** 수집 중 삼켜진 예외. 비어 있지 않으면 놓친 응답이 있다는 뜻이다. */
    errors,

    /** 첫 히트를 기다린다. 이미 수집됐으면 즉시 반환한다. */
    async waitForFirstHit(timeoutMs = 20_000): Promise<ProfileNoHit> {
      if (hits.length > 0) return hits[0];

      return new Promise<ProfileNoHit>((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waiters.indexOf(onHit);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(
            new Error(
              `${timeoutMs}ms 안에 '${key}' 를 담은 JSON 응답을 찾지 못했습니다. ` +
                `npm run discover 로 실제 응답을 먼저 확인하세요.`,
            ),
          );
        }, timeoutMs);

        const onHit = (hit: ProfileNoHit) => {
          clearTimeout(timer);
          resolve(hit);
        };
        waiters.push(onHit);
      });
    },

    /** 수집된 값 중 유일한 값을 반환한다. 값이 갈리면 판정을 보류한다. */
    resolveUnique(): string {
      return resolveUniqueValue(hits.flatMap((h) => h.values), key);
    },
  };
}

/**
 * 수집된 값들에서 유일한 값을 고른다.
 * 브라우저가 필요 없는 순수 함수로 분리해 단위 테스트로 검증한다.
 */
export function resolveUniqueValue(values: string[], key: string = config.targetKey): string {
  const unique = [...new Set(values)];
  if (unique.length === 0) {
    throw new Error(`'${key}' 값을 찾지 못했습니다.`);
  }
  if (unique.length > 1) {
    throw new Error(
      `'${key}' 값이 ${unique.length}개로 갈립니다: ${unique.join(', ')}. ` +
        `프로필이 여러 개인 계정일 수 있으므로 어느 값을 쓸지 정의가 필요합니다.`,
    );
  }
  return unique[0];
}
