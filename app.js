/* =====================================================================
   Sito Pietro — logica frontend
   ===================================================================== */

const cfg = window.APP_CONFIG || {};
const configured =
  cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("IL-TUO-PROGETTO") &&
  cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("LA-TUA");

// Testi personalizzati
if (cfg.TITOLO) document.getElementById("titolo").textContent = cfg.TITOLO;
if (cfg.SOTTOTITOLO) document.getElementById("sottotitolo").textContent = cfg.SOTTOTITOLO;
document.title = cfg.TITOLO || document.title;

let sb = null;
if (configured) {
  sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
} else {
  document.getElementById("config-warning").hidden = false;
}

/* ---------------------- MAPPA ---------------------- */
const map = L.map("map", { preferCanvas: true }).setView([45.0, 9.0], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
  maxZoom: 19,
}).addTo(map);

let routeLine = null;
const plannedLines = [];
let plannedBounds = null;
let liveMarker = null;
const photoMarkers = [];

// legenda
const legend = L.control({ position: "bottomright" });
legend.onAdd = function () {
  const div = L.DomUtil.create("div", "map-legend");
  div.innerHTML = `
    <div><span class="ln solid"></span> percorso fatto</div>
    <div><span class="ln dashed"></span> itinerario previsto</div>
    <div>🚴 dov'è ora &nbsp; 📷 foto</div>`;
  return div;
};
legend.addTo(map);

const bikeIcon = L.divIcon({
  html: "🚴", className: "bike-emoji",
  iconSize: [30, 30], iconAnchor: [15, 15],
});
const photoIcon = L.divIcon({
  html: "📷", className: "photo-emoji",
  iconSize: [24, 24], iconAnchor: [12, 12],
});

// Itinerario previsto (una o più tratte GPX)
async function loadPlannedRoute() {
  const paths = cfg.PERCORSI_GPX || (cfg.PERCORSO_GPX ? [cfg.PERCORSO_GPX] : []);
  if (paths.length === 0) return;

  for (const path of paths) {
    try {
      const r = await fetch(path);
      if (!r.ok) continue; // file non presente: pazienza
      const xml = new DOMParser().parseFromString(await r.text(), "application/xml");
      const pts = [...xml.querySelectorAll("trkpt, rtept")]
        .map((p) => [parseFloat(p.getAttribute("lat")), parseFloat(p.getAttribute("lon"))])
        .filter((p) => !isNaN(p[0]) && !isNaN(p[1]));
      if (pts.length === 0) continue;

      const line = L.polyline(pts, {
        color: "#4a6fa5", weight: 3, opacity: 0.75, dashArray: "8 8",
      }).addTo(map).bindPopup("Itinerario previsto");
      plannedLines.push(line);

      plannedBounds = plannedBounds
        ? plannedBounds.extend(line.getBounds())
        : line.getBounds();
    } catch (e) { console.error("GPX:", e); }
  }

  if (plannedBounds) map.fitBounds(plannedBounds, { padding: [40, 40] });
}

async function loadLocations() {
  if (!sb) return;
  const { data, error } = await sb
    .from("locations")
    .select("lat, lon, recorded_at, battery")
    .order("recorded_at", { ascending: true })
    .limit(5000);
  if (error) { console.error(error); return; }
  if (!data || data.length === 0) return;

  const pts = data.map((d) => [d.lat, d.lon]);

  if (routeLine) routeLine.remove();
  routeLine = L.polyline(pts, { color: "#d1603d", weight: 4, opacity: 0.85 }).addTo(map);

  const last = data[data.length - 1];
  if (liveMarker) liveMarker.remove();
  liveMarker = L.marker([last.lat, last.lon], { icon: bikeIcon })
    .addTo(map)
    .bindPopup(`Ultima posizione<br>${fmtDateTime(last.recorded_at)}` +
               (last.battery != null ? `<br>🔋 ${last.battery}%` : ""));

  const bounds = routeLine.getBounds();
  if (plannedBounds) bounds.extend(plannedBounds);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });

  const upd = document.getElementById("last-update");
  upd.textContent = "Aggiornato: " + fmtDateTime(last.recorded_at);
}

