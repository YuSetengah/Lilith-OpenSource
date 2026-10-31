/**
 * Perhitungan waktu sholat (metode Kemenag RI: Subuh 20°, Isya 18°, Ashar standar, ihtiyath ±2 menit).
 * Fungsi murni — tidak menyentuh DOM. Hasilnya perkiraan; bandingkan dengan jadwal resmi.
 * @param {Date} dt tanggal  @param {number} lat  @param {number} lon
 * @param {number} tzOffset selisih jam dari UTC (WIB = 7)
 * @returns {[string, number][]} pasangan [nama, menit sejak 00:00]
 */
export function pray(dt, lat, lon, tzOffset = 7) {
  const R = Math.PI / 180,
    S = (x) => Math.sin(x * R),
    C = (x) => Math.cos(x * R),
    AC = (x) => Math.acos(x) / R,
    fx = (a, b) => a - b * Math.floor(a / b);
  let Y = dt.getFullYear(),
    M = dt.getMonth() + 1;
  const D = dt.getDate();
  if (M <= 2) {
    Y--;
    M += 12;
  }
  const A = Math.floor(Y / 100),
    jd =
      Math.floor(365.25 * (Y + 4716)) +
      Math.floor(30.6001 * (M + 1)) +
      D +
      2 -
      A +
      Math.floor(A / 4) -
      1524.5 -
      lon / 360;
  const sp = (t) => {
    const d = jd + t / 24 - 2451545,
      g = fx(357.529 + 0.98560028 * d, 360),
      q = fx(280.459 + 0.98564736 * d, 360),
      L = fx(q + 1.915 * S(g) + 0.02 * S(2 * g), 360),
      e = 23.439 - 3.6e-7 * d,
      ra = fx(Math.atan2(C(e) * S(L), C(L)) / R, 360) / 15;
    return [Math.asin(S(e) * S(L)) / R, q / 15 - ra];
  };
  const mid = (t) => fx(12 - sp(t)[1], 24),
    ang = (a, t, ccw) => {
      const dc = sp(t)[0],
        x = (-S(a) - S(dc) * S(lat)) / (C(dc) * C(lat));
      return mid(t) + ((ccw ? -1 : 1) * AC(x)) / 15;
    };
  const asr = (t) => ang(-Math.atan(1 / (1 + Math.tan(Math.abs(lat - sp(t)[0]) * R))) / R, t, 0),
    tz = tzOffset - lon / 15,
    m = (h) => Math.round((h + tz) * 60);
  return [
    ["Subuh", m(ang(20, 5, 1)) + 2],
    ["Terbit", m(ang(0.833, 6, 1)) - 2],
    ["Dzuhur", m(mid(12)) + 2],
    ["Ashar", m(asr(13)) + 2],
    ["Maghrib", m(ang(0.833, 18, 0)) + 2],
    ["Isya", m(ang(18, 18, 0)) + 2],
  ];
}
