# 17 — Budget

Working within **$1,000–$5,000 AUD** of setup capital. All figures indicative
and in AUD; verify current vendor and government pricing (see the note in
`README.md`).

## Setup — three scenarios

| Item | Lean ($1.2k) | Recommended ($3.4k) | Full ($5k) |
| --- | --- | --- | --- |
| ABN | $0 | $0 | $0 |
| Business name registration (3 yr) | $102 | $102 | $102 |
| Company registration (ASIC) | — | — | ~$600 |
| Domain (.com + .com.au) | $80 | $80 | $80 |
| Accountant — setup session | $0 | $450 | $600 |
| Lawyer — terms of service | $0 (generator) | $1,200 | $2,000 |
| Logo / brand basics | $0 (do it yourself) | $250 | $600 |
| Infrastructure — 6 months | $300 | $450 | $600 |
| Software (helpdesk, email, monitoring) — 6 months | $150 | $350 | $500 |
| Validation ads | $150 | $200 | $300 |
| Insurance — first year | $0 | $600 | $900 |
| Contingency | $400 | $400 | $500 |
| **Total** | **~$1,180** | **~$4,080** | **~$6,780** |

### What to cut, in order

1. **Company registration** — start as a sole trader (`07`)
2. **Brand** — a wordmark in a good typeface is enough; you already have the
   design skills
3. **Insurance** — defer only if you hold no sensitive data and make no
   outcome-critical promises. Do not defer it for the deadline-monitoring idea
4. **Ads** — validation can be done entirely by email

### What not to cut

| Never cut | Why |
| --- | --- |
| **Lawyer-reviewed terms of service** | US templates are wrong under Australian Consumer Law, and unfair-contract-terms rules now carry penalties (`07`). This is the single most important spend in the table |
| **The accountant session** | Structure, GST timing and PAYG decided wrongly cost more than the fee, every year |
| **Backups** | Included in managed hosting. Never run an unmanaged database to save $20 |
| **Error tracking + uptime monitoring** | Free tiers are adequate. There is no excuse |

## Monthly run rate

### Pre-revenue (months 1–4)

| Item | Cost |
| --- | --- |
| Hosting (app + staging) | $30 |
| Managed Postgres | $25 |
| Transactional email | $0 (free tier) |
| Domain/DNS/CDN | $0 (Cloudflare free) |
| Error tracking | $0 (free tier) |
| Uptime monitoring | $0–$10 |
| Analytics | $0–$10 |
| Accounting software | $30 |
| Email hosting | $10 |
| **Total** | **~$105–$125/month** |

**Under $150/month is the target while pre-revenue.** At that rate, $2,000 of
capital buys you well over a year of runway, which is the real freedom this
budget provides — the freedom not to panic in month 6.

### At ~30 customers (~$3,000 MRR)

| Item | Cost |
| --- | --- |
| Hosting | $50 |
| Database | $40 |
| Transactional email | $20 |
| Helpdesk | $30 |
| Monitoring + errors | $30 |
| Analytics | $15 |
| Accounting | $40 |
| Email marketing | $30 |
| Payment fees (~2%) | $60 |
| **Total** | **~$315/month — about 10% of revenue** |

Gross margin ~90%. That is what a well-designed micro-SaaS looks like, and it
is why `08` warns so hard about per-unit COGS.

### At ~100 customers (~$10,000 MRR)

Add a part-time VA for support (`11`) at $600–$1,000/month and infrastructure
roughly doubling. Total around $1,600/month — still ~84% gross margin, and now
the support hours belong to someone else.

## Cash rules

- [ ] **30% of profit to the tax account, monthly.** Never spend it. It is not
      your money.
- [ ] **Keep 6 months of run rate in the business account** before drawing
      anything.
- [ ] **Annual plans are cash.** Push them (`08`) — collecting a year up front
      transforms the cash position of a business this size.
- [ ] **Pay annually for tools you are certain about** (usually 2 months free);
      monthly for anything you might drop.
- [ ] **Review vendor spend monthly** (`10`). Subscription creep is the quiet
      killer of small-business margin.
- [ ] Keep receipts in the accounting app as you go, not in June.

## When to spend more

Spend on anything that removes recurring hours; be miserly with everything else.

| Worth paying for | Not worth paying for |
| --- | --- |
| A VA for support at 6 hrs/week of tickets | A designer before you have customers |
| Managed anything, over self-hosting | A "growth consultant" |
| A niche newsletter sponsorship ($200–$800) | Broad paid ads before organic works |
| An editor for your content, once you're at $5k MRR | Conferences, at this stage |
| Better error tracking / observability | A rebrand |
| Legal review of anything customer-facing | Custom illustration |

## The break-even line

| Monthly costs | Customers needed at $149/mo |
| --- | --- |
| $125 | 1 |
| $315 | 3 |
| $1,600 | 11 |

Break-even is trivially close. **The constraint on this business is never
cost — it is distribution and your time.** Spend accordingly: money that buys
back hours is well spent; money that buys reach you haven't earned is not.
