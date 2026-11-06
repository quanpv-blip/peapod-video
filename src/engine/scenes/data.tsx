// Cảnh dữ liệu: stat, cards, compare, chart, timeline, process, concept; và cảnh hình: photo, map.
// Mọi con số lấy từ fact (validate đã kiểm chứng cứ) và hiển thị qua formatNumber theo thị trường.
import { Box, Circle, Highlight, Underline } from '@remotion/rough-notation';
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { formatNumber } from '../../spec/numbers.ts';
import type { Scene } from '../../spec/schema.ts';
import { estimateEm, fitSize, numberFact, type SceneCtx } from '../context.ts';
import { Icon } from '../Icon.tsx';
import { isActive, pop, progress, rise } from '../motion.ts';
import { Body, Chip, NumberText, Panel } from '../parts.tsx';
import { MOTION, TONES, toneColor, TYPE, type Palette, type Tone } from '../theme.ts';

type Of<K extends Scene['kind']> = Extract<Scene, { kind: K }>;
const beatAt = (ctx: SceneCtx, i: number) => ctx.ps.beats[i] ?? 6 + i * 8;
const nextBeat = (ctx: SceneCtx, i: number) => ctx.ps.beats[i + 1];
const approxMark = (ctx: SceneCtx, approx: boolean) => (approx ? (ctx.ja ? '約' : '~') : '');

// ---------------- stat ----------------
export const StatScene: React.FC<{ s: Of<'stat'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout, lang } = ctx;
  const f = numberFact(ctx, s.factId);
  const shown = `${approxMark(ctx, f.approx)}${formatNumber(f.value, lang, { mode: s.display })}${f.unit}`;
  const size = fitSize(shown, layout.contentWidth, TYPE.display);
  const start = 8;
  const annStart = start + MOTION.countUp + 2;
  const prog = progress(frame, annStart, MOTION.annotate);
  const num = <NumberText value={f.value} lang={lang} mode={s.display} approx={f.approx} unit={f.unit} start={start} dur={MOTION.countUp} countUp={s.countUp} size={size} color={palette.text} unitColor={palette.accent} />;
  const ann = { progress: prog, color: palette.accent, strokeWidth: 6, roughness: 1.6, iterations: 2 } as const;
  return (
    <Body layout={layout}>
      <div style={{ ...rise(frame, 0), display: 'flex', alignItems: 'center', gap: 16, fontSize: TYPE.body, fontWeight: 600, color: palette.muted, marginBottom: s.annotation === 'none' ? 30 : 64 }}>
        {s.icon ? <Icon name={s.icon} size={46} color={palette.accent} strokeWidth={2.1} /> : null}
        {s.label}
      </div>
      <div style={{ alignSelf: 'flex-start', ...rise(frame, start - 4, 12, 20) }}>
        {s.annotation === 'circle' ? <Circle {...ann} padding={{ left: 24, right: 24, top: 10, bottom: 10 }}>{num}</Circle> : s.annotation === 'underline' ? <Underline {...ann}>{num}</Underline> : s.annotation === 'box' ? <Box {...ann} padding={{ left: 18, right: 18, top: 8, bottom: 8 }}>{num}</Box> : s.annotation === 'highlight' ? <Highlight {...ann} color={`${palette.accent}55`}>{num}</Highlight> : num}
      </div>
      {s.context ? <div style={{ ...rise(frame, annStart + 4, 14, 18), marginTop: 36, fontSize: TYPE.body * 0.9, color: palette.text, opacity: 0.85, lineHeight: 1.35 }}>{s.context}</div> : null}
    </Body>
  );
};

