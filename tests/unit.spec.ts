import { test, expect } from '@playwright/test';
import { findValuesByKey, resolveUniqueValue } from '../src/profileNo';
import { redact, maskUrl, maskIdentifier } from '../src/redact';

/**
 * 브라우저도 계정도 필요 없는 순수 로직 테스트.
 * 추출 실패를 디버깅할 때 원인이 파싱인지 네트워크인지 가르는 기준이 된다.
 */
test.describe('findValuesByKey', () => {
  test('최상위 키를 찾는다', () => {
    expect(findValuesByKey({ profileNo: '12345' }, 'profileNo')).toEqual(['12345']);
  });

  test('중첩 객체 안의 키를 찾는다', () => {
    const body = { result: { user: { profile: { profileNo: 987 } } } };
    expect(findValuesByKey(body, 'profileNo')).toEqual(['987']);
  });

  test('배열 안의 키를 모두 찾는다', () => {
    const body = { profiles: [{ profileNo: 'A' }, { profileNo: 'B' }] };
    expect(findValuesByKey(body, 'profileNo')).toEqual(['A', 'B']);
  });

  test('숫자를 문자열로 정규화한다', () => {
    expect(findValuesByKey({ profileNo: 0 }, 'profileNo')).toEqual(['0']);
  });

  test('객체나 null 값은 수집하지 않는다', () => {
    const body = { a: { profileNo: null }, b: { profileNo: { nested: 1 } }, c: { profileNo: 'ok' } };
    expect(findValuesByKey(body, 'profileNo')).toEqual(['ok']);
  });

  test('키가 없으면 빈 배열을 반환한다', () => {
    expect(findValuesByKey({ userNo: '1' }, 'profileNo')).toEqual([]);
  });

  test('순환 참조에서 무한 루프에 빠지지 않는다', () => {
    const node: Record<string, unknown> = { profileNo: 'X' };
    node.self = node;
    expect(findValuesByKey(node, 'profileNo')).toEqual(['X']);
  });
});

test.describe('redact', () => {
  test('토큰류 키를 가린다', () => {
    const out = redact({ accessToken: 'abc', profileNo: '123' }) as Record<string, unknown>;
    expect(out.accessToken).toBe('***SECRET***');
    expect(out.profileNo).toBe('123');
  });

  test('개인정보 키를 가린다', () => {
    const out = redact({ userName: '홍길동', age: 34, emailAddress: 'a@b.c', profileNo: '123' }) as Record<string, unknown>;
    expect(out.userName).toBe('***PII***');
    expect(out.age).toBe('***PII***');
    expect(out.emailAddress).toBe('***PII***');
    expect(out.profileNo, '추출 대상은 가리지 않는다').toBe('123');
  });

  test('message 같은 키를 개인정보로 오탐하지 않는다', () => {
    const out = redact({ message: 'OK', status: 200, profileNo: '1' }) as Record<string, unknown>;
    expect(out.message).toBe('OK');
    expect(out.status).toBe(200);
  });

  test('중첩 구조에서도 가린다', () => {
    const out = redact({ body: { profile: { profileNm: '기본', profileNo: '9' } } }) as any;
    expect(out.body.profile.profileNm).toBe('***PII***');
    expect(out.body.profile.profileNo).toBe('9');
  });

  test('긴 문자열을 잘라낸다', () => {
    const out = redact({ blob: 'x'.repeat(200) }) as Record<string, string>;
    expect(out.blob.length).toBeLessThan(60);
  });
});

test.describe('maskUrl', () => {
  test('쿼리 값을 감추고 파라미터 이름만 남긴다', () => {
    const out = maskUrl('https://api.tving.com/v2/user/info?apiKey=SECRET&osCode=X');
    expect(out).toBe('https://api.tving.com/v2/user/info?(apiKey, osCode)');
    expect(out).not.toContain('SECRET');
  });

  test('쿼리가 없으면 그대로 둔다', () => {
    expect(maskUrl('https://api.tving.com/v2/user/info')).toBe('https://api.tving.com/v2/user/info');
  });
});

test.describe('resolveUniqueValue', () => {
  test('값이 하나면 그대로 반환한다', () => {
    expect(resolveUniqueValue(['123456789'])).toBe('123456789');
  });

  test('같은 값이 여러 번 나와도 하나로 본다', () => {
    expect(resolveUniqueValue(['7', '7', '7'])).toBe('7');
  });

  test('값이 없으면 예외를 던진다', () => {
    expect(() => resolveUniqueValue([])).toThrow(/찾지 못했습니다/);
  });

  test('값이 갈리면 예외를 던지고 후보를 알려준다', () => {
    expect(() => resolveUniqueValue(['1', '2'])).toThrow(/2개로 갈립니다: 1, 2/);
  });
});

test.describe('maskIdentifier', () => {
  test('앞뒤 두 글자만 남긴다', () => {
    expect(maskIdentifier('abcdefghi')).toBe('ab*****hi');
  });

  test('이메일은 도메인을 남긴다', () => {
    expect(maskIdentifier('hongkildong@example.com')).toBe('ho*******ng@example.com');
  });

  test('짧은 값은 첫 글자만 남긴다', () => {
    expect(maskIdentifier('abcd')).toBe('a***');
  });

  test('원본이 그대로 남지 않는다', () => {
    expect(maskIdentifier('abcdefghi')).not.toContain('cdefg');
  });
});
