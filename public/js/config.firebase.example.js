/**
 * Contoh konfigurasi mode Firebase (opsional, untuk sinkron lintas perangkat).
 * Salin isinya ke js/config.js. Nilai `firebase` BUKAN rahasia (konfigurasi web publik),
 * tetapi tetap amankan dengan Firestore Rules + batasan API key (lihat README).
 */
export default {
  storage: "firebase",
  defaultLocation: { lat: -6.2088, lon: 106.8456 },
  useEmulator: false,
  firebase: {
    apiKey: "ISI_DARI_FIREBASE_CONSOLE",
    authDomain: "PROJECT_ID.firebaseapp.com",
    projectId: "PROJECT_ID",
    appId: "ISI_DARI_FIREBASE_CONSOLE",
  },
};
