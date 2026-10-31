/**
 * LILITH — entry utama. Urutan: impor → state → navigasi/menu → keuangan → tagihan →
 * sholat & alarm → rekap → MAGI → pelacak → cadangan data → tombol Back (native).
 * Penyimpanan data lewat `store` (js/storage/): mode lokal (bawaan) atau Firebase (opsional).
 */
import config from "./config.js";
import { $, rp, el, p2, dim, ymNow, hm2 } from "./lib/format.js";
import { pray } from "./lib/prayer-times.js";
import { createStore } from "./storage/index.js";

const store = createStore(config);
const CATS = ["Makan", "Transport", "Tagihan", "Belanja", "Kesehatan", "Lain"];
let uid,
  unsub,
  items = [],
  muted = new Set(),
  defi = "",
  bills = [],
  unsubB,
  nt = new Set(),
  sir,
  ac,
  snd = false,
  st = { inc: 0, out: 0, by: {} };
try {
  snd = localStorage.getItem("snd") === "1";
} catch {}
$("snd").textContent = snd ? "SIRENE: ON" : "SIRENE: OFF";
$("cat").replaceChildren(...CATS.map((c) => new Option(c, c)));
const n = new Date();
$("mon").value = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0");

const V = ["home", "dash", "log", "magi", "bill", "sholat", "alarm", "rekap", "pelacak"];
const show = (v) => {
  V.forEach((k) => ($("v-" + k).hidden = k !== v));
  setMenu(0);
  scrollTo(0, 0);
  v === "rekap" && drawRekap();
  v === "magi" && magiGo();
  v === "pelacak" && ((lastPS = ""), drawPel());
};
document.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => show(b.dataset.v)));
$("mb").onclick = () => setMenu($("menu").hidden);
$("sb").onclick = () => {
  setMenu(0);
  $("modal").hidden = false;
};
$("mc").onclick = () => ($("modal").hidden = true);
document
  .querySelectorAll("[data-go]")
  .forEach((b) => (b.onclick = () => (location.href = b.dataset.go)));
$("hs").onclick = () => ($("modal").hidden = false);
$("lo").onclick = () => {
  setMenu(0);
  store.signOut();
};
setInterval(
  () =>
    ($("jam").textContent =
      new Date()
        .toLocaleTimeString("id-ID", { hour12: false, timeZone: "Asia/Jakarta" })
        .replace(/\./g, ":") + " WIB"),
  1000,
);

function sirene(on, soft) {
  if (!on) {
    sir && sir.stop();
    sir = null;
    return;
  }
  if (sir || !ac) return;
  const o = ac.createOscillator(),
    g = ac.createGain(),
    l = ac.createOscillator(),
    lg = ac.createGain();
  o.type = soft ? "sine" : "sawtooth";
  o.frequency.value = soft ? 520 : 700;
  l.frequency.value = soft ? 0.5 : 1.2;
  lg.gain.value = soft ? 90 : 250;
  g.gain.value = soft ? 0.08 : 0.05;
  l.connect(lg).connect(o.frequency);
  o.connect(g).connect(ac.destination);
  o.start();
  l.start();
  sir = {
    stop() {
      o.stop();
      l.stop();
    },
  };
}
const wake = () => {
  ac = ac || new AudioContext();
  ac.resume();
};
$("snd").onclick = () => {
  snd = !snd;
  wake();
  try {
    localStorage.setItem("snd", snd ? "1" : "0");
  } catch {}
  $("snd").textContent = snd ? "SIRENE: ON" : "SIRENE: OFF";
};
$("tst").onclick = () => {
  wake();
  sirene(true);
  setTimeout(() => sirene(false), 1500);
};

// Login (pesan error generik; jeda 30 dtk setelah 5 gagal)
let fails = 0,
  lock = 0;
$("go").onclick = async () => {
  if (Date.now() < lock) {
    $("err").textContent = "TERKUNCI SEMENTARA";
    return;
  }
  try {
    await store.signIn($("em").value.trim(), $("pw").value);
    $("pw").value = "";
    fails = 0;
    $("err").textContent = "";
  } catch (e) {
    console.warn("auth:", e.code);
    if (++fails >= 5) {
      lock = Date.now() + 3e4;
      fails = 0;
    }
    $("err").textContent = "AKSES DITOLAK";
  }
};
store.onAuth((u) => {
  uid = u && u.uid;
  items = [];
  setTimeout(
    () => {
      $("boot").hidden = true;
    },
    Math.max(0, 950 - performance.now()),
  );
  $("login").hidden = !!u;
  $("app").hidden = !u;
  show("home");
  unsub && unsub();
  u
    ? (sub(), subB(), subP(), subC())
    : (unsubC && unsubC(),
      unsubB && unsubB(),
      unsubP && unsubP(),
      (bills = []),
      (PS = {}),
      draw(),
      drawBills());
});
$("mon").onchange = sub;

function sub() {
  unsub && unsub();
  if (!uid || !$("mon").value) return;
  unsub = store.watchTx(
    $("mon").value,
    (list, pending) => {
      items = list.sort((a, b) => b.t - a.t);
      pend = pending;
      net();
      draw();
    },
    () => {
      items = [];
      draw();
    },
  );
}

$("typ").onchange = () => {
  $("cat").hidden = $("typ").value === "in";
};
$("add").onclick = async () => {
  const amount = parseInt($("amt").value.replace(/\D/g, ""), 10),
    label = $("lbl").value.trim().slice(0, 60),
    type = $("typ").value,
    month = $("mon").value,
    tg = parseInt($("tgl").value, 10),
    n0 = new Date(),
    day =
      tg >= 1 && tg <= 31
        ? tg
        : month === n0.getFullYear() + "-" + String(n0.getMonth() + 1).padStart(2, "0")
          ? n0.getDate()
          : 1;
  if (!uid || !label || !amount || amount >= 1e12 || !/^\d{4}-\d{2}$/.test(month)) return;
  try {
    store
      .addTx({
        type,
        label,
        cat: type === "in" ? "Pendapatan" : $("cat").value,
        amount,
        month,
        day,
        t: Date.now(),
      })
      .catch(() => {
        $("lbl").placeholder = "GAGAL MENYIMPAN";
      });
    $("lbl").value = $("amt").value = $("tgl").value = "";
  } catch {
    $("lbl").placeholder = "GAGAL MENYIMPAN";
  }
};

const tw = (e, v) => {
  const a = +e.dataset.v || 0;
  e.dataset.v = v;
  const t0 = performance.now();
  (function f(t) {
    const k = Math.min(1, (t - t0) / 600);
    e.textContent = rp(a + (v - a) * k);
    k < 1 && requestAnimationFrame(f);
  })(t0);
};

