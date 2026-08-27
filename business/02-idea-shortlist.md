# 02 — Idea Shortlist

Six candidates, each scored with the rubric in [`03-idea-scorecard.md`](./03-idea-scorecard.md).
All are chosen against the same filter: **B2B, self-serve, async, one
integration or none, and priced high enough that 40 customers is a real
business.**

Scores are out of 50. Anything below 35 should not be built by one person with
a 10-hour cap.

---

## A. Deadline & obligation monitor for a regulated Australian niche — **44/50**

**What it is.** You hold a register of the customer's entities (companies,
licences, leases, certifications, insurances). You watch the relevant public
registers and statutory dates. You email the right person at the right time,
escalate if nobody acts, and produce a one-page compliance status report each
month.

**Who buys.** Small accounting firms, bookkeepers, licensed trades employing
20–200 people, RTOs, body corporate managers, franchise groups. Pick exactly
one and go narrow.

**Why it scores well.** It is a cron job with a nice front end. There is no
real-time anything. If a run is two hours late, nobody notices. Onboarding is
a CSV upload. The value is avoided penalties and lost licences, which prices
at $99–$499/month without argument. Support volume is low because the product
mostly emails *them*.

**Why it might not work.** The register data has to be obtainable legally and
reliably. Check terms of use for any government or industry source before you
build — scraping a register you are contractually barred from scraping is a
business built on sand. Where a paid data feed exists, that fee is your COGS
and must be modelled in `17-budget.md`.

**The unfair advantage you already have.** `corp-sec-desk/` in this repo shows
you have already done the research on ASIC annual reviews and small Australian
accounting firms. That is a warm, specific, reachable ICP — and you know the
vocabulary, which is 80% of B2B marketing.

---

## B. Paid API over a dataset you curate — **42/50**

**What it is.** A single well-documented HTTP endpoint returning something
fiddly that developers need and nobody wants to maintain. Candidates with real
Australian demand: public holidays by state and local government area;
award/penalty-rate calendars; school terms; ABN/GST/ACN validation with
enrichment; postcode-to-LGA-to-electorate mapping; superannuation fund USI
lookup; business-day arithmetic per jurisdiction.

**Who buys.** Developers at payroll, rostering, logistics, fintech and
scheduling companies — via a company card, with no approval process, at
$49–$299/month.

**Why it scores well.** This is the lowest-support product shape that exists.
No UI to misunderstand, no onboarding, no password resets worth mentioning.
Docs are the product. Developers self-serve or leave; either way they do not
email you. Churn is very low because once an API key is in production nobody
removes it.

**Why it might not work.** Distribution is slow and entirely content-driven —
you win on documentation quality and search. And you are permanently on the
hook for data accuracy: a wrong public holiday is somebody's payroll run. The
curation is the moat *and* the recurring work; budget 2 hrs/month for it
forever.

---

## C. Embeddable widget, single purpose — **37/50**

**What it is.** One `<script>` tag that adds one capable thing to any website:
a genuinely good booking flow, an interactive pricing/quote calculator, a
product configurator, an accessibility-compliant data visualisation embed.
Billed by pageviews or sites.

**Why it fits you.** This is directly what the rest of this repo demonstrates
you can already do — Vite, three.js, GSAP, no framework, self-hosted fonts,
tight bundles. A visually superior widget is a real differentiator in a market
where most options look like 2016.

**Why it scores lower.** Crowded, and the support surface is other people's
websites — every CMS, theme, CSP and consent banner is a variable you do not
control. "It doesn't show up on my Squarespace" is a support ticket you cannot
fully script away. It also drags you toward per-seat prices below $99.

Build this only if you pick a vertical (e.g. "quote calculators for Australian
trades") rather than a horizontal widget.

---

## D. Compliance document system with an annual refresh — **36/50**

**What it is.** Generate a business's policy set — privacy policy, WHS, data
breach response, AI use policy, contractor agreements — from a questionnaire,
then keep them current: when the law changes you push an updated version and
email them to re-acknowledge. The subscription is for *currency*, not the
document.

**Why it scores as it does.** Extremely low technical operations. But the
recurring work is legal monitoring, which you cannot automate and cannot fully
delegate, and the liability tail is real. Needs a lawyer's review at setup
(budget $1,500–$3,000, most of your setup budget) and a relationship for
updates. Strong margins if you have that relationship; a trap if you do not.

---

## E. Report generator for a specific back-office workflow — **34/50**

**What it is.** Spreadsheet or export in, branded client-ready PDF out, on a
schedule. Bookkeepers producing monthly management packs, agencies producing
performance reports, strata managers producing owner statements.

**Why it scores lower.** Every customer wants their own layout. That pull
toward bespoke work is exactly the failure mode this pack is designed to
prevent, and it takes real discipline to refuse. Also usually needs an
accounting-platform integration, breaking design rule 5.

---

## F. AI-assisted narrow workflow tool — **31/50**

**What it is.** One document-shaped task done by a model behind a tight UI —
summarise, extract, classify, rewrite within a specific professional workflow.

**Why it scores lowest despite being fashionable.** Three structural problems
for a low-touch solo business: (1) inference is real COGS, so gross margin
falls from ~95% to 60–75% and heavy users are unprofitable unless you meter,
which adds billing complexity; (2) non-deterministic output generates support
tickets that have no scripted answer; (3) the competitive floor moves every
few months, and features get absorbed into the platforms your customers
already pay for.

Not unbuildable — but if you go here, meter usage from day one, measure token
cost per job before setting a price, and treat model choice as a swappable
dependency behind an interface.

---

## Scores at a glance

| # | Idea | Support load | Ops load | Price ceiling | Distribution | Total |
| --- | --- | --- | --- | --- | --- | --- |
| A | Deadline / obligation monitor | Low | Low | High | Medium | **44** |
| B | Curated paid API | Very low | Low | Medium | Slow | **42** |
| C | Embeddable widget | Medium | Low | Low | Medium | **37** |
| D | Compliance doc system | Low | Very low | Medium | Medium | **36** |
| E | Report generator | Medium | Medium | Medium | Medium | **34** |
| F | AI workflow tool | High | Medium | Medium | Fast | **31** |

## Recommendation

**Build A, in the niche you already researched: statutory deadline and
obligation monitoring for small Australian accounting and bookkeeping firms.**

The reasoning is not that it scores one point higher than B. It is that you
have already done the expensive part — you have a defined ICP, you understand
their calendar, and you have marketing copy for them sitting in
`corp-sec-desk/`. In a 10-hour week, *domain knowledge you already possess* is
worth more than any product advantage, because it is the only input you cannot
buy for $5,000.

**Keep B as the fallback.** If validation (`04`) shows the accounting-firm
wedge is already owned by the incumbents, a curated API needs no ICP research
and can be validated in a fortnight.

**Do not build F first.** It is the most fun and the worst fit for your
constraint. Revisit it once something else pays the bills.

## Before you commit

Score your own idea too. Run all of A, B and your own through
[`03-idea-scorecard.md`](./03-idea-scorecard.md), then take the highest
scorer into [`04-validation-plan.md`](./04-validation-plan.md). Only one idea
proceeds past validation. Committing to two is committing to neither.
