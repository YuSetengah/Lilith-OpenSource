/**
 * Pilih adapter penyimpanan. Kontrak (dipakai app.js):
 *   requiresLogin, onAuth(cb), signIn(email, pass), signOut()
 *   watchTx(month, cb(list, pending), onErr) · addTx · deleteTx
 *   watchBills(cb, onErr) · addBill · deleteBill · payBill(id, ym, tx)
 *   watchPrayer(month, cb(map), onErr) · setPrayer(dateId, patch)
 *   watchCfg(cb(cfg|null), onErr) · setCfg(patch)
 *   (khusus lokal) exportData() · importData(json)
 * Semua `watch*` mengembalikan fungsi untuk berhenti berlangganan.
 */
import { createLocalStore } from "./local.js";
import { createFirebaseStore } from "./firebase.js";

export function createStore(config) {
  if (config.storage === "firebase") {
    if (!config.firebase)
      throw new Error("config.firebase kosong (lihat config.firebase.example.js)");
    return createFirebaseStore(config);
  }
  return createLocalStore();
}
