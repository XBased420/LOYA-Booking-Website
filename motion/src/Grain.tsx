import { AbsoluteFill, useCurrentFrame } from "remotion";

/** Film grain. The turbulence SVG is rasterised once as a background image and
 *  then panned per frame — animating the filter itself would re-run it every
 *  frame and tank render speed. */
const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
       <filter id="n">
         <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
         <feColorMatrix type="saturate" values="0"/>
       </filter>
       <rect width="220" height="220" filter="url(#n)" opacity="0.5"/>
     </svg>`
  );

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.13 }) => {
  const frame = useCurrentFrame();
  // jump by a prime-ish stride so the pattern never visibly repeats
  const x = (frame * 37) % 220;
  const y = (frame * 61) % 220;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("${NOISE}")`,
        backgroundPosition: `${x}px ${y}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

/** Slow vignette + warm bloom so the ground never reads as flat black. */
export const Ground: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(120% 80% at 50% 40%, #1d1a22 0%, #131116 55%, #0b0a0d 100%)",
    }}
  />
);
