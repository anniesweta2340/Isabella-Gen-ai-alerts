/**
 * fetch-news.js
 *
 * Pulls RSS items from every feed in config.js, filters to the lookback window,
 * deduplicates by URL, and writes data/raw-fetch.json.
 *
 * Run standalone:  node src/fetch-news.js
 */

import Parser from "rss-parser";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../data/raw-fetch.json");

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "IsabellasAlerts/1.0 (+https://github.com/anniesweta2340/isabella-gen-ai-alerts)",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function cutoffDate() {
  const d = new Date();
  d.setHours(d.getHours() - config.lookbackHours);
  return d;
}

function normaliseItem(item, feedName, feedHint) {
  const pubDate = item.pubDate || item.isoDate || null;
  return {
    id: item.link || item.guid || item.title,
    title: (item.title || "").trim(),
    link: (item.link || item.guid || "").trim(),
    pubDate: pubDate ? new Date(pubDate).toISOString() : null,
    summary: stripHtml(item.contentSnippet || item.summary || item.content || ""),
    source: feedName,
    sourceHint: feedHint,
  };
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 600);
}

function isWithinWindow(item, cutoff) {
  if (!item.pubDate) return true; // include if date is unknown
  return new Date(item.pubDate) >= cutoff;
}

// ── Core fetch ───────────────────────────────────────────────────────────────

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return parsed.items.map((item) => normaliseItem(item, feed.name, feed.hint || ""));
  } catch (err) {
    console.warn(`  [WARN] Could not fetch "${feed.name}": ${err.message}`);
    return [];
  }
}

async function run() {
  console.log("━━━ Isabella's Alerts — fetch-news ━━━");
  console.log(`Lookback window: ${config.lookbackHours}h  |  Feeds: ${config.feeds.length}\n`);

  const cutoff = cutoffDate();
  const seen = new Set();
  const allItems = [];

  for (const feed of config.feeds) {
    process.stdout.write(`  Fetching: ${feed.name} … `);
    const items = await fetchFeed(feed);
    const fresh = items.filter((i) => isWithinWindow(i, cutoff));

    let added = 0;
    for (const item of fresh) {
      const key = (item.link || item.title || "").toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        allItems.push(item);
        added++;
      }
    }
    console.log(`${items.length} items fetched, ${fresh.length} within window, ${added} new`);
  }

  // Sort newest first
  allItems.sort((a, b) => {
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify({ fetchedAt: new Date().toISOString(), items: allItems }, null, 2));

  console.log(`\n✓ ${allItems.length} unique items written to data/raw-fetch.json`);

  // ── Preview table ──────────────────────────────────────────────────────────
  console.log("\n── Sample (first 10 items) ───────────────────────────────────────────────");
  const sample = allItems.slice(0, 10);
  for (const item of sample) {
    const date = item.pubDate ? item.pubDate.slice(0, 10) : "unknown";
    const title = item.title.slice(0, 72).padEnd(72);
    console.log(`  [${date}] ${title}  (${item.source})`);
  }
  console.log("──────────────────────────────────────────────────────────────────────────\n");
}

run().catch((err) => {
  console.error("fetch-news fatal:", err);
  process.exit(1);
});
