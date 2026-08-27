# 03 — Idea Scorecard

Ten criteria, scored 1–5. Maximum 50. Score honestly; the point of the
exercise is to fail an idea cheaply, on paper, in twenty minutes.

Copy the blank table at the bottom for each idea. Score at least three,
including one of your own.

---

## The criteria

### 1. Support surface (weight: this is your time cap)
How many minutes per customer per month will this consume, forever?

| Score | Looks like |
| --- | --- |
| 5 | Product emails the customer; they rarely need to log in. API with good docs. |
| 4 | Simple self-serve UI, one job, no config. |
| 3 | Multi-step setup the customer can complete alone. |
| 2 | Runs inside environments you don't control (their website, their network). |
| 1 | Non-deterministic output, or real-time, or anything with a "did it work?" question. |

### 2. Operational burden
What breaks at 3am, and does it wake you?

| 5 | Scheduled jobs, retryable, hours of slack. | 3 | Normal web app, daily-ish criticality. | 1 | Real-time, or customers' revenue stops when you stop. |

### 3. Price ceiling
Can it credibly hold $99+/month?

| 5 | Avoids a penalty, a fine, or a lost licence. | 3 | Saves a few hours a month. | 1 | Nice to have; competitors are free. |

### 4. Buyer accessibility
Can you reach 500 of them without a sales team?

| 5 | They gather in an identifiable place — an association, a subreddit, a directory, a conference list. | 3 | Reachable by search intent. | 1 | Diffuse, unsearchable, or gatekept. |

### 5. Domain knowledge you already have
| 5 | You have worked in it or have already researched it deeply. | 3 | Adjacent. | 1 | You would be learning the vocabulary from scratch. |

### 6. Time to first dollar
| 5 | Under 8 weeks. | 3 | 3–4 months. | 1 | 6+ months before anyone can pay. |

### 7. Gross margin
| 5 | >90%, no per-unit COGS. | 3 | 75–90%, some data or inference cost. | 1 | <70%, or costs scale with heavy users. |

### 8. Churn resistance
| 5 | Embedded in a workflow or in production code; removing it is work. | 3 | Habitual use. | 1 | Seasonal, project-based, or easily forgotten. |

### 9. Dependency risk
| 5 | No third-party integration; no single platform can end you. | 3 | One integration, stable vendor. | 1 | Depends on one platform's API, terms, or goodwill. |

### 10. Legal and liability exposure
| 5 | Getting it wrong is an inconvenience. | 3 | Getting it wrong costs the customer money you could be asked to cover. | 1 | Regulated advice, personal data at scale, or safety-critical. |

---

## Interpreting the total

| Total | Verdict |
| --- | --- |
| 43–50 | Build it. Go to `04`. |
| 36–42 | Viable. Validate hard; watch the criteria you scored 1–2 on. |
| 30–35 | Only if you have an unfair advantage that the scorecard does not capture. Write down what it is. |
| < 30 | Do not build this as a solo, 10-hour-a-week business. Something else is a better use of the same effort. |

## The two automatic disqualifiers

Regardless of total, do not proceed if either is true:

- **Any single criterion scored 1 on rows 1, 2 or 10.** Support load,
  operational burden and liability are the three things that turn a business
  back into a job — or into a lawsuit.
- **You cannot name 20 specific potential customers.** Not "small accounting
  firms" — twenty named businesses with a website you have looked at. If you
  cannot list them, you do not have a market, you have a category.

---

## Blank scorecard

Fillable version, with room for three ideas and the 20-names check:
[`worksheets/idea-scorecard.md`](./worksheets/idea-scorecard.md).

```
Idea: ......................................................
ICP (one sentence): ........................................
Price point: $......../month     Customers needed for $5k MRR: ........

 1. Support surface          [ ] /5
 2. Operational burden       [ ] /5
 3. Price ceiling            [ ] /5
 4. Buyer accessibility      [ ] /5
 5. Domain knowledge         [ ] /5
 6. Time to first dollar     [ ] /5
 7. Gross margin             [ ] /5
 8. Churn resistance         [ ] /5
 9. Dependency risk          [ ] /5
10. Legal exposure           [ ] /5
                             ------
                     TOTAL   [ ] /50

Disqualifier check:
  [ ] No score of 1 on rows 1, 2 or 10
  [ ] I have written down 20 named potential customers

The unfair advantage I have here that the scorecard misses:
............................................................

The single thing most likely to kill this:
............................................................
```
