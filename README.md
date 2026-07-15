# 🚴 Sito Pietro — guida al setup

Sito-regalo per seguire Pietro nel suo viaggio in bici: **mappa live**, **galleria foto**
(con data e luogo dai metadati) e **diario di bordo**. Tutto gratis.

Stack: **Vercel** (hosting) + **Supabase** (database/foto) + **OwnTracks** (app iPhone) + **Leaflet/OpenStreetMap**.

---

## Passo 1 — Supabase (database + foto)

1. Vai su **https://supabase.com** → *Start your project* → registrati (gratis).
2. *New project* → dai un nome (es. `pietro`), scegli una password DB, regione **Europe (Frankfurt)**.
3. Apri **SQL Editor** → *New query* → incolla tutto il contenuto di [`supabase-schema.sql`](supabase-schema.sql) → **Run**.
   (crea le tabelle, lo storage foto e i permessi)
4. Vai in **Project Settings → API** e prendi nota di:
   - **Project URL** → es. `https://abcd.supabase.co`
   - **anon public** key (chiave pubblica)
   - **service_role** key (chiave SEGRETA — serve solo su Vercel, non va nel sito)

Poi apri [`config.js`](config.js) e incolla **Project URL** e **anon key**.

---

## Passo 2 — Vercel (mettere il sito online)

**Modo semplice (senza installare nulla):**
1. Metti questa cartella su un repo **GitHub** (posso aiutarti a farlo).
2. Vai su **https://vercel.com** → registrati con GitHub.
3. *Add New → Project* → importa il repo → **Deploy**.
4. Il sito sarà su un indirizzo tipo `https://pietro.vercel.app` (puoi cambiare il nome in *Settings → Domains*).

**Variabili d'ambiente** (Vercel → *Settings → Environment Variables*), servono all'endpoint della posizione:
| Nome | Valore |
|------|--------|
| `SUPABASE_URL` | il Project URL di Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | la chiave **service_role** (segreta) |
| `OWNTRACKS_SECRET` | una parola a piacere, es. `bici2026` |

Dopo averle aggiunte, fai *Redeploy*.

---

## Passo 3 — OwnTracks sull'iPhone di Pietro

1. Installa **OwnTracks** dall'App Store (gratis).
2. Apri l'app → concedi la posizione **"Sempre"** (serve per l'aggiornamento in background).
3. Impostazioni (icona ⓘ / *Settings*):
   - **Mode**: `HTTP`
   - **URL**: `https://TUO-SITO.vercel.app/api/owntracks?secret=bici2026`
     (usa lo stesso valore messo in `OWNTRACKS_SECRET`)
   - **TrackerID**: `P` (o quel che vuoi)
4. Modalità di tracciamento: **"Move"** aggiorna spesso (più preciso, più batteria);
   **"Significant"** aggiorna quando cambia zona (consigliata per durare 3 settimane).

Da quel momento la posizione compare da sola sulla mappa. ✅

---

## Foto — cose da sapere
- Pietro deve caricare le **foto originali** dal telefono (non inoltrate via WhatsApp,
  che cancella i metadati GPS).
- Gli iPhone salvano in **HEIC**: il sito le converte in automatico. In alternativa
  su iPhone → *Impostazioni → Fotocamera → Formati → Massima compatibilità* (salva in JPEG).
- Serve che il GPS della fotocamera sia attivo (di default lo è).

## Note
- Foto e diario sono **pubblici e senza login** (chiunque abbia il link può scrivere): scelta voluta, è una cosa tra amici.
- Piani gratuiti Supabase/Vercel ampiamente sufficienti per un viaggio di 3 settimane.