function draw() {
  let inc = 0,
    out = 0;
  const by = {};
  for (const x of items)
    x.type === "in"
      ? (inc += x.amount)
      : ((out += x.amount), (by[x.cat] = (by[x.cat] || 0) + x.amount));
  st = { inc, out, by };
  const bal = inc - out,
    pct = inc ? (out / inc) * 100 : out ? 100 : 0;
  tw($("inc"), inc);
  tw($("exp"), out);
  tw($("bal"), bal);
  $("bal").className = bal < 0 ? "neg" : "in";
  $("fill").style.width = Math.min(pct, 100) + "%";
  $("fill").className = pct >= 100 ? "d" : pct >= 75 ? "w" : "";
  $("pct").textContent = pct.toFixed(1) + "% PENDAPATAN TERPAKAI";
  $("hex").className = "hex" + (!items.length ? " idle" : bal < 0 ? " bad" : "");
  $("hex").textContent = !items.length ? "NO DATA" : bal < 0 ? "DEFISIT 赤字" : "SURPLUS 黒字";
  $("hexg").replaceChildren(
    ...Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => {
        const h = el("div", "hx" + (v / out > 0.4 ? " hot" : ""));
        h.title = rp(v);
        h.append(el("b", 0, Math.round((v / out) * 100) + "%"), el("small", 0, k));
        return h;
      }),
  );
  $("list").replaceChildren(
    ...items.map((x) => {
      const li = el("li"),
        s = el("div", x.type, (x.type === "in" ? "+ " : "− ") + x.label),
        a = el("div", 0, x.cat + " · " + rp(x.amount)),
        d = el("button", 0, "HAPUS");
      d.onclick = () => store.deleteTx(x.id);
      li.append(s, a, d);
      return li;
    }),
  );
  drawMagi();
  defi = bal < 0 ? "赤字 Pengeluaran melebihi pendapatan " + rp(-bal) : "";
  alerts();
  !$("v-rekap").hidden && drawRekap();
}

// Tagihan bulanan + peringatan
function dueBills() {
  const d = new Date(),
    ym = ymNow(),
    D = dim(d.getFullYear(), d.getMonth()),
    o = [];
  for (const b of bills) {
    if (b.paid === ym) continue;
    const due = Math.min(b.day, D),
      l = due - d.getDate(),
      w = b.name + " (" + rp(b.amount) + ")";
    if (l < 0) o.push("TERLAMBAT " + -l + " hari: " + w);
    else if (l <= 3)
      o.push(l ? "H-" + l + " jatuh tempo (tgl " + due + "): " + w : "HARI INI jatuh tempo: " + w);
  }
  return o;
}
let ring = null,
  cur = "",
  vib;
function showAl(o) {
  $("alert").hidden = false;
  $("at").textContent = o.t;
  $("as").textContent = o.sub;
  [
    ["1", o.s1],
    ["2", o.s2],
  ].forEach(([i, v]) => {
    $("s" + i + "v").textContent = v[0];
    $("s" + i + "l").textContent = v[1];
  });
  $("atag").textContent = o.tag;
  {
    const g =
      Array(12)
        .fill("▲ PERINGATAN " + o.tag)
        .join("   ") + "   ";
    ["mqt", "mqb"].forEach((i) => $(i).replaceChildren(el("span", 0, g), el("span", 0, g)));
  }
  $("amsg").replaceChildren(...(o.lines || []).map((x) => el("div", 0, x)));
  cur = o.key;
  (o.loud || snd) && ac ? sirene(true, o.soft) : sirene(false);
  clearInterval(vib);
  navigator.vibrate && (vib = setInterval(() => navigator.vibrate([400, 200, 400]), 1500));
}
function hideAl() {
  $("alert").hidden = true;
  sirene(false);
  clearInterval(vib);
  navigator.vibrate && navigator.vibrate(0);
}
function alerts() {
  if (ring) return;
  const L = [];
  defi && L.push(defi);
  L.push(...dueBills());
  const key = $("mon").value + "|" + L.join("|");
  if (!L.length || muted.has(key)) {
    hideAl();
    return;
  }
  const pct = st.inc ? Math.round((st.out / st.inc) * 100) : st.out ? 100 : 0;
  showAl({
    t: "WARNING",
    sub: "Peringatan keuangan",
    lines: L,
    s1: [pct + "%", "TERPAKAI"],
    s2: [dueBills().length, "TAGIHAN"],
    tag: "KEUANGAN",
    key,
  });
  notify(L.join("\n"));
}
$("stop").onclick = () => {
  if (ring) ring = null;
  else muted.add(cur);
  hideAl();
  alerts();
};
async function notify(m) {
  if (nt.has(m) || !("Notification" in window) || Notification.permission !== "granted") return;
  nt.add(m);
  try {
    (await navigator.serviceWorker.ready).showNotification("LILITH", {
      body: m,
      tag: "lilith",
      icon: "/asset/icon-192.png",
      badge: "/asset/icon-192.png",
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
    });
  } catch {}
}
const ntfLbl = () =>
  ($("ntf").textContent =
    "NOTIFIKASI: " +
    ("Notification" in window && Notification.permission === "granted" ? "ON" : "OFF"));
