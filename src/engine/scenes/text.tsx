// Cảnh chủ yếu là chữ: hook, quote, bullets, checklist, recap, alert, source, cta.
// Mọi thời điểm hiện phần tử lấy từ ctx.ps.beats (khớp lời đọc); không tự đặt số khung cứng cho nội dung.
import { Circle, Highlight } from '@remotion/rough-notation';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../../fonts.ts';
import type { Scene } from '../../spec/schema.ts';
import { tokenize } from '../captions.ts';
import { fitSize, UI_TEXT, type SceneCtx } from '../context.ts';
import { Icon } from '../Icon.tsx';
import { isActive, pop, progress, rise } from '../motion.ts';
import { Body, Chip, Panel } from '../parts.tsx';
import { TYPE } from '../theme.ts';

type Of<K extends Scene['kind']> = Extract<Scene, { kind: K }>;

/** Thời điểm hiện phần tử i và phần tử kế (để biết phần tử nào đang được nói tới). */
const beatAt = (ctx: SceneCtx, i: number) => ctx.ps.beats[i] ?? 6 + i * 8;
const nextBeat = (ctx: SceneCtx, i: number) => ctx.ps.beats[i + 1];

// ---------------- hook ----------------
export const HookScene: React.FC<{ s: Of<'hook'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, layout, lang, ja } = ctx;
  const words = tokenize(s.headline, lang);
  // Từ chứa chữ số (và từ đơn vị ngay sau nó) được tô màu nhấn: "50 độ C", "7700万件".
  const accent = new Set<number>();
  words.forEach((w, i) => {
    if (/\d/.test(w)) {
      accent.add(i);
      if (!ja && words[i + 1] && !/\d/.test(words[i + 1]!)) accent.add(i + 1);
      if (!ja && words[i + 2] && words[i + 1]?.length && words[i + 1]!.length <= 3) accent.add(i + 2);
    }
  });
  if (!accent.size) accent.add(words.length - 1);
  // Gộp các từ nhấn liền nhau thành một khối không ngắt dòng: "50 độ C" không bị rơi "C" xuống dòng riêng.
  const groups: { text: string; accent: boolean }[] = [];
  words.forEach((w, i) => {
    const last = groups.at(-1);
    if (last && last.accent && accent.has(i)) last.text += (ja ? '' : ' ') + w;
    else groups.push({ text: w, accent: accent.has(i) });
  });
  const size = ja ? 96 : 104;
  const orb = pop(frame, fps, 0, 12);
  return (
    <Body layout={layout}>
      {s.icon ? (
        <div style={{ alignSelf: 'flex-start', marginBottom: 56, transform: `scale(${orb})`, opacity: orb }}>
          <div style={{ width: 132, height: 132, borderRadius: 34, display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 30% 30%, ${palette.accent}55, ${palette.panel})`, border: `2px solid ${palette.accent}`, boxShadow: `0 0 60px ${palette.accent}66` }}>
            <Icon name={s.icon} size={74} color={palette.text} strokeWidth={2} />
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: ja ? 0 : '0 22px', fontSize: size, fontWeight: 800, lineHeight: 1.12, letterSpacing: ja ? 0 : -1.5, color: palette.text }}>
        {groups.map((g, i) => {
          const st = 4 + i * (ja ? 3 : 4);
          const p = pop(frame, fps, st, 13);
          return (
            <span key={i} style={{ display: 'inline-block', whiteSpace: 'nowrap', color: g.accent ? palette.accent : palette.text, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 40}px) scale(${0.86 + 0.14 * p})`, filter: p < 0.9 ? `blur(${(1 - p) * 10}px)` : undefined }}>
              {g.text}
            </span>
          );
        })}
      </div>
      {s.sub ? <div style={{ ...rise(frame, 10 + words.length * 4, 16), marginTop: 36, fontSize: TYPE.body, fontWeight: 500, color: palette.muted, lineHeight: 1.4 }}>{s.sub}</div> : null}
    </Body>
  );
};

