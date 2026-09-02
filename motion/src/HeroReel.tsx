import { AbsoluteFill, Sequence } from "remotion";
import { Grain, Ground } from "./Grain";
import { Shot } from "./Shot";
import { Title, Outro } from "./Cards";
import { SHOTS, SHOT_FRAMES, TITLE_FRAMES, OUTRO_FRAMES } from "./theme";

export const HeroReel: React.FC = () => (
  <AbsoluteFill>
    <Ground />
    <Sequence durationInFrames={TITLE_FRAMES}>
      <Title />
    </Sequence>
    {SHOTS.map((shot, i) => (
      <Sequence
        key={shot.src}
        from={TITLE_FRAMES + i * SHOT_FRAMES}
        durationInFrames={SHOT_FRAMES}
      >
        <Shot shot={shot} index={i} />
      </Sequence>
    ))}
    <Sequence
      from={TITLE_FRAMES + SHOTS.length * SHOT_FRAMES}
      durationInFrames={OUTRO_FRAMES}
    >
      <Outro />
    </Sequence>
    <Grain />
  </AbsoluteFill>
);
