/** Konfigurasi bawaan: semua data tersimpan lokal di browser (tanpa server, tanpa akun). */
export default {
  storage: "local", // "local" | "firebase"
  defaultLocation: { lat: -6.2088, lon: 106.8456 }, // dipakai sebelum pengguna menekan "PAKAI LOKASI SAYA"
  useEmulator: false, // true = Firebase Emulator lokal (hanya untuk pengembangan)
  firebase: null,
};
