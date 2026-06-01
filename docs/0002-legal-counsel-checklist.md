# Legal counsel briefing — Mach-Zero

> **Not legal advice.** This is the engineering team's checklist for a
> first conversation with a fintech / trading-product lawyer. It states
> what the product is, what we already do, what we believe is true about
> our regulatory posture, and the questions we need counsel to confirm
> or correct.

---

## 1. What Mach-Zero is (and isn't)

**Mach-Zero is software** — an algorithmic trading platform users run
against their own exchange accounts. It is **not**:

- A broker-dealer. We don't take orders for our own book or route on
  behalf of customers; we publish orders the user has signed with their
  own API key.
- A custodian. User capital lives at the exchange (Binance / NSE).
  We never hold customer funds.
- An RIA / investment adviser (we believe — please confirm). Marketplace
  strategies are general-purpose templates published one-to-many, not
  tailored advice for a specific client.
- A payment processor or money transmitter. No fiat flows through us.
- A market data vendor (we redistribute exchange-owned data only to the
  user who already has access via their account).

**Architecture summary** (relevant for liability scoping):

- Web UI (Vercel) + Postgres (Supabase).
- Trading engine in C++ on a single Oracle Cloud VM. ~80ns p99 risk gate.
- Users connect via Binance API key (testnet or main) or NSE broker
  credentials. Keys are encrypted at rest in our DB, decrypted only in
  the engine process when an order is being signed.
- Multi-tenant: per-tenant kill switches, per-tenant risk limits
  (position cap, order rate, max order size, price band), per-tenant
  audit log. (Just landed in PR #N — the SBE tenant isolation work.)
- "Mock" mode (paper trading) and "Live" mode (real orders); LIVE
  requires an explicit confirmation step (HTTP 428).

---

## 2. Documents we need drafted

In rough priority order:

1. **Terms of Service** — primary contract
2. **Risk Disclosure** — must be acknowledged before LIVE mode
3. **Privacy Policy** — GDPR/CCPA-compliant if any EU/CA traffic
4. **Acceptable Use Policy** — what users can't do (market manipulation,
   sanctioned-country access, sharing accounts, etc.)
5. **Cookie Policy** (if EU traffic warrants)
6. **Data Processing Addendum** template for any B2B / enterprise tier
7. **Subprocessor list** — must be public; current list:
   - Supabase (Postgres host) — US-incorporated; data region per Supabase project (currently AWS `ap-south-1` Mumbai)
   - Vercel (web app host) — US
   - Oracle Cloud (engine host) — US/India regions
   - Google (OAuth)
   - SMTP provider (currently Nodemailer-default; needs replacement
     before scale)
   - Stripe (when billing lands)
   - PostHog (when analytics lands)
   - QuestDB (self-hosted on the Oracle VM, not a separate processor)

---

## 3. Critical clauses we want in the ToS

For each, please advise on enforceability in the relevant jurisdictions
(US, EU, UK; **not** India initially — see §5).

- **Limitation of liability** — cap at fees paid by user in the trailing
  12 months. Consequential / lost-profits carve-out.
- **Indemnification** — user is liable for losses occurring on their
  own exchange account. We are not party to the user's broker
  relationship.
- **No investment advice** — software is general-purpose; nothing in the
  marketplace is a recommendation to buy/sell.
- **Self-help rights** — we can:
  - Activate kill switch on any tenant if we observe suspected market
    abuse, sanctioned-country activity, or technical malfunction.
  - Force square-off positions in the same scenarios.
  - Suspend or terminate accounts for ToS violations without notice.
  Are these enforceable? Especially the force-square-off — it generates
  market orders on the user's account.
- **Termination** — both parties may terminate. We retain the right to
  refuse service. On termination, user data deleted within 90 days
  unless retention is required (financial records).
- **Assignment / change of control** — we can assign in M&A scenarios.
- **Arbitration vs class action waiver** — preferred. Confirm whether
  this is enforceable in CA/EU.
- **Governing law / venue** — Delaware (assumed; see §10).
- **Warranty disclaimer** — software provided "as is."
- **Force majeure** — exchange outages, network failures.
- **Modification** — we can modify ToS with N days' notice; continued
  use = acceptance.

---

## 4. Risk Disclosure — what must be acknowledged

- "Algorithmic trading carries the risk of substantial loss. Past
  performance does not predict future results."
- "On margin/derivative products, you can lose more than your initial
  deposit."
- "Strategies displayed in the marketplace include backtested
  performance. Backtests are not guarantees of live performance and may
  not account for slippage, fees, or market impact."
- "The Mach-Zero engine has known latency / availability characteristics
  but is not a high-availability system. Outages may prevent order
  cancellation or square-off."
- "You are responsible for your own tax, regulatory, and reporting
  obligations on the trades you execute."

