// Menyiapkan www/ untuk Capacitor: salin public/, bundel js/app.js, tambahkan jembatan native.
import { build } from "esbuild";
import { cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import config from "../public/js/config.js";

rmSync("www", { recursive: true, force: true });
cpSync("public", "www", { recursive: true });
rmSync("www/js", { recursive: true, force: true });
const fb = config.storage === "firebase"; // mode Firebase: SDK dibundel dari npm, bukan gstatic
const rewrite = {
  name: "gstatic-to-npm",
  setup(b) {
    if (!fb) return;
    b.onResolve(
      { filter: /^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-(\w+)\.js$/ },
      (a) =>
        b.resolve("firebase/" + a.path.match(/firebase-(\w+)\.js$/)[1], {
          resolveDir: process.cwd(),
          kind: a.kind,
        }),
    );
  },
};
const common = {
  plugins: [rewrite],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
  logLevel: "info",
  external: ["https://*"],
};
let app = readFileSync("public/js/app.js", "utf8").replace(
  'navigator.serviceWorker && navigator.serviceWorker.register("sw.js")',
  "0",
);
writeFileSync("public/js/.app.native.tmp.js", app);
try {
  const opts = {
    ...common,
    entryPoints: ["public/js/.app.native.tmp.js"],
    outfile: "www/js/app.js",
  };
  await build(opts);
  writeFileSync(
    "scripts/.native.tmp.js",
    'import { App } from "@capacitor/app"; window.NATIVE = { App };',
  );
  await build({ ...common, entryPoints: ["scripts/.native.tmp.js"], outfile: "www/js/native.js" });
} finally {
  rmSync("public/js/.app.native.tmp.js", { force: true });
  rmSync("scripts/.native.tmp.js", { force: true });
}
const tag = '<script type="module" src="js/app.js">';
const html = readFileSync("www/index.html", "utf8");
if (!html.includes(tag)) throw new Error("tag script app.js tidak ditemukan");
writeFileSync(
  "www/index.html",
  html.replace(tag, '<script type="module" src="js/native.js"></script>' + tag),
);
console.log("OK: www/ siap. Lanjut: npx cap sync android");
