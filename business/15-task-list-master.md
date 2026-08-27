# 15 — Master Task List

The single source of truth for what is done. Work it top to bottom. Do not
start a phase before its gate is passed.

**Gates are the point.** Each one prevents the most expensive mistake available
at that stage.

---

## Phase 0 — Decide *(1 week)*

- [ ] Read `01-business-model.md`
- [ ] Score three ideas with `03-idea-scorecard.md`, including one of your own
- [ ] Check the two automatic disqualifiers on the winner
- [ ] Write the ICP in one sentence
- [ ] Write the one-sentence product statement from `05`
- [ ] Calculate customers needed for $5k MRR at your intended price
- [ ] Commit in writing to the validation gate in `04`

> **GATE 0:** One idea scores 36+, has no disqualifying score, and you can name
> 20 real potential customers. → Phase 1.

---

## Phase 1 — Validate *(3 weeks, ~$250)*

### Week 1
- [ ] Build the 50-prospect list
- [ ] Research three incumbents: pricing, features, complaints
- [ ] Write the problem statement in customer language, with three verbatim quotes
- [ ] Define the wedge

### Week 2
- [ ] Email 30 prospects requesting 15 minutes
- [ ] Run 10 conversations
- [ ] Log every call
- [ ] Write the half-page verdict: is the pain real, urgent, budgeted?

### Week 3
- [ ] Register the domain
- [ ] Build the one-page site
- [ ] Set the price, publish it
- [ ] Make the ask: founding-member deposit or paid pilot
- [ ] Go back to all 50 prospects
- [ ] Post in the two places the ICP actually gathers
- [ ] Optional: $150 of high-intent search ads

> **GATE 1:** 5+ deposits, or 3 signed paid pilots. **No money = no build.**
> → Phase 2.

---

## Phase 2 — Set up the business *(1 week, ~$500–$2,500)*

### Legal and financial
- [ ] Apply for an ABN (free, via ABR)
- [ ] Check the name: ASIC register, IP Australia, domain availability
- [ ] Register the business name with ASIC if trading under a name
- [ ] Open a business bank account
- [ ] Open a separate tax-savings account
- [ ] Book and hold the accountant session — structure, GST, PAYG, deductions
- [ ] Set up accounting software with a bank feed
- [ ] Get quotes for professional indemnity and cyber insurance
- [ ] Engage a lawyer for terms of service
- [ ] Publish the privacy policy
- [ ] Write the refund policy onto the pricing page
- [ ] Create the subprocessor list page

### Accounts and infrastructure
- [ ] Domain and DNS
- [ ] Email hosting; create `support@` and `hello@`
- [ ] Code repository, private
- [ ] Hosting platform
- [ ] Managed Postgres
- [ ] Transactional email provider — verify the domain, configure SPF, DKIM, DMARC
- [ ] Payment provider — complete verification early, it takes days
- [ ] Error tracking
- [ ] Uptime monitoring
- [ ] Analytics, cookieless
- [ ] Password manager, with emergency access configured
- [ ] Calendar with every recurring obligation from `07`

> **GATE 2:** You can legally invoice, and a customer's money can reach your
> bank account. → Phase 3.

---

## Phase 3 — Build the MVP *(6–10 weeks, 20 hrs/week)*

### Foundation
- [ ] Repository, TypeScript, linting, formatting, CI on every push
- [ ] Local setup working with one command; document it in the README
- [ ] Staging and production environments
- [ ] Deploy-on-merge pipeline
- [ ] Secrets in the platform store; secret scanning in CI
- [ ] Database schema, migrations, seed data

### Core product
- [ ] Signup, email verification, login, password reset
- [ ] The one data-in method (`05`)
- [ ] **The core job** — the thing customers pay for. Spend the most time here
- [ ] The one primary output
- [ ] Settings page, under 8 controls
- [ ] Sample/demo data so the product is never an empty room

### Billing
- [ ] Plans and prices in the payment provider
- [ ] Trial with card required
- [ ] Checkout
- [ ] Webhooks: subscription created, updated, cancelled, payment failed
- [ ] Customer portal for card, invoices, plan changes, cancellation
- [ ] Dunning: retries, four emails, in-app banner, card-expiry notice
- [ ] Test every billing path in test mode, including cancellation and proration

