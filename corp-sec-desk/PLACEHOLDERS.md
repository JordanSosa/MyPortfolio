# Placeholders to fill before deploy

Every bracketed value in the site that must be replaced with a real value.
Search the codebase for `[` to confirm none remain before going live.

| Placeholder | Where it appears | Replace with |
| --- | --- | --- |
| `[Business name]` | `index.html` — `<title>`, nav wordmark, footer | The trading name of the desk |
| `[email]` | `index.html` — hero CTA `mailto:`, footer link text and `mailto:` | The desk's enquiry email address (appears in three places: two `mailto:` hrefs and the visible footer text) |
| `[Your firm name]` | `index.html` — the `subject=` parameter of both `mailto:` links (URL-encoded as `%5BYour%20firm%20name%5D`) | Leave as a literal prompt for the sender, or drop it — it is the part of the email subject the referring firm fills in |
| `[ABN]` | `index.html` — footer | The registered ABN |
| `[Agent No. — placeholder until registration is finalised]` | `index.html` — FAQ answer "How do you lodge?" | The ASIC registered agent number, once registration is finalised |

Also update:

- `<meta name="description">` and `<title>` in `index.html` once the business
  name is final.