/* ---------------------- GALLERIA ---------------------- */
async function loadPhotos() {
  const gallery = document.getElementById("gallery");
  if (!sb) { gallery.innerHTML = `<p class="empty">Nessuna foto ancora.</p>`; return; }

  const { data, error } = await sb
    .from("photos")
    .select("*")
    .order("taken_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return; }

  // pulisci i marker foto sulla mappa
  photoMarkers.forEach((m) => m.remove());
  photoMarkers.length = 0;

  if (!data || data.length === 0) {
    gallery.innerHTML = `<p class="empty">Nessuna foto ancora. Carica la prima! 📷</p>`;
    return;
  }

  gallery.innerHTML = data.map((p) => {
    const when = p.taken_at ? fmtDateTime(p.taken_at) : "data sconosciuta";
    const where = p.place
      ? p.place
      : (p.lat != null ? `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}` : "");
    const link = p.lat != null
      ? `<a href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=13/${p.lat}/${p.lon}" target="_blank" rel="noopener">📍 ${where}</a>`
      : (where ? `📍 ${where}` : "");
    return `
      <figure class="photo-card">
        <img src="${p.url}" loading="lazy" alt="${p.caption || "foto"}">
        <figcaption class="photo-meta">
          ${p.caption ? `<p class="cap">${escapeHtml(p.caption)}</p>` : ""}
          <p class="info">🕑 ${when}</p>
          ${link ? `<p class="info">${link}</p>` : ""}
        </figcaption>
      </figure>`;
  }).join("");

  // pin sulla mappa
  data.forEach((p) => {
    if (p.lat == null) return;
    const m = L.marker([p.lat, p.lon], { icon: photoIcon })
      .addTo(map)
      .bindPopup(`<img src="${p.url}" style="width:160px;border-radius:8px">
                  <br>${p.caption ? escapeHtml(p.caption) + "<br>" : ""}
                  <small>${p.taken_at ? fmtDateTime(p.taken_at) : ""}</small>`);
    photoMarkers.push(m);
  });
}

// posizionamento manuale foto sulla mappa
let manualLatLng = null, pickMarker = null, picking = false;
const pickBtn = document.getElementById("pick-location");

pickBtn.addEventListener("click", () => {
  picking = !picking;
  pickBtn.classList.toggle("active", picking);
  document.getElementById("map").style.cursor = picking ? "crosshair" : "";
  if (picking) {
    pickBtn.textContent = "📍 Clicca sul punto della mappa…";
    document.getElementById("mappa").scrollIntoView({ behavior: "smooth" });
  } else {
    pickBtn.textContent = manualLatLng ? "📍 Posizione scelta ✓" : "📍 Posiziona sulla mappa";
  }
});

map.on("click", (e) => {
  if (!picking) return;
  manualLatLng = [e.latlng.lat, e.latlng.lng];
  if (pickMarker) pickMarker.setLatLng(e.latlng);
  else pickMarker = L.marker(e.latlng, { icon: photoIcon }).addTo(map);
  pickMarker.bindPopup("📷 Qui verranno posizionate le foto che carichi").openPopup();
  picking = false;
  pickBtn.classList.remove("active");
  pickBtn.textContent = "📍 Posizione scelta ✓ (clicca per cambiare)";
  document.getElementById("map").style.cursor = "";
});

async function getLastKnownLocation() {
  if (!sb) return null;
  const { data } = await sb.from("locations")
    .select("lat, lon").order("recorded_at", { ascending: false }).limit(1);
  return data && data[0] ? [data[0].lat, data[0].lon] : null;
}

// selezione file
const photoInput = document.getElementById("photo-input");
const fileDrop = document.querySelector(".file-drop span");
photoInput.addEventListener("change", () => {
  const n = photoInput.files.length;
  document.querySelector(".file-drop").classList.toggle("has-files", n > 0);
  fileDrop.textContent = n ? `✅ ${n} foto selezionate` : "➕ Carica foto (dal telefono di Pietro)";
});

document.getElementById("photo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sb) return alert("Configura prima Supabase (config.js).");
  const files = [...photoInput.files];
  if (files.length === 0) return;

  const status = document.getElementById("photo-status");
  const btn = document.getElementById("photo-submit");
  const caption = document.getElementById("photo-caption").value.trim();
  btn.disabled = true;

  let done = 0;
  for (const file of files) {
    try {
      status.textContent = `Elaboro ${done + 1}/${files.length}…`;
      await uploadPhoto(file, caption);
      done++;
    } catch (err) {
      console.error(err);
      status.textContent = `Errore su una foto: ${err.message}`;
    }
  }

  status.textContent = `✅ ${done} foto caricate!`;
  btn.disabled = false;
  photoInput.value = "";
  document.getElementById("photo-caption").value = "";
  document.querySelector(".file-drop").classList.remove("has-files");
  fileDrop.textContent = "➕ Carica foto (dal telefono di Pietro)";

  // reset posizione manuale
  manualLatLng = null;
  if (pickMarker) { pickMarker.remove(); pickMarker = null; }
  pickBtn.textContent = "📍 Posiziona sulla mappa";

  loadPhotos();
});