### Reliability
- [ ] Automated daily backups
- [ ] **Restore test performed and timed** — record it in `14`
- [ ] Health endpoint that checks the database
- [ ] Structured logging with request IDs
- [ ] Error tracking wired up with alerts
- [ ] Uptime monitors on marketing site, app and health endpoint
- [ ] Post-deploy smoke test
- [ ] Alert thresholds from `13` configured
- [ ] Dependency update automation

### Data protection
- [ ] Minimum data collection reviewed
- [ ] Self-serve data export
- [ ] Deletion on request, and scheduled deletion after cancellation
- [ ] Admin access to customer data is logged

### Onboarding
- [ ] Three-step in-app checklist
- [ ] Empty states with a next action
- [ ] Nudge emails at 24h and 72h
- [ ] Time a stranger through it — **must be under 10 minutes unaided**

### Support infrastructure
- [ ] Helpdesk on `support@<DOMAIN>`
- [ ] All 15 canned replies from `11` written
- [ ] Docs site: getting started, core workflow, FAQ, billing
- [ ] Contextual help in the app
- [ ] Status page
- [ ] Published response-time promise

> **GATE 3:** A stranger can sign up, pay, reach first value and cancel — with
> no contact from you. Backups have been restored successfully at least once.
> → Phase 4.

---

## Phase 4 — Launch *(2 weeks)*

- [ ] Onboard the founding members personally. **This is the exception to
      self-serve** — watch each one and note every point of confusion
- [ ] Fix everything they stumbled on before launching wider
- [ ] Marketing site final: outcome headline, proof, pricing, FAQ
- [ ] Cornerstone guide published
- [ ] Three "how to" articles published
- [ ] One comparison / alternatives page published
- [ ] Free tool published, if applicable
- [ ] Email capture live with a real incentive
- [ ] Listed in every relevant directory and marketplace
- [ ] Announced to the two ICP communities
- [ ] Emailed all 50 prospects and everyone who nearly bought
- [ ] Contacted 10 potential referral partners
- [ ] Verify: analytics recording, emails not landing in spam, alerts firing

> **GATE 4:** Ten paying customers acquired without a personal conversation.
> → Phase 5.

---

## Phase 5 — Steady state *(ongoing, 10 hrs/week)*

Switch to `10-operating-rhythm.md`. The task list is now a calendar.

### Weekly
- [ ] Metrics review — the six numbers
- [ ] Support windows ×2, cleared to zero
- [ ] Publish one piece of content
- [ ] Ship one improvement
- [ ] Check errors, backups, failed payments
- [ ] Merge dependency updates

### Monthly
- [ ] Reconcile books; move 30% to tax
- [ ] **Check GST turnover against $75k**
- [ ] Churn review + personal emails to everyone who left
- [ ] Support log review → fix the top category
- [ ] Send the newsletter
- [ ] Update the metrics spreadsheet

### Quarterly
- [ ] **Backup restore test**
- [ ] BAS / PAYG if applicable
- [ ] Pricing review — raise for new customers if conversion is easy
- [ ] Feature request review — anything with 3+ paying askers
- [ ] Deprecate features under 5% usage
- [ ] Security pass — rotate keys, review access
- [ ] Read the risk register
- [ ] Update the valuation estimate

### Annually
- [ ] Tax return; revisit sole trader vs Pty Ltd
- [ ] ASIC annual review, if a company
- [ ] Renew domains, business name, insurance
- [ ] Re-read terms and privacy policy against what the product now does
- [ ] Major dependency upgrades
- [ ] Rewrite the runbooks
- [ ] **The absence test** — two weeks away, touching nothing
- [ ] Decide: grow, hold, or sell

---

## Progress summary

| Phase | Status | Gate passed | Date |
| --- | --- | --- | --- |
| 0 — Decide | ☐ | ☐ | |
| 1 — Validate | ☐ | ☐ | |
| 2 — Set up | ☐ | ☐ | |
| 3 — Build | ☐ | ☐ | |
| 4 — Launch | ☐ | ☐ | |
| 5 — Operate | ☐ | n/a | |