// ---------------- cards ----------------
export const CardsScene: React.FC<{ s: Of<'cards'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, layout, lang } = ctx;
  // Cột số rộng vừa đủ số dài nhất (ở cỡ tối đa 120px), phần còn lại cho nhãn: tránh nhãn tiếng Nhật xuống dòng lẻ chữ.
  const shownOf = (it: (typeof s.items)[number]) => { const f = numberFact(ctx, it.factId); return `${approxMark(ctx, f.approx)}${formatNumber(f.value, lang, { mode: s.display })}`; };
  // Mọi thẻ dùng CHUNG một cỡ số (số dài nhất quyết định) để các thẻ thẳng hàng, rồi cột số co đúng bằng độ rộng thật của số đó.
  const numSize = Math.min(...s.items.map((it) => fitSize(shownOf(it), layout.contentWidth * 0.42, 110, 56)));
  const longest = Math.max(...s.items.map((it) => estimateEm(shownOf(it))));
  const numW = Math.round(longest * numSize + 14);
  return (
    <Body layout={layout}>
      {s.items.map((it, i) => {
        const f = numberFact(ctx, it.factId);
        const tone: Tone = it.tone ?? TONES[i % TONES.length]!;
        const c = toneColor(palette, tone);
        const at = beatAt(ctx, i);
        const on = isActive(frame, at, nextBeat(ctx, i));
        const p = pop(frame, fps, at, 13);
        const size = numSize;
        return (
          <Panel key={i} palette={palette} color={c} glow={on ? 1 : 0.15} style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '30px 34px', marginBottom: 24, borderColor: c, opacity: Math.min(1, p * 1.3), transform: `translateX(${(1 - p) * -60}px) scale(${0.94 + 0.06 * p})` }}>
            <div style={{ width: numW, flex: 'none' }}>
              <NumberText value={f.value} lang={lang} mode={s.display} approx={f.approx} start={at + 2} dur={MOTION.countUp} size={size} color={c} unitColor={c} />
            </div>
            {/* Đơn vị chỉ thêm khi nhãn chưa nói tới (tránh "cửa hàng cửa hàng ..."). */}
            <div style={{ fontSize: TYPE.body * 0.82, fontWeight: 700, lineHeight: 1.3, color: palette.text }}>
              {f.unit && !it.label.toLowerCase().includes(f.unit.toLowerCase()) ? <span style={{ color: c }}>{f.unit} </span> : null}
              {it.label}
            </div>
          </Panel>
        );
      })}
    </Body>
  );
};

// ---------------- compare ----------------
export const CompareScene: React.FC<{ s: Of<'compare'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, layout, lang } = ctx;
  const facts = s.items.map((it) => numberFact(ctx, it.factId));
  const max = Math.max(...facts.map((f) => Math.abs(f.value)), 1);
  return (
    <Body layout={layout}>
      <div style={{ ...rise(frame, 0), fontSize: TYPE.body, fontWeight: 700, color: palette.muted, marginBottom: 36 }}>{s.title}</div>
      {s.items.map((it, i) => {
        const f = facts[i]!;
        const at = beatAt(ctx, i);
        const on = isActive(frame, at, nextBeat(ctx, i));
        const last = i === s.items.length - 1;
        const c = last ? palette.accent : palette.muted;
        const shown = `${approxMark(ctx, f.approx)}${formatNumber(f.value, lang, { mode: s.display })}${f.unit}`;
        const size = fitSize(shown, layout.contentWidth * 0.9, 120, 54);
        const barP = progress(frame, at + 4, 22);
        const p = pop(frame, fps, at, 14);
        return (
          <div key={i} style={{ opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * 30}px)` }}>
            <div style={{ fontSize: TYPE.small, fontWeight: 700, color: on ? palette.text : palette.muted, marginBottom: 6 }}>{it.label}</div>
            <NumberText value={f.value} lang={lang} mode={s.display} approx={f.approx} unit={f.unit} start={at + 2} dur={MOTION.countUp} size={size} color={last ? palette.text : palette.muted} unitColor={c} />
            {s.mode === 'bars' ? (
              <div style={{ marginTop: 14, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${(Math.abs(f.value) / max) * 100 * barP}%`, height: '100%', borderRadius: 11, background: c }} />
              </div>
            ) : null}
            {!last && s.mode === 'steps' ? (
              <div style={{ margin: '18px 0 22px 14px', display: 'flex', alignItems: 'center', gap: 16, opacity: progress(frame, beatAt(ctx, i + 1) - 6, 8) }}>
                <svg width={44} height={70} viewBox="0 0 44 70"><path d="M22 2 V60 M8 46 L22 64 L36 46" fill="none" stroke={palette.accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            ) : (
              <div style={{ height: 34 }} />
            )}
          </div>
        );
      })}
    </Body>
  );
};

