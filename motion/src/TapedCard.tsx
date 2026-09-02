import React from "react";
import { theme } from "./theme";

const Tape: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div
    style={{
      position: "absolute",
      width: 132,
      height: 38,
      background:
        "linear-gradient(100deg, rgba(255,252,240,.42), rgba(232,224,203,.30))",
      boxShadow: "0 1px 6px rgba(0,0,0,.35)",
      ...style,
    }}
  />
);

export const TapedCard: React.FC<{
  width: number;
  height: number;
  tilt: number;
  caption: string;
  children: React.ReactNode;
}> = ({ width, height, tilt, caption, children }) => (
  <div
    style={{
      width,
      height: height + 86,
      background: theme.paper,
      border: `1px solid ${theme.paperEdge}`,
      padding: 16,
      paddingBottom: 0,
      transform: `rotate(${tilt}deg)`,
      boxShadow:
        "0 34px 70px rgba(0,0,0,.62), 0 2px 0 rgba(255,255,255,.28) inset",
      position: "relative",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        width: width - 32,
        height,
        overflow: "hidden",
        background: "#000",
        position: "relative",
      }}
    >
      {children}
    </div>
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        fontFamily: theme.type,
        fontSize: 25,
        letterSpacing: ".04em",
        color: "#4a4238",
      }}
    >
      {caption}
    </div>
    <Tape style={{ top: -19, left: -34, transform: "rotate(-7deg)" }} />
    <Tape style={{ bottom: 24, right: -38, transform: "rotate(5deg)" }} />
  </div>
);
