// Kiểm tra thiết lập ban đầu của Video Engine. Chạy: npm run doctor
// Không in giá trị bí mật. Không tải gì từ Internet, không sửa gì. Thoát mã 1 nếu có mục ❌.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildJsonSchema } from './manifest.ts';
import { CATALOG_COMPLETE, ENV_VARS, FONTS, OFFICIAL_SKILLS, PLANNED_PACKAGES, PROJECT_SKILLS, REMOTION_VERSION, REQUIRED_PACKAGES, SCENE_CATALOG } from '../src/spec/manifest.ts';
import { validateSpec } from '../src/spec/validate.ts';

type Level = 'ok' | 'warn' | 'fail';
const rows: { level: Level; name: string; detail: string }[] = [];
const add = (level: Level, name: string, detail = '') => rows.push({ level, name, detail });
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

// 1. Node
const major = Number(process.versions.node.split('.')[0]);
add(major >= 22 ? 'ok' : 'fail', 'Node.js', `${process.versions.node} (cần ≥ 22)`);

// 2. Phiên bản Remotion thống nhất
const pkg = readJson('package.json');
const declared = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
const remotionDeps = Object.keys(declared).filter((k) => k === 'remotion' || k.startsWith('@remotion/'));
const wrongDecl = remotionDeps.filter((k) => declared[k] !== REMOTION_VERSION);
add(wrongDecl.length ? 'fail' : 'ok', `Gói Remotion khai báo đúng ${REMOTION_VERSION}`, wrongDecl.length ? `lệch: ${wrongDecl.map((k) => `${k}@${declared[k]}`).join(', ')}` : `${remotionDeps.length} gói`);
const wrongInst: string[] = [];
for (const k of remotionDeps) {
  try {
    const v = readJson(join('node_modules', k, 'package.json')).version;
    if (v !== REMOTION_VERSION) wrongInst.push(`${k}@${v}`);
  } catch {
    wrongInst.push(`${k} (chưa cài)`);
  }
}
add(wrongInst.length ? 'fail' : 'ok', 'Gói Remotion đã cài đúng phiên bản', wrongInst.join(', '));
const missing = REQUIRED_PACKAGES.filter((k) => !declared[k]);
add(missing.length ? 'fail' : 'ok', 'Đủ gói bắt buộc cho phần đã làm', missing.length ? `thiếu: ${missing.join(', ')}` : `${REQUIRED_PACKAGES.length} gói`);
const planned = PLANNED_PACKAGES.filter((p) => !declared[p.name]).length;
add('warn', 'Gói dành cho đợt sau (chưa cài, đúng kế hoạch)', `${planned}/${PLANNED_PACKAGES.length}: ${PLANNED_PACKAGES.map((p) => p.name.replace('@remotion/', '')).join(', ')}`);

// 3. Font
const noFont = FONTS.filter((f) => !existsSync(join('public/fonts', f)));
add(noFont.length ? 'fail' : 'ok', 'Font Việt và Nhật trong public/fonts', noFont.join(', '));

// 4. Biến môi trường (chỉ kiểm có/không, không in giá trị)
const env: Record<string, string> = {};
if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) env[m[1]!] = m[2]!; }
add(existsSync('.env') ? 'ok' : 'fail', 'Tệp .env', existsSync('.env') ? '' : 'chưa có; xem .env.example hoặc README');
const tok = env.RENDER_TOKEN ?? '';
add(tok.length >= 32 ? 'ok' : 'fail', 'RENDER_TOKEN đủ dài (≥ 32 ký tự)', tok ? `${tok.length} ký tự` : 'chưa đặt');
const optional = ENV_VARS.filter((v) => v.where.startsWith('peapod-video') && !v.required && !env[v.name]).map((v) => v.name);
add('warn', 'Biến tùy chọn chưa đặt', optional.join(', ') || 'không');