// ---------------- chart ----------------
/** Bốn màu khác nhau: màu nhấn của chương có thể trùng màu vàng/tím/mint của bảng màu nên loại bản trùng. */
const distinctTones = (p: Palette): string[] => {
  const out: string[] = [];
  for (const c of [p.accent, p.violet, p.mint, p.gold, p.text]) if (!out.includes(c)) out.push(c);
  return out.slice(0, 4);
};
export const ChartScene: React.FC<{ s: Of<'chart'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout, lang } = ctx;
  const facts = s.series.map((it) => numberFact(ctx, it.factId));
  const max = Math.max(...facts.map((f) => f.value), 1);
  const H = 620;
  const W = layout.contentWidth;
  const n = s.series.length;
  if (s.type === 'donut') {
    const total = facts.reduce((a, f) => a + f.value, 0) || 1;
    let acc = 0;
    const R = 230;
    const C = 2 * Math.PI * R;
    return (
      <Body layout={layout}>
        <div style={{ ...rise(frame, 0), fontSize: TYPE.body, fontWeight: 700, color: palette.muted, marginBottom: 30 }}>{s.title}</div>
        <svg width={W} height={R * 2 + 140 + facts.length * 56} viewBox={`0 0 ${W} ${R * 2 + 140 + facts.length * 56}`}>
          {facts.map((f, i) => {
            const frac = f.value / total;
            const p = progress(frame, beatAt(ctx, i), 22);
            const seg = <circle key={i} cx={W / 2} cy={R + 30} r={R} fill="none" stroke={distinctTones(palette)[i % 4]!} strokeWidth={70} strokeDasharray={`${C * frac * p} ${C}`} strokeDashoffset={-C * acc} transform={`rotate(-90 ${W / 2} ${R + 30})`} />;
            acc += frac;
            return seg;
          })}
          {facts.map((f, i) => (
            <text key={`l${i}`} x={W / 2 - 300} y={R * 2 + 110 + i * 56} fill={palette.text} fontSize={34} fontWeight={700} opacity={progress(frame, beatAt(ctx, i) + 8, 10)}>
              <tspan fill={distinctTones(palette)[i % 4]!}>■ </tspan>
              {s.series[i]!.label}: {formatNumber(f.value, lang, { mode: s.display })}
              {f.unit && lang === 'vi' && !/^[%‰]/.test(f.unit) ? ' ' : ''}
              {f.unit}
            </text>
          ))}
        </svg>
      </Body>
    );
  }
  const bw = Math.min(150, (W - 40) / n - 30);
  const pts = facts.map((f, i) => [30 + i * ((W - 60) / Math.max(1, n - 1)), H - (f.value / max) * (H - 80)] as const);
  return (
    <Body layout={layout}>
      <div style={{ ...rise(frame, 0), fontSize: TYPE.body, fontWeight: 700, color: palette.muted, marginBottom: 30 }}>{s.title}</div>
      <svg width={W} height={H + 70} viewBox={`0 0 ${W} ${H + 70}`} style={{ overflow: 'visible' }}>
        <line x1={0} y1={H} x2={W} y2={H} stroke={palette.panelLine} strokeWidth={3} />
        {s.type === 'bar'
          ? facts.map((f, i) => {
              const p = progress(frame, beatAt(ctx, i), 20);
              const h = (f.value / max) * (H - 80) * p;
              const x = 20 + i * ((W - 40) / n) + ((W - 40) / n - bw) / 2;
              const c = i === n - 1 ? palette.accent : distinctTones(palette)[(i + 1) % 4]!;
              return (
                <g key={i}>
                  <rect x={x} y={H - h} width={bw} height={h} rx={14} fill={c} />
                  <text x={x + bw / 2} y={H - h - 18} textAnchor="middle" fill={palette.text} fontSize={34} fontWeight={800} opacity={p}>{formatNumber(f.value, lang, { mode: s.display })}</text>
                  <text x={x + bw / 2} y={H + 48} textAnchor="middle" fill={palette.muted} fontSize={28} fontWeight={600}>{s.series[i]!.label}</text>
                </g>
              );
            })
          : (() => {
              const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
              const len = pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]) : 0), 0);
              const p = progress(frame, beatAt(ctx, 0), Math.max(20, (beatAt(ctx, n - 1) - beatAt(ctx, 0)) + 12));
              return (
                <g>
                  <path d={d} fill="none" stroke={palette.accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
                  {pts.map(([x, y], i) => (
                    <g key={i} opacity={progress(frame, beatAt(ctx, i), 8)}>
                      <circle cx={x} cy={y} r={14} fill={palette.bg} stroke={palette.accent} strokeWidth={6} />
                      <text x={x} y={y - 30} textAnchor="middle" fill={palette.text} fontSize={32} fontWeight={800}>{formatNumber(facts[i]!.value, lang, { mode: s.display })}</text>
                      <text x={x} y={H + 48} textAnchor="middle" fill={palette.muted} fontSize={28}>{s.series[i]!.label}</text>
                    </g>
                  ))}
                </g>
              );
            })()}
      </svg>
      {facts[0]?.unit ? <div style={{ fontSize: TYPE.note, color: palette.faint }}>({facts[0].unit})</div> : null}
    </Body>
  );
};

