import { Composition } from "remotion";
import { HeroReel } from "./HeroReel";
import { TOTAL } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="HeroReel"
    component={HeroReel}
    durationInFrames={TOTAL}
    fps={30}
    width={1920}
    height={1080}
  />
);
