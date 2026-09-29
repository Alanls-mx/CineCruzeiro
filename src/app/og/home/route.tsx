import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { homeFeaturedMovie, backendUrl, loadHomeContent } from "@/services/homeContent";
import { cinemaBrand } from "@/utils/cinema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "")).replace(/\/+$/, "");

async function movieImageData(source: string | undefined): Promise<string | null> {
  if (!source) return null;

  let url: string;
  if (source.startsWith(`${basePath}/uploads/`)) {
    url = `${backendUrl}${source.slice(basePath.length)}`;
  } else if (source.startsWith("/uploads/")) {
    url = `${backendUrl}${source}`;
  } else if (/^https:\/\//i.test(source)) {
    const parsed = new URL(source);
    if (parsed.hostname !== "image.tmdb.org") return null;
    url = parsed.toString();
  } else {
    return null;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "force-cache" });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return null;
    if (Number(response.headers.get("content-length") || 0) > 8_000_000) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8_000_000) return null;
    const png = await sharp(bytes).rotate().resize({ width: 1200, withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET() {
  const brand = cinemaBrand();
  let featured = null;
  try {
    featured = homeFeaturedMovie(await loadHomeContent());
  } catch {
    // The brand-only image remains valid while the program feed is unavailable.
  }

  const [backdrop, poster, logo] = await Promise.all([
    movieImageData(featured?.backdropUrl),
    movieImageData(featured?.posterUrl),
    readFile(path.join(process.cwd(), "public/images/logo-display.webp")),
  ]);
  const logoData = `data:image/png;base64,${(await sharp(logo).png().toBuffer()).toString("base64")}`;
  const title = featured?.title || "O cinema da sua próxima história";
  const titleSize = title.length > 40 ? 60 : title.length > 24 ? 72 : 86;

  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: 1200, height: 630, overflow: "hidden", backgroundColor: "#060a12", color: "#ffffff", fontFamily: "Arial, sans-serif" }}>
      {backdrop && <img src={backdrop} alt="" style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", opacity: 0.42 }} />}
      <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(6,10,18,0.98) 0%, rgba(6,10,18,0.88) 48%, rgba(6,10,18,0.35) 100%)" }} />
      <div style={{ position: "absolute", left: 64, top: 58, display: "flex", flexDirection: "column", alignItems: "flex-start", width: poster ? 650 : 1000 }}>
        <img src={logoData} alt={brand.name} style={{ width: 292, height: 83, objectFit: "contain" }} />
        <div style={{ display: "flex", marginTop: 78, color: "#f5c518", fontSize: 24, fontWeight: 700 }}>EM DESTAQUE NO {brand.name.toLocaleUpperCase("pt-BR")}</div>
        <div style={{ display: "flex", marginTop: 20, maxWidth: poster ? 650 : 1000, fontSize: titleSize, fontWeight: 900, lineHeight: 1.04, overflowWrap: "break-word" }}>{title}</div>
        <div style={{ display: "flex", marginTop: 28, width: 100, height: 7, backgroundColor: "#f5c518" }} />
        <div style={{ display: "flex", marginTop: 22, color: "#d4deee", fontSize: 26, fontWeight: 600 }}>Confira a programação e escolha sua sessão</div>
      </div>
      {poster && <img src={poster} alt="" style={{ position: "absolute", right: 64, top: 55, width: 302, height: 453, objectFit: "cover", boxShadow: "0 22px 55px rgba(0,0,0,0.55)" }} />}
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 44, display: "flex", height: 2, backgroundColor: "rgba(255,255,255,0.18)" }} />
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=300" } }
  );
}
