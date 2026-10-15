# desk-ops

Local automation for the corp-sec desk: outreach, inbox triage, change-request checks, a daily digest and proposals. It runs on your computer against your own mailbox. Nothing here is deployed with the site.

## What it automates

| Job | What the tool does | What stays with you |
| --- | --- | --- |
| Outreach | Sends a personalised first email and one follow-up four business days later. At most 15 a day, inside business hours, skipping public holidays and the Christmas shutdown. Stops for a firm the moment it replies, bounces or unsubscribes. | Build the prospect list by hand. Glance at the preview, then send. |
| Replies and support | Reads new mail. Marks replies, bounces, unsubscribes and declines. Saves a reply draft for every prospect reply, enquiry and client email to your Drafts folder. Optional AI drafts written from `knowledge/faq.md`. | Read, edit and send each draft. |
| Change requests | Firms email changes on a one-page template, also linked from the site's FAQ. The tool checks the request is complete, the ACN passes ASIC's check digit, the director ID is 15 digits starting 036, the director is 18 or over and consent is held. It drafts the "still need" or "got everything" reply and tracks the 28-day Form 484 deadline. | Prepare and lodge in your corp-sec software, then close the job. |
| Digest | Outreach due today, replies waiting on you, open change jobs, ASIC deadlines and any late-fee exposure. | Read it each morning. |
| Proposals | A one-page proposal priced from the firm's company count. | Send it with your engagement letter. |

## What it won't do

- **Find email addresses.** The Spam Act 2003 bans address-harvesting software and harvested lists (Part 3). The list is built by hand, from addresses firms publish themselves.
- **Send replies on its own.** Every reply is a draft. A wrong answer about an ASIC deadline costs a client late fees and costs you their trust.
- **Send client details to an AI.** Change requests and mail from clients are handled locally. AI drafting only sees prospect replies and general enquiries, after email addresses, phone numbers, dates, long numbers and street addresses are stripped out.
- **Lodge with ASIC.** Lodgement stays in your corp-sec software under your agent number.

## Setup (about 15 minutes)

1. Check Python: `python3 --version` should print 3.9 or later. Nothing else needs installing unless you want AI drafts.
2. Use a desk mailbox on Google Workspace or Gmail with 2-Step Verification on, and create an app password (Google Account > Security > App passwords). Microsoft 365 mailboxes won't work, because Microsoft requires OAuth for IMAP.
3. Create your files:
   ```sh
   cd desk-ops
   python3 desk.py init
   ```
4. Fill in `config.ini`. The `[sender]` details appear on every email, and live sending stays blocked until none of them is still a `[placeholder]`. Set your prices under `[offer]` and a free Cal.com, Calendly or Google Calendar booking page as `booking_link`.
5. Give it the app password, either in `config.ini` (git ignores that file) or as an environment variable:
   ```sh
   export DESK_MAIL_PASSWORD='abcd efgh ijkl mnop'
   ```
6. Add firms to `prospects.csv` (next section).
7. Check everything, including the mailbox login:
   ```sh
   python3 desk.py check
   ```

## Building the prospect list by hand

For each firm, open its own website and find the published address of the principal or the general enquiries address. Then fill in a row:

| Column | What goes in it |
| --- | --- |
| `email` | The published address. |
| `first_name` | The person's first name, if the address belongs to a person. |
| `firm`, `suburb`, `website` | As shown on the site. |
| `source_url` | The page where the address is published. This is your record of where it came from. |
| `no_objection_checked` | `yes` once you've confirmed the page doesn't say it wants no unsolicited email. |
| `personal_line` | Optional. One genuine sentence, such as "Congratulations on the new Narellan office." |
| `notes` | Anything for you. Never sent. |
| `do_not_contact` | `yes` for your employer's clients and anyone else you mustn't approach. |

Sending refuses to run while any row is missing `source_url` or `no_objection_checked`.

## Daily routine (about five minutes)

```sh
python3 desk.py daily
```

This reads your mail, saves drafts, previews today's outreach and prints the digest. Nothing goes out. Then:

