/**
 * Adapter Firebase (opsional): Auth email+kata sandi, Firestore dengan cache offline.
 * SDK dimuat dinamis hanya jika mode ini dipakai, jadi mode lokal tidak menyentuh gstatic.
 * Struktur data: users/{uid}/{tx|bills|sholat}/{id} dan users/{uid}/cfg/main.
 */
export function createFirebaseStore(config) {
  let fb,
    auth,
    db,
    uid = null;
  const ready = (async () => {
    const [app, au, fs] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
    ]);
    fb = { ...au, ...fs };
    const a = app.initializeApp(config.firebase);
    auth = au.getAuth(a);
    db = fs.initializeFirestore(a, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
    if (config.useEmulator) {
      au.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      fs.connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
  })();

  /** Jalankan `start` setelah SDK siap; kembalikan fungsi berhenti yang aman dipanggil kapan saja. */
  const sub = (start) => {
    let off = () => {},
      dead = false;
    ready.then(() => {
      if (!dead) off = start();
    });
    return () => {
      dead = true;
      off();
    };
  };
  const col = (...p) => fb.collection(db, "users", uid, ...p);
  const ref = (...p) => fb.doc(db, "users", uid, ...p);
  const list = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    mode: "firebase",
    requiresLogin: true,
    onAuth: (cb) =>
      sub(() =>
        fb.onAuthStateChanged(auth, (u) => {
          uid = u ? u.uid : null;
          cb(u && { uid: u.uid });
        }),
      ),
    async signIn(email, pass) {
      await ready;
      await fb.setPersistence(auth, fb.browserLocalPersistence);
      await fb.signInWithEmailAndPassword(auth, email, pass);
    },
    async signOut() {
      await ready;
      await fb.signOut(auth);
    },

    watchTx: (month, cb, err) =>
      sub(() =>
        fb.onSnapshot(
          fb.query(col("tx"), fb.where("month", "==", month)),
          (s) => cb(list(s), s.metadata.hasPendingWrites),
          err,
        ),
      ),
    addTx: (tx) => fb.addDoc(col("tx"), tx),
    deleteTx: (id) => fb.deleteDoc(ref("tx", id)),

    watchBills: (cb, err) => sub(() => fb.onSnapshot(col("bills"), (s) => cb(list(s)), err)),
    addBill: (b) => fb.addDoc(col("bills"), b),
    deleteBill: (id) => fb.deleteDoc(ref("bills", id)),
    payBill(id, ym, tx) {
      const w = fb.writeBatch(db); // atomik: transaksi + status lunas
      w.set(fb.doc(col("tx")), tx);
      w.update(ref("bills", id), { paid: ym });
      return w.commit();
    },

    watchPrayer: (month, cb, err) =>
      sub(() =>
        fb.onSnapshot(
          fb.query(col("sholat"), fb.where("m", "==", month)),
          (s) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))),
          err,
        ),
      ),
    setPrayer: (id, patch) =>
      fb.setDoc(ref("sholat", id), { ...patch, t: Date.now() }, { merge: true }),

    watchCfg: (cb, err) =>
      sub(() => fb.onSnapshot(ref("cfg", "main"), (s) => cb(s.exists() ? s.data() : null), err)),
    setCfg: (patch) => fb.setDoc(ref("cfg", "main"), { ...patch, t: Date.now() }, { merge: true }),
  };
}
