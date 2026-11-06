// Kiểm tra một hoặc nhiều VideoSpec. Chạy: npm run spec:validate -- samples/spec-vn-freezers.json
// Không đối số: kiểm tra mọi samples/spec-*.json. Thoát mã 1 nếu có lỗi mức 'error'.
import { readdirSync, readFileSync } from 'node:fs';
import { formatIssues, validateSpec } from '../src/spec/validate.ts';

const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('samples').filter((f) => /^spec-.*\.json$/.test(f)).map((f) => `samples/${f}`);
let failed = 0;
for (const f of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    console.log(`✕ ${f}: không đọc được JSON (${(e as Error).message})`);
    failed++;
    continue;
  }
  const r = validateSpec(data);
  const errs = r.issues.filter((i) => i.level === 'error').length;
  const warns = r.issues.filter((i) => i.level === 'warn').length;
  console.log(`${r.ok ? '✓' : '✕'} ${f}: ${errs} lỗi, ${warns} cảnh báo${r.estimatedSeconds ? `, ước tính ${r.estimatedSeconds}s` : ''}`);
  if (r.issues.length) console.log(formatIssues(r.issues).replace(/^/gm, '    '));
  if (!r.ok) failed++;
}
process.exit(failed ? 1 : 0);