ntfLbl();
$("ntf").onclick = async () => {
  if ("Notification" in window) {
    await Notification.requestPermission();
    ntfLbl();
    alerts();
  }
};
try {
  navigator.serviceWorker && navigator.serviceWorker.register("sw.js");
} catch {}
addEventListener(
  "pointerdown",
  () => {
    wake();
  },
  { once: true },
);
function subB() {
  unsubB && unsubB();
  if (!uid) return;
  unsubB = store.watchBills(
    (list) => {
      bills = list.sort((a, b) => a.day - b.day);
      drawBills();
      alerts();
    },
    () => {
      bills = [];
      drawBills();
    },
  );
}
function drawBills() {
  const d = new Date(),
    ym = ymNow(),
    D = dim(d.getFullYear(), d.getMonth());
  $("bl").replaceChildren(
    ...bills.map((b) => {
      const l = Math.min(b.day, D) - d.getDate(),
        ok = b.paid === ym,
        li = el("li"),
        r = el("div", "row");
      const s = el(
          "div",
          ok ? "in" : l < 0 ? "neg blink" : l <= 3 ? "out blink" : "",
          b.name + " · " + rp(b.amount) + " · tgl " + b.day,
        ),
        u = el(
          "small",
          0,
          ok
            ? "LUNAS BULAN INI"
            : l < 0
              ? "TERLAMBAT " + -l + " HARI"
              : l === 0
                ? "JATUH TEMPO HARI INI"
                : "H-" + l,
        );
      if (!ok) {
        const p = el("button", 0, "BAYAR");
        p.onclick = () => pay(b);
        r.append(p);
      }
      const x = el("button", "ghost", "HAPUS");
      x.onclick = () => store.deleteBill(b.id);
      r.append(x);
      li.append(s, u, r);
      return li;
    }),
  );
}
async function pay(b) {
  const ym = ymNow();
  try {
    store
      .payBill(b.id, ym, {
        type: "out",
        label: b.name,
        cat: "Tagihan",
        amount: b.amount,
        month: ym,
        day: new Date().getDate(),
        t: Date.now(),
      })
      .catch(() => {});
  } catch {}
}
$("badd").onclick = async () => {
  const name = $("bn").value.trim().slice(0, 40),
    amount = parseInt($("ba").value.replace(/\D/g, ""), 10),
    day = parseInt($("bd").value, 10);
  if (!uid || !name || !amount || amount >= 1e12 || !(day >= 1 && day <= 31)) return;
  try {
    store
      .addBill({
        name,
        amount,
        day,
        paid: "",
        t: Date.now(),
      })
      .catch(() => {});
    $("bn").value = $("ba").value = $("bd").value = "";
  } catch {}
};
$("ics").onclick = () => {
  if (!bills.length) return;
  const d = new Date(),
    y = d.getFullYear(),
    mo = d.getMonth(),
    L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LILITH//ID"];
  for (const b of bills) {
    const dd = Math.min(b.day, dim(y, mo));
    L.push(
      "BEGIN:VEVENT",
      "UID:" + b.id + "@lilith",
      "DTSTAMP:" + y + p2(mo + 1) + p2(d.getDate()) + "T000000Z",
      "DTSTART;VALUE=DATE:" + y + p2(mo + 1) + p2(dd),
      "RRULE:FREQ=MONTHLY;BYMONTHDAY=" + b.day,
      "SUMMARY:Bayar " + b.name.replace(/[,;\\\n]/g, " ") + " (" + rp(b.amount) + ")",
    );
    for (const t of ["-P2DT15H", "-PT15H", "PT9H"])
      L.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Tagihan " + b.name.replace(/[,;\\\n]/g, " "),
        "TRIGGER:" + t,
        "END:VALARM",
      );
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  const a = el("a");
  a.href = URL.createObjectURL(new Blob([L.join("\r\n")], { type: "text/calendar" }));
  a.download = "lilith-tagihan.ics";
  a.click();
};

// ===== Sholat (WIB, Kemenag RI: Subuh 20°, Isya 18°, Ashar standar, ihtiyath ±2 menit) & Alarm =====
const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) || d;
    } catch {
      return d;
    }
  },
  save = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
    uid && store.setCfg({ [k]: v }).catch(() => {});
  };
let PR = load("pr", { Subuh: 1, Dzuhur: 1, Ashar: 1, Maghrib: 1, Isya: 1 }),
  ALR = load("al", []),
  loc = load("loc", config.defaultLocation),
  lastSig = "";
function drawPray(P, now) {
  const nx = P.find(([k, m]) => k !== "Terbit" && m > now) || ["Subuh", P[0][1] + 1440],
    df = nx[1] - now;
  $("nx").textContent = nx[0].toUpperCase() + " " + hm2(nx[1]);
  $("lc").textContent = "-" + hm2(df) + " LAGI · LOKASI " + loc.lat + ", " + loc.lon;
  const sig = P.join() + JSON.stringify(PR) + nx[0];
  if (sig === lastSig) return;
  lastSig = sig;
  $("pl").replaceChildren(
    ...P.map(([k, m]) => {
      const li = el("li", k === nx[0] ? "nxt" : "", null);
      li.append(el("span", 0, k + "  " + hm2(m)));
      if (k !== "Terbit") {
        const b = el("button", "ghost", PR[k] ? "ON" : "OFF");
        b.onclick = () => {
          PR[k] = PR[k] ? 0 : 1;
          save("pr", PR);
          lastSig = "";
        };
        li.append(b);
      }
      return li;
    }),
  );
}
$("gl").onclick = () =>
  navigator.geolocation &&
  navigator.geolocation.getCurrentPosition(
    (p) => {
      loc = { lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) };
      save("loc", loc);
      lastSig = "";
    },
    () => {},
    { timeout: 8000 },
  );
let wl;
$("wk").onclick = async () => {
  try {
    if (wl) {
      await wl.release();
      return;
    }
    wl = await navigator.wakeLock.request("screen");
    $("wk").textContent = "MODE SIAGA: ON";
    wl.addEventListener("release", () => {
      wl = null;
      $("wk").textContent = "MODE SIAGA: OFF";
    });
  } catch {}
};
function drawAl() {
  $("alst").replaceChildren(
    ...ALR.map((a) => {
      const li = el("li"),
        r = el("div", "row");
      li.append(el("div", a.on ? "in" : "", a.t + " · " + (a.label || "Alarm")));
      const t = el("button", "ghost", a.on ? "ON" : "OFF");
      t.onclick = () => {
        a.on = a.on ? 0 : 1;
        save("al", ALR);
        drawAl();
      };
      const h = el("button", "ghost", "JAM HP");
      h.onclick = () => {
        const [H, M] = a.t.split(":");
        location.href =
          "intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=" +
          Number(H) +
          ";i.android.intent.extra.alarm.MINUTES=" +
          Number(M) +
          ";S.android.intent.extra.alarm.MESSAGE=" +
          encodeURIComponent(a.label || "LILITH") +
          ";end";
      };
      const x = el("button", "ghost", "HAPUS");
      x.onclick = () => {
        ALR = ALR.filter((z) => z.id !== a.id);
        save("al", ALR);
        drawAl();
      };
      r.append(t, h, x);
      li.append(r);
      return li;
    }),
  );
}
$("aad").onclick = () => {
  const t = $("ahm").value;
  if (!t) return;
  ALR.push({ id: Date.now(), t, label: $("alb").value.trim().slice(0, 30), on: 1 });
  ALR.sort((a, b) => (a.t < b.t ? -1 : 1));
  save("al", ALR);
  $("alb").value = "";
  drawAl();
};
drawAl();
const fired = new Set();
setInterval(() => {
  const d = new Date(),
    hm = p2(d.getHours()) + ":" + p2(d.getMinutes()),
    day = d.toDateString(),
    now = d.getHours() * 60 + d.getMinutes(),
    P = pray(d, loc.lat, loc.lon);
  if (!$("v-sholat").hidden) drawPray(P, now);
  if (!uid || ring) return;
  for (const [k, mn] of P) {
    const id = day + k;
    if (k !== "Terbit" && PR[k] && mn === now && !fired.has(id)) {
      fired.add(id);
      ring = {
        t: "WARNING",
        sub: "Waktu sholat " + k,
        s1: [hm2(mn), "WIB"],
        s2: [k.toUpperCase(), "SHOLAT"],
        tag: "ADZAN",
        loud: 1,
        soft: 1,
        key: id,
      };
      showAl(ring);
      notify("Waktu sholat " + k + " " + hm2(mn));
      return;
    }
  }
  for (const a of ALR) {
    const id = day + a.id;
    if (a.on && a.t === hm && !fired.has(id)) {
      fired.add(id);
      ring = {
        t: "WARNING",
        sub: a.label || "Alarm",
        s1: [a.t, "WAKTU"],
        s2: ["ALARM", "AKTIF"],
        tag: "ALARM",
        loud: 1,
        key: id,
      };
      showAl(ring);
      notify("Alarm " + a.t + " " + (a.label || ""));
      return;
    }
  }
}, 1000);

