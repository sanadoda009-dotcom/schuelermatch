# Deutsche E-Mail-Vorlagen für Supabase Auth

Die Auth-Mails von Supabase (Bestätigung, Passwort-Reset) sind standardmäßig **englisch**.
Hier sind deutsche Vorlagen im SchülerMatch-Design – passend zu den Mails, die die
Edge Function `mail-ereignis` verschickt.

## Wo einfügen
Supabase → **Authentication** → **Emails** → Reiter **Templates** → jeweiliges Template
auswählen → Betreff + HTML ersetzen → **Save**.

## Hinweise
- `{{ .ConfirmationURL }}` usw. sind Supabase-Platzhalter – **nicht übersetzen oder ändern**.
- Absender ist bereits die eigene Domain (Custom SMTP über Resend, `no-reply@mail.schuelermatch.de`).
- Die Button-Farbe startet bei `#00795c` statt `#00c896`: dunkler, damit weiße Schrift
  gut lesbar ist (gleiche Anpassung wie auf der Website, Kontrast-Fix aus dem Impeccable-Audit).
- Nur diese 3 Vorlagen sind für SchülerMatch relevant. „Magic Link", „Invite user" und
  „Reauthentication" werden aktuell nicht genutzt – die kannst du englisch lassen.

---

## 1. Confirm signup  (Registrierungs-Bestätigung)

**Betreff:**
```
Bestätige deine E-Mail-Adresse
```

**HTML:**
```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#161a1f">
  <div style="height:4px;background:linear-gradient(120deg,#00c896,#2b2f8f);border-radius:4px"></div>
  <div style="padding:24px 4px">
    <h2 style="font-family:sans-serif;margin:0 0 12px">Fast geschafft! 🎉</h2>
    <p style="line-height:1.6">Willkommen bei SchülerMatch. Klick auf den Button, um deine
    E-Mail-Adresse zu bestätigen – danach kannst du dich einloggen.</p>
    <p style="margin:22px 0">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:linear-gradient(120deg,#00795c,#2b2f8f);color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold">
        E-Mail bestätigen</a>
    </p>
    <p style="line-height:1.6;font-size:13px;color:#5a6270">Der Link ist aus Sicherheitsgründen
    nur begrenzt gültig. Falls der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:<br>
    <span style="word-break:break-all;color:#2b2f8f">{{ .ConfirmationURL }}</span></p>
    <p style="line-height:1.6;font-size:13px;color:#5a6270">Du hast dich gar nicht bei
    SchülerMatch angemeldet? Dann ignoriere diese E-Mail einfach – es passiert nichts.</p>
  </div>
  <p style="font-size:12px;color:#9aa0a8;border-top:1px solid #e7e3da;padding-top:14px">
    Du bekommst diese E-Mail von SchülerMatch, weil sich jemand mit dieser Adresse registriert hat.
  </p>
</div>
```

---

## 2. Reset Password  (Passwort vergessen)

**Betreff:**
```
Neues Passwort für SchülerMatch
```

**HTML:**
```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#161a1f">
  <div style="height:4px;background:linear-gradient(120deg,#00c896,#2b2f8f);border-radius:4px"></div>
  <div style="padding:24px 4px">
    <h2 style="font-family:sans-serif;margin:0 0 12px">Passwort zurücksetzen</h2>
    <p style="line-height:1.6">Du hast ein neues Passwort für dein SchülerMatch-Konto
    angefordert. Klick auf den Button, um eins festzulegen.</p>
    <p style="margin:22px 0">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:linear-gradient(120deg,#00795c,#2b2f8f);color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold">
        Neues Passwort festlegen</a>
    </p>
    <p style="line-height:1.6;font-size:13px;color:#5a6270">Der Link ist aus Sicherheitsgründen
    nur begrenzt gültig. Falls der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:<br>
    <span style="word-break:break-all;color:#2b2f8f">{{ .ConfirmationURL }}</span></p>
    <p style="line-height:1.6;font-size:13px;color:#5a6270"><b>Warst du das nicht?</b> Dann
    ignoriere diese E-Mail. Dein Passwort bleibt unverändert und niemand kann auf dein Konto zugreifen.</p>
  </div>
  <p style="font-size:12px;color:#9aa0a8;border-top:1px solid #e7e3da;padding-top:14px">
    Du bekommst diese E-Mail von SchülerMatch, weil für dein Konto ein neues Passwort angefordert wurde.
  </p>
</div>
```

---

## 3. Change Email Address  (E-Mail-Adresse ändern)

**Betreff:**
```
Bestätige deine neue E-Mail-Adresse
```

**HTML:**
```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#161a1f">
  <div style="height:4px;background:linear-gradient(120deg,#00c896,#2b2f8f);border-radius:4px"></div>
  <div style="padding:24px 4px">
    <h2 style="font-family:sans-serif;margin:0 0 12px">E-Mail-Adresse ändern</h2>
    <p style="line-height:1.6">Du möchtest die E-Mail-Adresse deines SchülerMatch-Kontos
    ändern – von <b>{{ .Email }}</b> zu <b>{{ .NewEmail }}</b>. Bestätige die Änderung mit einem Klick.</p>
    <p style="margin:22px 0">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:linear-gradient(120deg,#00795c,#2b2f8f);color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold">
        Änderung bestätigen</a>
    </p>
    <p style="line-height:1.6;font-size:13px;color:#5a6270">Falls der Button nicht funktioniert,
    kopiere diese Adresse in deinen Browser:<br>
    <span style="word-break:break-all;color:#2b2f8f">{{ .ConfirmationURL }}</span></p>
    <p style="line-height:1.6;font-size:13px;color:#5a6270"><b>Warst du das nicht?</b> Dann
    ignoriere diese E-Mail – deine Adresse bleibt unverändert.</p>
  </div>
  <p style="font-size:12px;color:#9aa0a8;border-top:1px solid #e7e3da;padding-top:14px">
    Du bekommst diese E-Mail von SchülerMatch, weil für dein Konto eine neue Adresse hinterlegt werden soll.
  </p>
</div>
```
