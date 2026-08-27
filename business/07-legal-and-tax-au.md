# 07 — Legal, Tax and Compliance (Australia)

> **This is not legal, tax or financial advice.** It is a checklist of the
> things to ask a registered tax agent and, where noted, a lawyer. All fees and
> thresholds are indicative and change — ASIC fees are indexed on 1 July each
> year. Verify every figure at the primary source (abr.gov.au, asic.gov.au,
> ato.gov.au, business.gov.au) before relying on it.

Budget one session with an accountant (~$300–$600) before you take the first
payment. It is the highest-return spend in the entire budget.

## Structure: sole trader or company?

| | Sole trader | Pty Ltd company |
| --- | --- | --- |
| Setup cost | $0 (ABN is free) | ASIC registration fee, roughly $600, indexed annually |
| Annual cost | $0 | ASIC annual review fee, roughly $320, indexed — plus accounting fees |
| Tax | Your marginal personal rate | Flat company rate — 25% for a base rate entity, otherwise 30%. Confirm eligibility with your accountant |
| Liability | Unlimited — personal assets exposed | Limited, with real exceptions (director duties, personal guarantees, insolvent trading) |
| Admin burden | Minimal — one tax return | Company return, ASIC annual review, minutes, registers, director ID |
| Sale of the business | Messy — an asset sale | Clean — sell the shares |

**Recommendation for this stage: start as a sole trader.** At pre-revenue and
early revenue, a company's fixed costs and administrative overhead buy you
little, and the overhead is a direct tax on your 10-hour week.

**Move to a Pty Ltd when any of these becomes true**, and plan for it — the
restructure is easier before there is much to move:

- Revenue is consistently above roughly $80–100k/year and the company rate
  beats your marginal rate
- You take on a co-founder, an investor, or an employee
- Contracts or customers require it
- Your liability exposure grows (larger customers, sensitive data)
- You are preparing to sell — see `19-exit-plan.md`

**If you do register a company:** every director must have a Director ID,
obtained personally through ABRS before appointment. This is a legal
obligation with penalties, and it is not something your accountant can do for
you.

## Registration checklist

- [ ] **ABN** — free, via the Australian Business Register. Do not pay a
      third-party site for this.
- [ ] **Business name** — register with ASIC if trading under anything other
      than your own legal name. Roughly $44 for one year or $102 for three,
      indexed. **Check the name is free on ASIC's register, IP Australia's
      trade mark search, and as a domain, before you get attached to it.**
- [ ] **Domain** — a `.com.au` requires an ABN or equivalent Australian
      presence. A `.com` does not, and travels better if you ever sell
      internationally. Consider registering both.
- [ ] **Business bank account** — separate from personal, from day one, no
      exceptions. Mixing accounts costs you more in accounting fees than the
      account ever costs.
- [ ] **Trade mark** — optional at this stage. Worth doing before you spend
      meaningfully on brand. Search first at IP Australia.
- [ ] **Director ID** — company route only, before appointment.

## GST

- Registration is **compulsory once your GST turnover reaches $75,000** in a
  12-month period (current or projected). Below that it is voluntary.
- Registering voluntarily lets you claim GST credits on your costs, but
  commits you to **quarterly BAS lodgement forever after** — a recurring
  administrative task, which is exactly what this business is designed to
  avoid. At a $2k/month run rate the credits are small; the BAS is not free
  in time.

  **Recommendation: do not register until you must, unless your accountant
  says otherwise for your circumstances.**
- **Watch the threshold.** Crossing it unknowingly and failing to register is
  a real and avoidable problem. Put a monthly check in `10-operating-rhythm.md`
  and register as soon as a rolling 12-month projection approaches $75k.
- Sales of services to **non-resident customers outside Australia are
  generally GST-free exports**, but the rules have conditions. Get this
  confirmed for your specific model — it materially affects pricing if most
  customers are overseas.
- If you use a merchant of record (see `08`), they are the seller of record to
  the end customer, which changes your tax position substantially. Confirm the
  treatment with your accountant before you choose a payment provider, not
  after.

## Income tax and cash discipline

- [ ] **Set aside 30% of every dollar of profit in a separate account.** The
      first tax bill is the most common cause of death for a small profitable
      business.
