# Phase 1 — Content ledger and approval gates

Branch: `upgrade/phase-1-narrative`. Nothing on this branch is published; `main` is untouched.
Prototype: `docs/phase-1/connections-prototype.html` (noindex, not linked from the live site).

## Why this file exists

Spec §"content provenance": the site must distinguish demonstrated work, firsthand accounts,
interpretation and unverified outcomes — and must not publish private material as if it were approved.
Every sentence in the Connections prototype is traceable to a line here.

## Ledger

Classes: **D** demonstrated (openable artefact) · **F** firsthand (her own record) ·
**I** interpretation (mine, offered as a reading) · **U** unverified · **A** needs her approval.

| # | Claim on the page | Class | Source | Status |
|---|---|---|---|---|
| 1 | Pulse Instinct records choices and hesitation, not stated preference | D | resume.html (Pulse Instinct paragraph); product exists | publishable |
| 2 | GramLingo has no placement test; the app is the test | D | gramlingo repo + her stated philosophy (2026-08-17) | publishable |
| 3 | Her IELTS: writing 6, reading 9 (listening/reading 8.5–9, speaking 8.5) | F | her own record, told to me | **A** — score numbers on a public page |
| 4 | BrainyBaobei computes the chart in code, then interprets | D | `@openfate/bazi-engine`, brainybaobei.onrender.com | publishable |
| 5 | BaZi chart ↔ preference profile is the "same question" | I | my reading | publishable as interpretation |
| 6 | ASOC = catalogue of Chinese intellectual heritage, classical texts | D | ancientscienceofchina.com | publishable |
| 7 | Her own training in those traditions links the two | F | memory (Wudang, 袁师懋; 小六壬/八字/紫微) | **A** — held off page |
| 8 | Pulse Branding stayed one person and built an agent pipeline | F/D | resume.html; Pulse Growth Engine | publishable |
| 9 | Eleven live products | D | index.html work grid (11 cards) | publishable — count is checkable |
| 10 | NeoLabCare pre-order, zero inventory, 7-day dispatch | D | her locked operating model | publishable |
| 11 | Firefly Global books + takes payment, no enquiry queue | D | booking flow + Stripe, live | publishable |
| 12 | Robotist site answers inbound with an embedded agent | D | site front end | publishable |
| 13 | "Smallest operational core" is a method, not just a constraint | I | my reading | publishable as interpretation |
| 14 | Project cards are labelled by evidence type; unverifiable claims dropped | D | index.html card labels; resume.html edit history | publishable |

Nothing in the prototype uses private conversation content, client-confidential material, or the
LoOI/Marriott proposal.

## Page architecture proposed for Phase 2

| Location | Change | Risk |
|---|---|---|
| `index.html` hero | unchanged | none |
| `index.html` #work | unchanged order, unchanged evidence labels | none |
| after #work | new teaser: 3 of 6 connections, one line each, "All six →" | low |
| `#how`, `#ways`, `contact` | unchanged | none |
| nav | add **Connections** between Work and How I work | low |
| new route | `/connections.html` — the six connections, full copy | new page |
| `#method` anchor | currently broken (nav links to a section that does not exist) — fix or remove | defect |

## The four decisions I need from her

1. **Her own practice** (Wudang training, 袁师懋, 六壬/八字/紫微). Recommended: one short paragraph
   inside connection 03, no teacher's name. Her call; nothing ships until she answers.
2. **IELTS numbers** on a public page. Recommended: yes — it is the evidence that makes connection 01
   more than a slogan. Alternative: keep the shape ("writing far below reading"), drop the digits.
3. **New route + nav item** `/connections.html`. Recommended: yes.
4. **Homepage teaser placement** after Work. Recommended: yes; keeps clients on the commercial path
   (hero → work → how → ways → contact) with curiosity as an optional branch, never a detour.

## Phase 0 baseline (recorded, not changed)

- Repo `lareesahu/lareesa-hu`, branch `main`, live at `lareesahu.github.io/lareesa-hu/`
  (HTTP 200, index.html 67,403 bytes = local HEAD byte-for-byte).
- Copy of the pre-work portfolio (verified 2026-10-20 16:14): filesystem copy
  `C:/Users/hunin/backups/lareesa-hu-backup-20261020-1607` (94 MB, `index.html` sha256
  `c2e3aa47…d97346` = live), git bundle `backups/lareesa-hu-20261020-main.bundle`, and the tag
  `backup-pre-upgrade-20261020` pushed to origin.
- Stack: static HTML, no build step, no CDN. Two self-hosted fonts (Tenor Sans, Geist), one WebGL
  hero (`assets/molten-metal.js`, 40 MB of models under `assets/models`).
- Bilingual EN/中文 via `data-en` / `data-zh` attributes; single `<h1>`; 11 lazy images, 10 videos.
- Preserve: palette (`#0b0a10`, `#f4f2f7`, `#ff8fd0`), type pairing, hero animation, the 11 work
  cards and their evidence labels, résumé page, routes `/`, `/resume.html`, `/work/welaab.html`.
- Defects found: broken `#method` anchor · no `Person` JSON-LD · 40 MB model payload on first paint
  (performance budget) · `<h1>` contains two hidden bilingual spans (screen-reader noise).