**Question for counsel:** what's the right *placement* for this? Today:
single one-line reference on the login page. Plan: gate per-strategy
LIVE activation behind an explicit acknowledgment with a copy of the
disclosure shown. Is that sufficient, or do we need a separately-signed
Risk Disclosure document on first signup?

---

## 5. Jurisdiction-specific landmines

### USA

1. **Investment Advisers Act of 1940** — we believe Mach-Zero stays
   under the **publisher's exception** (15 USC §80b-2(a)(11)(D)):
   strategies are published one-to-many, not tailored. Marketplace
   templates are bona fide publications, not personalized advice.
   - Question: does displaying historical backtest performance change
     this analysis?
   - Question: does our `"Featured" / sortable / filterable` UI tip
     into "advice" — i.e., we're saying "this strategy is good"?
   - Question: at what point does a user-customized strategy become
     "advice"?
2. **CFTC** — Binance offers perpetual futures. If we facilitate US
   users trading those, we're touching CFTC-regulated derivatives.
   - Action: gate Binance perpetual symbol IDs to non-US users only,
     OR require user to confirm their Binance account is not under US
     residency.
3. **State money transmitter / BitLicense (NY)** — should be N/A since
   we never hold custody. Please confirm.
4. **FinCEN MSB** — same. We don't transmit money.
5. **State data breach notification** — varies. We will need a US
   counsel to maintain a state-by-state notification timing matrix.
6. **State-level fiduciary regs (e.g., MA, NV)** — please flag if
   relevant.

### EU / EEA

1. **MiCA (Markets in Crypto-Assets Regulation)** — effective 2024.
   - Article 3(1)(19) "reception and transmission of orders" and
     Article 3(1)(21) "execution of orders" — does our software fall
     under either?
   - Our position: no, because the user signs and submits the order
     with their own credentials; we are a tooling provider. Counsel
     please confirm.
   - If counsel concludes we *do* fall under MiCA: what's the
     authorization timeline? Cost?
2. **MiFID II** — likely N/A for crypto-only operations, but if NSE
   equities are exposed to EU users this applies.
3. **GDPR**:
   - Standard Contractual Clauses with US-based subprocessors (Supabase,
     Vercel, Oracle, Google, Stripe, PostHog).
   - Article 30 records of processing.
   - Subject access / deletion endpoints.
   - DPO requirement — likely no, but counsel should confirm given the
     volume.
4. **UK (post-Brexit)** — FCA. We believe out of scope under FCA's
   "regulated activities" since we're non-custodial software, but
   please confirm.

### India

1. **SEBI Investment Adviser Regulations 2013** — strict registration
   requirements; "investment advice" defined broadly.
2. **SEBI Research Analyst Regulations 2014** — similar.
3. **RBI/FEMA** — crypto in India is in legal grey; INR-to-crypto rails
   are restricted. Our NSE gateway is currently a simulator only.
4. **Position**: we do not market to or onboard Indian residents until
   either (a) SEBI IA/RA registration completes, or (b) we partner with
   an existing SEBI-licensed broker who fronts the customer
   relationship.
5. Action item: implement IP-based + signup-form residency-declaration
   geo-blocking for India.

### Sanctions (universal)

- OFAC SDN list and country sanctions — we must geo-block:
  - Iran, North Korea, Cuba, Syria, Crimea/Donetsk/Luhansk, Russia
    (partial — comprehensive on financial services).
- Action: implement at signup time using a geo-IP service + a
  user-attested country field. Re-check at LIVE-mode activation.

### Other countries we may need country-specific advice for

Brazil (LGPD), Singapore (MAS), UAE (VARA), Canada (provincial
securities regulators).

---

## 6. API key handling — questions for counsel

We encrypt user exchange credentials at rest (`apps/web/lib/crypto.ts`).
Key material lives in env-var KMS-equivalent. Specifically:

- Are we required to specify *how* keys are encrypted (algorithm, key
  rotation cadence) in the ToS?
- Do any jurisdictions require a specific certification (FIPS-140-2,
  SOC 2) for storing exchange credentials?
- On account deletion, key material is purged within 24h. Sufficient?
- What's our liability if Mach-Zero is breached and user keys leak?
  Specifically: a leaked key with withdrawal permission could drain a
  user's exchange account.
- Is it sufficient to *recommend* users disable withdrawal permissions
  on their API keys, or do we need to refuse to accept keys that have
  withdrawal enabled?
  - Engineering plan: validate Binance key permissions on connect, warn
    or block if withdrawal is enabled.

---

## 7. Backtest / performance display

The marketplace shows for each strategy template:

- `returnPct` — backtested historical return
- `winRate`
- `sharpeRatio`
- `maxDrawdown`
- `totalTrades`

**Questions for counsel:**

1. What disclaimers must accompany these numbers?
2. Is "backtested" sufficient, or must we say "hypothetical performance
   based on a model that does not include slippage, fees, or market
   impact"?
