import { Composition } from 'remotion';
import { PeaPodCard } from './PeaPodCard';
import { cardSchema, sampleCard } from './schema';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PeaPodCard"
    component={PeaPodCard}
    schema={cardSchema}
    defaultProps={sampleCard}
    width={1080}
    height={1350}
    fps={30}
    durationInFrames={90}
  />
);