- [ ] Expect **PAYG instalments** to begin once you have reported business
      income. Then you are paying tax quarterly, in advance, and the cash-flow
      shape changes. Ask your accountant when to expect this.
- [ ] Keep records for **five years**. Use accounting software from day one
      (Xero, MYOB or a cheaper equivalent) rather than reconstructing a year
      of transactions in July.
- [ ] Home office and asset deductions have specific rules and rates that
      change. Your accountant, once a year.

## Privacy

- The Privacy Act 1988 and the Australian Privacy Principles currently exempt
  most small businesses with turnover of $3 million or less — **but there are
  exceptions**, including businesses that trade in personal information or
  provide certain services, and **the small-business exemption has been under
  active reform.**

  **Treat the exemption as temporary and comply anyway.** The cost of building
  privacy in from the start is a few hours. The cost of retrofitting it is
  weeks, and possibly a breach in between.

- [ ] Publish a genuine privacy policy that describes what you actually do.
- [ ] Collect the minimum. Delete on request, and on cancellation after a
      stated retention period.
- [ ] Know where your data physically lives, and disclose it if it leaves
      Australia. Overseas hosting is fine; undisclosed overseas hosting is not.
- [ ] Have a data breach response plan — `14-runbooks.md` has one. The
      **Notifiable Data Breaches scheme** imposes real obligations if it
      applies to you; assume it will.
- [ ] **If you have any EU or UK customers, GDPR applies to you** regardless of
      where you sit. If you have Californian customers, consider CCPA. This is
      a reason to decide deliberately whether you sell internationally.

## Australian Consumer Law

- **Consumer guarantees cannot be excluded, restricted or modified by your
  terms.** A term that purports to do so is void, and asserting it can itself
  be a breach. Any template terms you find online that disclaim "all
  warranties" are US terms and are wrong here.
- The consumer guarantees can apply to business customers too, depending on
  the value and nature of the supply. Do not assume B2B puts you outside them.
- **Unfair contract terms** rules apply to standard-form small business
  contracts — which is exactly what your terms of service are — and penalties
  now attach. Auto-renewal, unilateral variation, and one-sided termination
  clauses are the usual offenders. Have a lawyer read your terms.
- Refund policy: write a clear, generous one. At this price point, arguing
  about a $99 refund costs more than the refund in time and reputation.

## Documents you need before the first sale

| Document | Get it how | Rough cost |
| --- | --- | --- |
| Terms of Service | Lawyer-reviewed. Do not use a US template | $800–$2,000 |
| Privacy Policy | Can start from a reputable AU generator; have it reviewed with the terms | Included above, or ~$100 |
| Refund policy | Write it yourself, plainly, on the pricing page | $0 |
| Subprocessor list | A page listing every vendor that touches customer data | $0 |
| Acceptable use policy | Only if abuse is plausible for your product | $0 |

**A lawyer for the terms of service is worth $1,000–$2,000 of your $1k–$5k
budget** if you handle customer data or make any promise about outcomes. It is
the difference between a defensible position and an expensive surprise.

## Insurance

Get quotes; do not assume you need all of it on day one.

- **Professional indemnity** — the relevant one if your software's output
  informs a customer's decision (a missed deadline, a wrong figure). Strongly
  consider it for the deadline-monitoring idea in `02`.
- **Cyber liability** — covers breach response costs, which are the expensive
  part. Worth it once you hold meaningful customer data.
- **Public liability** — usually not relevant for a software business with no
  premises.

Some customers will ask for evidence of cover before they buy. Having it can
be a sales asset, not just a cost.

## Recurring obligations calendar

Put every one of these in a calendar with a reminder, today. This list is the
compliance half of `10-operating-rhythm.md`.

| When | What |
| --- | --- |
| Monthly | Reconcile accounts; check GST turnover against the $75k threshold |
| Quarterly | BAS (if registered); PAYG instalment (once it applies); super (if you ever employ) |
| Annually | Income tax return; ASIC annual review + fee (company only); insurance renewal; domain renewals; business name renewal; trade mark renewal |
| Annually | Re-read your own terms and privacy policy — do they still describe what the product does? |
