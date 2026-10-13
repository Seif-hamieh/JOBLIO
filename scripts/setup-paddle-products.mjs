// Creates JOBLIO's products and prices in the Paddle **sandbox** in one go.
//
//   node scripts/setup-paddle-products.mjs
//
// - Reads PADDLE_SETUP_API_KEY (if set) or PADDLE_API_KEY from .env — never printed or written anywhere.
//   The key needs the product:write and price:write permissions. A separate one-off
//   setup key is safer than widening the app key, which only needs transactions.
// - Idempotent: a product with the same name is skipped; so is a price with the same name
//   on that product (so a run that stopped half-way can simply be re-run).
// - Waits 500 ms between API requests (Paddle rate limits).
// - Writes the IDs to paddle-products-output.json and prints the env vars to add.
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

const OUTPUT = new URL("../paddle-products-output.json", import.meta.url);
const DELAY_MS = 500;

const day = (n) => ({ days: n });
const MONTHLY = { interval: "month", frequency: 1 };
const YEARLY = { interval: "year", frequency: 1 };

// amount in cents (USD). billingCycle only for subscriptions.
const CATALOG = [
  {
    code: "FEATURED_JOB",
    name: "Featured Job",
    description: "Feature your job posting at the top of JOBLIO.",
    prices: [
      { env: "PADDLE_PRICE_FEATURED_JOB_7D", name: "Featured Job - 7 days", amount: 300, ...day(7) },
      { env: "PADDLE_PRICE_FEATURED_JOB_14D", name: "Featured Job - 14 days", amount: 500, ...day(14) },
      { env: "PADDLE_PRICE_FEATURED_JOB_30D", name: "Featured Job - 30 days", amount: 800, ...day(30) },
    ],
  },
  {
    code: "URGENT_HIRE",
    name: "Urgent Hire",
    description: "Mark your job as urgent and notify qualified candidates.",
    prices: [
      { env: "PADDLE_PRICE_URGENT_HIRE_7D", name: "Urgent Hire - 7 days", amount: 500, ...day(7) },
      { env: "PADDLE_PRICE_URGENT_HIRE_14D", name: "Urgent Hire - 14 days", amount: 800, ...day(14) },
      { env: "PADDLE_PRICE_URGENT_HIRE_30D", name: "Urgent Hire - 30 days", amount: 1200, ...day(30) },
    ],
  },
  {
    code: "COMPANY_PREMIUM",
    name: "Company Premium",
    description: "Monthly subscription for premium company visibility.",
    prices: [
      { env: "PADDLE_PRICE_COMPANY_PREMIUM_MONTHLY", name: "Company Premium - Monthly", amount: 2500, billingCycle: MONTHLY },
      { env: "PADDLE_PRICE_COMPANY_PREMIUM_YEARLY", name: "Company Premium - Yearly", amount: 25000, billingCycle: YEARLY },
    ],
  },
  {
    code: "PROFILE_BOOST",
    name: "Profile Boost",
    description: "Boost your profile to the top of JOBLIO.",
    prices: [
      { env: "PADDLE_PRICE_PROFILE_BOOST_7D", name: "Profile Boost - 7 days", amount: 200, ...day(7) },
      { env: "PADDLE_PRICE_PROFILE_BOOST_14D", name: "Profile Boost - 14 days", amount: 300, ...day(14) },
      { env: "PADDLE_PRICE_PROFILE_BOOST_30D", name: "Profile Boost - 30 days", amount: 500, ...day(30) },
    ],
  },
  {
    code: "PRIORITY_APPLICATION",
    name: "Priority Application",
    description: "Make your application stand out to recruiters.",
    prices: [
      { env: "PADDLE_PRICE_PRIORITY_APPLICATION_1", name: "Priority Application - 1 pack", amount: 100, credits: 1 },
      { env: "PADDLE_PRICE_PRIORITY_APPLICATION_5", name: "Priority Application - 5 pack", amount: 400, credits: 5 },
      { env: "PADDLE_PRICE_PRIORITY_APPLICATION_10", name: "Priority Application - 10 pack", amount: 700, credits: 10 },
    ],
  },
  {
    code: "JOB_SEEKER_PRO",
    name: "Job Seeker Pro",
    description: "Monthly subscription for premium job seeker tools.",
    prices: [
      { env: "PADDLE_PRICE_JOB_SEEKER_PRO_MONTHLY", name: "Job Seeker Pro - Monthly", amount: 700, billingCycle: MONTHLY },
      { env: "PADDLE_PRICE_JOB_SEEKER_PRO_YEARLY", name: "Job Seeker Pro - Yearly", amount: 7000, billingCycle: YEARLY },
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const usd = (cents) => `$${(cents / 100).toFixed(2)}`;
const cycle = (p) => (p.billingCycle ? ` / ${p.billingCycle.interval}` : " one-time");
/** Paddle errors carry code + detail; never print the request (it has the auth header). */
const describe = (err) => {
  const text = [err?.code, err?.detail ?? err?.message].filter(Boolean).join(": ") || String(err);
  return err?.code === "forbidden" ? `${text} — the API key needs the product:write and price:write permissions (Paddle > Developer tools > Authentication)` : text;
};

async function listAll(collection) {
  const items = [];
  for (;;) {
    items.push(...(await collection.next()));
    if (!collection.hasMore) return items;
    await sleep(DELAY_MS);
  }
}

async function main() {
  const apiKey = process.env.PADDLE_SETUP_API_KEY || process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("Neither PADDLE_SETUP_API_KEY nor PADDLE_API_KEY is set in .env");
  // Explicitly sandbox. A live key would be rejected by the sandbox API anyway — stop early.
  if (apiKey.includes("_live_")) throw new Error("The Paddle API key is a live key; this script only runs against the sandbox");
  const paddle = new Paddle(apiKey, { environment: Environment.sandbox });

  console.log("Paddle sandbox — reading existing products…");
  const existingProducts = await listAll(paddle.products.list({ status: ["active"], perPage: 200 }));
  console.log(`Found ${existingProducts.length} active product(s).\n`);

  const result = { environment: "sandbox", generatedAt: new Date().toISOString(), products: [], env: {} };
  const counts = { productsCreated: 0, productsSkipped: 0, pricesCreated: 0, pricesSkipped: 0, errors: 0 };

  for (const item of CATALOG) {
    let product = existingProducts.find((p) => p.name === item.name);
    let productStatus = "existing";
    try {
      if (product) {
        counts.productsSkipped++;
        console.log(`• ${item.name}  ${product.id}  (exists — skipped)`);
      } else {
        await sleep(DELAY_MS);
        product = await paddle.products.create({ name: item.name, description: item.description, taxCategory: "standard", customData: { joblio: item.code } });
        productStatus = "created";
        counts.productsCreated++;
        console.log(`• ${item.name}  ${product.id}  (created)`);
      }
    } catch (err) {
      counts.errors++;
      console.error(`✗ ${item.name}: ${describe(err)}`);
      result.products.push({ code: item.code, name: item.name, error: describe(err), prices: [] });
      continue;
    }

    let existingPrices = [];
    if (productStatus === "existing") {
      await sleep(DELAY_MS);
      existingPrices = await listAll(paddle.prices.list({ productId: [product.id], status: ["active"], perPage: 200 }));
    }

    const prices = [];
    for (const p of item.prices) {
      const label = `${p.name} — ${usd(p.amount)}${cycle(p)}`;
      try {
        let price = existingPrices.find((x) => x.name === p.name);
        let status = "existing";
        if (price) {
          counts.pricesSkipped++;
        } else {
          await sleep(DELAY_MS);
          price = await paddle.prices.create({
            productId: product.id,
            name: p.name, // shown to buyers at checkout
            description: p.name, // internal
            unitPrice: { amount: String(p.amount), currencyCode: "USD" },
            ...(p.billingCycle && { billingCycle: p.billingCycle }),
            quantity: { minimum: 1, maximum: 1 },
            customData: { joblio: p.env, ...(p.days && { days: p.days }), ...(p.credits && { credits: p.credits }) },
          });
          status = "created";
          counts.pricesCreated++;
        }
        console.log(`    ${status === "created" ? "+" : "="} ${label}  ${price.id}${status === "existing" ? "  (exists — skipped)" : ""}`);
        prices.push({ env: p.env, name: p.name, priceId: price.id, amount: p.amount, currency: "USD", billingCycle: p.billingCycle ?? null, days: p.days ?? null, credits: p.credits ?? null, status });
        result.env[p.env] = price.id;
      } catch (err) {
        counts.errors++;
        console.error(`    ✗ ${label}: ${describe(err)}`);
        prices.push({ env: p.env, name: p.name, error: describe(err) });
      }
    }
    result.products.push({ code: item.code, name: item.name, productId: product.id, status: productStatus, prices });
  }

  result.summary = counts;
  await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);

  console.log("\n──────── Summary ────────");
  console.log(`Products: ${counts.productsCreated} created, ${counts.productsSkipped} skipped (already existed)`);
  console.log(`Prices:   ${counts.pricesCreated} created, ${counts.pricesSkipped} skipped (already existed)`);
  if (counts.errors) console.log(`Errors:   ${counts.errors} (see above; re-run to retry — existing items are skipped)`);
  console.log(`Saved:    paddle-products-output.json\n`);
  console.log("Add to .env and Vercel:");
  for (const [key, id] of Object.entries(result.env)) console.log(`${key}=${id}`);
  if (counts.errors) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`Failed: ${describe(err)}`);
  process.exitCode = 1;
});