3. SEC Marketing Rule / similar in EU — do those apply to a publisher
   showing backtests, or only to advisers?
4. Time-period transparency — must we disclose the date range of the
   backtest?

---

## 8. Operational / compliance hygiene

- **Audit log** — Prisma `AuditLog` model exists; UI viewer is a
  follow-up. Records every kill-switch toggle, square-off, mode change,
  account/strategy mutation.
  - Question: retention period? Trading-firm conventions are 5–7 years.
- **Data retention** — trades, orders, risk events stored in QuestDB
  indefinitely today. Need a retention policy.
- **Incident response runbook** — we don't have one yet. Counsel please
  point at a template. SOC 2 Type I is downstream.
- **Breach notification** — assume 72h for GDPR; varies by US state.
  We'll build a notification process when a real customer asks.
- **Background checks** for employees with database access — when
  applicable.

---

## 9. Items in our current codebase that need legal sign-off

| Item | Where | Question |
|---|---|---|
| "By continuing, you agree to the terms of service" | login page footer | Is this sufficient assent for the ToS? |
| Marketplace strategy "minCapital" advice | `MarketplaceTemplateCard` | Are we crossing into advice if we tell a user "you need ≥$X for this strategy"? |
| Per-strategy LIVE confirmation gate | `StrategyCard` | Sufficient for a binding "I acknowledge risk" record? |
| Force square-off | `/api/square-off` | Does the ToS as drafted give us this right unambiguously? |
| Email magic-link sign-in | NextAuth Nodemailer | Are there CAN-SPAM / EU equivalents to consider? |

---

## 10. Operating entity / corporate setup

Recommended posture for a US fintech accepting VC investment:

- **Delaware C-Corp**.
- IP assignment agreements signed by every contributor (including any
  prior contractors). This is a diligence killer if missed.
- Founder vesting (4-year, 1-year cliff) on day-one shares.
- Cap table reviewed by counsel before any priced round.
- If the founding team is outside the US: "flip" structure with a US
  Delaware parent and a foreign subsidiary (e.g., India Pvt Ltd) that
  is a wholly-owned operating sub. Both US VCs and Indian investors
  expect this.

---

## 11. Insurance — to discuss with broker

- **E&O / Cyber liability** — algorithmic trading product, mid-six-figure
  starting limit recommended.
- **D&O** — once we take outside investment.
- **General liability** — table stakes.

---

## 12. Action items punch list

In approximately the order they unblock revenue:

- [ ] Engage trading-product fintech counsel (1–3 weeks lead time).
- [ ] Determine: are we under MiCA / Investment Advisers Act / FCA?
- [ ] Confirm publisher's exception applicability for the marketplace.
- [ ] Counsel drafts ToS, risk disclosure, privacy policy.
- [ ] Counsel reviews backtest display disclaimers.
- [ ] Counsel reviews self-help / kill-switch / square-off clauses.
- [ ] Implement geo-blocking for sanctioned countries + India at signup.
- [ ] Implement Binance key permission validator (block / warn on
  withdrawal-enabled keys).
- [ ] Build risk-acknowledgment gate per-strategy at LIVE activation.
- [ ] Add subprocessor list to privacy policy (live before any GDPR
  user signs up).
- [ ] Document data retention policy (QuestDB + Postgres + audit log).
- [ ] Document incident response runbook.
- [ ] Confirm IP assignment from every past contributor.
- [ ] Set up Delaware C-Corp / flip structure if not done.
- [ ] D&O / E&O insurance — quote.
- [ ] SOC 2 readiness — start once a customer asks.

---

## 13. Items we are NOT asking counsel to do (yet)

- M&A / acquisition contracts
- Tax structuring (separate accountant)
- Patents / trade secret protection beyond IP assignment
- Employment law beyond contractor IP assignment
- HR policies / handbook
- Government contracts / sales to regulated entities

---

## 14. Engineering changes that depend on legal answers

These are blocked until counsel responds:

| Engineering change | Blocked on |
|---|---|
| Final ToS / Privacy Policy text in onboarding | Counsel-drafted documents |
| Risk acknowledgment text at LIVE activation | Counsel-drafted disclosure |
| Backtest display disclaimer wording | Counsel review |
| EU-vs-US-vs-India content gating | MiCA + SEBI rulings |
| Marketplace "Featured" UX (does it tip into advice?) | Publisher's exception ruling |
| Account-key withdrawal-permission policy (warn vs block) | Liability analysis |

These are NOT blocked and we will continue:

- Stripe billing scaffold
- Onboarding walkthrough hardening
- Geo-blocking for sanctioned countries (purely technical; no legal
  ambiguity)
- PostHog funnel instrumentation
- Multi-tenant Python bridge
- SOC 2 readiness preparation (logging, access reviews) without the
  audit itself
