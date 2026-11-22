// Gewerbenachweis im Firmen-Dashboard (22.11.2026)
//
// Freiwillig. Wer ein Gewerbe hat, laedt Gewerbeanmeldung oder
// Handelsregisterauszug hoch; der Betreiber prueft und vergibt das
// Abzeichen "Gewerbe nachgewiesen". Privatleute brauchen das nicht.
//
// Die Datei liegt in der privaten Ablage `verifizierung` unter
// <id>/gewerbe.<endung> - dieselbe wie der Schuelerausweis, mit denselben
// Regeln (nur der eigene Ordner, sonst nur Admins). Nach der Pruefung
// wird sie geloescht; die Datenbank vergibt das Abzeichen sonst gar
// nicht (supabase/gewerbe-nachweis.sql).

import { supabase } from './supabase.js'
import { toast } from './toast.js'
import { verstaendlich } from './zustand.js'
import { dokumentPfad, pruefeFuerBucket, verwaisterPfad } from './dokument-pfad.js'

let profil = null

function kasten() { return document.getElementById('gewerbe-box') }

export function initGewerbe(p) {
  profil = p
  if (!kasten()) return
  zeige()
}

function zeige() {
  const box = kasten()
  if (profil.gewerbe_geprueft) {
    box.innerHTML = `
      <p class="gewerbe-stand gewerbe-stand--ok"><b>✓ Gewerbe nachgewiesen</b></p>
      <p class="ll-feldhilfe">Das Abzeichen steht auf deiner Firmenseite und bei jeder Anzeige.
        Den Nachweis selbst haben wir nach der Prüfung gelöscht.</p>`
    return
  }
  const liegtVor = !!profil.gewerbe_url
  box.innerHTML = `
    ${liegtVor
      ? `<p class="gewerbe-stand"><b>⏳ Dein Nachweis wird geprüft.</b></p>
         <p class="ll-feldhilfe">Danach löschen wir ihn wieder. Falsche Datei erwischt? Lade einfach eine andere hoch.</p>`
      : `<p class="ll-feldhilfe">Freiwillig. Hast du ein Gewerbe, lade die Gewerbeanmeldung oder einen
           Handelsregisterauszug hoch (PDF oder Foto, höchstens 6 MB). Nach unserer Prüfung steht
           <b>„✓ Gewerbe nachgewiesen“</b> bei deinen Anzeigen – das gibt Schülern und Eltern Sicherheit.
           Den Nachweis löschen wir nach der Prüfung. Privatleute, etwa wer einen Babysitter sucht,
           brauchen das nicht.</p>`}
    <input type="file" id="gewerbe-datei" accept="image/*,application/pdf" aria-label="Gewerbenachweis auswählen" style="display:none;">
    <button type="button" class="btn btn-outline" id="gewerbe-btn">${liegtVor ? 'Andere Datei hochladen' : 'Nachweis hochladen'}</button>`
  box.querySelector('#gewerbe-btn').addEventListener('click', () => box.querySelector('#gewerbe-datei').click())
  box.querySelector('#gewerbe-datei').addEventListener('change', ladeHoch)
}

async function ladeHoch(e) {
  const datei = e.target.files[0]
  if (!datei) return
  const pruefung = pruefeFuerBucket(datei, 'verifizierung')
  if (!pruefung.ok) {
    toast(pruefung.fehler, 'fehler')
    e.target.value = ''
    return
  }
  const pfad = dokumentPfad(profil.id, 'gewerbe', datei.type)
  if (!pfad) {
    toast('Dieses Dateiformat können wir nicht speichern.', 'fehler')
    e.target.value = ''
    return
  }
  const btn = document.getElementById('gewerbe-btn')
  btn.disabled = true
  btn.textContent = 'Wird hochgeladen…'

  const { error: hochErr } = await supabase.storage.from('verifizierung')
    .upload(pfad, datei, { upsert: true, contentType: datei.type })
  if (hochErr) {
    toast(verstaendlich(hochErr), 'fehler')
    zeige()
    return
  }
  // Erst jpg, dann pdf: sonst bliebe die alte Datei fuer immer liegen.
  const alt = verwaisterPfad(profil.gewerbe_url, pfad)
  if (alt) await supabase.storage.from('verifizierung').remove([alt])

  const { error } = await supabase.from('profiles').update({ gewerbe_url: pfad }).eq('id', profil.id)
  if (error) {
    toast(verstaendlich(error), 'fehler')
    zeige()
    return
  }
  profil = { ...profil, gewerbe_url: pfad }
  zeige()
  toast('Nachweis hochgeladen – wir sehen ihn uns an')
}
