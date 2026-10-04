import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/app-icon";

export const dynamic = "force-static";

const FILES = {
  "icon-192.png": { size: 192, maskable: false },
  "icon-512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

/** Ícones PNG do manifest (o Android/Chrome exige PNG 192 e 512; o "maskable" é recortado pelo sistema). */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = FILES[file as keyof typeof FILES];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIconArt size={spec.size} maskable={spec.maskable} />, { width: spec.size, height: spec.size });
}
