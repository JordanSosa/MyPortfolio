# 18 — Risk Register

Reviewed quarterly (`10`). Scored **Likelihood × Impact**, each 1–5.

Risks scoring 12+ need an active mitigation with a date, not a note.

| # | Risk | L | I | Score | Mitigation |
| --- | --- | --- | --- | --- | --- |
| R1 | Nobody buys — the pain wasn't urgent | 4 | 5 | **20** | Gate 1 in `04`. Money before code, without exception |
| R2 | You lose interest before it compounds | 4 | 5 | **20** | Pick a domain you find genuinely interesting. Gates give early wins. The 90-day plan sets honest expectations |
| R3 | Churn above 5%/month | 3 | 5 | **15** | Track weekly (`13`). Annual plans. Personal exit emails. Treat any month above 4% as the sole priority |
| R4 | Support load exceeds the 10-hour cap | 3 | 4 | **12** | Measure support-minutes-per-customer (`13`). Four-layer deflection (`11`). VA at 150 customers |
| R5 | SEO takes longer than you can wait | 4 | 3 | **12** | Expect 4–9 months. Fund it from the day job. Use outreach and partnerships for the first customers |
| R6 | Scope creep delays launch indefinitely | 4 | 3 | **12** | The MVP list in `15` is a contract. Three-customer rule for every feature (`05`) |
| R7 | Incumbent adds your feature | 3 | 4 | 12 | Go narrower than they can afford to. Own the niche's vocabulary and its community |
| R8 | Data breach | 2 | 5 | 10 | Minimum data collection. Managed infrastructure. Quarterly key rotation. Cyber insurance. `R5` runbook |
| R9 | Extended outage damages trust | 3 | 3 | 9 | Managed hosting, monitoring, status page, honest communication, tested restores |
| R10 | Key dependency deprecated or vendor shuts down | 3 | 3 | 9 | Portable data (Postgres). At most one integration (`01`). `R8` runbook |
| R11 | Tax surprise | 2 | 4 | 8 | 30% set aside monthly. Accountant annually. Monthly GST threshold check |
| R12 | Getting the GST/MoR treatment wrong | 2 | 4 | 8 | Confirm with the accountant **before** the first sale (`07`, `08`) |
| R13 | Illness or life event | 2 | 4 | 8 | Full automation (`12`). Runbooks `R10`, `R11`. Emergency password access |
| R14 | Underpricing traps you in a support-heavy business | 3 | 3 | 9 | Price floor near $99 (`01`). Quarterly reviews. Grandfather existing, raise for new |
| R15 | Legal exposure from a bad outcome for a customer | 2 | 4 | 8 | Lawyer-drafted terms. Professional indemnity. Never promise an outcome you can't control |
| R16 | Platform dependency — a channel or marketplace you rely on | 2 | 4 | 8 | Own your email list. Never let one channel exceed 50% of acquisition |
| R17 | Founder burnout from build-phase intensity | 3 | 3 | 9 | The plan is 4 months of intensity, not 4 years. Protect the two zero days from week 15 |
| R18 | AI or market shift makes the product obsolete | 2 | 4 | 8 | Quarterly review. Depth in a niche and customer relationships are the durable moat, not the code |

## The four that actually matter

**R1 — nobody buys.** The most common outcome for a new software business, and
the one the entire validation phase exists to catch. The mitigation only works
if you honour the gate when it fails, which is precisely when you will least
want to.

**R2 — you lose interest.** Under-discussed and probably the leading cause of
death for solo software businesses. It usually strikes in months 4–8: the build
euphoria has passed, SEO has not landed yet, and revenue is real but small.
Everything in `16` about honest expectations exists for this month. Knowing it
is coming is most of the defence.

**R3 — churn.** Growth is arithmetic: at 5% monthly churn you lose about half
your customers a year, and every marketing hour goes to standing still. Churn
above 4% means stop everything else and find out why.

**R4 — support load.** The specific risk to *your* stated goal. Everything else
can be fine while this quietly turns the business back into a job. It is why
support-minutes-per-customer is one of the six metrics.

## Quarterly review template

```
Date: ........

Risks that materialised this quarter:
............................................................

Risks whose score changed (and why):
............................................................

New risks:
............................................................

Mitigations due this quarter:
  [ ] ........................................  by ........
  [ ] ........................................  by ........

The single biggest threat to this business right now:
............................................................
```
