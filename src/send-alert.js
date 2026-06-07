/**
 * send-alert.js
 *
 * Reads data/email.html and data/latest.json, then sends the email digest
 * via Resend. Requires:
 *   RESEND_API_KEY  — set as a GitHub Actions secret (or .env for local testing)
 *
 * Run standalone:  RESEND_API_KEY=re_... node src/send-alert.js
 */

import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_HTML_PATH = path.join(__dirname, "../data/email.html");
const LATEST_PATH = path.join(__dirname, "../data/latest.json");

async function run() {
  console.log("━━━ Isabella's Alerts — send-alert ━━━");

  if (!process.env.RESEND_API_KEY) {
    console.error(`
ERROR: RESEND_API_KEY is not set.

To run locally, add it to your .env file:

  RESEND_API_KEY=re_...

Get your key at: https://resend.com/api-keys
`);
    process.exit(1);
  }

  const [html, latest] = await Promise.all([
    fs.readFile(EMAIL_HTML_PATH, "utf8"),
    fs.readFile(LATEST_PATH, "utf8").then(JSON.parse),
  ]);

  const { digestDate, itemCount } = latest;
  const formattedDate = new Date(digestDate).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const subject = `Isabella's Alerts — ${formattedDate} (${itemCount} stor${itemCount === 1 ? "y" : "ies"})`;

  const resend = new Resend(process.env.RESEND_API_KEY);

  const recipients = config.email.to
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`  Sending to ${recipients.length} recipient(s): ${recipients.join(", ")}`);
  console.log(`  Subject: ${subject}`);

  const { data, error } = await resend.emails.send({
    from: config.email.from,
    to: recipients,
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }

  console.log(`\n✓ Email sent — Resend ID: ${data?.id ?? "(unknown)"}`);
}

run().catch((err) => {
  console.error("send-alert fatal:", err);
  process.exit(1);
});