1. Read and send the drafts in your Drafts folder.
2. Skim the previews in `data/preview/`. They're `.eml` files your mail app can open.
3. Send the outreach: `python3 desk.py send --live`
4. After a call, record the outcome: `python3 desk.py mark ann@firm.com.au interested`, or `client` or `declined`.
5. Once a change is lodged: `python3 desk.py jobs --close 7`. Closing deletes the personal details the job held.

To run `daily` automatically each morning, add a cron job (macOS or Linux) or a Task Scheduler task (Windows), for example `30 8 * * 1-5 cd /path/to/desk-ops && python3 desk.py daily --live >> data/daily.log 2>&1`. Leave out `--live` until you trust the previews.

## Commands

| Command | Does |
| --- | --- |
| `init` | Creates `config.ini` and `prospects.csv` from the examples. |
| `check [--no-login]` | Checks config, templates and the prospect list, then tests the SMTP and IMAP login. |
| `daily [--live]` | Runs inbox, outreach (a preview unless `--live`) and the digest. |
| `inbox` | Reads new mail, updates the pipeline, saves drafts and tracks change jobs. |
| `send [--live] [--limit N]` | Previews or sends due outreach. Live sending checks the inbox for replies first. |
| `digest [--email]` | Prints the digest, or also emails it to the desk address. |
| `mark EMAIL STATUS` | Records `interested`, `client`, `declined` and so on after a conversation. |
| `suppress EMAIL` | Makes sure the desk never emails that address. |
| `jobs [--close ID]` | Lists open change jobs, or closes one once lodged. |
| `proposal --firm --contact --companies --start` | Writes a one-page proposal to `data/proposals/`. Open it in a browser and print to PDF. |
| `report` | Exports the pipeline to `data/pipeline.csv`. |

## Spam Act rules the tool enforces

- **Consent.** For cold B2B email, consent can be inferred when a business conspicuously publishes an address, the page doesn't say it wants no unsolicited email, and your message is relevant to the recipient's work. The `source_url` and `no_objection_checked` columns are your record of each.
- **Identify the sender (s17).** Every email carries your name, business, ABN, location, phone and email.
- **Working unsubscribe (s18).** Every email says how to opt out and carries a `List-Unsubscribe` header. A reply asking to be removed is acted on the next time the inbox is read, well inside the five business days allowed.
- **No harvesting (Part 3).** The tool never searches for addresses, and neither should anyone building the list.
- **Low volume.** 15 a day and two emails per firm by default. Raising these mostly hurts deliverability.

ACMA's guidance is at <https://www.acma.gov.au/avoid-sending-spam>.

## AI drafting (optional)

1. Install the SDK (needs Python 3.10 or later): `pip install "anthropic>=1,<2"`
2. Set your key: `export ANTHROPIC_API_KEY=...`
3. In `config.ini`, set `[ai] enabled = true`.

Drafts come from Claude Opus 5.5 at low effort, grounded in `knowledge/faq.md`, which fills in your prices and details from `config.ini`. Keep that file accurate: the model is told to use nothing else, and to write `[CHECK: ...]` where it can't answer. Server-side fallback is on, so if the model declines a request the API retries on a fallback model. If drafting still fails, you get the template draft instead. At current prices ($4 per million input tokens, $20 per million output) a draft costs roughly one to two cents.

The redacted text of prospect and enquiry emails goes to Anthropic's API, which runs outside Australia. Client email never does. If you switch AI drafting on, consider saying so in the site's data-handling FAQ.

## Your data

Everything stays in this folder: `config.ini`, `prospects.csv` and `data/` (the SQLite store, previews and proposals). Git ignores all of them. Open change jobs hold directors' personal details until closed, so turn on disk encryption (FileVault or BitLocker) and back the folder up.

## Tests

```sh
python3 -m unittest discover -s tests
```

Twenty-seven tests run against fake mail servers with no network. They cover sequencing, sending, refused addresses, reply, bounce and opt-out handling (including replies that quote the unsubscribe line), change-request checks, redaction, AI drafting, the digest, proposals, the command line, and a round trip of the site's change template through the parser.
