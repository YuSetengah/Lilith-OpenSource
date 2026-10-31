# LILITH

Pencatat **keuangan, tagihan, jadwal sholat, pelacak sholat, dan alarm** dengan tampilan HUD ala MAGI.
Berjalan sebagai web/PWA dan bisa dibungkus jadi aplikasi Android. *(English: a HUD-styled personal
finance, bills, prayer-times and alarm app. Runs fully in the browser; Firebase sync is optional.)*

- **Mode lokal (bawaan):** tanpa server, tanpa akun, tanpa Firebase. Data di browser, bisa diekspor/diimpor (.json).
- **Mode Firebase (opsional):** login + sinkron lintas perangkat dengan proyek Firebase milik Anda sendiri.

## Mulai cepat (mode lokal)

```bash
npm install
npm run dev          # menyajikan folder public/ (atau: python -m http.server -d public 8080)
```

Buka alamat yang ditampilkan. Modul ES butuh `http://`, jadi jangan membuka `index.html` langsung dari file.
Salin aset yang diperlukan ke `public/asset/` dan `public/vendor/` (lihat README di masing-masing folder).

## Struktur

```
public/                 ← seluruh situs statis (root hosting)
  index.html  peta.html  manifest.json  sw.js
  css/style.css
  js/
    app.js              ← entry: UI semua fitur
    config.js           ← konfigurasi (mode penyimpanan, lokasi bawaan)
    config.firebase.example.js
    lib/                ← format.js, prayer-times.js (fungsi murni)
    storage/            ← index.js, local.js, firebase.js (satu kontrak, dua adapter)
  asset/  vendor/       ← ikon, font, MapLibre (tidak disertakan di repo)
scripts/                ← build-native, make-icons, export-design
tests/                  ← smoke.mjs, storage.mjs   (npm test)
firebase.json  firestore.rules  firebase.local.json  firestore.local.rules
capacitor.config.json  .github/workflows/build-apk.yml
```

## Mode Firebase (opsional)

1. Buat proyek Firebase, aktifkan **Authentication → Email/Password** dan **Firestore**.
2. Buat **satu** pengguna di Authentication, salin UID-nya ke `me()` di `firestore.rules`
   (ganti `REPLACE_WITH_YOUR_UID`), lalu nonaktifkan pendaftaran akun baru
   (Authentication → Settings → User actions) bila opsinya tersedia.
3. Salin isi `public/js/config.firebase.example.js` ke `public/js/config.js` dan isi konfigurasi web Anda.
   Jangan commit `config.js` pribadi: `git update-index --skip-worktree public/js/config.js`.
4. Batasi API key di Google Cloud (HTTP referrers ke domain Anda, API: Identity Toolkit, Token Service, Firestore).
5. Deploy: `firebase deploy --only firestore:rules,hosting --project PROJECT_ID`.

Uji lokal tanpa menyentuh data asli: set `useEmulator: true`, lalu
`firebase emulators:start --config firebase.local.json --project demo-lilith` (butuh JDK 21+).

## Android (Capacitor)

```bash
npm run build:native && npx cap add android && npx cap sync android && node scripts/make-icons.mjs
```
Atau jalankan workflow **Build APK** di tab Actions (tanpa Android Studio). Ubah `appId` di
`capacitor.config.json`. Untuk mode Firebase, tambahkan `https://localhost/*` ke pembatasan API key
dan jalankan `npm i firebase@10.14.1`.

## Batasan yang diketahui

- Waktu sholat adalah **perkiraan** (metode Kemenag RI) dan jam tampilan memakai zona **WIB**;
  bandingkan dengan jadwal resmi. Parameter zona ada di `lib/prayer-times.js`.
- Alarm/pengingat di web hanya berbunyi saat aplikasi terbuka. Notifikasi terjadwal native belum ada.
- Mode lokal tidak mengenkripsi data (lihat `SECURITY.md`).

## Pengembangan

`npm test` menjalankan uji adapter penyimpanan dan uji asap aplikasi (jsdom). `npm run format` merapikan kode.
Lisensi: MIT (`LICENSE`). Atribusi dan catatan merek: `THIRD_PARTY.md`.
