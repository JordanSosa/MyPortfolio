# 05 — Product Scope

Scope discipline is not a virtue here — it is the mechanism that keeps the
business inside 10 hours a week. Every feature is a permanent liability:
support surface, test surface, documentation, and a thing that can break.

## The one-sentence product

Write it before anything else, and refuse anything that does not serve it:

> `<PRODUCT>` <does one specific thing> for `<ICP>` so they never <specific
> bad outcome>.

Print it. Every feature request gets measured against it.

## MVP boundary

**In scope — the smallest thing a customer would pay for:**

- [ ] Sign up with email, verify, set a password. Nothing else at the door.
- [ ] Get data in: one method only. CSV upload, a form, or an API key. Not all three.
- [ ] The core job, done well, for one use case.
- [ ] Output the customer sees: email, dashboard, or export. Pick one primary.
- [ ] Billing: subscribe, see invoices, update card, cancel — all self-serve.
- [ ] A settings page with fewer than eight controls.
- [ ] Docs: a getting-started page and an FAQ.

**Explicitly out of the MVP, no matter who asks:**

- Teams, roles, permissions — until a paying customer is blocked by their absence
- SSO / SAML — until someone offers $500/mo for it
- Mobile app — the responsive web page is the mobile app
- Public API — until three customers ask unprompted
- White-labelling and custom branding
- A second integration
- Custom report layouts
- Anything described as "just a small tweak for us"

## The permanent never list

These are not "later". They are structurally incompatible with a one-person,
low-touch business. Write them down so the decision is made once instead of
every month:

| Never | Because |
| --- | --- |
| Bespoke work for a single customer | It is consulting with a subscription attached, and it never ends |
| Real-time / live collaboration | Uptime becomes a pager, not a metric |
| User-generated public content | Moderation, takedowns, and legal exposure |
| Self-hosted / on-premise deployments | You now support N environments you cannot see |
| Free plans with support | Free users generate 80% of tickets and 0% of revenue |
| Data migration services | Unbounded scope, always underquoted |
| Phone support | An interrupt-driven channel destroys batching |
| Enterprise procurement (security questionnaires, custom MSAs, POs) | Weeks of unpaid work per deal |

The enterprise row is worth sitting with. A $2,000/month enterprise deal that
brings a 300-question security questionnaire, a bespoke contract, an annual
review meeting and a named support contact is a *worse* business than twenty
$99 customers who never call. Politely decline, or quote for the overhead.

## Feature request policy

Every request gets logged. Nothing gets built on request.

1. Log it: who asked, what outcome they want, what they do today, whether they
   would pay more.
2. Reply within your normal support window: *"Logged — I'll come back to you
   if it makes the roadmap."* Never promise a date.
3. Build only when **three or more paying customers** have independently asked
   for the same outcome, and it serves the one-sentence product.
4. Charge for it if it only serves one segment: a higher tier, not a
   configuration flag.

The three-customer rule is the single highest-leverage policy in this pack. It
prevents the most common failure mode of solo SaaS — a product that becomes an
unmaintainable configuration matrix built by whoever emailed most recently.

## Configuration is a tax

Each settings toggle multiplies the states you must support, test and reason
about. Prefer a good default and no option. If you cannot decide the default,
you do not understand the use case well enough to ship it.

Target: **under 8 settings, forever.**

## Onboarding must be unattended

Timebox it: a new customer reaches first value in **under 10 minutes, alone,
without contacting you.** If they cannot, that is a product bug of the highest
severity, not a documentation problem.

- [ ] Sample data or a demo mode so the product is not an empty room
- [ ] One clear next action on every empty state
- [ ] A three-step checklist visible until complete
- [ ] An automated nudge at 24h and 72h if setup is unfinished

## Deprecation discipline

Once a quarter, look at feature usage. Anything used by fewer than 5% of
customers and generating any support at all is a candidate for removal.
Removing features is how a solo product stays maintainable for years. Give 60
days notice, email affected users personally, then delete the code.
