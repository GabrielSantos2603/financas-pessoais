import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// O iOS aplica o arredondamento sozinho: entrega o quadrado inteiro, sem cantos.
export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={180} maskable />, size);
}
