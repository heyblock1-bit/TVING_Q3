import { test, expect } from '@playwright/test';
import { config } from '../src/config';
import { collectProfileNo } from '../src/extractProfileNo';
import { redact, maskUrl } from '../src/redact';

/**
 * 1단계 탐지.
 * profileNo 가 어느 응답에 실려 오는지 모르는 상태에서 URL 을 추측해 하드코딩하면
 * 처음부터 틀린 코드가 된다. 먼저 실제 트래픽을 관찰해 위치를 확정한다.
 */
test('마이페이지 진입 시 profileNo 를 담은 응답을 찾는다', async ({ browser }) => {
  const { hits, errors } = await collectProfileNo(browser);

  for (const hit of hits) {
    console.log('─'.repeat(72));
    console.log(`URL    : ${maskUrl(hit.url)}`);
    console.log(`STATUS : ${hit.status}`);
    console.log(`VALUES : ${hit.values.join(', ')}`);
    console.log(`BODY   : ${JSON.stringify(redact(hit.body), null, 2)}`);
  }

  console.log('─'.repeat(72));
  console.log(`총 ${hits.length}개 응답에서 발견`);
  if (errors.length > 0) {
    console.log(`수집 중 건너뛴 응답 ${errors.length}건:`);
    errors.forEach((e) => console.log(`  ${maskUrl(e.url)} : ${e.reason}`));
  }

  /**
   * 탐지 결과를 단언한다.
   * 찾은 것이 없는데 통과로 남으면, 검증하지 않은 것을 검증했다고 기록하는 셈이다.
   */
  expect(
    hits.length,
    `'${config.targetKey}' 를 담은 JSON 응답이 없습니다. 마이페이지 경로(TVING_MYPAGE_PATH)나 키 이름을 확인하세요.`,
  ).toBeGreaterThan(0);
});
