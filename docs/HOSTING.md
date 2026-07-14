# Hosting API — analiza kosztów (stan: 2026-07-06)

Kontekst: API (NestJS) stoi na **Render free** i usypia po 15 min bezczynności —
zimny start ~30–60 s, a do tego znika cache in-memory panelu „loty dalsze"
(okna Wizza, dni Google). Frontend (Cloudflare Pages), baza (Neon free)
i silnik (GitHub Actions cron) są darmowe i nie ma powodu ich ruszać —
poniższa analiza dotyczy wyłącznie API.

## Porównanie opcji (mały ruch, hobby)

| Opcja | Koszt | Nie usypia? | Uwagi |
|---|---|---|---|
| **Render free + pinger** ✅ wdrożone | 0 zł | tak (obejście) | Ping `/health` co 10 min; 750 h/mies. limitu starcza na 1 serwis 24/7. Cache i tak znika przy deployu/restarcie. |
| **Oracle Cloud Always Free** | 0 zł | tak | ARM do 4 rdzeni / 24 GB RAM, na zawsze. Haczyki: kapryśna rejestracja, bywa brak wolnych ARM w regionie, samodzielny VPS. Najlepsza darmowa opcja „na poważnie". |
| **Mikrus 2.1** | 75 zł/rok (~6 zł/mies.) | tak | 1 GB RAM, Docker, LXC (Helsinki). Brak własnego IPv4 → HTTPS przez Cloudflare Tunnel/AAAA. Ryzyko: współdzielone IP wychodzące może łapać 403/429 od Ryanaira/Wizza/Google — do sprawdzenia w praniu. Mikrus 1.0 (35 zł/rok, 384 MB, bez Dockera) — na styk, goły Node+systemd. |
| **Fly.io** | ~$2–4/mies. | tak | shared-cpu 256–512 MB, Frankfurt, deploy z Dockerfile, shared IPv4 w cenie. Najmniej dłubania z płatnych. |
| **Render Starter** | $7/mies. | tak | Zero migracji — jedno pole w dashboardzie. |
| **AWS Lightsail** | $5/mies. | tak | 512 MB, stały IP. Najprostszy „prawdziwy AWS". |
| **AWS EC2 t4g.nano** | ~$7–8/mies. | tak | $3 instancja + $1 EBS + $3.6 publiczny IPv4. Więcej pracy niż Lightsail, bez korzyści. |
| **AWS Lambda + API GW** | ~0–1 $/mies. | n/d | Odpada: gubi cache in-memory między wywołaniami, a fan-out Google trwa 60 s+. Wymagałoby Redis/DynamoDB na cache. |
| **AWS App Runner / Fargate 24/7** | $9–15/mies. | tak | Za drogo jak na ten projekt. |
| **RDS zamiast Neona** | +$15–20/mies. | — | Nie ruszać — Neon free wystarcza. |

## Rekomendacja (kolejność)

1. **Pinger na Render free (0 zł)** — wdrożone: `.github/workflows/keepalive.yml`
   pinguje `https://lotsy-api.onrender.com/health` ~co 10 min (nietypowe
   minuty, bo GitHub dławi crony o okrągłych). **Uwaga (potwierdzone w
   praktyce 2026-07-06):** cron GitHuba jest best-effort — potrafił odpalić
   raz na kilka godzin. Jeśli po zmianie minut nadal gubi strzały, jako
   podstawowy pinger załóż darmowy monitor HTTP w
   [UptimeRobot](https://uptimerobot.com) (interwał 5 min, URL
   `https://lotsy-api.onrender.com/health`) — 2 minuty klikania, wymaga
   założenia konta. GitHub dodatkowo wyłącza harmonogramy po ~60 dniach bez
   aktywności w repo (mail + „re-enable").
2. Jeśli Render zacznie przeszkadzać (limity, restarty kasujące cache):
   **Oracle Free** (0 zł, więcej pracy) albo **Mikrus 2.1 / Fly.io** (grosze,
   mniej pracy). Do Mikrusa/Oracle potrzebny Dockerfile + Cloudflare Tunnel
   i podmiana `apiUrl` w `frontend/src/environments/environment.prod.ts`.

## GitHub Actions — limit minut (incydent 2026-07-14)

2026-07-13 ~23:30 wszystkie workflow zaczęły padać z komunikatem o billingu:
skończyło się **2000 darmowych minut/mies. dla prywatnego repo**. Keepalive
(~150 min/dzień, już usunięty — API pinguje się samo) tylko przyspieszył to,
co i tak by nastąpiło: same silniki (search + oneway + charters co 3 h) palą
~350–400 min/dzień ≈ 10–12 tys. min/mies., czyli ~5× ponad darmowy limit.

Opcje:
1. **Repo publiczne (rekomendacja, 0 zł)** — publiczne repozytoria mają
   darmowe minuty bez limitu na standardowych runnerach. Jedno kliknięcie:
   Settings → General → Danger Zone → Change visibility (sekrety w Actions
   pozostają ukryte; upewnić się, że w historii repo nie ma credentiali).
2. Podbić spending limit — przy tym zużyciu ~$65–80/mies. Bez sensu.
3. Przenieść crony silników poza GitHub (np. na przyszły VPS/Mikrus) —
   opcja na później, wymaga własnego schedulera.

Ceny orientacyjne — sprawdzić aktualne cenniki przed decyzją.
