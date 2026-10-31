// Membuat ikon launcher Android dari asset/icon-512.png dan asset/icon-maskable-512.png
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const RES = "android/app/src/main/res",
  BG = "#000000",
  SAFE = 0.82; // SAFE: skala logo di dalam ikon adaptif
const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const adaptive = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const d of Object.keys(legacy)) {
  const dir = `${RES}/mipmap-${d}`;
  mkdirSync(dir, { recursive: true });
  const s = legacy[d];
  const sq = await sharp("asset/icon-512.png").resize(s, s).png().toBuffer();
  writeFileSync(`${dir}/ic_launcher.png`, sq);
  const circle = Buffer.from(
    `<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`,
  );
  writeFileSync(
    `${dir}/ic_launcher_round.png`,
    await sharp(sq)
      .composite([{ input: circle, blend: "dest-in" }])
      .png()
      .toBuffer(),
  );
  const f = adaptive[d],
    inner = Math.round(f * SAFE);
  const art = await sharp("asset/icon-maskable-512.png").resize(inner, inner).png().toBuffer();
  writeFileSync(
    `${dir}/ic_launcher_foreground.png`,
    await sharp({
      create: { width: f, height: f, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: art, gravity: "center" }])
      .png()
      .toBuffer(),
  );
}
mkdirSync(`${RES}/values`, { recursive: true });
writeFileSync(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
);
mkdirSync(`${RES}/mipmap-anydpi-v26`, { recursive: true });
const ad = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, ad);
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, ad);
console.log("Ikon launcher dibuat.");
