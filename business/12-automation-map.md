# 12 — Automation Map

Automate in the order that returns the most hours per hour invested. The
temptation is to automate the interesting things; the discipline is to automate
the frequent, boring ones first.

## The rule

> Automate anything you do **more than twice a month**, that takes **more than
> 10 minutes**, and where **being wrong is recoverable**.

Anything failing the third test — irreversible, legally significant, or
requiring judgement — stays manual with a checklist. Automating a refund is
fine. Automating a legal notice is not.

## Tier 1 — before the first customer

Non-negotiable. Each is a recurring task that would otherwise never end.

| Automate | With | Saves |
| --- | --- | --- |
| Signup → account provisioned | App logic | Every signup |
| Payment → access granted | Payment webhook | Every signup |
| Cancellation → access revoked at period end | Payment webhook | Every churn |
| Failed payment → dunning sequence | Stripe Billing + emails | ~2 hrs/mo, recovers real revenue |
| Trial started / ending / ended emails | Scheduled job | Conversion, unattended |
| Onboarding nudges at 24h and 72h | Scheduled job | Support tickets prevented |
| Daily database backup | Managed provider | The business |
| Error capture and alerting | Sentry | Discovering bugs from customers |
| Uptime monitoring | External monitor | Discovering outages from customers |
| Deploy on merge to main | CI/CD | 30 min per deploy |
| Dependency update PRs | Renovate/Dependabot | 2 hrs/mo, and security |
| Invoice generation and delivery | Payment provider | Every payment |

## Tier 2 — first 90 days live

| Automate | With | Saves |
| --- | --- | --- |
| Canned support replies | Helpdesk | ~1 hr/wk |
| Metrics dashboard, auto-refreshing | Stripe + a simple query | 1 hr/wk of spreadsheet work |
| Weekly metrics email to yourself | Scheduled job | Makes the Monday review 5 minutes |
| Churn survey on cancellation | In-app form | The most valuable data you'll get |
| Bookkeeping feeds → accounting software | Bank feed rules | 2 hrs/mo |
| Receipt capture | Accounting app | The June scramble |
| Customer data export, self-serve | App feature | A support ticket per request |
| Status page updates | Monitor integration | Outage emails |
| Content publishing pipeline | Static build + CI | 20 min per post |

## Tier 3 — as you scale past ~50 customers

| Automate | With | Saves |
| --- | --- | --- |
| Usage-limit warnings and upgrade prompts | Scheduled job | Upsell, unattended |
| Dormant-account re-engagement | Scheduled job | Churn prevention |
| Annual renewal reminders | Scheduled job | Failed renewals |
| Referral tracking | Codes + a query | Partner admin |
| Anomaly alerts — signups, churn, errors | Threshold checks | Noticing late |
| Onboarding personalised by signup source | App logic | Conversion |
| Quarterly usage reports to customers | Scheduled job | Retention, and it's a nice touch |

## Deliberately not automated

| Keep manual | Because |
| --- | --- |
| Churn follow-up emails | A personal note gets replies; a template gets deleted. This is your best source of truth |
| Pricing changes | Judgement, and irreversible in effect |
| Anything legal — terms, notices, breach notification | Consequences of a wrong automated send are severe |
| Refunds over a set threshold | Fraud control |
| Customer conversations that reveal what to build | The point is the conversation, not the throughput |
| Content writing | Generic content ranks nowhere and reads as though nobody cared |

## Alerting philosophy

The largest hidden time cost is not work — it is **attention**. An alert that
does not require action within the hour is not an alert; it is a report, and it
belongs in the weekly email.

| Severity | Reaches you by | Examples |
| --- | --- | --- |
| Wake me | Phone, immediately | Site down >5 min, database unreachable, payments failing globally, security event |
| Today | Email, checked in a support window | Scheduled job failed twice, error rate up, certificate expiring in <14 days |
| Weekly digest | One email, Monday | Signups, churn, revenue, top errors, spend |

**Every alert that fires and turns out not to need action must be retuned or
deleted, that week.** Alert fatigue is how real outages get ignored, and it
starts with one noisy check nobody wants to touch.

## Automation debt

Automation is code, and code rots. Once a quarter (`10`):

- [ ] Does every scheduled job still run, and does it alert if it doesn't?
- [ ] Has any automated email started going to spam? Send yourself one.
- [ ] Are any integrations using deprecated API versions?
- [ ] Is anything automated that is no longer needed? Delete it.

A silently broken automation is worse than no automation, because you have
stopped watching.
