import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        background: "#16a34a",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: 120,
        fontWeight: 700,
        fontFamily: "system-ui",
        borderRadius: 36,
      }}
    >
      L
    </div>,
    size,
  );
}
