import { Composition } from 'remotion';
import { PeaPodCard } from './PeaPodCard';
import { PeaPodReel, REEL_DURATION, REEL_FPS } from './PeaPodReel';
import { cardSchema, sampleCard } from './schema';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PeaPodCard" component={PeaPodCard} schema={cardSchema} defaultProps={sampleCard} width={1080} height={1350} fps={30} durationInFrames={90} />
    <Composition id="PeaPodReel" component={PeaPodReel} schema={cardSchema} defaultProps={sampleCard} width={1080} height={1920} fps={REEL_FPS} durationInFrames={REEL_DURATION} />
  </>
);
