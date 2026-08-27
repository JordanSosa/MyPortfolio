# 16 — The First 90 Days

A week-by-week schedule from "no idea chosen" to "paying customers arriving
without a conversation". It assumes **20 hours a week during build**, dropping
to 10 from week 15 (`01`).

Dates are relative. Fill in the real ones — a plan without dates is a wish.

## Weeks 1–4 — Decide and validate

| Week | Hours | Focus | Done when |
| --- | --- | --- | --- |
| 1 | 10 | Score three ideas. Pick one. Write the ICP and the product sentence | Gate 0 passed |
| 2 | 12 | 50-prospect list, incumbent research, problem statement, wedge | List exists, verdict written |
| 3 | 12 | 30 emails, 10 conversations, call log | Pain assessed honestly |
| 4 | 15 | Landing page, price, the ask, follow up everyone | **Gate 1: money received** |

**Week 4 is the most important week in the plan.** If the gate does not pass,
go back to week 1 with a different idea. That is a success, not a failure — you
spent four weeks instead of six months.

## Week 5 — Set up the business

| | Hours | Task |
| --- | --- | --- |
| Mon | 3 | ABN, name checks, business name registration |
| Tue | 3 | Bank account, tax account, accounting software |
| Wed | 3 | Accountant session. Brief the lawyer on terms |
| Thu | 4 | All infrastructure accounts; email domain auth (SPF/DKIM/DMARC) |
| Fri | 4 | Payment provider verification, password manager, obligations calendar |

Start the payment provider verification and the lawyer on **Monday** — both
have lead times measured in days to weeks and both can block your launch.

**Gate 2: you can legally take money.**

## Weeks 6–13 — Build

Two-week blocks, each ending in something demonstrable. Ship to staging
continuously.

| Weeks | Build | Ends with |
| --- | --- | --- |
| 6–7 | Foundation: repo, CI, environments, deploys, schema, auth | You can sign up and log in on staging |
| 8–9 | **The core job.** Data in, the work, the output | The product does its one thing |
| 10–11 | Billing end to end, plus dunning | A test card can subscribe, change plan and cancel |
| 12 | Reliability: backups + **a real restore test**, monitoring, alerts, logging | Gate 3 reliability items ticked |
| 13 | Onboarding, docs, canned replies, helpdesk, status page | A stranger completes setup in under 10 minutes |

**Guard rails for the build:**
- If week 9 ends without the core job working, cut scope — not quality, scope.
  Go back to `05` and remove something.
- Anything not on the Phase 3 list in `15` does not get built. Log it instead.
- Deploy to staging at least twice a week. A codebase that has not been
  deployed in a fortnight is a codebase full of surprises.

**Gate 3: a stranger can buy, use and cancel unaided.**

## Week 14 — Founding members

| | Task |
| --- | --- |
| Mon | Onboard founding member 1, watching. Write down every hesitation |
| Tue | Fix what they hit. Onboard member 2 |
| Wed | Fix. Onboard member 3 |
| Thu | Fix. Onboard the rest |
| Fri | Fix the remaining friction. Convert deposits to subscriptions |

This week decides your support load for the next two years. Every confusion you
fix now is a ticket you never receive.

## Weeks 15–16 — Launch

Drop to 10 hours from here. The rhythm in `10` starts now.

| Week | Focus |
| --- | --- |
| 15 | Publish the cornerstone guide + two articles. Final marketing site. Directory listings. Email capture live |
| 16 | Comparison page. Announce in the two ICP communities. Email all 50 prospects. Contact 10 referral partners |

**Gate 4: ten paying customers, none of whom you spoke to.**

## Weeks 17+ — Operate

`10-operating-rhythm.md` is now the whole plan.

---

## Realistic expectations at day 90

| Metric | Realistic | Good | Exceptional |
| --- | --- | --- | --- |
| Paying customers | 8–15 | 20–30 | 50+ |
| MRR | $800–$1,500 | $2,000–$3,000 | $5,000+ |
| Organic traffic | Barely any | A trickle | Some rankings |
| Hours/week | 12–15 | 10 | 10 |

**Organic traffic being near zero at day 90 is normal and expected.** SEO takes
4–9 months (`09`). The content you publish in weeks 15–16 pays out in month 8.
The most common reason a founder abandons a working business is judging the
long-payback channel on a short timeline.

## The three ways this plan fails

1. **Skipping Gate 1.** Building something nobody paid for in advance. This is
   the failure mode that costs six months, and it is the one you are most
   likely to talk yourself into.
2. **Scope creep in weeks 6–13.** Every added feature pushes launch and adds
   permanent support load. The MVP list in `15` is a contract with yourself.
3. **Stopping marketing after launch.** Churn never stops, so a business that
   stops marketing starts shrinking within a quarter. The 4-hour block in `10`
   is not optional.
