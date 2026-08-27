# 11 — Support Playbook

Support is the variable that decides whether this business fits in 10 hours.
Left alone it grows linearly with customers. Managed properly it stays roughly
flat, because the same twenty questions arrive forever and each one only has to
be answered well once.

**Target: under 5 support-minutes per customer per month.** Track it. It is a
real metric, not an aspiration.

## The four-layer model

Every question should be caught by the earliest layer that can handle it.

| Layer | Catches | Cost to you |
| --- | --- | --- |
| 1. Product design | The question is never asked | Zero, forever |
| 2. Docs and in-app help | Customer self-serves | Zero, after writing |
| 3. Templated reply | You paste and personalise one line | 2 minutes |
| 4. Real thinking | Genuinely novel problem | 15+ minutes |

Every layer-4 ticket must produce an improvement at layer 1, 2 or 3. That is
the rule that keeps the load flat. A ticket you answer and forget is a ticket
you will answer again.

## Channel: email only

- One address, `support@<DOMAIN>`, in a helpdesk with canned replies and
  snoozing (Help Scout, Front, or plain Gmail with templates while volume is
  low).
- **No live chat.** It is an interrupt machine and it sets an expectation of
  instant response that you cannot meet at 10 hours a week.
- **No phone.** Not on the site, not in the footer.
- **Publish your response time and beat it:** "We reply within one business
  day, Monday to Friday, Australian Eastern time." Under-promising here is
  free, and it converts an unanswered email from anxiety into a normal wait.

## Deflection — build these before launch

- [ ] **Searchable docs**, linked from every page of the app
- [ ] **Contextual help** — a short explanation next to any control that has
      ever confused anyone
- [ ] **A getting-started checklist** in the app, visible until finished
- [ ] **Good empty states** that say what to do next, not "no data"
- [ ] **Error messages that state the fix**, not the failure. "Your CSV is
      missing a `date` column — here's the template" instead of "Import failed"
- [ ] **A status page**, even a static one, so outage emails become
      self-service
- [ ] **A visible FAQ on the pricing page** answering the objections that
      otherwise arrive as pre-sales email
- [ ] **A help link in every automated email** you send

## The canned reply library

Write these before launch. Keep them in the helpdesk. Personalise one sentence
each time so they do not read like a robot.

- [ ] How do I get started?
- [ ] How do I import my data / what format?
- [ ] How do I change my plan?
- [ ] How do I update my card?
- [ ] How do I cancel? *(Answer plainly and immediately. Never make cancelling hard.)*
- [ ] Can I get a refund?
- [ ] Where is my data stored? Is it secure?
- [ ] Do you have a privacy policy / can you complete our security form?
- [ ] Feature request — logged, no promises
- [ ] Bug report — acknowledged, with a timeframe
- [ ] Outage acknowledgement
- [ ] Payment failed
- [ ] Trial ending
- [ ] "Can you jump on a call?" *(See below)*
- [ ] "Can you build X just for us?" *(See `05` — the answer is no)*

## The call request

You will get these. Answering them one at a time destroys the schedule.

> Thanks for asking — I keep support to email so I can reply quickly and keep
> prices where they are. If you tell me what you're trying to do, I'll usually
> have an answer back the same day, and often a link to exactly the right page.

If it is a genuinely large account and a call would close it, take the call —
but decide that consciously, and price the account accordingly.

## Batching

Two windows per week (`10`). Between them, support email does not notify you.

- Sort by oldest first. Clear to zero, every time.
- Anything needing more than 15 minutes: acknowledge now, schedule for Friday's
  block, tell the customer when to expect the answer.
- Anything that is a bug: reply with an acknowledgement and a timeframe, log
  it, then fix it in the product block.

**The one exception:** a total outage, which is an alert, not a ticket, and is
handled by `14-runbooks.md`.

## The support log

One row per ticket, in [`worksheets/support-log.md`](./worksheets/support-log.md).
Two minutes a week to maintain, and it is where your roadmap comes from.

| Date | Customer | Category | Minutes | Root cause | Fix layer | Fixed? |
| --- | --- | --- | --- | --- | --- | --- |

Review monthly (`10`). The top category is next month's product or docs work.
Over a year this log will show you that a handful of design decisions generated
most of your support, and fixing those is what buys back your time.

## When to hire

At roughly **150 customers, or 6 support hours a week**, a part-time VA becomes
worth it — $400–$800/month for layers 1–3, escalating only layer 4 to you.

Prerequisites, or you will spend more time managing than answering:

- [ ] The canned reply library is complete and actually used
- [ ] Docs are good enough that the VA can find answers
- [ ] `14-runbooks.md` covers the common operational tasks
- [ ] A clear escalation rule: anything about billing disputes, data loss,
      legal, or security comes to you immediately

This is the single highest-leverage hire in the business, and the point at
which "minimal interaction" becomes literally true.
