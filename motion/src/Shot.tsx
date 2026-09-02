import {
  AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile,
  useCurrentFrame,
} from "remotion";
import { TapedCard } from "./TapedCard";
import { theme, type Shot as ShotData } from "./theme";

export const Shot: React.FC<{ shot: ShotData; index: number }> = ({
  shot, index,
}) => {
  const frame = useCurrentFrame();

  // settle in, then drift almost imperceptibly for the rest of the shot
  const enter = interpolate(frame, [0, 9], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const drift = interpolate(frame, [0, 64], [1.045, 1.0], {
    extrapolateRight: "clamp",
  });
  const lift = interpolate(enter, [0, 1], [26, 0]);

  const portrait = shot.orientation === "portrait";
  const w = portrait ? 512 : 1080;
  const h = portrait ? 910 : 608;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* the clip again, blown up and blurred, so the ground carries its colour */}
      <AbsoluteFill style={{ opacity: 0.26 * enter }}>
        <OffthreadVideo
          src={staticFile(shot.src)}
          muted
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            filter: "blur(58px) saturate(1.5)", transform: "scale(1.18)",
          }}
        />
      </AbsoluteFill>

      <div style={{ opacity: enter, transform: `translateY(${lift}px) scale(${drift})` }}>
        <TapedCard width={w} height={h} tilt={shot.tilt} caption={shot.caption}>
          <OffthreadVideo
            src={staticFile(shot.src)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </TapedCard>
      </div>

      {/* act label, pinned to the frame rather than the card */}
      <div
        style={{
          position: "absolute", left: 92, top: 78,
          fontFamily: theme.type, fontSize: 21, letterSpacing: ".34em",
          color: theme.paper, opacity: 0.72 * enter,
        }}
      >
        {shot.kicker}
      </div>
      <div
        style={{
          position: "absolute", left: 92, top: 112,
          width: interpolate(enter, [0, 1], [0, 116]),
          height: 2, background: theme.violet, opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute", right: 92, bottom: 78,
          fontFamily: theme.type, fontSize: 19, letterSpacing: ".22em",
          color: theme.paper, opacity: 0.4 * enter,
        }}
      >
        {String(index + 1).padStart(2, "0")} / 09
      </div>
    </AbsoluteFill>
  );
};
