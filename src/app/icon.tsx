import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = {
  width: 64,
  height: 64,
};
export const contentType = "image/png";

const logoBase64 = readFileSync(join(process.cwd(), "public", "logo.png")).toString("base64");
const logoDataUrl = `data:image/png;base64,${logoBase64}`;

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <img
          src={logoDataUrl}
          alt="BetterNotes"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </div>
    ),
    size,
  );
}
