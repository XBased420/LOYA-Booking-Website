import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { theme } from "./theme";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const b = interpolate(frame, [14, 34], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const out = interpolate(frame, [44, 52], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center", justifyContent: "center",
        opacity: out, flexDirection: "column", gap: 26,
      }}
    >
      <div
        style={{
          fontFamily: theme.display, fontSize: 108, fontWeight: 700,
          letterSpacing: "-.02em", color: theme.paper,
          opacity: a, transform: `translateY(${interpolate(a, [0, 1], [22, 0])}px)`,
        }}
      >
        ELIZABETH LOYA
      </div>
      <div style={{ width: interpolate(a, [0, 1], [0, 420]), height: 2, background: theme.violet }} />
      <div
        style={{
          fontFamily: theme.type, fontSize: 27, letterSpacing: ".30em",
          color: theme.paper, opacity: b * 0.82,
        }}
      >
        AUDIO ENGINEER · DJ · DALLAS
      </div>
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [2, 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
      <div style={{ fontFamily: theme.display, fontSize: 92, fontWeight: 700, letterSpacing: "-.02em", color: theme.paper, opacity: a }}>
        ELIZABETH LOYA
      </div>
      <div
        style={{
          fontFamily: theme.type, fontSize: 25, letterSpacing: ".26em",
          color: theme.ink, background: theme.gold,
          padding: "16px 34px", opacity: a,
          transform: `translateY(${interpolate(a, [0, 1], [16, 0])}px) rotate(-1.2deg)`,
        }}
      >
        BOOK A SESSION
      </div>
    </AbsoluteFill>
  );
};