// ---------------- timeline ----------------
export const TimelineScene: React.FC<{ s: Of<'timeline'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout } = ctx;
  const n = s.events.length;
  const rowH = Math.min(190, (layout.bodyBottom - layout.bodyTop - (s.title ? 80 : 0)) / n);
  const lastBeat = beatAt(ctx, n - 1);
  const lineP = interpolate(frame, [beatAt(ctx, 0), lastBeat + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Body layout={layout}>
      {s.title ? <div style={{ ...rise(frame, 0), fontSize: TYPE.body, fontWeight: 700, color: palette.muted, marginBottom: 30 }}>{s.title}</div> : null}
      <div style={{ position: 'relative', paddingLeft: 70 }}>
        <div style={{ position: 'absolute', left: 22, top: 24, width: 6, height: (n - 1) * rowH, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', left: 22, top: 24, width: 6, height: (n - 1) * rowH * lineP, borderRadius: 3, background: palette.accent, boxShadow: `0 0 18px ${palette.accent}` }} />
        {s.events.map((e, i) => {
          const at = beatAt(ctx, i);
          const on = isActive(frame, at, nextBeat(ctx, i));
          const shown = frame >= at;
          return (
            <div key={i} style={{ position: 'relative', height: rowH, ...rise(frame, at, 12, 22) }}>
              <div style={{ position: 'absolute', left: -62, top: 10, width: 34, height: 34, borderRadius: '50%', background: shown ? palette.accent : palette.bg, border: `5px solid ${palette.accent}`, boxShadow: on ? `0 0 26px ${palette.accent}` : 'none' }} />
              <Chip palette={palette} text={e.when} size={30} color={on ? palette.accent : palette.faint} />
              <div style={{ marginTop: 14, fontSize: TYPE.body * 0.92, fontWeight: 700, lineHeight: 1.3, color: on ? palette.text : palette.muted }}>{e.label}</div>
            </div>
          );
        })}
      </div>
    </Body>
  );
};

// ---------------- process ----------------
export const ProcessScene: React.FC<{ s: Of<'process'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout } = ctx;
  return (
    <Body layout={layout}>
      <div style={{ ...rise(frame, 0), fontSize: TYPE.body, fontWeight: 700, color: palette.muted, marginBottom: 30 }}>{s.title}</div>
      {s.steps.map((st, i) => {
        const at = beatAt(ctx, i);
        const on = isActive(frame, at, nextBeat(ctx, i));
        return (
          <div key={i}>
            <Panel palette={palette} glow={on ? 1 : 0} style={{ ...rise(frame, at), display: 'flex', alignItems: 'center', gap: 24, padding: '24px 28px' }}>
              <div style={{ width: 62, height: 62, flex: 'none', borderRadius: 16, display: 'grid', placeItems: 'center', background: on ? palette.accent : `${palette.accent}22`, color: on ? palette.accentInk : palette.accent, fontSize: 32, fontWeight: 800 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: TYPE.body * 0.92, fontWeight: 800, color: palette.text }}>{st.label}</div>
                {st.detail ? <div style={{ marginTop: 6, fontSize: TYPE.small * 0.9, color: palette.muted, lineHeight: 1.3 }}>{st.detail}</div> : null}
              </div>
            </Panel>
            {i < s.steps.length - 1 ? <div style={{ marginLeft: 58, width: 4, height: 28, background: `linear-gradient(${palette.accent}, transparent)`, opacity: progress(frame, beatAt(ctx, i + 1) - 4, 8) }} /> : null}
          </div>
        );
      })}
    </Body>
  );
};

// ---------------- concept ----------------
/** Các chip bay quanh một tâm, rồi gộp vào tâm khi câu kết quả hiện ra (giống "= 1 repo GitHub" của video mẫu). */
export const ConceptScene: React.FC<{ s: Of<'concept'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette, layout, ja } = ctx;
  const n = s.chips.length;
  const resultAt = beatAt(ctx, n);
  const merge = progress(frame, resultAt - 4, 16);
  const cx = layout.contentWidth / 2;
  const cy = (layout.bodyBottom - layout.bodyTop) / 2 - 40;
  const rx = layout.contentWidth * 0.36;
  const ry = 300;
  const t = frame / fps;
  const res = pop(frame, fps, resultAt + 6, 12);
  return (
    <Body layout={layout} align="start">
      <div style={{ position: 'relative', width: '100%', height: layout.bodyBottom - layout.bodyTop }}>
        {s.chips.map((c, i) => {
          const at = beatAt(ctx, i);
          const p = pop(frame, fps, at, 12);
          const ang = (i / n) * Math.PI * 2 - Math.PI / 2 + t * 0.18;
          const x = cx + Math.cos(ang) * rx * (1 - merge);
          const y = cy + Math.sin(ang) * ry * (1 - merge);
          const on = isActive(frame, at, nextBeat(ctx, i));
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${(0.6 + 0.4 * p) * (1 - 0.5 * merge)})`, opacity: Math.min(1, p * 1.4) * (1 - merge) }}>
              <Chip palette={palette} text={c.text} icon={c.icon} size={ja ? 30 : 34} color={on ? palette.accent : `${palette.accent}88`} />
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) scale(${res})`, opacity: res, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34, width: layout.contentWidth }}>
          <div style={{ width: 170, height: 170, borderRadius: 40, display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 30% 30%, ${palette.accent}66, ${palette.panel})`, border: `3px solid ${palette.accent}`, boxShadow: `0 0 80px ${palette.accent}88` }}>
            <Icon name={s.icon ?? 'bolt'} size={96} color={palette.text} strokeWidth={2} />
          </div>
          <div style={{ fontSize: fitSize(s.result, layout.contentWidth * 1.9, 64, 40), fontWeight: 800, lineHeight: 1.25, color: palette.accent, textAlign: 'center' }}>{s.result}</div>
        </div>
      </div>
    </Body>
  );
};

// ---------------- photo / map ----------------
const assetSrc = (src: string) => (/^https:\/\//.test(src) ? src : staticFile(src.replace(/^public\//, '')));

export const PhotoScene: React.FC<{ s: Of<'photo'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout, spec } = ctx;
  const a = spec.assets.find((x) => x.id === s.assetId)!;
  const dur = ctx.ps.durationInFrames;
  const k = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' });
  const tf = s.motion === 'zoom-in' ? `scale(${1 + 0.12 * k})` : s.motion === 'zoom-out' ? `scale(${1.12 - 0.12 * k})` : s.motion === 'pan-left' ? `scale(1.12) translateX(${4 - 8 * k}%)` : s.motion === 'pan-right' ? `scale(1.12) translateX(${-4 + 8 * k}%)` : 'none';
  const credit = s.credit && (a.license.attributionRequired || a.aiGenerated) ? [a.license.attributionText, a.aiGenerated ? (ctx.ja ? 'AI生成画像' : 'Ảnh do AI tạo') : ''].filter(Boolean).join(' · ') : '';
  return (
    <Body layout={layout}>
      <Panel palette={palette} style={{ ...rise(frame, 0, 16), overflow: 'hidden', height: (layout.bodyBottom - layout.bodyTop) * 0.82 }}>
        <Img src={assetSrc(a.src)} alt={a.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: tf }} />
      </Panel>
      {s.caption ? <div style={{ ...rise(frame, 10), marginTop: 22, fontSize: TYPE.small, color: palette.text }}>{s.caption}</div> : null}
      {credit ? <div style={{ marginTop: 10, fontSize: TYPE.note, color: palette.faint }}>{credit}</div> : null}
    </Body>
  );
};

export const MapScene: React.FC<{ s: Of<'map'>; ctx: SceneCtx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { palette, layout, spec } = ctx;
  const a = s.assetId ? spec.assets.find((x) => x.id === s.assetId) : undefined;
  return (
    <Body layout={layout}>
      <div style={{ ...rise(frame, 0), display: 'flex', alignItems: 'center', gap: 16, fontSize: TYPE.body, fontWeight: 700, color: palette.text, marginBottom: 26 }}>
        <Icon name="globe" size={50} color={palette.accent} />
        {s.label}
      </div>
      <Panel palette={palette} style={{ ...rise(frame, 6, 16), overflow: 'hidden', height: (layout.bodyBottom - layout.bodyTop) * 0.7 }}>
        {a ? <Img src={assetSrc(a.src)} alt={a.alt ?? s.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      </Panel>
      {s.markers.length ? (
        <div style={{ marginTop: 22, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {s.markers.map((m, i) => <div key={i} style={rise(frame, beatAt(ctx, i) + 10)}><Chip palette={palette} text={m.label} icon="globe" size={28} /></div>)}
        </div>
      ) : null}
    </Body>
  );
};
