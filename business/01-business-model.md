# 01 — The Business Model

## What this business is

A single-purpose software product, sold on a recurring subscription, to
businesses, bought and set up by the customer without you in the loop.

That last clause is the whole business. Every decision in this pack exists to
protect it.

## Why micro-SaaS is the hardest of the "passive" options

You chose the model that compounds best and is the *least* passive of the
candidates. Be clear-eyed about that:

- Software rots. Dependencies, APIs, browsers and payment providers change
  underneath you whether or not you touch the code.
- Every customer is a permanent support liability, not a one-off transaction.
- Uptime is a promise you make continuously.

Against that: revenue is recurring, margins are 85–95%, the asset is saleable
at a multiple, and the work per additional customer trends toward zero. That
trade is worth making — but only if the product is deliberately designed to
minimise the three costs above. That design is what `05` and `06` are for.

## The arithmetic

Work backwards from what you want, not forwards from what you can build.

| Target monthly revenue | At $29/mo | At $79/mo | At $199/mo | At $499/mo |
| --- | --- | --- | --- | --- |
| $2,000 | 69 customers | 26 | 11 | 5 |
| $5,000 | 173 | 64 | 26 | 11 |
| $10,000 | 345 | 127 | 51 | 21 |

**Read the first column as a warning.** 345 customers at $29 is a support
department. 21 customers at $499 is a spreadsheet and a monthly email. Your
time cap is a pricing instruction: *charge more, serve fewer.*

Rule of thumb for a solo operator: **price so that $5k MRR needs fewer than 60
customers.** That means a floor around $99/month, which in turn means B2B, and
a problem that costs the buyer real money or real risk.

### Unit economics to hold

| Metric | Target | Why |
| --- | --- | --- |
| Gross margin | > 85% | Below this, infrastructure or per-unit costs are eating you |
| Monthly logo churn | < 4% | Above 5% you are refilling a leaking bucket forever |
| CAC payback | < 6 months | Longer, and you cannot self-fund growth on $1–5k |
| LTV : CAC | > 3:1 | Below 3, growth destroys cash |
| Support minutes / customer / month | < 5 | This is your actual time constraint, expressed as a number |

That last row is the one nobody tracks and the one that decides whether this
fits in 10 hours. Track it from customer one.

## The five design rules

Break any of these and the 10-hour cap fails, regardless of how good the
product is.

**1. B2B, and paid by a business.**
Consumers churn hard, pay little, and expect support at 11pm. Businesses pay
annually, expense it without thinking, and email during business hours.

**2. No real-time, no user-generated content, no marketplace.**
Real-time means uptime pages and pager duty. UGC means moderation and
takedowns. Marketplaces mean two sides to acquire and disputes to arbitrate.
Each is a full-time job wearing a product costume.

**3. Async and idempotent by default.**
Prefer work that runs on a schedule, can safely re-run, and can be an hour
late without anyone noticing. A cron job that fails is retried at 3am. A live
API that fails is a phone call.

**4. Self-serve from first click to first invoice.**
If the product needs a demo call, an onboarding session, a data migration or a
custom config, you have bought a job. Everything must be doable by the
customer, alone, at 2am, from the marketing site.

**5. One integration surface at most.**
Every third-party integration is a permanent maintenance contract you signed
for free. Xero, Google, Slack and friends all deprecate, rotate scopes and
change consent screens. One is manageable. Five is your whole week.

## What "10 hours a week" actually looks like

Once steady-state (see `10-operating-rhythm.md`):

| Block | Hours/week |
| --- | --- |
| Support (two batched sessions) | 2 |
| Marketing content / distribution | 4 |
| Product improvement, one small thing | 2 |
| Metrics review + admin + finance | 1 |
| Buffer for the unexpected | 1 |

Note that **marketing is the largest block, permanently.** A micro-SaaS that
stops marketing stops growing and then shrinks, because churn never stops.
Anyone who tells you otherwise is selling a course.

## Build phase is not steady state

Expect **15–25 hrs/week for the first 3–4 months**. This pack front-loads
deliberately: the work you do in the build phase is what buys the low-touch
steady state. Automation built later is automation you paid for twice — once
in manual labour, once in the build.

## Definition of done for the business

You are finished building when all of the following are true:

- [ ] A stranger can find, buy, onboard, use and cancel without contacting you.
- [ ] A failed payment recovers itself, or churns the customer cleanly, unattended.
- [ ] Every recurring obligation (tax, renewals, backups, certs) is on a calendar with a reminder.
- [ ] You could not touch it for two weeks and lose nothing but growth.
- [ ] Someone else could operate it from `14-runbooks.md` alone.

Until then, you have a job. After that, you have a business.