// ===== Rekapitulasi =====
const sv = (t, at, p) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", t);
  for (const k in at) e.setAttribute(k, at[k]);
  p && p.append(e);
  return e;
};
const cmp = (v) => {
  const x = Math.abs(v);
  return (
    (v < 0 ? "-" : "") +
    (x >= 1e6
      ? (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + "jt"
      : x >= 1e3
        ? Math.round(x / 1e3) + "rb"
        : Math.round(x))
  );
};
const ABB = "JAN FEB MAR APR MEI JUN JUL AGU SEP OKT NOV DES".split(" ");
const dayOf = (x) => {
  if (x.day) return x.day;
  const d = new Date(x.t);
  return d.getFullYear() + "-" + p2(d.getMonth() + 1) === x.month ? d.getDate() : 1;
};
function drawRekap() {
  const mon = $("mon").value;
  if (!mon) return;
  const [Y, M] = mon.split("-").map(Number),
    N = dim(Y, M - 1),
    nw = new Date(),
    last = nw.getFullYear() === Y && nw.getMonth() + 1 === M ? nw.getDate() : N;
  const I = Array(N + 1).fill(0),
    O = Array(N + 1).fill(0);
  for (const x of items) {
    const d = Math.min(dayOf(x), N);
    x.type === "in" ? (I[d] += x.amount) : (O[d] += x.amount);
  }
  const ci = [0],
    co = [0],
    cb = [0];
  for (let d = 1; d <= last; d++) {
    ci[d] = ci[d - 1] + I[d];
    co[d] = co[d - 1] + O[d];
    cb[d] = ci[d] - co[d];
  }
  const { inc, out, by } = st,
    bal = inc - out;
  $("rmon").textContent = ABB[M - 1] + " " + Y;
  $("rkv").replaceChildren(
    ...[
      ["PENDAPATAN", rp(inc)],
      ["PENGELUARAN", rp(out)],
      ["SISA", rp(bal)],
      ["TRANSAKSI", items.length],
      ["RASIO", (inc ? (out / inc) * 100 : out ? 100 : 0).toFixed(1) + "%"],
    ].map(([k, v]) => {
      const r = el("div");
      r.append(el("span", 0, k), el("b", 0, v));
      return r;
    }),
  );
  $("rst").className = "sb " + (!items.length ? "" : bal < 0 ? "red" : "grn");
  $("rst").firstChild.textContent = !items.length
    ? "NO DATA"
    : bal < 0
      ? "⚠ DEFISIT 赤字"
      : "SURPLUS 黒字";
  const cells = [...CATS.map((k) => [k, by[k] || 0]), ["Pendapatan", inc]];
  $("chn").replaceChildren(
    ...cells.map(([k, v], i) => {
      const c = Math.floor(i / 3),
        r = i % 3,
        isI = k === "Pendapatan",
        sh = out ? (v / out) * 100 : 0;
      const h = el(
        "div",
        "ch " + (isI ? (v ? "g" : "z") : !v ? "z" : sh > 40 ? "r" : "a") + (c % 2 ? " off" : ""),
      );
      h.style.gridColumn = c + 1;
      h.style.gridRow = r + 1;
      h.append(
        el("b", 0, k.slice(0, 3).toUpperCase()),
        el("small", 0, isI ? "IN" : Math.round(sh) + "%"),
      );
      return h;
    }),
  );
  $("rlg").replaceChildren(
    ...items
      .slice(0, 8)
      .map((x) =>
        el(
          "div",
          0,
          "> NEW DATA " +
            p2(dayOf(x)) +
            " " +
            x.label +
            " " +
            (x.type === "in" ? "+" : "-") +
            rp(x.amount),
        ),
      ),
  );
  // grafik arus kas (SVG)
  const W = 400,
    H = 320,
    L = 48,
    R = 10,
    T = 10,
    B = 28,
    pw = W - L - R,
    ph = H - T - B,
    cv = $("cv");
  cv.replaceChildren();
  let hi = Math.max(1, ...ci, ...co, ...cb) * 1.1,
    lo = Math.min(0, ...cb) * 1.1;
  if (hi - lo < 1) hi = lo + 1;
  const X = (d) => L + ((d - 1) / (N - 1)) * pw,
    Yv = (v) => T + ((hi - v) / (hi - lo)) * ph,
    xs = [];
  for (let d = 1; d <= N; d++) if (d === 1 || d % 5 === 0) xs.push(d);
  const yt = [0, 1, 2, 3, 4, 5].map((i) => lo + ((hi - lo) * i) / 5);
  xs.forEach((d) =>
    sv("line", { x1: X(d), x2: X(d), y1: T, y2: T + ph, stroke: "#1d6a64", "stroke-width": 1 }, cv),
  );
  let g = "";
  for (let i = 0; i < xs.length - 1; i++) {
    const mx = (X(xs[i]) + X(xs[i + 1])) / 2;
    yt.forEach((v) => {
      const y = Yv(v);
      g += "M" + (mx - 3) + " " + y + "H" + (mx + 3) + "M" + mx + " " + (y - 3) + "V" + (y + 3);
    });
  }
  sv("path", { d: g, stroke: "#1d5c58", "stroke-width": 1, fill: "none" }, cv);
  yt.forEach((v) => {
    sv(
      "text",
      {
        x: L - 5,
        y: Yv(v) + 4,
        "text-anchor": "end",
        fill: "#ffb400",
        "font-size": 10,
        "font-family": "monospace",
      },
      cv,
    ).textContent = cmp(v);
  });
  lo < 0 &&
    sv(
      "line",
      {
        x1: L,
        x2: W - R,
        y1: Yv(0),
        y2: Yv(0),
        stroke: "#ff6a00",
        "stroke-width": 1,
        "stroke-dasharray": "4 3",
      },
      cv,
    );
  sv(
    "line",
    { x1: L, x2: W - R, y1: T + ph, y2: T + ph, stroke: "#ff6a00", "stroke-width": 2 },
    cv,
  );
  xs.forEach((d) => {
    sv(
      "text",
      {
        x: X(d),
        y: H - 10,
        "text-anchor": "middle",
        fill: "#ffb400",
        "font-size": 10,
        "font-family": "monospace",
      },
      cv,
    ).textContent = d;
  });
  const pl = (ar2, c, w, cls) => {
    const p = [];
    for (let d = 1; d <= last; d++) p.push(X(d).toFixed(1) + "," + Yv(ar2[d]).toFixed(1));
    sv(
      "polyline",
      {
        points: p.join(" "),
        fill: "none",
        stroke: c,
        "stroke-width": w,
        "stroke-linejoin": "round",
        class: cls || "",
      },
      cv,
    );
  };
  pl(ci, "#3dff8a", 1.2);
  pl(co, "#ff2a2a", 1.2);
  pl(cb, "#ff8a00", 2.6, "glow");
  const cl = sv(
      "line",
      { y1: T, y2: T + ph, stroke: "#fff", "stroke-width": 1, "stroke-dasharray": "3 3" },
      cv,
    ),
    dot = sv("circle", { r: 4, fill: "#ff8a00", stroke: "#fff" }, cv);
  const place = (d) => {
    cl.setAttribute("x1", X(d));
    cl.setAttribute("x2", X(d));
    dot.setAttribute("cx", X(d));
    dot.setAttribute("cy", Yv(cb[d]));
    $("rdo").textContent =
      "TGL " + p2(d) + " | SALDO " + rp(cb[d]) + " | MASUK " + rp(ci[d]) + " | KELUAR " + rp(co[d]);
  };
  cv.onpointermove = cv.onpointerdown = (e) => {
    const r = cv.getBoundingClientRect(),
      vx = ((e.clientX - r.left) / r.width) * W;
    place(Math.max(1, Math.min(last, Math.round(((vx - L) / pw) * (N - 1) + 1))));
  };
  place(last);
}

// ===== MAGI — tampilan & animasi diadaptasi dari github.com/bagusindrayana/ews-concept-new (MIT Modified) dan TomaszRewak/MAGI (MIT) =====
const MN = ["MELCHIOR • 1", "BALTHASAR • 2", "CASPAR • 3"],
  MV = { yes: "承認 APPROVED", no: "否決 DENIED", info: "NO DATA" },
  MC = { yes: "#00dfa2", no: "#e60026", info: "#2f8fb5" },
  OR = "#ff7700",
  CY = "#00f0ff";
const FF = "'Roboto Condensed','Arial Narrow',Impact,sans-serif",
  JP = "'Hiragino Kaku Gothic ProN',Meiryo,'Yu Gothic','Noto Sans JP',sans-serif";
const POD = [
  {
    pts: "715,255 945,255 945,565 605,565 605,365",
    b: [605, 255, 340, 310],
    t: [640, 400, 270, 90],
    x: 775,
    y: 435,
    s: 472,
    f: 44,
    d: "m",
  },
  {
    pts: "360,36 640,36 640,265 565,340 435,340 360,265",
    b: [360, 36, 280, 304],
    t: [380, 160, 240, 80],
    x: 500,
    y: 190,
    s: 226,
    f: 38,
    d: "b",
  },
  {
    pts: "55,255 285,255 395,365 395,565 55,565",
    b: [55, 255, 340, 310],
    t: [90, 400, 270, 90],
    x: 225,
    y: 435,
    s: 472,
    f: 44,
    d: "c",
  },
];
let MR = null,
  mt,
  PD = [],
  MH = [],
  MX,
  MS,
  MG,
  rz,
  MOB = innerWidth < 700;
function magiEval() {
  const { inc, out, by } = st,
    bal = inc - out,
    top = Math.max(0, ...Object.values(by)),
    nd = !items.length;
  const V = [
    [bal >= 0 && inc > 0, "Saldo tidak minus", "Sisa " + rp(bal)],
    [
      inc > 0 && bal / inc >= 0.2,
      "Tabungan minimal 20% dari pendapatan",
      "Tabungan " + (inc ? ((bal / inc) * 100).toFixed(1) : 0) + "%",
    ],
    [
      !out || top / out <= 0.5,
      "Tidak ada kategori di atas 50% pengeluaran",
      "Kategori terbesar " + (out ? Math.round((top / out) * 100) : 0) + "%",
    ],
  ];
  const v = V.map(([ok, c, r]) =>
      nd ? { s: "info", c, r: "Belum ada data bulan ini." } : { s: ok ? "yes" : "no", c, r },
    ),
    n = v.filter((z) => z.s === "yes").length;
  return { v, n, f: nd ? "info" : n >= 2 ? "yes" : "no" };
}

function buildMagi() {
  const s = $("msvg");
  s.replaceChildren();
  const df = sv("defs", {}, s),
    fl = sv("filter", { id: "cg", x: "-20%", y: "-20%", width: "140%", height: "140%" }, df);
  sv("feGaussianBlur", { stdDeviation: 2.5, result: "blur" }, fl);
  sv("feComposite", { in: "SourceGraphic", in2: "blur", operator: "over" }, fl);
  POD.forEach((p, i) => sv("polygon", { points: p.pts }, sv("clipPath", { id: "cp" + i }, df)));
  const tx = (x, y, t, at, p) => {
    const e = sv("text", { x, y, ...at }, p || s);
    e.textContent = t;
    return e;
  };
  sv("rect", { width: 1000, height: 605, fill: "#000" }, s);
  sv(
    "rect",
    { x: 24, y: 20, width: 952, height: 565, fill: "none", stroke: OR, "stroke-width": 4.5 },
    s,
  );
  sv(
    "rect",
    { x: 32, y: 28, width: 936, height: 549, fill: "none", stroke: OR, "stroke-width": 1.5 },
    s,
  );
  [
    [70, 52, 332],
    [680, 660, 940],
  ].forEach(([kx, x1, x2]) => {
    tx(kx, 95, "財務観測所", {
      fill: OR,
      "font-size": 46,
      "font-weight": 900,
      "letter-spacing": 2,
      "font-family": JP,
    });
    const g = sv(
      "g",
      { stroke: CY, "stroke-width": 2.5, fill: "none", opacity: 0.95, filter: "url(#cg)" },
      s,
    );
    [38, 44, 106, 112].forEach((y) =>
      sv("path", { d: "M " + x1 + " " + y + " L " + x2 + " " + y }, g),
    );
  });
  MOB = innerWidth < 700;
  const ys = MOB ? [150, 178, 202, 226, 250] : [152, 174, 192, 210, 228];
  const g2 = sv(
    "g",
    {
      fill: OR,
      "font-family": "'Roboto Condensed',monospace",
      "font-size": MOB ? 19 : 15,
      "font-weight": 700,
      "letter-spacing": 1.5,
    },
    s,
  );
  tx(110, ys[0], "CODE:473", { "font-size": MOB ? 24 : 20 }, g2);
  tx(110, ys[1], "FILE MAGI_SYS", {}, g2);
  MX = tx(110, ys[2], "EXTENTION:0000", {}, g2);
  tx(110, ys[3], "EX_MODE:OFF", {}, g2);
  tx(110, ys[4], "PRIORITY:AAB", {}, g2);
  const bx = sv("g", { transform: "translate(712,145)" }, s);
  sv("rect", { width: 180, height: 74, fill: "#000", stroke: OR, "stroke-width": 3 }, bx);
  sv(
    "rect",
    { x: 5, y: 5, width: 170, height: 64, fill: "none", stroke: OR, "stroke-width": 1.5 },
    bx,
  );
  MS = tx(
    90,
    48,
    "調整中",
    {
      fill: OR,
      "font-size": 34,
      "font-weight": 900,
      "text-anchor": "middle",
      "letter-spacing": 5,
      "font-family": JP,
    },
    bx,
  );
  sv("polygon", { points: "386,291 404,309 372,342 354,324", fill: OR }, s);
  sv("polygon", { points: "614,291 596,309 628,342 646,324", fill: OR }, s);
  sv("line", { x1: 395, y1: 445, x2: 605, y2: 445, stroke: OR, "stroke-width": 20 }, s);
  tx(500, 400, "MAGI", {
    fill: OR,
    "font-size": 38,
    "font-weight": 900,
    "text-anchor": "middle",
    "letter-spacing": 6,
    "font-family": "'Times New Roman',Times,Georgia,serif",
  });
  PD = POD.map((p, i) => {
    const g = sv("g", { class: "pod" }, s),
      c = sv("g", { "clip-path": "url(#cp" + i + ")" }, g),
      base = sv("polygon", { points: p.pts, fill: MC.info }, c),
      layer = sv("g", {}, c);
    const c2 = sv("g", { "clip-path": "url(#cp" + i + ")" }, g),
      T = { "text-anchor": "middle", "font-weight": 900, "font-family": FF, "letter-spacing": 1 };
    const ghost = tx(
      p.x + 2,
      p.y - 1,
      MN[i],
      { ...T, fill: CY, opacity: 0.7, "font-size": p.f },
      c2,
    );
    ghost.style.display = "none";
    const tg = sv("g", {}, c2),
      sub = tx(
        p.x,
        p.s,
        "",
        { ...T, fill: "#000", "font-size": MOB ? 24 : 18, "font-weight": 800 },
        tg,
      );
    const title = tx(p.x, p.y, MN[i], { ...T, fill: "#000", "font-size": p.f }, tg);
    const sl = sv("g", {}, c2);
    sv("polygon", { points: p.pts, fill: "none", stroke: OR, "stroke-width": 3.5 }, g);
    g.onclick = () => pressPod(i);
    return { base, layer, ghost, title, sub, sl, cur: MC.info, tm: 0 };
  });
}
function glitch(i, to, fr) {
  const p = PD[i],
    c = POD[i],
    [bx, by, bw, bh] = c.b,
    [tx0, ty0, tw, th] = c.t,
    bs = 14,
    cols = Math.ceil(bw / bs),
    rows = Math.ceil(bh / bs);
  const from = fr || (p.cur === to ? (to === MC.yes ? MC.no : MC.yes) : p.cur);
  p.base.setAttribute("fill", from);
  p.layer.replaceChildren();
  p.sl.replaceChildren();
  p.layer.style.setProperty("--from-color", from);
  p.layer.style.setProperty("--to-color", to);
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      const d =
          c.d === "c"
            ? (k / cols) * 0.6 + (r / rows) * 0.4
            : c.d === "m"
              ? ((cols - k) / cols) * 0.6 + (r / rows) * 0.4
              : (r / rows) * 0.65 + (Math.abs(k - cols / 2) / (cols / 2)) * 0.35,
        nz = (((Math.sin(k * 23.45 + r * 67.89) * 43758.5453) % 1) + 1) % 1;
      const e = sv(
        "rect",
        {
          x: bx + k * bs,
          y: by + r * bs,
          width: nz > 0.76 && k < cols - 1 ? bs * 2 : bs,
          height: bs,
          class: "glitch-block",
        },
        p.layer,
      );
      e.style.animationDelay = (d * 0.42 + nz * 0.26).toFixed(3) + "s";
      e.style.setProperty(
        "--block-accent",
        nz > 0.62 ? "#000" : nz < 0.18 ? "#fff" : nz > 0.45 ? "#092736" : CY,
      );
    }
  for (let k = 0; k < 7; k++) {
    const h = 3 + Math.random() * 7,
      w = 35 + Math.random() * (tw - 35),
      e = sv(
        "rect",
        {
          x: Math.round(tx0 + Math.random() * (tw - w)),
          y: Math.round(ty0 + Math.random() * (th - 8)),
          width: Math.round(w),
          height: Math.round(h),
          class: "glitch-text-slice",
        },
        p.sl,
      );
    e.style.animationDelay = (0.05 + Math.random() * 0.45).toFixed(3) + "s";
    e.style.animationDuration = (0.18 + Math.random() * 0.25).toFixed(3) + "s";
  }
  p.ghost.style.display = "";
  clearTimeout(p.tm);
  p.tm = setTimeout(() => {
    p.base.setAttribute("fill", to);
    p.cur = to;
    p.layer.replaceChildren();
    p.sl.replaceChildren();
    p.ghost.style.display = "none";
  }, 850);
}
function paint(anim) {
  MR = magiEval();
  if (!PD.length) buildMagi();
  MX.textContent =
    "EXTENTION:" + String(Math.round((st.inc + st.out) / 1000) % 10000).padStart(4, "0");
  MS.textContent = MR.f === "yes" && MR.n === 3 ? "正常稼働" : "調整中";
  PD.forEach((p, i) => {
    const v = MR.v[i],
      to = MC[v.s];
    p.sub.textContent = v.s === "info" ? "[ NO DATA ]" : MV[v.s];
    if (p.cur !== to && !p.press) {
      if (anim) glitch(i, to);
      else {
        p.base.setAttribute("fill", to);
        p.cur = to;
      }
    }
  });
}
// grid hex latar: hex = satu hari bulan terpilih (hijau = saldo kumulatif >= 0, merah = minus), muncul dari tengah
function buildHex() {
  const box = $("mhex");
  box.replaceChildren();
  MH = [];
  const W = innerWidth,
    H = innerHeight,
    w = W < 600 ? 54 : W < 1100 ? 64 : 80,
    h = Math.round(w * 0.866),
    cols = Math.ceil(W / (w * 0.75)) + 1,
    rows = Math.ceil(H / h) + 1,
    ox = (W - ((cols - 1) * w * 0.75 + w)) / 2,
    oy = (H - (rows * h + h / 2)) / 2;
  MG = { w, h, cols, rows, ox, oy };
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x = ox + c * w * 0.75,
        y = oy + r * h + (c % 2 ? h / 2 : 0),
        e = el("div", "hxb"),
        l = el("span", 0, "N/A");
      e.append(l);
      e.style.left = x + "px";
      e.style.top = y + "px";
      e.style.width = w + "px";
      e.style.height = h + "px";
      box.append(e);
      MH.push({ e, l, r, c, x: x + w / 2, y: y + h / 2 });
    }
  const cx = W / 2,
    cy = H / 2,
    mx = Math.hypot(cx, cy);
  MH.forEach((o) => {
    o.d = Math.hypot(o.x - cx, o.y - cy);
    o.e.style.animationDelay = ((o.d / mx) * 800).toFixed(0) + "ms";
  });
}
function hexStat() {
  const mon = $("mon").value;
  if (!MH.length || !mon) return;
  const [Y, M] = mon.split("-").map(Number),
    N = dim(Y, M - 1),
    nw = new Date(),
    last = nw.getFullYear() === Y && nw.getMonth() + 1 === M ? nw.getDate() : N,
    D = Array(N + 1).fill(0),
    cb = [0];
  for (const x of items) {
    const d = Math.min(dayOf(x), N);
    D[d] += x.type === "in" ? x.amount : -x.amount;
  }
  for (let d = 1; d <= N; d++) cb[d] = cb[d - 1] + D[d];
  MH.forEach((o) => {
    o.l.textContent = "N/A";
    o.e.className = "hxb";
  });
  // blok kalender 7 kolom diletakkan di area kosong di samping/bawah layar MAGI (jika tidak muat: di belakangnya)
  const g = MG,
    W = innerWidth,
    H = innerHeight,
    dr = $("msvg").getBoundingClientRect(),
    n = Math.ceil(N / 7),
    bw = 6 * 0.75 * g.w + g.w,
    bh = n * g.h + g.h / 2;
  let x0 = (W - bw) / 2,
    y0 = (H - bh) / 2;
  if (dr.left > bw + 24) x0 = (dr.left - bw) / 2;
  else if (dr.bottom + 12 + bh < H) y0 = dr.bottom + 12;
  const c0 = Math.max(0, Math.min(g.cols - 7, Math.round((x0 - g.ox) / (0.75 * g.w)))),
    r0 = Math.max(0, Math.min(g.rows - n - 1, Math.round((y0 - g.oy) / g.h)));
  for (let k = 0; k < N; k++) {
    const o = MH[(c0 + (k % 7)) * g.rows + r0 + Math.floor(k / 7)],
      d = k + 1;
    if (!o) continue;
    o.l.textContent = p2(d);
    o.e.className = "hxb" + (items.length && d <= last ? (cb[d] >= 0 ? " ok" : " bad") : "");
  }
}
// teks pod dipaskan ke lebar pod agar tidak terpotong di font apa pun
function fit() {
  PD.forEach((p, i) => {
    const mx = [300, 250, 300][i],
      T = [p.title, p.ghost];
    T.forEach((t) => t.removeAttribute("textLength"));
    if (p.title.getComputedTextLength() > mx)
      T.forEach((t) => {
        t.setAttribute("textLength", mx);
        t.setAttribute("lengthAdjust", "spacingAndGlyphs");
      });
  });
}
addEventListener("resize", () => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    if ($("v-magi").hidden) return;
    if (innerWidth < 700 !== MOB) {
      buildMagi();
      paint(false);
    }
    buildHex();
    const b = $("mhex");
    b.classList.add("rv", "nd");
    hexStat();
    fit();
  }, 200);
});
function drawMagi() {
  paint(!$("v-magi").hidden);
  hexStat();
}
function magiGo() {
  clearTimeout(mt);
  $("mgm").hidden = true;
  PD.forEach((p) => (p.press = 0));
  paint(false);
  buildHex();
  $("mgl").hidden = false;
  requestAnimationFrame(() => {
    hexStat();
    fit();
  });
  document.fonts && document.fonts.ready.then(fit);
  PD.forEach((p) => {
    clearTimeout(p.tm);
    p.layer.replaceChildren();
    p.sl.replaceChildren();
    p.ghost.style.display = "none";
  });
  mt = setTimeout(() => {
    $("mgl").hidden = true;
    const b = $("mhex");
    b.classList.remove("rv", "nd");
    void b.offsetWidth;
    b.classList.add("rv");
    [1, 2, 0].forEach((i, k) => setTimeout(() => glitch(i, MC[MR.v[i].s]), 300 + k * 180));
  }, 900);
}
function showPod(i) {
  const z = MR.v[i];
  $("mgn").textContent = MN[i];
  $("mgb").replaceChildren(
    ...[
      ["kriteria:", z.c],
      ["suara:", MV[z.s]],
      ["detail:", z.r],
      [
        "keputusan:",
        MR.f === "info"
          ? "STANDBY"
          : MR.f === "yes"
            ? "決議: ACCEPTED (" + MR.n + "/3)"
            : "決議: REJECTED (" + MR.n + "/3)",
      ],
    ].flatMap(([k, t]) => [el("div", 0, k), el("div", 0, t)]),
  );
  $("mgm").hidden = false;
}
// ditekan: biru (diam) -> merah dengan animasi glitch yang sama; kembali ke warna status saat jendela rincian ditutup
function restorePods() {
  PD.forEach((p, i) => {
    if (!p.press) return;
    p.press = 0;
    const rs = MC[MR.v[i].s];
    glitch(i, rs, rs === MC.no ? MC.info : MC.no);
  });
}
function pressPod(i) {
  restorePods();
  const p = PD[i];
  p.press = 1;
  glitch(i, MC.no, p.cur === MC.no ? MC.info : p.cur);
  showPod(i);
}
$("mgx").onclick = () => {
  $("mgm").hidden = true;
  restorePods();
};

