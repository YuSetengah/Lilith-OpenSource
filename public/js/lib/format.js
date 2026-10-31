/** Helper kecil untuk DOM dan format tampilan. */
export const $ = (id) => document.getElementById(id);
export const rp = (n) =>
  (n < 0 ? "−" : "") + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
export const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
};
export const p2 = (n) => String(n).padStart(2, "0");
export const dim = (y, m) => new Date(y, m + 1, 0).getDate(); // jumlah hari; m = 0..11
export const ymNow = () => {
  const d = new Date();
  return d.getFullYear() + "-" + p2(d.getMonth() + 1);
};
export const hm2 = (min) => p2(Math.floor(min / 60) % 24) + ":" + p2(min % 60);
