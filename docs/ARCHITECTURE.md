# Arsitektur

`app.js` hanya berbicara dengan objek `store` (js/storage/). Adapter dipilih oleh `config.storage`.

| Metode | Fungsi |
|---|---|
| `onAuth(cb)`, `signIn`, `signOut`, `requiresLogin` | Sesi. Mode lokal langsung memanggil `cb({uid:"local"})` |
| `watchTx(month, cb(list, pending))`, `addTx`, `deleteTx` | Transaksi per bulan (`YYYY-MM`) |
| `watchBills(cb)`, `addBill`, `deleteBill`, `payBill(id, ym, tx)` | Tagihan; `payBill` atomik |
| `watchPrayer(month, cb(map))`, `setPrayer(dateId, patch)` | Pelacak sholat per tanggal |
| `watchCfg(cb(cfg\|null))`, `setCfg(patch)` | Alarm (`al`), sholat ON/OFF (`pr`), lokasi (`loc`) |
| `exportData()`, `importData(json)` | Khusus lokal; impor divalidasi ketat |

Semua `watch*` mengembalikan fungsi berhenti. Menambah backend baru (mis. SQLite/REST) cukup membuat
adapter yang memenuhi tabel ini.

Rencana pemecahan lanjutan `app.js` (masih satu berkas besar, dibagi per bagian berkomentar): keuangan,
tagihan, sholat+alarm, rekap, MAGI, pelacak. Bagian MAGI paling terkait state bersama, jadi pisahkan terakhir.
