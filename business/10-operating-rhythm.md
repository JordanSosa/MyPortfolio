# 10 — Operating Rhythm

**This is the file you open every week.** Everything else in the pack exists to
make this one short.

The principle: **batch everything, schedule the batches, and let nothing be
interrupt-driven.** A business that runs on notifications consumes far more
than 10 hours regardless of how much work there actually is, because context
switching costs more than the task.

## The weekly template — 10 hours

| Day | Block | Time | What |
| --- | --- | --- | --- |
| Mon | Metrics + support | 1.5 hr | Read the six numbers (`13`). Clear the support queue (`11`). |
| Tue | Marketing | 2.5 hr | Write and publish the week's piece (`09`). |
| Wed | — | 0 | Nothing. Do not open it. |
| Thu | Support + product | 2.5 hr | Clear the queue. Ship one small improvement. |
| Fri | Deep work | 2.5 hr | The one meaningful thing this week. Deploy. |
| Sat/Sun | — | 0 | Nothing. |
| Any | Buffer | 1 hr | Overflow, or unused. |

Adjust the days to your life; do not adjust the shape. The load-bearing
features are: **two support windows, one protected marketing block, one deep
work block, and two days where you do not open it at all.**

### Rules that make it hold

- [ ] **Notifications off**, except genuine production alerts (see `13`).
      Support email does not notify. Stripe does not notify. Nothing pings you.
- [ ] **Support is answered in its window, not on sight.** Your published
      response time is one business day; meet it comfortably, not instantly.
- [ ] **Never deploy on a Friday afternoon or before you're away.** The whole
      point is not being needed.
- [ ] **One thing per week.** Not three. A year of one-thing-per-week is 50
      improvements, which is an enormous amount of product.
- [ ] **If a week goes over 12 hours twice in a row**, something has broken the
      model. Find it and automate it — that is what `12-automation-map.md` is
      for.

## Daily — 0 minutes

Nothing. There is no daily task. If something requires daily attention, it is a
defect in the system, and it goes on the automation list.

The only exception is a genuine production alert, which reaches you by phone
and by definition is rare.

## Weekly — 30 minutes of the Monday block

- [ ] Read the six metrics. Note anything that moved more than 20%.
- [ ] Clear the support queue to zero.
- [ ] Check the error tracker for anything new or recurring.
- [ ] Check failed payments — confirm dunning is doing its job, intervene only
      on a customer worth a personal email.
- [ ] Confirm backups ran and the last restore test is within 90 days.
- [ ] Merge the week's dependency updates if CI is green.
- [ ] Note the one thing for Friday's deep work block.

## Monthly — 90 minutes, first Monday

- [ ] Reconcile the books. Categorise every transaction. Do not let this build up.
- [ ] **Check GST turnover against the $75,000 threshold** on a rolling
      12-month basis (`07`).
- [ ] Move 30% of profit to the tax account.
- [ ] Review churn: who left, and why. Email every churned customer once,
      personally, asking. Around a third will reply and they will tell you
      exactly what to fix.
- [ ] Review the support log: what were the top three ticket categories?
      Each one is either a product fix or a docs fix. Pick one and do it.
- [ ] Review cloud and vendor spend for anything unused.
- [ ] Send the customer newsletter.
- [ ] Update the metrics sheet with the month's closing numbers.

## Quarterly — half a day

- [ ] **Restore a database backup into a scratch environment and verify it.**
      Non-negotiable. Record the date and the elapsed time in `14`.
- [ ] Lodge BAS if GST-registered; pay PAYG instalment if applicable.
- [ ] Review pricing: are new customers converting easily? If yes, you are too
      cheap. Test a rise for new customers.
- [ ] Review the feature request log. Anything asked for by 3+ paying
      customers? That is next quarter's roadmap.
- [ ] Feature-usage audit — deprecate anything under 5% usage that generates
      support (`05`).
- [ ] Security pass: rotate keys and tokens, review who has access to what,
      remove anything stale.
- [ ] Read `18-risk-register.md`. Has anything moved?
- [ ] Update the business valuation estimate in `19-exit-plan.md`.

## Annually — one full day

- [ ] Income tax return with your accountant. Revisit the sole trader vs Pty
      Ltd question (`07`).
- [ ] ASIC annual review and fee, if you have a company.
- [ ] Renew: domains, business name, insurance, any annual vendor contracts.
      Check none are on silent auto-renew at a price you would not choose.
- [ ] Re-read your terms of service and privacy policy. Do they still describe
      what the product actually does? Update if not.
- [ ] Full dependency audit — upgrade major versions deliberately, in a quiet
      week, one at a time.
- [ ] Rewrite the runbooks (`14`) as though someone else will use them. In a
      year you will have forgotten, and future you counts as someone else.
- [ ] Decide, deliberately: grow, hold, or sell (`19`).

## The absence test

Twice a year, go away for two weeks and touch nothing.

Everything that breaks, or that you feel anxious about, is a gap in the system.
Fix each one on return. Passing this test is the actual definition of the
business you said you wanted — and it is the only honest measure of whether
you have built it.
