# Keamanan

## Melaporkan kerentanan
Buka *Security Advisory* privat di tab Security repositori ini. Jangan membuka issue publik berisi
detail eksploitasi.

## Model ancaman singkat
- **Mode lokal:** data ada di `localStorage` browser, **tidak dienkripsi**. Siapa pun yang memakai
  perangkat/profil browser yang sama bisa membacanya. Kunci layar perangkat adalah perlindungannya.
- **Mode Firebase:** perlindungan data ada di Auth + Firestore Rules (terkunci ke satu UID), bukan di
  kerahasiaan URL atau API key. `firebaseConfig` memang publik.
- Kode tidak memakai `innerHTML`/`eval`; teks pengguna selalu lewat `textContent`.
- Header CSP ada di `firebase.json`. Hosting statis lain (mis. GitHub Pages) tidak bisa mengatur header,
  jadi tambahkan lewat `<meta http-equiv="Content-Security-Policy">` bila perlu.

## Jangan pernah di-commit
Kata sandi, token, file service account `.json`, `.env`, keystore (`*.jks`, `*.keystore`).