async function uploadPhoto(file, caption) {
  // 1) leggi EXIF dall'originale (GPS + data scatto)
  let lat = null, lon = null, takenAt = null;
  try {
    const exif = await exifr.parse(file, { gps: true, tiff: true });
    if (exif) {
      if (typeof exif.latitude === "number") { lat = exif.latitude; lon = exif.longitude; }
      takenAt = exif.DateTimeOriginal || exif.CreateDate || null;
      if (takenAt) takenAt = new Date(takenAt).toISOString();
    }
  } catch (_) { /* niente EXIF, pazienza */ }

  // 1b) se la foto non ha GPS: usa il punto scelto a mano, o l'ultima posizione di Pietro
  if (lat == null) {
    if (manualLatLng) { [lat, lon] = manualLatLng; }
    else {
      const last = await getLastKnownLocation();
      if (last) { [lat, lon] = last; }
    }
  }

  // 2) converti HEIC → JPEG se serve
  let uploadBlob = file;
  const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (isHeic) {
    uploadBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
  }

  // 3) nome file per lo storage
  const ext = isHeic ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // 4) upload su Storage
  const { error: upErr } = await sb.storage.from("photos").upload(path, uploadBlob, {
    contentType: isHeic ? "image/jpeg" : file.type || "image/jpeg",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: pub } = sb.storage.from("photos").getPublicUrl(path);

  // 5) reverse-geocoding (nome del luogo) — opzionale
  let place = null;
  if (lat != null) place = await reverseGeocode(lat, lon);

  // 6) salva riga
  const { error: insErr } = await sb.from("photos").insert({
    url: pub.publicUrl, caption: caption || null,
    taken_at: takenAt, lat, lon, place,
  });
  if (insErr) throw insErr;
}

async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=it&zoom=12`
    );
    const j = await r.json();
    const a = j.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county;
    return [city, a.country].filter(Boolean).join(", ") || j.display_name || null;
  } catch (_) { return null; }
}

/* ---------------------- DIARIO ---------------------- */
async function loadDiary() {
  const list = document.getElementById("diary-list");
  if (!sb) { list.innerHTML = `<p class="empty">Nessun post ancora.</p>`; return; }

  const { data, error } = await sb
    .from("diary").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }

  if (!data || data.length === 0) {
    list.innerHTML = `<p class="empty">Il diario è ancora vuoto. Scrivi il primo post! ✍️</p>`;
    return;
  }
  list.innerHTML = data.map((d) => `
    <article class="diary-entry">
      ${d.title ? `<h3>${escapeHtml(d.title)}</h3>` : ""}
      <p class="date">${fmtDateTime(d.created_at)}</p>
      <p class="text">${escapeHtml(d.body)}</p>
    </article>`).join("");
}

document.getElementById("diary-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sb) return alert("Configura prima Supabase (config.js).");
  const title = document.getElementById("diary-title").value.trim();
  const body = document.getElementById("diary-body").value.trim();
  if (!body) return;

  const status = document.getElementById("diary-status");
  status.textContent = "Pubblico…";
  const { error } = await sb.from("diary").insert({ title: title || null, body });
  if (error) { status.textContent = "Errore: " + error.message; return; }

  status.textContent = "✅ Pubblicato!";
  document.getElementById("diary-title").value = "";
  document.getElementById("diary-body").value = "";
  loadDiary();
});

/* ---------------------- UTILI ---------------------- */
function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("it-IT", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch (_) { return iso; }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------------- AVVIO ---------------------- */
(async () => {
  await loadPlannedRoute();   // prima l'itinerario previsto
  await loadLocations();      // poi la scia reale sopra
  loadPhotos();
  loadDiary();
})();

// aggiorna la posizione ogni 30 secondi
if (configured) setInterval(loadLocations, 30000);
