import { chromium } from '@playwright/test';
import { extractProfileNo, loginAndExtract, type ProfileNoResult } from '../src/extractProfileNo';

/**
 * profileNo 를 사람이 읽기 좋은 한 줄로 출력한다.
 *
 *   --login  세션 캐시를 쓰지 않고 브라우저를 띄워 새로 로그인한다
 *   --raw    값만 출력한다. 다른 명령에 파이프할 때 쓴다
 */

/**
 * 쓰기 완료를 기다린다.
 * 실행기를 거치면 stdout 이 TTY 가 아니라 파이프가 되고, 파이프 쓰기는 비동기다.
 * 기다리지 않고 프로세스가 끝나면 출력이 중간에 잘린다.
 */
function write(stream: NodeJS.WriteStream, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(text, (err) => (err ? reject(err) : resolve()));
  });
}

function sentence(r: ProfileNoResult): string {
  return r.account
    ? `계정 ${r.account}의 profileNo는 ${r.value} 입니다.\n`
    : `profileNo는 ${r.value} 입니다.\n`;
}

async function main(): Promise<void> {
  const fresh = process.argv.includes('--login');
  const raw = process.argv.includes('--raw');
  const browser = await chromium.launch({ headless: !fresh });

  let result: ProfileNoResult;
  try {
    if (fresh) {
      await write(process.stderr, '브라우저에서 로그인해 주세요. 완료되면 자동으로 진행합니다.\n\n');
      result = await loginAndExtract(browser);
    } else {
      result = await extractProfileNo(browser);
    }
  } finally {
    await browser.close(); // 브라우저를 먼저 정리하고 그다음에 출력한다
  }

  await write(process.stdout, raw ? `${result.value}\n` : sentence(result));
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
