# Isabella's Alerts

> *The luxury-tech briefing.* A daily generative-AI digest curated by a sharp editorial persona — covering the intersection of generative AI and the luxury, fashion, beauty, and premium retail industries.

---

## What it does

1. **Fetch** — `src/fetch-news.js` pulls RSS items from a configurable list of feeds, deduplicates by URL, and keeps only items from the last 24 hours.
2. **Curate** — `src/curate.js` sends batches to the Anthropic API. Claude filters (discard generic AI/fashion news), scores (1–5 relevance), summarises (Isabella's voice), and categorises each item.
3. **Build** — `src/build-digest.js` assembles the HTML email, a dated JSON archive entry, and `data/latest.json` which the dashboard reads.
4. **Send** — `src/send-alert.js` delivers the digest via [Resend](https://resend.com).
5. **Publish** — GitHub Actions commits the new `data/` files back to the repo; GitHub Pages serves the static dashboard from `dashboard/index.html`.

---

## Repo structure

```
├── config.js                     ← all configuration lives here
├── src/
│   ├── fetch-news.js
│   ├── curate.js
│   ├── build-digest.js
│   └── send-alert.js
├── dashboard/
│   └── index.html                ← static dashboard (GitHub Pages)
├── data/
│   ├── raw-fetch.json            ← transient; not committed
│   ├── curated.json              ← transient; not committed
│   ├── latest.json               ← committed; dashboard reads this
│   ├── archive-index.json        ← committed; list of digest dates
│   ├── email.html                ← transient email preview
│   └── digests/
│       └── YYYY-MM-DD.json       ← committed archive entries
├── .github/
│   └── workflows/
│       └── daily-digest.yml
└── package.json
```

---

## Setup

### 1. Fork / clone the repo

```bash
git clone https://github.com/your-username/isabellas-alerts
cd isabellas-alerts
npm install
```

### 2. Add GitHub Actions secrets

In your repo → **Settings → Secrets and variables → Actions**, add:

| Secret name         | Value |
|---------------------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (`sk-ant-...`) |
| `RESEND_API_KEY`    | Your Resend API key (`re_...`) |
| `ALERT_RECIPIENTS`  | Comma-separated recipient emails |

> **Never** put these values in `config.js` or anywhere in the repo.

### 3. Edit `config.js`

The only file you need to touch for day-to-day configuration:

- **`feeds`** — add/remove RSS sources; each entry takes `name`, `url`, and an optional `hint` for the curator.
- **`relevanceThreshold`** — raise to 4 for a tighter digest; lower to 2 for more coverage.
- **`cronSchedule`** — change the delivery time (GitHub Actions cron, UTC).
- **`email.to`** — override recipients locally (or rely on the `ALERT_RECIPIENTS` secret in CI).

### 4. Enable GitHub Pages

In your repo → **Settings → Pages**:
- **Source**: Deploy from a branch
- **Branch**: `main` (or your default branch), **folder**: `/dashboard`

The dashboard will be live at `https://your-username.github.io/isabellas-alerts/`.

The dashboard reads `../data/latest.json` relative to `dashboard/`, so the committed `data/` files must be in the repo root.

---

## Testing locally

### 1. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and paste in your keys — Anthropic, Resend, and the recipient address(es). This file is gitignored and never committed.

### 2. Run just the fetcher (no API keys needed)

```bash
npm run fetch
```

Inspect `data/raw-fetch.json` — verify the feeds are clean and item counts look right.

### 3. Run the full pipeline

```bash
npm run pipeline
```

Or step by step if you want to inspect each stage:

```bash
npm run fetch    # → data/raw-fetch.json
npm run curate   # → data/curated.json  (requires ANTHROPIC_API_KEY)
npm run build    # → data/latest.json, data/email.html, data/digests/…
npm run send     # sends the email      (requires RESEND_API_KEY)
```

Each script loads `.env` automatically via Node's `--env-file` flag (Node ≥ 20 required).

### Preview the email without sending

After `node src/build-digest.js`, open `data/email.html` in a browser.

### Preview the dashboard locally

```bash
npx serve dashboard
```

Or simply open `dashboard/index.html` — it fetches from `../data/latest.json` relative to the file. This works directly when `data/latest.json` exists and you're serving via a local HTTP server (CORS blocks `file://` fetches; use `npx serve` or VS Code Live Server).

---

## Triggering the pipeline manually

The workflow supports `workflow_dispatch`. Go to **Actions → Isabella's Alerts — Daily Digest → Run workflow**. Check **Skip email send** for a dry run that still commits the digest.

---

## Adding or swapping feeds

Edit the `feeds` array in `config.js`:

```js
{
  name: "Profound (AEO Coverage)",
  url:  "https://www.profound.com/blog/rss.xml",
  hint: "answer engine optimisation, luxury discovery",
},
```

The `hint` field is passed to Claude as context; it helps the curator make better keep/discard decisions for ambiguous sources.

---

## Architecture notes

- **No framework, no database.** The pipeline is plain Node.js ES modules.
- **Strict JSON from Claude.** `curate.js` instructs the model to return a bare JSON array and parses it defensively (strips code fences, falls back to regex extraction).
- **Batching.** Items are sent to Claude in batches of 8 to stay comfortably within token limits.
- **Archive.** Each digest is saved as a dated JSON file in `data/digests/`. The dashboard can browse up to 90 days of history.
- **Idempotent commits.** The workflow only commits if `data/` files actually changed.