// ===== Mode offline: data tersimpan di perangkat (IndexedDB), antrean tulis tersinkron otomatis saat online =====
let pend = false;
const net = () => {
  const n = $("net");
  n.hidden = navigator.onLine && !pend;
  n.textContent = navigator.onLine ? "SYNC" : "OFFLINE";
  n.className = "net" + (navigator.onLine ? "" : " off");
};
addEventListener("online", net);
addEventListener("offline", net);
net();

// ===== Pelacak sholat — tampilan Rib Cage Layout; data users/{uid}/sholat/{YYYY-MM-DD} =====
const PK = ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"],
  HRI = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"],
  ymd = (y, m, d) => y + "-" + p2(m) + "-" + p2(d);
let PS = {},
  unsubP,
  lastPS = "",
  tapK = "";
$("pmon").value = $("mon").value;
function subP() {
  unsubP && unsubP();
  if (!uid || !$("pmon").value) return;
  unsubP = store.watchPrayer(
    $("pmon").value,
    (map) => {
      PS = map;
      drawPel();
    },
    () => {
      PS = {};
      drawPel();
    },
  );
}
$("pmon").onchange = () => {
  lastPS = "";
  subP();
};
function drawPel() {
  const ym = $("pmon").value;
  if (!ym || $("v-pelacak").hidden) return;
  const [Y, M] = ym.split("-").map(Number),
    N = dim(Y, M - 1),
    nw = new Date(),
    cur = nw.getFullYear() === Y && nw.getMonth() + 1 === M,
    last = new Date(Y, M - 1, 1) > nw ? 0 : cur ? nw.getDate() : N;
  const T = Object.fromEntries(pray(nw, loc.lat, loc.lon)),
    nowM = nw.getHours() * 60 + nw.getMinutes(),
    td = nw.getDate(),
    done = (d, k) => !!(PS[ymd(Y, M, d)] || {})[k];
  let tot = 0;
  for (let d = 1; d <= last; d++) PK.forEach((k) => done(d, k) && tot++);
  let sk = 0;
  for (let d = cur ? td : last; d >= 1; d--) {
    if (PK.every((k) => done(d, k))) sk++;
    else if (!(cur && d === td)) break;
  }
  const sum =
    (cur ? "HARI INI " + PK.filter((k) => done(td, k)).length + "/5 · " : "") +
    "RENTETAN " +
    sk +
    " HARI · BULAN INI " +
    (last ? Math.round((tot / (5 * last)) * 100) : 0) +
    "%";
  const rows = [];
  for (let d = last; d >= 1; d--)
    PK.forEach((k, i) => {
      const dn = done(d, k),
        tdy = cur && d === td,
        due = !tdy || nowM >= T[k];
      rows.push([d, k, i, dn, due, tdy]);
    });
  const sig = ym + sum + rows.map((r) => r[3] * 1 + "" + r[4] * 1).join("");
  if (sig === lastPS) return;
  const ent = lastPS === "";
  lastPS = sig;
  $("psum").textContent = sum;
  const hdr = PK.map((k) => {
    const h = el("div", "ch2");
    h.append(el("b", 0, k.toUpperCase()), el("small", 0, cur ? hm2(T[k]) : "\u00a0"));
    return h;
  });
  const cells = rows.map(([d, k, i, dn, due, tdy], n) => {
    const c = el(
      "div",
      "cl " +
        (dn ? "ok" : due ? "bad" : "wait") +
        (i % 2 ? " rv" : "") +
        (tdy && due && !dn ? " att" : ""),
    );
    if (ent) c.style.animationDelay = Math.min(n * 14, 900) + "ms";
    else c.classList.add("na");
    if (tapK === d + k) {
      c.classList.add("flash");
      tapK = "";
    }
    const lb = el("div", "lb");
    lb.append(el("b", 0, p2(d)), el("small", 0, HRI[new Date(Y, M - 1, d).getDay()]));
    c.append(el("i", "br"), lb);
    c.onclick = () => {
      if (!due) return;
      tapK = d + k;
      store.setPrayer(ymd(Y, M, d), { [k]: !dn, m: ym }).catch(() => {});
    };
    return c;
  });
  $("pgrid").replaceChildren(...hdr, ...cells);
}
setInterval(() => {
  !$("v-pelacak").hidden && drawPel();
}, 30000);

