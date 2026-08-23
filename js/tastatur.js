// Tastaturbedienung – zentral für ALLE Seiten.
//
// Warum eine gemeinsame Datei: Fokus-Verhalten muss überall gleich sein.
// Läge es in jeder Seite einzeln, würde es beim nächsten neuen Dialog
// wieder vergessen. Diese Datei kümmert sich um drei Dinge:
//
//   1. "Zum Inhalt springen"-Link  – sonst muss man sich durch die
//      komplette Navigation tabben, auf jeder Unterseite aufs Neue.
//   2. Modale Dialoge              – Fokus hinein, Fokus gefangen halten,
//      Escape schließt, Fokus danach zurück auf den Knopf, der ihn öffnete.
//   3. Escape für das Seitenmenü   – gleiche Erwartung wie beim Dialog.
//
// Das Skript arbeitet über einen Beobachter am DOM, damit es auch für
// Dialoge greift, die erst später erzeugt werden (z.B. der Melden-Dialog).

(function () {
  'use strict'

  // --- 1. Sprunglink -----------------------------------------------------
  function baueSprunglink() {
    const main = document.querySelector('main')
    if (!main || document.querySelector('.skip-link')) return
    if (!main.id) main.id = 'hauptinhalt'
    // Damit der Fokus wirklich im Inhalt landet und nicht nur die Seite scrollt.
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
    const link = document.createElement('a')
    link.className = 'skip-link'
    link.href = '#' + main.id
    link.textContent = 'Zum Inhalt springen'
    document.body.insertBefore(link, document.body.firstChild)
  }

  // --- 2. Modale Dialoge -------------------------------------------------
  const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

  function sichtbar(el) {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }
  function elementeIn(dialog) {
    return [...dialog.querySelectorAll(FOKUSSIERBAR)].filter(sichtbar)
  }

  let offenerDialog = null
  let fokusVorher = null

  function dialogGeoeffnet(overlay, alsDialog = true) {
    if (offenerDialog === overlay) return
    offenerDialog = overlay
    fokusVorher = document.activeElement

    // Das Seitenmenue ist eine <nav> und bleibt eine - nur Dialoge
    // bekommen die Dialog-Rolle.
    if (alsDialog) {
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
    }

    // Fokus hinein: erstes Eingabefeld, sonst erstes Bedienelement,
    // sonst der Kasten selbst (damit Screenreader dort ansetzen).
    const elemente = elementeIn(overlay)
    const feld = elemente.find(el => /^(input|textarea|select)$/i.test(el.tagName))
    const ziel = feld || elemente.find(el => !el.classList.contains('modal-close')) || elemente[0]
    if (ziel) {
      ziel.focus()
    } else {
      const box = overlay.querySelector('.modal-box') || overlay
      box.setAttribute('tabindex', '-1')
      box.focus()
    }
  }

  function dialogGeschlossen(overlay) {
    if (offenerDialog !== overlay) return
    offenerDialog = null
    overlay.removeAttribute('aria-modal')
    // Zurück dorthin, wo man vor dem Öffnen war.
    if (fokusVorher && document.contains(fokusVorher) && sichtbar(fokusVorher)) {
      fokusVorher.focus()
    }
    fokusVorher = null
  }

  function schliesse(overlay) {
    // Das Seitenmenü hat keinen Schließen-Knopf, aber ein Overlay dahinter,
    // das mitgeschlossen werden muss.
    if (overlay.id === 'sidebar') {
      document.getElementById('sidebar-overlay')?.classList.remove('open')
      overlay.classList.remove('open')
      return
    }
    // Sonst bevorzugt den echten Schließen-Knopf klicken – dann läuft die
    // Aufräum-Logik der jeweiligen Seite mit (Felder leeren o.ä.).
    const knopf = overlay.querySelector('.modal-close, [data-schliessen]')
    if (knopf) knopf.click()
    else overlay.classList.remove('open')
  }

  document.addEventListener('keydown', e => {
    if (!offenerDialog) return
    if (e.key === 'Escape') {
      e.preventDefault()
      schliesse(offenerDialog)
      return
    }
    if (e.key !== 'Tab') return
    // Fokus-Falle: im Dialog im Kreis laufen statt dahinter zu verschwinden.
    const elemente = elementeIn(offenerDialog)
    if (!elemente.length) { e.preventDefault(); return }
    const erstes = elemente[0]
    const letztes = elemente[elemente.length - 1]
    const aktiv = document.activeElement
    if (!offenerDialog.contains(aktiv)) { e.preventDefault(); erstes.focus(); return }
    if (e.shiftKey && aktiv === erstes) { e.preventDefault(); letztes.focus() }
    else if (!e.shiftKey && aktiv === letztes) { e.preventDefault(); erstes.focus() }
  })

  function pruefeOverlay(overlay) {
    if (overlay.classList.contains('open')) dialogGeoeffnet(overlay)
    else dialogGeschlossen(overlay)
  }

  function beobachte(overlay) {
    if (overlay.dataset.tastaturAktiv) return
    overlay.dataset.tastaturAktiv = '1'
    new MutationObserver(() => pruefeOverlay(overlay))
      .observe(overlay, { attributes: true, attributeFilter: ['class'] })
    pruefeOverlay(overlay)
  }

  // --- 3. Seitenmenü (Off-Canvas) ---------------------------------------
  // Auf dem Handy schiebt sich das Menü über den Inhalt. Dann gelten die
  // gleichen Regeln wie beim Dialog: Fokus hinein, drin bleiben, Escape
  // schließt. Auf dem Desktop steht das Menü dauerhaft daneben — dort wäre
  // ein Fokussprung falsch, deshalb der Blick auf den Hamburger-Knopf:
  // ist er unsichtbar, sind wir im Desktop-Layout.
  function beobachteMenue() {
    const sidebar = document.getElementById('sidebar')
    if (!sidebar) return
    const toggle = document.getElementById('sidebar-toggle')

    function pruefe() {
      const offen = sidebar.classList.contains('open')
      const ueberlagert = toggle && sichtbar(toggle)
      if (offen && ueberlagert) dialogGeoeffnet(sidebar, false)
      else if (!offen) dialogGeschlossen(sidebar)
    }
    new MutationObserver(pruefe).observe(sidebar, { attributes: true, attributeFilter: ['class'] })
    pruefe()
  }

  function start() {
    baueSprunglink()
    document.querySelectorAll('.modal-overlay').forEach(beobachte)
    // Später erzeugte Dialoge (Melden-Dialog) mitnehmen.
    new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return
          if (n.classList?.contains('modal-overlay')) beobachte(n)
          n.querySelectorAll?.('.modal-overlay').forEach(beobachte)
        })
        m.removedNodes.forEach(n => {
          if (n.nodeType === 1 && n === offenerDialog) dialogGeschlossen(n)
        })
      }
    }).observe(document.body, { childList: true, subtree: true })
    beobachteMenue()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
