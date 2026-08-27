# 06 — Technical Architecture

The stack is chosen to minimise the hours you spend *not building* — patching,
debugging deploys, and being paged. Interesting architecture is a cost you pay
every week for the rest of the business's life.

## Principles

1. **Boring, in the majority.** Pick technology with ten years of Stack
   Overflow answers behind it. You are the only engineer; you cannot afford to
   be the person who discovers the bug.
2. **One deployable.** A monolith you can run locally with one command. Not
   microservices, not a distributed queue topology, not an event mesh.
3. **Managed everything.** You do not run databases, mail servers, or Kubernetes.
   Paying $25/month to never think about Postgres backups is the best money in
   this budget.
4. **Own your data, rent your infrastructure.** Anything with a proprietary
   query language or no export path is a hostage situation. Postgres is
   portable; a vendor-specific datastore is not.
5. **Prefer scheduled to real-time.** Cron with retries fails politely. Live
   systems fail loudly, at 3am, to your customers.
6. **Every job idempotent.** Re-running must be safe. This single property is
   what lets you fix problems by pressing "run again" instead of investigating.

## Recommended stack

You already work in Vite and vanilla ES modules, so this leans that way
deliberately — familiarity beats optimality for a solo operator.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Types catch the class of bug you'd otherwise find in production, alone, at night |
| Runtime | Node LTS | Longest support window, largest ecosystem |
| Web framework | Anything minimal and stable (Fastify, Hono, Express) | The framework is not the product |
| Frontend | Server-rendered pages + light JS; add a framework only if the UI is genuinely stateful | Fewer moving parts, better SEO on marketing pages |
| Database | Managed Postgres | One database for everything: app data, jobs, cache. Do not add Redis until Postgres actually can't cope |
| Background jobs | A Postgres-backed queue, or platform cron | No extra infrastructure to run or monitor |
| Hosting | A managed platform with git-push deploys (Fly, Render, Railway, or a single well-configured VPS) | Deploys must be a non-event |
| Email — transactional | A dedicated provider (Postmark, Resend, SES) | Deliverability is the whole product for an email-output business |
| Email — marketing | Kept separate from transactional | A marketing complaint must never poison your password-reset delivery |
| Auth | Library in your own app, or a managed provider | Do not hand-roll password hashing or session handling |
| Payments | See `08-pricing-and-payments.md` | Merchant-of-record probably wins |
| Errors | Sentry (free tier is adequate at this scale) | You cannot fix what you never hear about |
| Uptime | An external HTTP monitor | Must be outside your own infrastructure to be worth anything |
| Analytics | Privacy-preserving, cookieless (Plausible, Umami) | Avoids consent banners and the privacy obligations that follow |
| DNS / CDN | Cloudflare | Free tier covers TLS, caching, and basic protection |

## Architecture shape

```
  Marketing site (static)  ──►  App (single Node service)  ──►  Postgres
       │                            │        │
       │                            │        └──►  Scheduled jobs (idempotent)
       │                            │
       └──► Docs (static)           └──►  Email provider  ──►  Customer
                                    └──►  Payments provider (webhooks)
```

Both static sites can deploy from the same repo the way this portfolio already
does — GitHub Actions to Pages, or the same platform as the app.

## Non-negotiables before the first paying customer

- [ ] **Automated daily database backups, tested by an actual restore.** An
      untested backup is a rumour. Restore once, write down how long it took,
      put that in `14-runbooks.md`.
- [ ] **Secrets in the platform's secret store**, never in the repo. Add secret
      scanning to CI.
- [ ] **HTTPS everywhere, HSTS on, automatic certificate renewal.** Expired
      certificates are the most common self-inflicted outage.
- [ ] **Error tracking wired up**, with alerts to email/phone.
- [ ] **External uptime monitoring** on the marketing site, the app, and a
      health endpoint that actually checks the database.
- [ ] **A staging environment**, even a small one. Deploying straight to
      production is fine until the day it isn't.
- [ ] **One-command local setup.** Six months from now you will have forgotten
      everything.
- [ ] **Dependency update automation** (Dependabot/Renovate), grouped weekly,
      auto-merging patch updates that pass CI.
- [ ] **Structured logs** with a request ID, retained long enough to debug a
      complaint from last week.

## Testing, proportionate

You do not need 90% coverage. You need to never be woken up by the same class
of bug twice.

- Unit tests on the core domain logic — the thing customers pay for. Thorough.
- One integration test per critical path: sign up, subscribe, the core job,
  cancel.
- A smoke test that runs against production after every deploy and alerts on
  failure.
- Everything else: skip it until a bug proves otherwise, then write the test
  that would have caught it.

## Data protection built in

Decisions made now that save you enormously later (see also `07`):

- [ ] Collect the minimum personal information the product needs. Data you do
      not hold cannot be breached.
- [ ] Encrypt at rest (managed providers do this — confirm it) and in transit.
- [ ] Deletion actually deletes, including from backups within the backup
      retention window. Document the window.
- [ ] Export: a customer can get all their data out, self-serve, in a standard
      format. This is both a legal nicety and a trust signal.
- [ ] Access log for any admin view of customer data. If you can see their
      data, record when you did.

## What to deliberately not do

| Tempting | Why not |
| --- | --- |
| Microservices | Multiplies deployment, monitoring and failure modes for zero benefit at this scale |
| Kubernetes | You are renting a full-time job |
| A separate SPA + API when pages would do | Two codebases, two deploys, two sets of bugs |
| Multi-region | Your customers are in one country |
| Custom auth | The failure mode is a breach |
| Building your own billing logic | Proration and dunning are harder than your product |
| Bleeding-edge frameworks | You are the support forum |
