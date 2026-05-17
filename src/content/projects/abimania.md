---
title: "Abimania 2025 -- Online-Ticketsystem"
summary: "Eigenverantwortliches Setup, Deployment und Betrieb eines Pretix-basierten Ticketsystems für die Abi-Veranstaltung -- 350 Plätze, 136 Käufe, zwei Wochen ohne Downtime."
stack: [Docker, Pretix, Django, PayPal, Grafana, VPS]
status: archived
date: 2025-06-01
featured: true
---

Konzipiert, deployed und betrieben -- End-to-End-Verantwortung inklusive
Kunden-Support beim Kauf und Check-in vor Ort.

- VPS-Setup unter Linux, Containerisierung mit Docker, Reverse-Proxy-Konfiguration
- Pretix als Ticketing-Backend mit PayPal-Anbindung
- Eigenes Django-Plugin zur Echtzeit-Anzeige verfügbarer Sitzplätze
- Monitoring und Log-Aggregation via Grafana
