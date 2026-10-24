#!/usr/bin/env node
// 관리자 비밀번호 해시 생성기
// 사용법:  npm run hash-password            (프롬프트에 비밀번호 입력, 화면에 표시되지 않음)
//         npm run hash-password -- '비밀번호'  (인자로 전달 — 셸 기록에 남으니 비추천)
import bcrypt from 'bcryptjs';
import readline from 'node:readline';

async function askHidden(question) {
  if (!process.stdin.isTTY) {
    // 파이프 입력 지원: echo 'pw' | npm run hash-password
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    return Buffer.concat(chunks).toString('utf8').trim();
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else rl.output.write('*'.repeat(s.length ? 1 : 0));
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

let pw = process.argv[2];
if (!pw) {
  pw = await askHidden('관리자 비밀번호: ');
  if (process.stdin.isTTY) {
    const again = await askHidden('한 번 더 입력: ');
    if (again !== pw) {
      console.error('✖ 두 비밀번호가 다릅니다.');
      process.exit(1);
    }
  }
}
if (!pw || pw.length < 10) {
  console.error('✖ 비밀번호는 10자 이상으로 정해주세요.');
  process.exit(1);
}

const hash = await bcrypt.hash(pw, 12);
const b64 = 'b64:' + Buffer.from(hash, 'utf8').toString('base64');

console.log('\n아래 값을 ADMIN_PASSWORD_HASH 에 그대로 넣으세요 (Netlify 환경변수 / 로컬 .env 공통):\n');
console.log(b64);
console.log('\n(참고: 원본 bcrypt 해시 =', hash, ')\n');
