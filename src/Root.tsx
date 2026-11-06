import { Composition } from 'remotion';
import { calculateSpecMetadata, SpecVideo, type SpecVideoProps } from './engine/SpecVideo';
import { PeaPodCard } from './PeaPodCard';
import { PeaPodReel, REEL_FPS, reelFrames } from './PeaPodReel';
import { cardSchema, reelSchema, sampleCard, sampleReel } from './schema';
import sampleVn from '../samples/spec-vn-freezers.json';
import sampleJp from '../samples/spec-jp-arara.json';

// Hai composition của đường VideoSpec chỉ khác dữ liệu mặc định (mẫu VN/JP) để xem trước trong Studio.
// Dữ liệu từng bài KHÔNG sửa ở Studio (saveDefaultProps ghi vào mã nguồn): truyền qua inputProps khi dựng.
const vnProps: SpecVideoProps = { spec: sampleVn as SpecVideoProps['spec'], audio: {} };
const jpProps: SpecVideoProps = { spec: sampleJp as SpecVideoProps['spec'], audio: {} };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="SpecVideo" component={SpecVideo} defaultProps={vnProps} width={1080} height={1920} fps={30} durationInFrames={900} calculateMetadata={calculateSpecMetadata} />
    <Composition id="SpecVideoJP" component={SpecVideo} defaultProps={jpProps} width={1080} height={1920} fps={30} durationInFrames={900} calculateMetadata={calculateSpecMetadata} />
    <Composition id="PeaPodCard" component={PeaPodCard} schema={cardSchema} defaultProps={sampleCard} width={1080} height={1350} fps={30} durationInFrames={90} />
    <Composition
      id="PeaPodReel"
      component={PeaPodReel}
      schema={reelSchema}
      defaultProps={sampleReel}
      width={1080}
      height={1920}
      fps={REEL_FPS}
      durationInFrames={reelFrames(null)}
      // Độ dài video theo lời đọc khi có voiceSeconds; không có thì 15 giây.
      calculateMetadata={({ props }) => ({ durationInFrames: reelFrames(props.voiceSeconds) })}
    />
  </>
);
