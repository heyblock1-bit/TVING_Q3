import { test, expect } from '@playwright/test';
import { extractProfileNo } from '../src/extractProfileNo';

/**
 * 2단계 추출.
 * src/extractProfileNo.ts 의 추출 함수를 그대로 호출해 결과를 검증한다.
 * 조립을 테스트가 다시 하지 않으므로, 여기서 통과하면 CLI 로 실행해도 같은 결과가 나온다.
 */
test('로그인 후 마이페이지 응답에서 profileNo 를 추출한다', async ({ browser }) => {
  const { value, account, sources, errors } = await extractProfileNo(browser);

  /**
   * toBeTruthy 만으로는 'undefined' 나 'error' 같은 문자열도 통과한다.
   * 관측된 형식(숫자 문자열)을 단언해야 값이 아닌 것이 값처럼 흘러드는 것을 잡는다.
   */
  expect(value, 'profileNo 는 숫자로만 이루어진 문자열이어야 한다').toMatch(/^\d+$/);
  expect(sources.length, '출처가 최소 하나는 있어야 한다').toBeGreaterThan(0);
  expect(errors, '수집 중 삼켜진 예외가 없어야 한다').toEqual([]);

  console.log(account ? `계정 ${account}의 profileNo는 ${value} 입니다.` : `profileNo는 ${value} 입니다.`);
});
