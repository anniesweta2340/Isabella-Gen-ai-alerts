// ─────────────────────────────────────────────────────────────────────────────
// Isabella's Alerts — central configuration
// Edit feeds, thresholds, and delivery settings here; nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {

  // ── Digest timing ───────────────────────────────────────────────────────────
  // How far back (in hours) to look for fresh articles.
  lookbackHours: 24,

  // Cron schedule (GitHub Actions syntax). Default: 8:00 AM ET = 13:00 UTC.
  cronSchedule: "0 13 * * *",

  // ── Curation quality bar ────────────────────────────────────────────────────
  // Items scored below this threshold (1–5) are dropped from the digest.
  relevanceThreshold: 3,

  // Maximum items to include in a single digest after filtering + scoring.
  maxDigestItems: 12,

  // ── Email ───────────────────────────────────────────────────────────────────
  email: {
    from: "Isabella's Alerts <alerts@isabellas-alerts.com>",
    // Comma-separated list of recipient addresses (or a single string).
    to: process.env.ALERT_RECIPIENTS ?? "you@example.com",
    subject: "Isabella's Alerts — your luxury-tech briefing",
  },

  // ── RSS feed sources ────────────────────────────────────────────────────────
  // Each entry: { name, url, category (optional hint for the curator) }
  // Add / remove feeds here; the rest of the pipeline picks them up automatically.
  feeds: [
    {
      name: "Vogue Business — Technology",
      url: "https://www.voguebusiness.com/rss",
      hint: "luxury fashion tech",
    },
    {
      name: "The Business of Fashion",
      url: "https://www.businessoffashion.com/rss/",
      hint: "luxury fashion industry",
    },
    {
      name: "WWD",
      url: "https://wwd.com/feed/",
      hint: "fashion industry news",
    },
    {
      name: "TechCrunch — AI",
      url: "https://techcrunch.com/category/artificial-intelligence/feed/",
      hint: "AI technology",
    },
    {
      name: "The Verge — AI",
      url: "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml",
      hint: "AI technology",
    },
    {
      name: "Anthropic Blog",
      url: "https://www.anthropic.com/rss.xml",
      hint: "AI research and safety",
    },
    {
      name: "OpenAI Blog",
      url: "https://openai.com/blog/rss.xml",
      hint: "AI research",
    },
    {
      name: "Google DeepMind Blog",
      url: "https://deepmind.google/blog/rss.xml",
      hint: "AI research",
    },
  ],

  // ── Anthropic model ─────────────────────────────────────────────────────────
  anthropicModel: "claude-sonnet-4-5",

  // ── Categories Isabella uses ─────────────────────────────────────────────────
  categories: [
    "Maisons & Brands",
    "AI Tooling",
    "Commerce & Retail",
    "Creative & Campaigns",
    "Policy & Risk",
  ],
};
