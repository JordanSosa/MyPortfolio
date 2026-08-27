# 08 — Pricing and Payments

## Pricing is the highest-leverage decision in this pack

It sets how many customers you need, which sets your support load, which
decides whether the business fits in 10 hours. Get it wrong low and no amount
of product quality rescues you.

**Most solo founders underprice by 2–3×.** The instinct that a low price will
win customers is wrong in B2B: a suspiciously cheap tool reads as a tool that
will not be maintained, which is a rational fear about software sold by one
person.

## Setting the price

1. **Anchor on value, not on cost.** What does the problem cost them per year —
   in penalties, in wasted hours at their charge-out rate, in lost clients?
   Price at 10–20% of that.
2. **Anchor on the incumbent.** If the alternative is $400/month for a bloated
   suite, $149 for the one part they use is an easy yes, and you are not the
   cheap option — you are the focused one.
3. **Anchor on your constraint.** From `01`: fewer than 60 customers for $5k
   MRR means a floor near **$99/month**.
4. **Test it by asking.** `04` makes you ask for money before you build. That
   is the only real price research.

## Structure

Three tiers, and only three. More tiers means more decisions for the buyer and
more states for you.

| | Starter | Professional (make this obvious) | Business |
| --- | --- | --- | --- |
| Price | $79/mo | $149/mo | $349/mo |
| Positioned for | Smallest viable customer | Your actual ICP | The largest you'll serve unattended |
| Differentiator | A single value metric — entities tracked, seats, volume | | |

**Pick one value metric and scale on it.** It should grow as the customer gets
more value, be obvious in advance, and be impossible to game. Entities
monitored, API calls, or locations are good. Storage is bad — nobody feels
storage.

### Rules

- [ ] **Annual billing at a 2-month discount.** This is the single best move
      available to you: it collects cash up front, cuts churn structurally,
      and reduces failed-payment events twelve-fold. Push it hard.
- [ ] **No free plan.** A free tier is an unbounded support obligation with no
      revenue attached. Offer a **14-day free trial with a card required** —
      it filters out the tyre-kickers who generate most of the tickets.
- [ ] **Price in AUD if your market is Australian.** It signals you understand
      their world and removes a conversion question.
- [ ] **Publish your prices.** "Contact us for pricing" is a promise to spend
      your evenings on sales calls.
- [ ] **Grandfather existing customers on price rises.** It costs little,
      converts a rise into loyalty, and gives you a clean reason to email
      everyone.
- [ ] **Raise prices for new customers every 6–12 months** until conversion
      visibly suffers. You will find you had room.

## Payments: merchant of record, or Stripe direct?

This is a genuine fork, and the low-touch constraint pushes hard one way.

### Merchant of record (Paddle, Lemon Squeezy, Polar)

The provider is legally the seller. They handle sales tax, VAT and GST
worldwide, produce compliant invoices, and take on chargebacks.

- **Cost:** roughly 5% + fixed fee per transaction — call it 5%.
- **You get:** no global tax registrations, no VAT MOSS, no per-country
  thresholds to monitor, no invoice compliance work, fewer disputes handled by
  you.
- **You give up:** ~2.5% of revenue versus Stripe, some checkout control, and
  you take on platform risk — their terms, their payout schedule, their
  account review.

### Stripe direct

- **Cost:** roughly 1.75% + $0.30 for domestic Australian cards, higher for
  international and currency conversion. Check current rates.
- **You get:** lower fees, full control, the best developer experience,
  Stripe Billing's dunning and Customer Portal, and it is what an acquirer
  expects to see.
- **You take on:** determining and remitting sales tax in every jurisdiction
  you sell into. For Australia-only customers this is simply GST and is
  manageable. For international sales it is an ongoing obligation that grows
  quietly and expensively.

### Recommendation

| If | Use |
| --- | --- |
| Customers are overwhelmingly Australian | **Stripe direct.** One jurisdiction, one tax, minimal overhead, keep the 2.5% |
| You sell internationally, or expect to | **Merchant of record.** The 2.5% is cheap insurance against a compliance obligation you have no time to run |

Given the Australian focus and the ICPs in `02`, **start with Stripe direct**
— and revisit if international revenue exceeds 20%. Whichever you pick,
**confirm the GST treatment with your accountant** before the first sale (see
`07`), because MoR and direct sales are treated differently.

## Billing must be entirely self-serve

Every one of these must work without you:

- [ ] Subscribe, with card, in under two minutes
- [ ] Upgrade and downgrade, with correct proration
- [ ] Update payment method
- [ ] View and download past invoices with correct tax detail
- [ ] Cancel — genuinely self-serve, no "email us to cancel"
- [ ] Switch monthly to annual

Stripe's Customer Portal gives you nearly all of this out of the box. Use it.
Do not build a billing UI.

## Dunning — the most valuable automation you will build

Failed payments are the largest source of *involuntary* churn, and unlike real
churn they are almost entirely recoverable by machine.

- [ ] Smart retries on failure (Stripe Billing does this; enable it)
- [ ] Email on each failure: day 1, day 3, day 7, day 14 — with a one-click
      card update link
- [ ] In-app banner while payment is failing
- [ ] Card-expiring-soon email at 30 days
- [ ] Automatic cancellation after the retry window, with a clear final email
- [ ] Grace period so access does not cut off on the first decline

Configured well, this recovers a meaningful share of failed payments while you
sleep, and requires zero attention. Set it up before the first customer, not
after the first loss.

## Refunds

Publish a plain policy and honour it without argument:

> Cancel any time from your account. If you're unhappy in the first 30 days,
> reply to any email from us and we'll refund you in full — no questions.

Then actually do it, in under 24 hours. At these amounts, a disputed refund
costs more in your time and reputation than the money involved, and a
chargeback costs more again.

## Things that quietly destroy margin

| Watch | Mitigation |
| --- | --- |
| Currency conversion fees on international cards | Price in AUD, or use an MoR |
| Chargebacks | Clear billing descriptor, obvious cancellation, generous refunds |
| Per-unit COGS growing with heavy users | Meter the value metric; cap or tier it |
| Discounts becoming permanent | Time-limit every coupon; never discount to save a churning customer |
| Annual plans sold at monthly-equivalent price | The discount is the point — but keep it at 2 months, not 4 |
