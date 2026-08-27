# 14 — Runbooks

Written so that **someone who is not you can execute them** — a VA, a
contractor, or you at 3am, or you in eighteen months having forgotten
everything.

Keep them current. Rewrite annually (`10`). A runbook that no longer matches
reality is worse than none, because it is trusted.

## Quick reference — fill this in

| Thing | Where | Access |
| --- | --- | --- |
| Production hosting | | |
| Database | | |
| DNS | | |
| Payments | | |
| Transactional email | | |
| Error tracking | | |
| Uptime monitor | | |
| Code repository | | |
| Domain registrar | | |
| Accountant | | |
| Lawyer | | |

Store credentials in a password manager with **emergency access configured for
someone you trust.** Do this now. A business only you can access is a business
that dies with your laptop.

---

## R1 — Site is down

1. **Confirm it is real.** Check the uptime monitor and load the site from
   mobile data. Half of all "outages" are your own network or DNS cache.
2. **Check the hosting provider's status page.** If it is them, post to your
   status page and wait. There is nothing to fix.
3. **Check recent deploys.** If a deploy went out in the last hour, **roll
   back first and diagnose after.** Rolling back is always faster than fixing
   forward under pressure.
4. **Check the database.** Is it up? Connection limit reached? Disk full?
5. **Check certificates.** Expired TLS is a top self-inflicted cause.
6. **Communicate at 15 minutes.** Status page, then an email to customers if
   it exceeds 30 minutes. Say what is broken, what you are doing, and when you
   will next update. Do not speculate on cause.
7. **Afterwards:** write down what happened, why, and the one change that
   prevents recurrence. Make that change within a week or it will not happen.

## R2 — Payments failing

1. Check the payment provider's status page.
2. Check the webhook endpoint is reachable and returning 200. **A silently
   failing webhook means customers are paying and not getting access** — the
   worst failure mode in the business, because it looks fine from your side.
3. Replay failed webhook events from the provider dashboard.
4. Reconcile: list subscriptions active in the provider but inactive in your
   database, and fix each.
5. Email anyone affected personally, apologise, and extend their period.

## R3 — A single customer's payment failed

Do nothing. Dunning (`08`) handles it: retries, four emails, a banner, then
cancellation with a grace period.

**Intervene manually only** for a customer above your annual-value threshold,
and then send a short personal email, not a template.

## R4 — Refund request

1. Grant it. Under 30 days, no questions (`08`).
2. Process in the payment provider. Same day.
3. Reply confirming the amount and when it will appear — 5–10 business days.
4. Log the reason in the support log.
5. If a reason repeats, it is a product or a positioning problem, not a refund
   problem.

## R5 — Suspected data breach

**Move carefully. Do not delete anything.**

1. **Contain.** Revoke the compromised credential, rotate keys, isolate the
   affected system. Do not "clean up" — you are destroying evidence.
2. **Preserve.** Snapshot logs and the affected systems before changing them.
3. **Assess.** What data, whose, how much, and is it still exposed?
4. **Get advice.** Call your lawyer and your cyber insurer **before**
   notifying anyone. The insurer often supplies breach response specialists as
   part of the cover, and notifying incorrectly can make things worse.
5. **Notify.** Australia's Notifiable Data Breaches scheme imposes obligations
   with specific timeframes where it applies — assume it applies to you (`07`).
   Your lawyer determines what must be told to whom and by when.
6. **Tell affected customers** plainly: what happened, what data, what you have
   done, what they should do.
7. **Post-mortem**, written, with concrete changes.

**Do not:** downplay it, delay to investigate first, or notify before taking
advice.

## R6 — Restore from backup *(practise this quarterly)*

1. Take a fresh backup of the current state first, however broken it is.
2. Provision a scratch database. **Never restore over production as the first
   attempt.**
3. Restore the chosen backup into the scratch instance.
4. Verify: row counts, most recent record timestamp, spot-check three
   customers' data.
5. Point staging at it and exercise the critical paths.
6. Only then plan the production cutover, with a maintenance window and a
   customer email.

**Last successful restore test:** ........ **Elapsed time:** ........

If those blanks are empty, you do not have backups — you have hope.

## R7 — A customer churns

1. Access ends at period end. Automatic; do not intervene.
2. Retain their data for the documented period (30–90 days), then delete it —
   automatically, per your privacy policy.
3. Send one personal email, 3 days later, from you: *"Genuinely no pitch — what
   made you leave? It helps me a lot."*
4. Log the answer. Review monthly (`10`).
5. **Do not offer a discount to save them.** It teaches customers to threaten
   to leave and it converts a churn problem into a margin problem.

## R8 — A dependency is deprecated or breaks

1. Assess the deadline and the blast radius.
2. If it is a hard cutoff with a date, schedule it into the deep work block
   *now*, several weeks before the deadline.
3. Upgrade one major version at a time, on a branch, with CI green.
4. Deploy to staging, run the smoke tests, sit on it a day, then production.
5. If a vendor is shutting down entirely, this is a `18-risk-register.md` event
   — start the replacement evaluation the day you hear.

## R9 — Sudden traffic or usage spike

1. Is it real, or a bot? Check the source.
2. If it is abuse: rate-limit, block, and check nothing is unauthenticated that
   should not be.
3. If it is real: check spend against the value metric. **An unmetered heavy
   user can cost more than they pay** — this is why `08` insists on a value
   metric.
4. Scale up if needed. It is cheaper to over-provision for a week than to be
   down.

## R10 — You are unavailable (illness, travel, life)

1. Set an autoresponder on support with an honest return date.
2. Post a notice on the status page if the absence exceeds a week.
3. The system continues: billing, jobs, dunning and onboarding are all
   automatic (`12`). This is the payoff for the build phase.
4. **If it will exceed two weeks:** brief a trusted contact, give them
   emergency password-manager access, and point them at this file.

## R11 — Handover / operating without you permanently

Kept current so it exists when it is needed.

- [ ] Password manager emergency access is configured and tested
- [ ] This file's quick reference table is filled in and accurate
- [ ] A trusted person knows the business exists and where these files are
- [ ] Your accountant's and lawyer's details are here
- [ ] Customer obligations — what you owe them and until when — are written down
- [ ] Instructions for a graceful shutdown: notify customers, refund unused
      prepaid periods, export their data, then wind down
