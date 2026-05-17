---
title: "Stored XSS in einer Schul-Lernplattform"
description: "Per Zufall entdeckte Stored XSS in einem Zertifikat-Workflow einer DACH-weit eingesetzten Lernsoftware. Acht Stunden bis zur Bestätigung, schneller Fix, freundlicher Mail-Verlauf."
date: 2025-06-15
category: bug-bounty
tags: [web, xss, disclosure, php]
disclosure: redacted
---

> **Branche:** EdTech (Schul-Lernsoftware, in mehreren DACH-Bundesländern und Schweizer Kantonen als Standardlehrmittel) &middot; **Schwachstelle:** Stored XSS &middot; **Disclosure:** 12.06.2025 &middot; **Fix:** wenige Tage später &middot; **Reward:** kleine PayPal-Spende

## Worum es geht

Die betroffene Plattform ist eine Lernsoftware für das 10-Finger-Tippsystem,
in mehreren DACH-Bundesländern und Schweizer Kantonen als Standardlehrmittel
in Schulen im Einsatz. Ich nutze sie selbst gelegentlich.

Beim Generieren eines Übungs-Zertifikats ist mir aufgefallen, dass der Pfad in
der URL ein wenig zu offen aussieht (Pfade hier und im Folgenden generalisiert):

```
http://app.<vendor>.tld/index.php?r=user/generateCertificate&cert_name=<MyName>
```

`r=user/generateCertificate` riecht nach einem Yii-Routing, der Wert von
`cert_name` ist eine Art Schlüssel für vordefinierte Phrasen, die das erreichte Niveau beschreiben. Wenn es keinen Wert für den Schlüssel gibt, landet es 1:1 im erzeugten Zertifikat. Die Frage stellte sich
automatisch: was passiert mit einem Wert, für den kein Mapping existiert?

## Die Lücke

`cert_name` wird beim Erzeugen des Zertifikats serverseitig **persistiert**
und gehört ab dann zum Zertifikat-Datensatz. Jedes Zertifikat bekommt einen
QR-Code mit einer **Verifikations-URL**, die den gespeicherten Wert beim
Aufruf rendert &mdash; ohne Output-Encoding. Damit: **Stored XSS**.

```
http://app.<vendor>.tld/index.php?r=user/generateCertificate&cert_name=<script>alert('XSS')</script>
```

Der entscheidende Unterschied zur reflected-Variante: **die schädliche URL
muss nicht mehr direkt zugestellt werden.** Der Angreifer erzeugt einmalig
ein „vergiftetes" Zertifikat. Ab dann ist der Payload Teil jedes Aufrufs der
Verifikations-Seite &mdash; auch von Personen, die den QR-Code in einem
völlig anderen Kontext gezeigt bekommen.

Realistischer Verbreitungsweg: Schüler\*innen senden sich Zertifikate
gegenseitig zu („schau mal, ich hab Stufe 5 geschafft"), drucken sie aus, oder
Lehrkräfte scannen den QR zur Verifikation. Der Trust-Anchor ist die Domain
selbst &mdash; niemand prüft, ob der Cert-Inhalt manipuliert ist.

## PoC

Der minimalste Fall reicht zum Beweis:

```
?cert_name=<script>alert('XSS')</script>
```

`alert()` feuert auf der Verifikationsseite. Damit ist klar:

- Beliebiges JavaScript läuft im Origin der Plattform
- Damit verfügbar: Session-Cookies (sofern nicht `HttpOnly`), DOM-Manipulation,
  Phishing-Overlays in vertrautem Look-and-Feel, Redirects auf externe Seiten

## Warum das hier besonders unglücklich ist

Bei Lernplattformen für Schulen kommen drei Faktoren zusammen, die das
Threat-Modell verschärfen.

#### 1. Persistenz

Reflected-XSS muss man aktiv zustellen &mdash; Mail, Chat,
präparierter Link. Stored-XSS dagegen wird einmal eingeschleust und feuert
danach bei jedem Aufruf der betroffenen Seite. Eine vergiftete Cert-URL teilt
sich von selbst, sobald jemand stolz seinen Tipp-Erfolg weiterleitet.

#### 2. Vertrauenskontext
Schule und „offizielles Tool" sind autoritative
Marken; was von dort kommt, wird selten misstraut. Eine Phishing-Seite, die
*innerhalb* der Origin-Domain läuft und nach Zugangsdaten fragt, hätte hier
gute Trefferchancen &mdash; und eine einzige präparierte Cert-URL kann
beliebig oft re-zirkulieren, ohne dass der Angreifer aktiv beteiligt ist.

#### 3. Junge Zielgruppe
Der mediane Nutzer ist ein Kind, das Phishing-Heuristik
noch lernt. Indikatoren wie „URL prüfen", „auf HTTPS achten", „misstrauisch
bei Login-Aufforderungen" sind in der Altersgruppe selten verankert.

## Disclosure-Timeline

| Datum | Vorgang |
|---|---|
| 12.06.2025, 01:29 | Meldung an Vendor-Support mit PoC und Reproduktions-Schritten |
| 12.06.2025, 09:39 | Bestätigung („wir schauen uns das sofort an") |
| 12.06.2025, 10:06 | Rückmeldung mit Bug-Eingeständnis und Reward-Angebot |
| ~Juni 2025 | Fix deployed, Verhalten der Verifikationsseite geprüft |
| Mai 2026 | Anfrage zur Veröffentlichung; Permission erteilt mit Anonymisierungs-Wunsch |