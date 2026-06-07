/**
 * build-digest.js
 *
 * Reads data/curated.json, builds:
 *   1. docs/data/digests/YYYY-MM-DD.json  — dated archive entry (committed, served by GH Pages)
 *   2. docs/data/latest.json              — current digest (committed, dashboard reads this)
 *   3. docs/data/archive-index.json       — ordered list of digest dates (committed)
 *   4. data/email.html                    — email preview (transient, gitignored)
 *
 * Run standalone:  node --env-file=.env src/build-digest.js
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURATED_PATH    = path.join(__dirname, "../data/curated.json");
// Published outputs → docs/data/ (committed, served via GitHub Pages)
const DIGESTS_DIR     = path.join(__dirname, "../docs/data/digests");
const LATEST_PATH     = path.join(__dirname, "../docs/data/latest.json");
const ARCHIVE_INDEX_PATH = path.join(__dirname, "../docs/data/archive-index.json");
// Transient preview → data/ (gitignored, local only)
const EMAIL_PREVIEW_PATH = path.join(__dirname, "../data/email.html");

// ── Category colour accents (used in HTML email) ───────────────────────────────

const CATEGORY_STYLES = {
  "Maisons & Brands":    { dot: "#C9A96E", label: "Maisons & Brands" },
  "AI Tooling":          { dot: "#8B7D6B", label: "AI Tooling" },
  "Commerce & Retail":   { dot: "#A0937D", label: "Commerce & Retail" },
  "Creative & Campaigns":{ dot: "#B5AA99", label: "Creative & Campaigns" },
  "Policy & Risk":       { dot: "#7A6652", label: "Policy & Risk" },
};

// ── Score → display bar ────────────────────────────────────────────────────────

function scoreBar(n) {
  return "■".repeat(n) + "□".repeat(5 - n);
}

// ── Editor's note generator ────────────────────────────────────────────────────

function editorsNote(items, date) {
  const formatted = new Date(date).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const topCategory = (() => {
    const counts = {};
    for (const it of items) counts[it.category] = (counts[it.category] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "the industry";
  })();
  const leadScore = items[0]?.score ?? 0;

  if (items.length === 0) return "A quiet day — nothing cleared the bar. Back tomorrow.";
  if (items.length === 1) return `One story worth your attention today, and it concerns ${topCategory.toLowerCase()}. Quality over quantity.`;
  return `${formatted}. ${items.length} stories cleared the bar today — the lead, scoring ${leadScore}/5, concerns ${items[0]?.category?.toLowerCase() ?? "the space"} and deserves the first read. ${topCategory} dominated the week's signal.`;
}

// ── HTML email builder ─────────────────────────────────────────────────────────

function buildEmailHtml(digest) {
  const { items, digestDate } = digest;
  const formatted = new Date(digestDate).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const note = editorsNote(items, digestDate);

  const itemsHtml = items
    .map((item, i) => {
      const cs = CATEGORY_STYLES[item.category] ?? { dot: "#C9A96E", label: item.category };
      const isLead = i === 0;
      return `
    <tr>
      <td style="padding: ${isLead ? "32px 0 28px" : "24px 0 20px"}; border-top: 1px solid #E8E2D9;">
        <!-- category + score row -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: ${cs.dot};">
            ${cs.label}
          </td>
          <td align="right" style="font-family: 'Courier New', monospace; font-size: 11px; color: #B5AA99; letter-spacing: 0.04em;">
            ${scoreBar(item.score ?? 3)}
          </td>
        </tr></table>
        <!-- headline -->
        <h2 style="margin: 8px 0 12px; font-family: 'Playfair Display', Georgia, serif; font-size: ${isLead ? "22px" : "17px"}; font-weight: 700; line-height: 1.3; color: #1A1714;">
          <a href="${item.link}" style="color: #1A1714; text-decoration: none;">${item.headline}</a>
        </h2>
        <!-- isabella's take -->
        <p style="margin: 0 0 10px; font-family: 'Inter', Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #3D3530;">
          ${item.take}
        </p>
        <!-- source + date -->
        <p style="margin: 0; font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #9E9188; letter-spacing: 0.04em;">
          ${item.source} &nbsp;·&nbsp; ${item.pubDate ? new Date(item.pubDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
          &nbsp;·&nbsp; <a href="${item.link}" style="color: #C9A96E; text-decoration: none;">Read →</a>
        </p>
      </td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>Isabella's Alerts — ${formatted}</title>
</head>
<body style="margin:0;padding:0;background:#F8F5EF;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F5EF;">
  <tr><td align="center" style="padding: 40px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#FDFCF9;">

      <!-- Masthead -->
      <tr>
        <td style="padding: 40px 48px 0; border-top: 3px solid #1A1714;">
          <p style="margin:0 0 6px;font-family:'Inter',Arial,sans-serif;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#9E9188;">
            ${formatted}
          </p>
          <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:36px;font-weight:900;letter-spacing:-0.01em;color:#1A1714;line-height:1.1;">
            ISABELLA'S ALERTS
          </h1>
          <p style="margin:8px 0 0;font-family:'Inter',Arial,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9E9188;">
            The luxury-tech briefing
          </p>
          <hr style="border:none;border-top:1px solid #E8E2D9;margin:24px 0 0;">
        </td>
      </tr>

      <!-- Editor's note -->
      <tr>
        <td style="padding: 24px 48px 8px;">
          <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:15px;font-style:italic;line-height:1.7;color:#3D3530;">
            ${note}
          </p>
        </td>
      </tr>

      <!-- Items -->
      <tr>
        <td style="padding: 0 48px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${itemsHtml}
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding: 32px 48px 40px; border-top: 3px solid #1A1714; margin-top: 8px;">
          <p style="margin:0 0 6px;font-family:'Inter',Arial,sans-serif;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#9E9188;">
            Isabella's Alerts &nbsp;·&nbsp; The luxury-tech briefing
          </p>
          <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#B5AA99;line-height:1.6;">
            Curated daily by a generative AI pipeline, written in Isabella's voice.<br>
            You are receiving this because you subscribed. To unsubscribe, reply STOP.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  console.log("━━━ Isabella's Alerts — build-digest ━━━");

  const curated = JSON.parse(await fs.readFile(CURATED_PATH, "utf8"));
  const { digestDate, items } = curated;

  await fs.mkdir(DIGESTS_DIR, { recursive: true });

  // 1. Dated archive entry
  const datedPath = path.join(DIGESTS_DIR, `${digestDate}.json`);
  await fs.writeFile(datedPath, JSON.stringify(curated, null, 2));
  console.log(`  Wrote dated digest: docs/data/digests/${digestDate}.json`);

  // 2. latest.json (dashboard reads this)
  await fs.writeFile(LATEST_PATH, JSON.stringify(curated, null, 2));
  console.log("  Wrote docs/data/latest.json");

  // 3. Archive index
  let archiveIndex = [];
  try {
    archiveIndex = JSON.parse(await fs.readFile(ARCHIVE_INDEX_PATH, "utf8"));
  } catch { /* first run */ }

  if (!archiveIndex.includes(digestDate)) {
    archiveIndex.unshift(digestDate);
    archiveIndex = archiveIndex.slice(0, 90); // keep 90 days
    await fs.writeFile(ARCHIVE_INDEX_PATH, JSON.stringify(archiveIndex, null, 2));
    console.log(`  Updated docs/data/archive-index.json (${archiveIndex.length} entries)`);
  }

  // 4. HTML email (also write preview file)
  const emailHtml = buildEmailHtml(curated);
  await fs.writeFile(EMAIL_PREVIEW_PATH, emailHtml);
  console.log("  Wrote email preview: data/email.html");

  console.log(`\n✓ Digest built — ${items.length} items for ${digestDate}`);

  // Export for send-alert.js
  return { emailHtml, subject: `Isabella's Alerts — ${digestDate}`, digestDate };
}

export { buildEmailHtml, editorsNote };
export default run;

// Allow direct execution
run().catch((err) => {
  console.error("build-digest fatal:", err);
  process.exit(1);
});
