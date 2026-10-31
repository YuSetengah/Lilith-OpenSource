// Uji asap (tanpa browser): jalankan aplikasi mode lokal di jsdom, catat transaksi, ekspor/impor.
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const out = await build({
  entryPoints: ["public/js/app.js"],
  bundle: true,
  write: false,
  format: "iife",
  external: ["https://*"],
  logLevel: "silent",
});
const html = readFileSync("public/index.html", "utf8").replace(
  /<script[^>]*src="js\/app\.js"[^>]*><\/script>/,
  "",
);
const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window,
  errors = [];
w.addEventListener("error", (e) => errors.push(e.message));
for (const n of ["getBBox", "getComputedTextLength"])
  w.SVGElement.prototype[n] = () => ({ x: 0, y: 0, width: 10, height: 10 });
w.matchMedia =
  w.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
w.scrollTo = () => {};
w.eval(out.outputFiles[0].text);
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const $ = (i) => w.document.getElementById(i);
await wait(150);

assert.equal($("app").hidden, false, "aplikasi harus langsung terbuka (tanpa login) di mode lokal");
assert.equal($("login").hidden, true);
$("typ").value = "in";
$("lbl").value = "Gaji";
$("amt").value = "5000000";
$("add").click();
await wait();
$("typ").value = "out";
$("lbl").value = "Makan";
$("amt").value = "45000";
$("add").click();
await wait();
assert.equal($("list").children.length, 2, "dua transaksi harus tampil");
await wait(1500); // angka dianimasikan (tween)
assert.match($("inc").textContent, /5\.000\.000/);
assert.match($("exp").textContent, /45\.000/);

$("bn").value = "Listrik";
$("ba").value = "350000";
$("bd").value = "5";
$("badd").click();
await wait();
assert.equal($("bl").children.length, 1, "satu tagihan harus tampil");

const backup = JSON.parse(w.localStorage.getItem("lilith:v1:tx"));
assert.equal(backup.length, 2);
assert.throws(() => JSON.parse('{"x"'), SyntaxError);
console.log(
  errors.length
    ? "Peringatan runtime (tidak fatal):\n" + errors.join("\n")
    : "Tidak ada error runtime.",
);
console.log("SMOKE TEST LULUS");
process.exit(0);
