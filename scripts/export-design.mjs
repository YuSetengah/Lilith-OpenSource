// Mengekspor tampilan LILITH ke JPG 1920x1080 + PSD berlapis (tiap elemen = 1 layer).
// Prasyarat: emulator berjalan (firebase emulators:start ...). Jalankan:
//   $env:EMAIL="uji@contoh.com"; $env:PASS="kataSandiUji"; node export-design.mjs
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { writePsd } from "ag-psd";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:5000",
  EMAIL = process.env.EMAIL,
  PASS = process.env.PASS;
const PROJECT = process.env.PROJECT || "demo-lilith",
  AUTH = "http://127.0.0.1:9099",
  FS = "http://127.0.0.1:8080";
if (!EMAIL || !PASS) throw new Error("Isi EMAIL dan PASS (akun UJI di emulator, bukan akun asli).");
const OUT = "export";
mkdirSync(OUT, { recursive: true });

async function seed() {
  // data contoh agar grafik dan daftar terisi (set SEED=0 untuk melewati)
  if (process.env.SEED === "0") return;
  try {
    const h = { "Content-Type": "application/json" },
      body = JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true });
    const q = `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:`;
    let j = await (await fetch(q + "signUp?key=x", { method: "POST", headers: h, body })).json();
    if (j.error)
      j = await (
        await fetch(q + "signInWithPassword?key=x", { method: "POST", headers: h, body })
      ).json();
    if (!j.idToken) throw new Error(JSON.stringify(j.error || j));
    const hd = { ...h, Authorization: "Bearer " + j.idToken };
    const base = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/users/${j.localId}`;
    const ym = new Date().toISOString().slice(0, 7),
      S = (s) => ({ stringValue: s }),
      N = (n) => ({ doubleValue: n }),
      I = (n) => ({ integerValue: String(n) });
    const post = async (col, fields) => {
      const r = await fetch(`${base}/${col}`, {
        method: "POST",
        headers: hd,
        body: JSON.stringify({ fields }),
      });
      if (!r.ok) throw new Error(col + ": " + (await r.text()));
    };
    const tx = [
      ["in", "Gaji", "Lain", 6000000, 1],
      ["out", "Makan siang", "Makan", 45000, 2],
      ["out", "Ojek", "Transport", 30000, 3],
      ["out", "Listrik", "Tagihan", 350000, 5],
      ["out", "Belanja bulanan", "Belanja", 600000, 8],
      ["out", "Obat", "Kesehatan", 120000, 10],
      ["out", "Makan malam", "Makan", 70000, 12],
      ["out", "Lain-lain", "Lain", 90000, 14],
      ["in", "Freelance", "Lain", 1500000, 15],
    ];
    for (const [type, label, cat, amount, day] of tx)
      await post("tx", {
        type: S(type),
        label: S(label),
        cat: S(cat),
        amount: N(amount),
        month: S(ym),
        t: N(Date.now()),
        day: I(day),
      });
    for (const [name, amount, day] of [
      ["Listrik", 350000, 5],
      ["Internet", 300000, 20],
      ["Air", 90000, 25],
    ])
      await post("bills", {
        name: S(name),
        amount: N(amount),
        day: I(day),
        paid: S(""),
        t: N(Date.now()),
      });
    console.log("Data contoh dibuat.");
  } catch (e) {
    console.warn("Seed dilewati:", e.message);
  }
}
await seed();

const browser = await chromium.launch({ channel: "chrome" }); // memakai Google Chrome yang sudah terpasang
const page = await (
  await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
).newPage();
const SEL = "nav,.pn,.hb,.hex,.cw,.chn,.blk,.bn2,.rb,.mdsp,.sub,h2,button,input,select,svg";
let n = 0;

async function shot(name) {
  const id = String(++n).padStart(2, "0") + "-" + name;
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(800);
  writeFileSync(`${OUT}/${id}.jpg`, await page.screenshot({ type: "jpeg", quality: 95 })); // 1920x1080
  writeFileSync(
    `${OUT}/${id}-full.jpg`,
    await page.screenshot({ type: "jpeg", quality: 95, fullPage: true }),
  ); // seluruh halaman
  const bg = PNG.sync.read(await page.screenshot({ type: "png", fullPage: true }));
  const boxes = [];
  for (const el of await page.locator(SEL).all()) {
    // ukur semua posisi dulu (scroll 0), baru ambil gambar
    if (boxes.length >= 80 || !(await el.isVisible())) continue;
    const b = await el.evaluate((e) => {
      const r = e.getBoundingClientRect();
      const t = e.id
        ? "#" + e.id
        : typeof e.className === "string" && e.className
          ? "." + e.className.split(" ")[0]
          : e.tagName.toLowerCase();
      return {
        x: r.left + scrollX,
        y: r.top + scrollY,
        w: r.width,
        h: r.height,
        name: (
          t +
          " " +
          (e.innerText || e.getAttribute("aria-label") || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 24)
        ).trim(),
      };
    });
    if (b.w >= 8 && b.h >= 8 && b.x >= 0 && b.y >= 0 && b.w <= bg.width) boxes.push({ el, ...b });
  }
  const layers = [];
  for (const b of boxes)
    try {
      const p = PNG.sync.read(await b.el.screenshot({ type: "png" }));
      layers.push({
        name: b.name,
        left: Math.round(b.x),
        top: Math.round(b.y),
        imageData: { width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) },
      });
    } catch {}
  layers.sort(
    (a, c) => c.imageData.width * c.imageData.height - a.imageData.width * a.imageData.height,
  ); // besar di bawah, kecil di atas
  const whole = { width: bg.width, height: bg.height, data: new Uint8ClampedArray(bg.data) };
  const psd = {
    width: bg.width,
    height: bg.height,
    imageData: whole,
    children: [
      { name: "Background (screenshot)", left: 0, top: 0, imageData: whole },
      { name: "Elemen", opened: true, children: layers },
    ],
  };
  writeFileSync(`${OUT}/${id}.psd`, Buffer.from(writePsd(psd, { generateThumbnail: false })));
  console.log(id, "→", layers.length, "layer");
}

await page.goto(BASE);
await page.waitForSelector("#login:not([hidden])");
await shot("login");
await page.fill("#em", EMAIL);
await page.fill("#pw", PASS);
await page.click("#go");
await page.waitForSelector("#app:not([hidden])", { timeout: 15000 });
await shot("home");
await page.click("#mb");
await shot("menu-samping");
await page.click("#scrim");
for (const v of ["dash", "rekap", "log", "magi", "bill", "sholat", "pelacak", "alarm"]) {
  await page.click("#mb");
  await page.click(`#menu [data-v="${v}"]`);
  await page.waitForTimeout(v === "magi" ? 3500 : 1200);
  await shot(v);
}
await page.click("#mb");
await page.click("#sb");
await shot("setting");
try {
  await page.click("#tst");
  await page.waitForSelector("#alert:not([hidden])", { timeout: 3000 });
  await shot("alarm-aktif");
  await page.click("#stop");
} catch {}
await page.evaluate(() => {
  const m = document.getElementById("modal");
  if (m) m.hidden = true;
});
await page.goto(BASE + "/peta.html");
await page.waitForTimeout(4000);
await shot("peta");
await browser.close();
console.log("Selesai. Hasil ada di folder:", OUT);