// ---------------- quote ----------------
export const QuoteScene: React.FC<{ s: Of<'quote'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout, ja } = ctx;
  const f = ctx.facts.get(s.factId);
  const text = f && f.kind === 'quote' ? f.text : '';
  // tách lời trích thành đoạn thường và đoạn được nhấn (highlight phải là chuỗi con, validate đã kiểm)
  const parts: { t: string; hl: boolean }[] = [];
  let rest = text;
  for (const h of s.highlight) {
    const k = rest.indexOf(h);
    if (k < 0) continue;
    if (k > 0) parts.push({ t: rest.slice(0, k), hl: false });
    parts.push({ t: h, hl: true });
    rest = rest.slice(k + h.length);
  }
  if (rest) parts.push({ t: rest, hl: false });
  const size = text.length > 90 ? (ja ? 52 : 56) : ja ? 60 : 66;
  const hlProgress = progress(frame, 24, 22);
  return (
    <Body layout={layout}>
      <Panel palette={palette} style={{ padding: '64px 56px 52px', ...rise(frame, 2, 16) }}>
        <div style={{ position: 'absolute', top: -46, left: 40, fontSize: 180, lineHeight: 1, fontWeight: 800, color: palette.accent, fontFamily: 'Georgia, serif' }}>“</div>
        <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.42, color: palette.text }}>
          {parts.map((p, i) =>
            p.hl ? (
              <Highlight key={i} progress={hlProgress} color={`${palette.accent}66`} roughness={1.4} padding={{ left: 6, right: 6 }} iterations={1}>
                {p.t}
              </Highlight>
            ) : (
              <span key={i}>{p.t}</span>
            ),
          )}
        </div>
        <div style={{ ...rise(frame, 18, 14, 16), marginTop: 34, display: 'flex', alignItems: 'center', gap: 16, fontSize: TYPE.small, color: palette.muted }}>
          <span style={{ width: 40, height: 3, background: palette.accent }} />
          {s.attribution}
        </div>
      </Panel>
    </Body>
  );
};

// ---------------- bullets ----------------
export const BulletsScene: React.FC<{ s: Of<'bullets'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout } = ctx;
  return (
    <Body layout={layout}>
      <div style={{ ...rise(frame, 0), fontSize: TYPE.title * 0.85, fontWeight: 800, color: palette.text, marginBottom: 40 }}>{s.title}</div>
      {s.items.map((it, i) => {
        const at = beatAt(ctx, i);
        const on = isActive(frame, at, nextBeat(ctx, i));
        return (
          <Panel key={i} palette={palette} glow={on ? 1 : 0} style={{ ...rise(frame, at), display: 'flex', alignItems: 'center', gap: 26, padding: '28px 32px', marginBottom: 22 }}>
            <Icon name={it.icon ?? 'check'} size={52} color={palette.accent} strokeWidth={2.1} />
            <div style={{ fontSize: TYPE.body, fontWeight: 600, lineHeight: 1.35, color: palette.text }}>{it.text}</div>
          </Panel>
        );
      })}
    </Body>
  );
};

// ---------------- checklist ----------------
export const ChecklistScene: React.FC<{ s: Of<'checklist'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, layout } = ctx;
  const n = s.items.length;
  const rowH = Math.min(118, Math.floor((layout.bodyBottom - layout.bodyTop - 20) / n) - 14);
  return (
    <Body layout={layout}>
      {s.items.map((it, i) => {
        const at = beatAt(ctx, i);
        const done = frame >= at;
        const on = isActive(frame, at, nextBeat(ctx, i));
        const tick = pop(frame, fps, at, 11);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 14, opacity: 0.35 + 0.65 * Math.min(1, progress(frame, at - 6, 10) + (done ? 1 : 0)) }}>
            <div style={{ width: 54, height: 54, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', border: `3px solid ${done ? palette.accent : palette.faint}`, background: done ? palette.accent : 'transparent' }}>
              {done ? <Icon name="check" size={34} color={palette.accentInk} strokeWidth={3.4} style={{ transform: `scale(${tick})` }} /> : null}
            </div>
            <Panel palette={palette} glow={on ? 1 : 0} style={{ flex: 1, height: rowH, display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px', borderColor: done && !on ? `${palette.accent}66` : undefined }}>
              {it.icon ? <Icon name={it.icon} size={44} color={on ? palette.accent : palette.muted} strokeWidth={2.1} /> : null}
              <div style={{ fontSize: TYPE.body * 0.95, fontWeight: 700, color: palette.text }}>{it.text}</div>
            </Panel>
          </div>
        );
      })}
    </Body>
  );
};

