/** Adapter lokal: data di localStorage browser. Tanpa server dan tanpa login. */
const NS = "lilith:v1:";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_ROWS = 20000;

export function createLocalStore() {
  const listeners = new Map();
  const emit = (k) => (listeners.get(k) || []).forEach((f) => f());
  const on = (k, f) => {
    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k).add(f);
    return () => listeners.get(k).delete(f);
  };
  const read = (k, d) => {
    try {
      const v = JSON.parse(localStorage.getItem(NS + k));
      return v == null ? d : v;
    } catch {
      return d;
    }
  };
  const write = (k, v) => {
    localStorage.setItem(NS + k, JSON.stringify(v));
    emit(k);
  };
  const uid = () =>
    (globalThis.crypto && crypto.randomUUID && crypto.randomUUID()) ||
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const run = (fn) =>
    new Promise((ok, no) => {
      try {
        ok(fn());
      } catch (e) {
        no(e);
      }
    });
  addEventListener("storage", (e) => e.key && e.key.startsWith(NS) && emit(e.key.slice(NS.length)));

  const watch = (key, get, cb) => {
    const f = () => cb(get());
    f();
    return on(key, f);
  };
  const clean = {
    tx: (x) =>
      x &&
      (x.type === "in" || x.type === "out") &&
      typeof x.label === "string" &&
      x.label &&
      x.label.length <= 60 &&
      typeof x.cat === "string" &&
      x.cat.length <= 20 &&
      typeof x.amount === "number" &&
      x.amount > 0 &&
      x.amount < 1e12 &&
      MONTH.test(x.month) &&
      typeof x.t === "number" &&
      (x.day == null || (Number.isInteger(x.day) && x.day >= 1 && x.day <= 31))
        ? {
            id: String(x.id || uid()),
            type: x.type,
            label: x.label,
            cat: x.cat,
            amount: x.amount,
            month: x.month,
            t: x.t,
            ...(x.day ? { day: x.day } : {}),
          }
        : null,
    bill: (x) =>
      x &&
      typeof x.name === "string" &&
      x.name &&
      x.name.length <= 40 &&
      typeof x.amount === "number" &&
      x.amount > 0 &&
      x.amount < 1e12 &&
      Number.isInteger(x.day) &&
      x.day >= 1 &&
      x.day <= 31 &&
      typeof x.t === "number" &&
      (x.paid === "" || MONTH.test(x.paid))
        ? {
            id: String(x.id || uid()),
            name: x.name,
            amount: x.amount,
            day: x.day,
            paid: x.paid,
            t: x.t,
          }
        : null,
  };

  return {
    mode: "local",
    requiresLogin: false,
    onAuth(cb) {
      const t = setTimeout(() => cb({ uid: "local" }), 0);
      return () => clearTimeout(t);
    },
    signIn: () => Promise.reject(new Error("mode lokal tidak memakai login")),
    signOut: () => Promise.resolve(),

    watchTx: (month, cb) =>
      watch(
        "tx",
        () => read("tx", []).filter((x) => x.month === month),
        (l) => cb(l, false),
      ),
    addTx: (tx) => run(() => write("tx", [...read("tx", []), { id: uid(), ...tx }])),
    deleteTx: (id) =>
      run(() =>
        write(
          "tx",
          read("tx", []).filter((x) => x.id !== id),
        ),
      ),

    watchBills: (cb) => watch("bills", () => read("bills", []), cb),
    addBill: (b) => run(() => write("bills", [...read("bills", []), { id: uid(), ...b }])),
    deleteBill: (id) =>
      run(() =>
        write(
          "bills",
          read("bills", []).filter((x) => x.id !== id),
        ),
      ),
    payBill: (id, ym, tx) =>
      run(() => {
        const oldTx = read("tx", []);
        write("tx", [...oldTx, { id: uid(), ...tx }]);
        try {
          write(
            "bills",
            read("bills", []).map((b) => (b.id === id ? { ...b, paid: ym } : b)),
          );
        } catch (e) {
          write("tx", oldTx); // batalkan agar tetap konsisten
          throw e;
        }
      }),

    watchPrayer: (month, cb) =>
      watch(
        "prayer",
        () =>
          Object.fromEntries(Object.entries(read("prayer", {})).filter(([, v]) => v.m === month)),
        cb,
      ),
    setPrayer: (id, patch) =>
      run(() =>
        write("prayer", {
          ...read("prayer", {}),
          [id]: { ...read("prayer", {})[id], ...patch, t: Date.now() },
        }),
      ),

    watchCfg: (cb) => watch("cfg", () => read("cfg", null), cb),
    setCfg: (patch) => run(() => write("cfg", { ...read("cfg", {}), ...patch, t: Date.now() })),

    exportData: () =>
      JSON.stringify({
        app: "lilith",
        version: 1,
        data: {
          tx: read("tx", []),
          bills: read("bills", []),
          prayer: read("prayer", {}),
          cfg: read("cfg", {}),
        },
      }),
    importData(text) {
      const j = JSON.parse(text);
      if (!j || j.app !== "lilith" || j.version !== 1 || !j.data)
        throw new Error("format tidak dikenal");
      const d = j.data;
      if (
        !Array.isArray(d.tx) ||
        !Array.isArray(d.bills) ||
        d.tx.length > MAX_ROWS ||
        d.bills.length > MAX_ROWS
      )
        throw new Error("data tidak valid");
      const tx = d.tx.map(clean.tx),
        bills = d.bills.map(clean.bill);
      if (tx.includes(null) || bills.includes(null)) throw new Error("ada baris tidak valid");
      const cfg = d.cfg && typeof d.cfg === "object" ? d.cfg : {};
      write("tx", tx);
      write("bills", bills);
      write("prayer", d.prayer && typeof d.prayer === "object" ? d.prayer : {});
      write("cfg", {
        ...(Array.isArray(cfg.al) ? { al: cfg.al.slice(0, 50) } : {}),
        ...(cfg.pr && typeof cfg.pr === "object" ? { pr: cfg.pr } : {}),
        ...(cfg.loc && typeof cfg.loc.lat === "number" && typeof cfg.loc.lon === "number"
          ? { loc: { lat: cfg.loc.lat, lon: cfg.loc.lon } }
          : {}),
        t: Date.now(),
      });
    },
  };
}