// ===== Sinkron lintas perangkat: users/{uid}/cfg/main (alarm, sholat ON/OFF, lokasi). localStorage hanya cache =====
let unsubC;
function subC() {
  unsubC && unsubC();
  if (!uid) return;
  unsubC = store.watchCfg(
    (d) => {
      if (!d) return;
      const mirror = (k, v) => {
        try {
          localStorage.setItem(k, JSON.stringify(v));
        } catch {}
      };
      if (Array.isArray(d.al)) {
        ALR = d.al;
        mirror("al", ALR);
      }
      if (d.pr && typeof d.pr === "object") {
        PR = d.pr;
        mirror("pr", PR);
      }
      if (d.loc && typeof d.loc.lat === "number") {
        loc = d.loc;
        mirror("loc", loc);
      }
      lastSig = "";
      drawAl();
    },
    () => {},
  );
}

// ===== Menu samping (drawer) =====
function setMenu(o) {
  let s = $("scrim");
  if (!s) {
    s = document.createElement("div");
    s.id = "scrim";
    s.onclick = () => setMenu(0);
    document.body.appendChild(s);
  }
  $("menu").hidden = !o;
  s.hidden = !o;
}
setMenu(0);

// ===== Tombol Back Android (aktif hanya di aplikasi native; NATIVE diisi oleh native.js) =====
if (window.NATIVE && NATIVE.App)
  NATIVE.App.addListener("backButton", () => {
    if (!$("alert").hidden) return;
    if (!$("modal").hidden) {
      $("modal").hidden = true;
      return;
    }
    if (!$("mgm").hidden) {
      $("mgx").click();
      return;
    }
    if (!$("menu").hidden) {
      setMenu(0);
      return;
    }
    const cur = V.find((k) => !$("v-" + k).hidden);
    if (!$("app").hidden && cur && cur !== "home") {
      show("home");
      return;
    }
    NATIVE.App.exitApp();
  });

// ===== Cadangan data (hanya mode lokal) =====
$("lo").hidden = !store.requiresLogin;
if (store.exportData) {
  $("exp").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([store.exportData()], { type: "application/json" }));
    a.download = "lilith-backup-" + ymNow() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("imp").onclick = () => $("impf").click();
  $("impf").onchange = async () => {
    const f = $("impf").files[0];
    if (!f) return;
    try {
      store.importData(await f.text());
      $("imp").textContent = "IMPOR BERHASIL";
    } catch {
      $("imp").textContent = "BERKAS TIDAK VALID";
    }
    $("impf").value = "";
  };
} else {
  $("exp").hidden = $("imp").hidden = true;
}