// ---------------- recap ----------------
export const RecapScene: React.FC<{ s: Of<'recap'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout } = ctx;
  return (
    <Body layout={layout}>
      {s.items.map((it, i) => {
        const at = beatAt(ctx, i);
        return (
          <Panel key={i} palette={palette} glow={isActive(frame, at, nextBeat(ctx, i)) ? 0.8 : 0} style={{ ...rise(frame, at, 14, 28), display: 'flex', alignItems: 'center', gap: 24, padding: '30px 32px', marginBottom: 22, borderColor: `${palette.accent}55` }}>
            <div style={{ width: 64, height: 64, flex: 'none', borderRadius: 18, display: 'grid', placeItems: 'center', background: `${palette.accent}22` }}>
              <Icon name={it.icon ?? 'check'} size={40} color={palette.accent} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: TYPE.body, fontWeight: 700, lineHeight: 1.3, color: palette.text }}>{it.text}</div>
          </Panel>
        );
      })}
    </Body>
  );
};

// ---------------- alert ----------------
export const AlertScene: React.FC<{ s: Of<'alert'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout, lang } = ctx;
  const red = palette.danger;
  const pulse = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 1.6);
  return (
    <Body layout={layout}>
      <Panel palette={palette} color={red} glow={0.6 + 0.4 * pulse} style={{ ...rise(frame, 0, 16), padding: '44px 44px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: red, fontSize: TYPE.small, fontWeight: 800, letterSpacing: 3 }}>
          <Icon name="alert" size={46} color={red} strokeWidth={2.4} />
          {s.level === 'critical' ? UI_TEXT[lang].critical : UI_TEXT[lang].alert}
        </div>
        <div style={{ marginTop: 18, fontSize: TYPE.title, fontWeight: 800, lineHeight: 1.2, color: palette.text }}>{s.title}</div>
        <div style={{ marginTop: 26 }}>
          {s.points.map((pt, i) => {
            const at = beatAt(ctx, i);
            return (
              <div key={i} style={{ ...rise(frame, at, 12, 20), display: 'flex', gap: 18, alignItems: 'flex-start', marginTop: 16, fontSize: TYPE.body * 0.95, color: palette.text, lineHeight: 1.35 }}>
                <span style={{ marginTop: 18, width: 14, height: 14, flex: 'none', borderRadius: 3, background: red }} />
                {pt}
              </div>
            );
          })}
        </div>
      </Panel>
    </Body>
  );
};

// ---------------- source ----------------
/** Ngày ISO (2026-11-03) → cách viết người đọc quen: 03/11/2026 (vi), 2026年11月3日 (ja). Chuỗi khác giữ nguyên. */
export function displayDate(d: string, lang: 'vi' | 'ja'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.trim());
  if (!m) return d;
  return lang === 'ja' ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : `${m[3]}/${m[2]}/${m[1]}`;
}