// 5. ffmpeg đi kèm Remotion
try {
  const out = execSync('npx remotion ffmpeg -version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  add('ok', 'ffmpeg của Remotion chạy được', out.split('\n')[0]!.slice(0, 60));
} catch (e) {
  add('fail', 'ffmpeg của Remotion', (e as Error).message.slice(0, 80));
}

// 6. Kỹ năng
const skillDir = (base: string, name: string) => existsSync(join(base, name, 'SKILL.md'));
const noOfficial = OFFICIAL_SKILLS.filter((s) => !skillDir('.agents/skills', s));
const noProject = PROJECT_SKILLS.filter((s) => !skillDir('.agents/skills', s));
add(noOfficial.length ? 'fail' : 'ok', 'Kỹ năng Remotion chính thức', noOfficial.length ? `thiếu: ${noOfficial.join(', ')}` : `${OFFICIAL_SKILLS.length} kỹ năng`);
add(noProject.length ? 'fail' : 'ok', 'Kỹ năng riêng của dự án', noProject.length ? `thiếu: ${noProject.join(', ')}` : `${PROJECT_SKILLS.length} kỹ năng`);
const notLinked = [...OFFICIAL_SKILLS, ...PROJECT_SKILLS].filter((s) => !existsSync(join('.claude/skills', s, 'SKILL.md')));
add(notLinked.length ? 'fail' : 'ok', 'Kỹ năng đã liên kết vào .claude/skills (Claude Code đọc được)', notLinked.length ? `chưa liên kết: ${notLinked.join(', ')}` : '');

// 7. Hợp đồng đầu vào
const specFiles = existsSync('samples') ? readdirSync('samples').filter((f) => /^spec-.*\.json$/.test(f)) : [];
const badSpecs = specFiles.filter((f) => !validateSpec(readJson(join('samples', f))).ok);
add(!specFiles.length || badSpecs.length ? 'fail' : 'ok', 'Mẫu VideoSpec đạt kiểm tra', badSpecs.length ? `lỗi: ${badSpecs.join(', ')}` : `${specFiles.length} mẫu`);
let schemaOk = false;
try { schemaOk = readFileSync('schemas/video-spec.schema.json', 'utf8') === buildJsonSchema(); } catch { /* chưa có */ }
add(schemaOk ? 'ok' : 'fail', 'schemas/video-spec.schema.json khớp mã nguồn', schemaOk ? '' : 'chạy npm run manifest');
add(CATALOG_COMPLETE ? 'ok' : 'fail', 'Danh mục cảnh phủ đủ mọi loại trong schema', `${SCENE_CATALOG.length} loại`);
const verified = SCENE_CATALOG.filter((s) => s.status === 'verified');
const unseen = SCENE_CATALOG.filter((s) => s.status === 'built').map((s) => s.kind);
const specOnly = SCENE_CATALOG.filter((s) => s.status === 'spec').map((s) => s.kind);
add(
  unseen.length || specOnly.length ? 'warn' : 'ok',
  'Thành phần cảnh đã dựng và xem ảnh',
  `${verified.length}/${SCENE_CATALOG.length}` + (unseen.length ? ` · có mã, chưa xem ảnh: ${unseen.join(', ')}` : '') + (specOnly.length ? ` · chưa có mã: ${specOnly.join(', ')}` : ''),
);

// 8. Dịch vụ dựng (tùy chọn)
const port = env.RENDER_PORT || '4100';
try {
  const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2500) });
  const j = (await res.json()) as { ready?: boolean };
  add(j.ready ? 'ok' : 'warn', `Dịch vụ dựng ở cổng ${port}`, j.ready ? 'sẵn sàng' : 'đang khởi động');
} catch {
  add('warn', `Dịch vụ dựng ở cổng ${port}`, 'không chạy (chạy bằng npm run serve nếu cần dựng)');
}

// 9. Thư mục .env không bị theo dõi
try {
  const ig = readFileSync('.gitignore', 'utf8');
  add(/^\.env$/m.test(ig) ? 'ok' : 'fail', '.env nằm trong .gitignore', '');
} catch { add('warn', '.gitignore', 'không đọc được'); }

const icon: Record<Level, string> = { ok: '✓', warn: '!', fail: '✕' };
for (const r of rows) console.log(`${icon[r.level]} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
const fails = rows.filter((r) => r.level === 'fail').length;
console.log(`\n${fails ? `✕ ${fails} mục cần sửa` : '✓ Thiết lập đạt'} · ${rows.filter((r) => r.level === 'warn').length} lưu ý`);
process.exit(fails ? 1 : 0);
