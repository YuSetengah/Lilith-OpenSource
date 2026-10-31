const $ = (i) => document.getElementById(i),
  say = (t) => {
    $("st").textContent = t;
  };
addEventListener("error", (e) => say("ERROR: " + (e.message || "gagal memuat skrip")));
if (typeof maplibregl === "undefined")
  say("MapLibre tidak termuat. Pastikan folder vendor/ ikut ter-deploy.");
else {
  maplibregl.setWorkerUrl("vendor/maplibre-gl-csp-worker.js");
  // Tile gratis OpenFreeMap (data © OpenStreetMap contributors), gaya Liberty berisi gedung 3D
  const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [106.8456, -6.2088],
    zoom: 16.5,
    pitch: 60,
    bearing: 20,
    maxPitch: 75,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.on("error", (e) => say("PETA: " + ((e.error && e.error.message) || "gagal memuat data")));
  map.on("load", () => say(""));
  let mk;
  $("me").onclick = () =>
    navigator.geolocation &&
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const c = [p.coords.longitude, p.coords.latitude];
        if (!mk) {
          const d = document.createElement("div");
          d.className = "me";
          mk = new maplibregl.Marker({ element: d });
        }
        mk.setLngLat(c).addTo(map);
        map.flyTo({ center: c, zoom: 17, pitch: 60 });
      },
      () => say("Lokasi tidak diizinkan"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
}
$("go").onclick = () => {
  const q = $("dst").value.trim();
  if (q)
    open(
      "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" +
        encodeURIComponent(q),
      "_blank",
      "noopener",
    );
};
