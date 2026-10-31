# Panduan mode Firebase

Mode ini menambahkan login dan sinkron lintas perangkat. Setiap orang memakai **proyek Firebase miliknya
sendiri**; repositori ini tidak berisi konfigurasi siapa pun. Paket gratis (Spark) cukup untuk pemakaian pribadi.

## 1. Siapkan proyek
1. Firebase Console → buat proyek → tambahkan **Web app** → salin objek `firebaseConfig`.
2. **Authentication → Sign-in method** → aktifkan *Email/Password*.
3. **Firestore Database** → buat database (mode produksi).
4. **Authentication → Users → Add user**: buat satu akun, lalu salin **User UID**-nya.

## 2. Kunci akses ke akun Anda
Di `firestore.rules`, ganti `REPLACE_WITH_YOUR_UID` pada fungsi `me()`. Rules ini sengaja hanya mengizinkan
satu pengguna. Untuk beberapa pengguna, ubah `owner(uid)` agar tidak memakai `me()`.

## 3. Konfigurasi aplikasi
Salin isi `public/js/config.firebase.example.js` ke `public/js/config.js` dan isi `firebase: {...}`.
Jangan commit konfigurasi pribadi: `git update-index --skip-worktree public/js/config.js`.

## 4. Deploy
```
npm i -g firebase-tools
firebase login
firebase use --add            # pilih proyek Anda (membuat .firebaserc, sudah di-.gitignore)
firebase deploy --only firestore:rules,hosting
```

## 5. Pengamanan (disarankan)
- Nonaktifkan pendaftaran akun baru: Authentication → Settings → User actions → *Enable create (sign-up)*.
- Batasi API key (Google Cloud → APIs & Services → Credentials → Browser key):
  *Application restrictions* = Websites (`https://PROJECT_ID.web.app/*`, `https://PROJECT_ID.firebaseapp.com/*`);
  *API restrictions* = Identity Toolkit, Token Service, Cloud Firestore.
- Aktifkan 2-Step Verification pada akun Google pemilik proyek.
- `firebaseConfig` bukan rahasia; yang melindungi data adalah Auth + Rules di atas.

## 6. Uji lokal (emulator, tidak menyentuh data asli)
Butuh JDK 21+. Di `config.js` set `useEmulator: true` (dengan `projectId: "demo-lilith"`), lalu:
```
firebase emulators:start --config firebase.local.json --project demo-lilith
```
Buka `http://127.0.0.1:4000/auth` → *Add user*, lalu masuk di `http://127.0.0.1:5000`.
`firestore.local.rules` longgar khusus emulator dan tidak boleh di-deploy.

## 7. Android
Tambahkan `https://localhost/*` ke pembatasan API key, set `useEmulator: false`, lalu `npm i firebase@10.14.1`
sebelum `npm run build:native` (SDK dibundel dari npm, bukan dari gstatic).
