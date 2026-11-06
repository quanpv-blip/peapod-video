// Phụ đề karaoke theo số đo video mẫu (ba-team/docs/20-video-style-bible.md §3): một dòng, tối đa 5 từ, ngắt theo dấu câu;
// từ đang đọc có ô màu nhấn bo nhỏ, chữ tối trên ô; ô nhảy sang từ kế gần như tức thì (không trượt); sau dòng có nền tối mép mềm.
// Đặt ở ~77% chiều cao (mẫu đặt 87%, nằm trong vùng giao diện Reels che).
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY } from '../fonts.ts';
import type { CaptionPage } from './captions.ts';
import { TYPE, type Layout, type Palette } from './theme.ts';

export const KaraokeCaptions: React.FC<{ pages: CaptionPage[]; layout: Layout; palette: Palette; style: 'karaoke' | 'tiktok' | 'subtitle'; highlight?: string; ja: boolean }> = ({ pages, layout, palette, style, highlight, ja }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;
  const hl = highlight ?? palette.accent;
  const size = ja ? TYPE.caption * 0.94 : TYPE.caption;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: layout.captionY - size * 0.75, display: 'flex', justifyContent: 'center', fontFamily: FONT_FAMILY }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          maxWidth: layout.width * 0.86,
          padding: `${size * 0.18}px ${size * 0.5}px`,
          borderRadius: size,
          // nền tối mép mềm sau dòng chữ, đủ đọc trên nền sáng mà không thành khung đặc
          background: 'radial-gradient(closest-side, rgba(6,8,14,0.72), rgba(6,8,14,0.45) 70%, transparent)',
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1.3,
          color: palette.text,
          whiteSpace: 'nowrap',
        }}
      >
        {page.tokens.map((tok, i) => {
          const active = style !== 'subtitle' && ms >= tok.startMs && ms < tok.endMs;
          const word = tok.text.trim();
          const space = !ja && tok.text.startsWith(' ') && i > 0;
          const boxed = active && style === 'karaoke';
          return (
            <span key={`${tok.startMs}-${i}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {space ? <span style={{ width: size * 0.26 }} /> : null}
              <span
                style={{
                  // Tiếng Nhật không có dấu cách giữa các từ: đệm nhỏ để chữ liền mạch, ô nền vẫn ôm đủ từ đang đọc.
                  padding: `0 ${size * (ja ? 0.05 : 0.13)}px`,
                  borderRadius: size * 0.12,
                  background: boxed ? hl : 'transparent',
                  color: boxed ? palette.accentInk : active && style === 'tiktok' ? hl : palette.text,
                  textShadow: boxed ? 'none' : '0 2px 10px rgba(0,0,0,0.8)',
                }}
              >
                {word}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
