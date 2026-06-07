/**
 * curate.js
 *
 * Reads data/raw-fetch.json, sends batches to the Anthropic API for
 * filtering / scoring / summarising, and writes data/curated.json.
 *
 * Run standalone:  ANTHROPIC_API_KEY=sk-... node src/curate.js
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = path.join(__dirname, "../data/raw-fetch.json");
const OUTPUT_PATH = path.join(__dirname, "../data/curated.json");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the curation engine for Isabella's Alerts — a sharp, opinionated luxury-tech intelligence briefing. Isabella is a well-connected editor who covers the intersection of generative AI and the luxury, fashion, beauty, and premium retail industries.

Your job: review raw RSS items and decide which ones belong in today's digest.

KEEP an item if it is genuinely about generative AI (or closely related AI tooling) AND at least one of: luxury goods, fashion, beauty, premium retail, creative production for maisons, or regulatory/IP risk specific to the luxury-AI nexus.

DISCARD an item if it is:
- Generic AI news with no luxury/fashion angle
- Generic fashion/retail news with no generative AI angle
- Purely financial or M&A news unless the AI-luxury angle is the story
- Speculation, opinion, or hot-takes with no new factual development

For each KEPT item, write in Isabella's voice: confident, elegant, lightly opinionated. She does not use buzzwords. She does not write "delve". She writes for a reader who already knows what an LLM is.

Return a JSON array (no markdown, no prose outside the JSON). Each element:
{
  "id": "<original item id>",
  "keep": true,
  "headline": "<Isabella's rewrite — punchy, max 90 chars>",
  "take": "<2–3 sentence Isabella take on why this matters for luxury. First person plural is fine ('What this means for the maisons…'). No em-dash overuse.>",
  "category": "<one of: Maisons & Brands | AI Tooling | Commerce & Retail | Creative & Campaigns | Policy & Risk>",
  "score": <integer 1–5, where 5 = must-read for anyone in luxury-AI>
}

For DISCARDED items, include only: { "id": "<id>", "keep": false }

Be strict. Isabella has taste. A weak story in the digest is worse than a short one.`;

function buildUserPrompt(items) {
  const itemList = items
    .map(
      (item, i) =>
        `[${i + 1}] SOURCE: ${item.source}\nTITLE: ${item.title}\nSUMMARY: ${item.summary || "(no summary)"}\nURL: ${item.link}`
    )
    .join("\n\n---\n\n");

  return `Here are today's raw RSS items. Curate them for Isabella's Alerts.\n\n${itemList}`;
}

// ── Defensive JSON parse ───────────────────────────────────────────────────────

function extractJSON(text) {
  // Strip any markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try to find the first [...] block
    const match = stripped.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not extract valid JSON from model response");
  }
}

// ── Batch processing (stay under token limits) ─────────────────────────────────

const BATCH_SIZE = 8;

async function curateBatch(items) {
  const message = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(items) }],
  });

  const raw = message.content[0]?.text ?? "";
  const results = extractJSON(raw);

  if (!Array.isArray(results)) throw new Error("Model returned non-array JSON");
  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  console.log("━━━ Isabella's Alerts — curate ━━━");

  const { items, fetchedAt } = JSON.parse(await fs.readFile(INPUT_PATH, "utf8"));
  console.log(`Input: ${items.length} raw items fetched at ${fetchedAt}\n`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`
ERROR: ANTHROPIC_API_KEY is not set.

To run locally, create a .env file in the project root:

  cp .env.example .env
  # then edit .env and paste your key

Get your key at: https://console.anthropic.com/settings/keys
`);
    process.exit(1);
  }

  // Build a lookup map so we can merge model output with original data
  const itemMap = Object.fromEntries(items.map((item) => [item.id, item]));

  const allResults = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    console.log(`  Curating batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)…`);
    const results = await curateBatch(batch);
    allResults.push(...results);
  }

  // Merge model decisions with original item data, apply threshold
  const kept = [];
  const discarded = [];

  for (const result of allResults) {
    if (!result.keep) {
      discarded.push(result.id);
      continue;
    }
    const original = itemMap[result.id];
    if (!original) continue;
    if ((result.score ?? 0) < config.relevanceThreshold) {
      discarded.push(result.id);
      continue;
    }
    kept.push({
      ...original,
      headline: result.headline,
      take: result.take,
      category: result.category,
      score: result.score,
    });
  }

  // Sort by score descending
  kept.sort((a, b) => b.score - a.score);

  // Cap at maxDigestItems
  const digest = kept.slice(0, config.maxDigestItems);

  const output = {
    curatedAt: new Date().toISOString(),
    fetchedAt,
    digestDate: new Date().toISOString().slice(0, 10),
    itemCount: digest.length,
    items: digest,
    discardedCount: discarded.length,
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n✓ Kept ${digest.length} items, discarded ${discarded.length}`);
  console.log("\n── Curated digest preview ────────────────────────────────────────────────");
  for (const item of digest) {
    console.log(`  [${item.score}/5] [${item.category}] ${item.headline}`);
    console.log(`         ${item.take.slice(0, 100)}…`);
  }
  console.log("──────────────────────────────────────────────────────────────────────────\n");
}

run().catch((err) => {
  console.error("curate fatal:", err);
  process.exit(1);
});
