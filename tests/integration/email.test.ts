// Sends through a local stand-in for the SendByte API, so no real email or key is used.
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";

type Seen = { method?: string; url?: string; auth?: string; body: Record<string, unknown> };
const seen: Seen[] = [];
let reply: { status: number; body: unknown } = { status: 200, body: { id: "em_test_1", status: "queued" } };

const server = createServer(async (req: IncomingMessage, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : {} });
  res.writeHead(reply.status, { "content-type": "application/json" });
  res.end(JSON.stringify(reply.body));
});

let sendMail: typeof import("../../src/lib/mail").sendMail;
let mailProvider: typeof import("../../src/lib/mail").mailProvider;
let db: typeof import("../../src/lib/db").db;

before(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  process.env.SENDBYTE_API_KEY = "sk_test_local";
  process.env.SENDBYTE_BASE_URL = `http://localhost:${(server.address() as AddressInfo).port}`;
  process.env.MAIL_FROM = "EMSS Mentorship <hello@example.org>";
  ({ sendMail, mailProvider } = await import("../../src/lib/mail"));
  ({ db } = await import("../../src/lib/db"));
});
after(async () => {
  server.close();
  await db.$disconnect();
});

test("SendByte is chosen when its key is set", () => {
  assert.equal(mailProvider(), "sendbyte");
});

test("a send posts the right request and is marked sent", async () => {
  seen.length = 0;
  reply = { status: 200, body: { id: "em_test_1", status: "queued" } };
  const row = await sendMail({ to: "student@example.edu", subject: "Your sign-in code: 123456", body: "Your code is 123456.", type: "otp", cta: { label: "Open EMSS", href: "https://example.org" } });
  assert.equal(row.status, "SENT");
  assert.equal(seen.length, 1);
  const r = seen[0];
  assert.equal(r.method, "POST");
  assert.equal(r.url, "/v1/emails");
  assert.equal(r.auth, "Bearer sk_test_local");
  assert.equal(r.body.from, "EMSS Mentorship <hello@example.org>");
  assert.equal(r.body.to, "student@example.edu");
  assert.equal(r.body.subject, "Your sign-in code: 123456");
  assert.match(String(r.body.html), /EMSS MENTORSHIP/);
  assert.match(String(r.body.text), /Open EMSS: https:\/\/example\.org/);
  assert.deepEqual(r.body.tags, ["otp"]);
  assert.equal(r.body.idempotency_key, `emp-${row.id}`, "retries of the same email are deduplicated");
});

test("a rejected send is marked failed with SendByte's reason, without retrying", async () => {
  seen.length = 0;
  reply = { status: 422, body: { error: { code: "domain_not_verified", message: "The from domain is not verified." } } };
  const row = await sendMail({ to: "student@example.edu", subject: "Hello", body: "Hi", type: "test" });
  assert.equal(row.status, "FAILED");
  assert.match(row.error ?? "", /domain_not_verified \(422\): The from domain is not verified\./);
  assert.equal(seen.length, 1);
});

test("a temporary outage is retried, then recorded as failed", async () => {
  seen.length = 0;
  reply = { status: 503, body: { error: { code: "unavailable", message: "Try again." } } };
  const row = await sendMail({ to: "student@example.edu", subject: "Hello", body: "Hi", type: "test" });
  assert.equal(row.status, "FAILED");
  assert.equal(seen.length, 3, "the SDK makes three attempts");
  assert.equal(new Set(seen.map((s) => s.body.idempotency_key)).size, 1, "every attempt carries the same idempotency key");
});
