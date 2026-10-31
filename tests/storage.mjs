// Uji adapter lokal: tulis, ekspor, impor, dan penolakan data tidak valid.
import assert from "node:assert/strict";
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};
globalThis.addEventListener = () => {};
const { createLocalStore } = await import("../public/js/storage/local.js");
const s = createLocalStore();
const ym = "2026-10";
await s.addTx({
  type: "out",
  label: "Makan",
  cat: "Makan",
  amount: 45000,
  month: ym,
  day: 2,
  t: 1,
});
await s.addBill({ name: "Listrik", amount: 350000, day: 5, paid: "", t: 1 });
let bills;
s.watchBills((l) => (bills = l));
await s.payBill(bills[0].id, ym, {
  type: "out",
  label: "Listrik",
  cat: "Tagihan",
  amount: 350000,
  month: ym,
  day: 5,
  t: 2,
});
let tx;
s.watchTx(ym, (l) => (tx = l));
assert.equal(tx.length, 2);
assert.equal(bills[0].paid, ym);

const dump = s.exportData();
mem.clear();
const s2 = createLocalStore();
s2.importData(dump);
let tx2;
s2.watchTx(ym, (l) => (tx2 = l));
assert.equal(tx2.length, 2);
assert.throws(() => s2.importData('{"app":"x"}'));
assert.throws(() =>
  s2.importData(
    JSON.stringify({
      app: "lilith",
      version: 1,
      data: { tx: [{ type: "hack", label: "<x>", amount: -1 }], bills: [] },
    }),
  ),
);
console.log("STORAGE TEST LULUS");
