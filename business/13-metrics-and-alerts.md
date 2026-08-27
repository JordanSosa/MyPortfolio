# 13 — Metrics and Alerts

Six numbers. Reviewed weekly in under 10 minutes. Everything else is a
distraction dressed up as diligence.

## The six

### 1. MRR — Monthly Recurring Revenue
Normalise annual plans to monthly (annual ÷ 12). Break it into new, expansion,
contraction and churned so you can see *why* it moved, not just that it did.

**Target:** growing. Early on, 10–20% month over month from a small base is
normal and mostly meaningless in absolute terms; the direction is what matters.

### 2. Logo churn — % of customers lost this month
`customers lost ÷ customers at start of month`

**Target: under 4%/month.** Above 5% and growth is impossible — you are
replacing the bucket faster than you can fill it. At 5% monthly you lose about
half your customers each year, which means every marketing hour is spent
standing still.

This is the number that most often kills a small SaaS, and the one founders
most often look away from.

### 3. Trial → paid conversion
**Target: 20–40%** with a card required at trial start. Below 15% means the
onboarding is failing, or you attracted the wrong people, or the product does
not do what the landing page implied.

### 4. Support minutes per customer per month
`total support minutes ÷ active customers`

**Target: under 5.** This is your time constraint expressed as a number, and
it is the metric this whole pack is built around. If it climbs, the business is
becoming a job — go to `11` and `12` immediately, before adding customers.

Nobody else tracks this. Track it.

### 5. Cash in bank, and months of runway
Including money already set aside for tax, tracked separately so you never
mistake the ATO's money for yours.

### 6. Traffic → signup conversion rate
The health of the top of the funnel. Separate organic from everything else,
because organic is the channel you are actually building (`09`).

**Target: 2–5%** on a niche B2B landing page with a clear offer.

---

## What not to track

| Vanity metric | Why it misleads |
| --- | --- |
| Total signups ever | Includes everyone who left |
| Page views | Untargeted traffic converts at zero |
| Social followers | Not customers, and mostly not even prospects |
| Feature usage counts, in isolation | Interesting; not decision-relevant weekly |
| App store / launch site rankings | A moment, not a business |

Track these quarterly at most, if at all.

## The dashboard

Do not build one. Use what you have:

- **Stripe** gives MRR, churn and failed payments out of the box
- **One SQL query** for signups, activation and usage
- **A spreadsheet**, one row per month, updated monthly — this is your
  historical record and the thing an acquirer will eventually ask for
- **A weekly email to yourself** with the six numbers, sent by a scheduled job.
  This turns the Monday review from a task into a read.

## Alert thresholds

Configure these once. Retune anything that cries wolf.

### Wake me — phone, any hour

- [ ] Site unreachable for more than 5 minutes
- [ ] Database unreachable
- [ ] Payment webhook failing repeatedly — you are losing signups silently
- [ ] Error rate above 10× baseline
- [ ] Any suspected security event or unauthorised access
- [ ] Backup job failed two days running

### Today — email, handled in a support window

- [ ] A scheduled job failed twice in a row
- [ ] Error rate above 3× baseline
- [ ] TLS certificate expiring within 14 days
- [ ] Domain expiring within 30 days
- [ ] Failed payments above 5% of active subscriptions
- [ ] Cloud spend more than 50% above the monthly average
- [ ] Signups zero for 7 days when they are normally non-zero — usually a
      broken form, not a market collapse

### Weekly digest — one email

- [ ] The six metrics, with week-over-week change
- [ ] Top five errors by count
- [ ] New customers, churned customers, by name
- [ ] Support ticket count and total minutes
- [ ] Total infrastructure and vendor spend

## Reviewing well

The 10-minute Monday review, in order:

1. Did anything move more than 20%? Only then investigate.
2. Is churn under 4%? If not, this is the week's priority — nothing else is.
3. Are support minutes per customer under 5? If not, `11` and `12`.
4. Is the trend over 3 months up, flat or down? A single week means nothing.
5. Write one line in the log: what happened, what you'll do.

**Do not check metrics daily.** Daily noise on small numbers produces anxiety
and bad decisions, and it turns a business designed to be low-touch into a
thing you refresh at breakfast.
