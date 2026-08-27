/**
 * 탐지 리포트에 응답을 남길 때 민감한 값이 그대로 찍히지 않도록 가린다.
 * user/info 응답에는 토큰뿐 아니라 이름, 나이, 이메일, 아이디 같은 개인정보가 함께 실린다.
 * 추출 대상인 profileNo 만 남기고 나머지는 가린다.
 */
const SECRET_KEY = /(token|auth|password|secret|credential|session|cookie|jwt|apikey|api_key)/i;

/** 부분 일치로 가릴 키. emailAddress, profileNm, userName 처럼 접미사가 붙는 경우를 잡는다. */
const PII_PART = /(name|nm|email|mail|addr|userid|user_id|nickname)/i;

/** 완전 일치로만 가릴 키. 부분 일치로 두면 message 가 age 에 걸리는 식의 오탐이 난다. */
const PII_EXACT = new Set([
  'age', 'birth', 'birthday', 'gender', 'sex', 'tel', 'phone', 'mobile', 'cash', 'ci', 'di',
]);

function isPii(key: string): boolean {
  return PII_EXACT.has(key.toLowerCase()) || PII_PART.test(key);
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '…';
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) out[k] = '***SECRET***';
      else if (isPii(k)) out[k] = '***PII***';
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 80) return `${value.slice(0, 40)}…`;
  return value;
}

/** 쿼리스트링에는 apiKey 등이 실린다. 경로만 남기고 파라미터 이름만 보여준다. */
export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const params = [...u.searchParams.keys()];
    return params.length ? `${u.origin}${u.pathname}?(${params.join(', ')})` : `${u.origin}${u.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

/**
 * 계정 식별자를 어느 계정인지 알아볼 정도로만 남기고 가린다.
 * 추출한 profileNo 가 어느 계정의 것인지 확인하려면 표시가 필요하지만,
 * 아이디나 이메일을 그대로 콘솔과 로그에 남길 이유는 없다.
 */
export function maskIdentifier(value: string): string {
  const [local, domain] = value.split('@');
  const masked =
    local.length <= 4
      ? `${local.slice(0, 1)}${'*'.repeat(Math.max(local.length - 1, 1))}`
      : `${local.slice(0, 2)}${'*'.repeat(local.length - 4)}${local.slice(-2)}`;
  return domain ? `${masked}@${domain}` : masked;
}