/** Thẻ nguồn tự vẽ (giống cửa sổ trình duyệt), KHÔNG dùng ảnh chụp trang báo (xem peapod-assets-and-legal). */
export const SourceScene: React.FC<{ s: Of<'source'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout, lang, spec } = ctx;
  const src = spec.source;
  let host = src.url;
  try {
    host = new URL(src.url).hostname.replace(/^www\./, '');
  } catch {
    /* url đã qua zod; để nguyên nếu lỗi */
  }
  const raw = s.factId && ctx.facts.get(s.factId)?.kind === 'date' ? (ctx.facts.get(s.factId) as Extract<NonNullable<ReturnType<typeof ctx.facts.get>>, { kind: 'date' }>).raw : src.publishedAt;
  const date = raw ? displayDate(raw, lang) : raw;
  const ring = progress(frame, 22, 20);
  return (
    <Body layout={layout}>
      <div style={{ ...rise(frame, 0), fontSize: TYPE.title, fontWeight: 800, color: palette.text, marginBottom: 34, display: 'flex', alignItems: 'center', gap: 18 }}>
        <Icon name="link" size={56} color={palette.accent} strokeWidth={2.2} />
        {UI_TEXT[lang].source}
      </div>
      <Panel palette={palette} style={{ ...rise(frame, 6, 16), overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: `1px solid ${palette.panelLine}`, background: 'rgba(255,255,255,0.03)' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 16, height: 16, borderRadius: '50%', background: c }} />)}
          <div style={{ marginLeft: 16, flex: 1, padding: '8px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: palette.muted, fontSize: 24 }}>{host}</div>
        </div>
        <div style={{ padding: '36px 36px 40px' }}>
          <div style={{ display: 'inline-block', position: 'relative', fontSize: TYPE.small, fontWeight: 800, color: palette.accent }}>
            <Circle progress={ring} color={palette.accent} strokeWidth={4} roughness={1.2} padding={{ left: 14, right: 14, top: 8, bottom: 8 }}>
              {src.outlet}
            </Circle>
          </div>
          <div style={{ marginTop: 22, fontSize: fitSize(src.title, layout.contentWidth * 2.2, 46, 34), fontWeight: 700, lineHeight: 1.35, color: palette.text }}>{src.title}</div>
          <div style={{ marginTop: 22, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 26, color: palette.muted }}>
            {date ? <span>{UI_TEXT[lang].published}: {date}</span> : null}
            {src.author ? <span>{UI_TEXT[lang].by}: {src.author}</span> : null}
          </div>
        </div>
      </Panel>
    </Body>
  );
};

// ---------------- cta ----------------
export const CtaScene: React.FC<{ s: Of<'cta'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, layout, lang, ja } = ctx;
  const bubble = pop(frame, fps, 2, 13);
  const btn = pop(frame, fps, 22, 10);
  const glow = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2);
  return (
    <Body layout={layout}>
      <div style={{ position: 'relative', alignSelf: 'center', width: '100%', transform: `scale(${0.9 + 0.1 * bubble})`, opacity: bubble }}>
        <div style={{ background: '#ffffff', color: '#0f1222', borderRadius: 36, padding: '48px 46px', fontSize: ja ? 56 : 60, fontWeight: 800, lineHeight: 1.3, textAlign: 'center', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>{s.question}</div>
        <div style={{ position: 'absolute', left: 90, bottom: -26, width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: '30px solid #ffffff' }} />
      </div>
      <div style={{ ...rise(frame, 14, 14, 16), marginTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: TYPE.small, color: palette.muted }}>
        <Icon name="mail" size={36} color={palette.muted} />
        {UI_TEXT[lang].comment}
      </div>
      <div style={{ marginTop: 44, alignSelf: 'center', transform: `scale(${btn})` }}>
        <div style={{ padding: '24px 56px', borderRadius: 999, background: palette.accent, color: palette.accentInk, fontSize: TYPE.body, fontWeight: 800, boxShadow: `0 0 ${30 + 40 * glow}px ${palette.accent}aa` }}>{UI_TEXT[lang].follow}</div>
      </div>
      {s.hashtags.length ? (
        <div style={{ ...rise(frame, 30, 14, 14), marginTop: 40, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          {s.hashtags.map((h) => <Chip key={h} palette={palette} text={h} size={26} color={palette.faint} />)}
        </div>
      ) : null}
    </Body>
  );
};

/** Trạng thái vào cảnh mặc định (dùng chung cho cảnh không có hiệu ứng riêng). */
export const fadeIn = (frame: number) => interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
export { FONT_FAMILY };
