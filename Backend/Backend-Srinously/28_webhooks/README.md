# Untitled

## 1. The Paradigm Shift: Server-to-Server Communication

In traditional web architecture, the client (browser) always initiates the connection to the server. Even in real-time systems (like WebSockets or Server-Sent Events), the client must first open the door.

Webhooks break this premise. They are purely **service-to-service** communication with no browser and no human involved.

**The Stripe Payment Example:** Imagine a taskboard app with a paid plan. A user buys the plan, and the payment is processed by Stripe. How does your backend know the payment succeeded so it can unlock the user's features?

- **Why the browser is the wrong tool:** You cannot rely on the user's browser to tell your backend the payment succeeded. The user's network might drop, they might close the tab, or their PC might crash. Furthermore, **security**: a client-side operation can be easily manipulated by a malicious user to send a fake "payment success" signal to your server.
- *Why this matters (not stated in the source):* Rule #1 of backend engineering is "never trust the client." The signal must come directly from Stripe's servers to your servers.

## 2. The Brute Force Failure: Polling

The intuitive (but wrong) way to get this server-to-server signal is **polling**: your server asks Stripe's API every 1 second, "Is the payment done?"

1. **The Delay:** If you poll every 60 seconds, your average delay in knowing the result is 30 seconds.
2. **Wasted Compute:** Every request that returns "pending" is wasted network bandwidth and CPU time.
3. **The DDoS Effect:** If Stripe has 10,000 merchants polling every second, Stripe's infrastructure receives 10,000 requests per second just for status checks. Stripe will aggressively rate-limit you, forcing your polling interval up (e.g., to 60 seconds), which worsens the delay.

**The Webhook Solution:** Flip the direction. Instead of you calling Stripe's API, you give Stripe a URL. When the payment succeeds, Stripe makes an HTTP POST request to *your* API. This reverse API call is a **Webhook**.

## 3. History and Terminology

In 2007, Jeff Lindsay proposed that web architecture needed something like a **Unix pipe** (where the standard output of one program is pushed directly as the input to another). He called them webhooks: structured, user-defined HTTP POST callbacks. By 2009, Google engineers built a protocol on this idea for RSS feeds called **PubSubHubbub**.

**Core Terminology:**

- **Provider / Sender:** The system where the event happens (e.g., Stripe, GitHub).
- **Consumer / Receiver:** You. The system receiving the signal.
- **Endpoint:** The specific public URL you expose to receive the HTTP POST.
- **Event:** The specific trigger (e.g., `payment.success`, `task.moved`).
- **Delivery:** A single *attempt* by the provider to send the event to your endpoint. (Note: One event can have *multiple*deliveries due to retries).
- **Subscription:** The act of registering your endpoint URL and desired event types with the provider.

## 4. Building a Basic Receiver

The source highlights a basic Go implementation running on a Linux machine.

1. **The Route:** You set up an endpoint, e.g., `POST /hooks/github`.
2. **The Handler (`inbox` package):** Reads the HTTP body.
3. **The Security (`verify` package):** Checks the signature.
4. **The Processing:** Stores the unique Delivery ID.
5. **The Response:** Immediately returns a `202 Accepted` status code.

**The Local Development Problem (Tunnels):** Because webhooks are *inbound* requests, they cannot reach your laptop. Your home router blocks unsolicited internet traffic, and "localhost" means nothing to Stripe.

- **Solution:** You must use a **Tunnel** (like Ngrok or Cloudflare Tunnel). These tools give you a temporary, public HTTPS address that securely forwards incoming internet requests directly to a local port (e.g., `8081`) on your machine.

**Anatomy of a GitHub Webhook Delivery:** When GitHub hits your endpoint, it sends:

- `POST` request.
- Header: `Content-Type: application/json`.
- Header: `X-GitHub-Event` (The type of event).
- Header: `X-GitHub-Delivery` (A unique ID for this specific delivery attempt).
- Header: `X-Hub-Signature-256` (The security hash).
- Body: The JSON payload.

## 5. Rules of Engagement: Status Codes and Timeouts

How does the provider know you successfully received the webhook?

- **Status Codes:** Any HTTP status code in the `200` series (200, 201, 202) is considered a success. Anything else (300 redirects, 400 client errors, 500 server errors) is considered a **failure**, triggering a retry.
- **Timeouts:** Providers will not hold the connection open forever waiting for your database to finish processing. If you don't respond with a 200-series code within a strict window, they drop the connection and mark it as a failure.
    - *GitHub:* 10 seconds.
    - *Shopify:* 5 seconds.
    - *Slack / Microsoft Graph:* 3 seconds.

## 6. Registration and Handshakes

When setting up subscriptions, you provide a URL, a secret string, and a list of events.

**Rule: Isolate Providers by URL** Never use a generic `/hooks/callback`. You must create provider-specific URLs (e.g., `/hooks/github` and `/hooks/stripe`).

- *Why this matters (not stated in the source):* Every provider uses different headers for signatures, different JSON structures, and different retry logic. Routing them to one handler creates a massive, unmaintainable `if/else` block.

**Handshakes:** To prevent attackers from using webhook registrations to DDoS a victim (by registering the victim's URL to receive thousands of AWS events), some providers require a handshake before sending real traffic:

- **Microsoft Graph:** Sends a validation token; you must echo it back in plain text.
- **Discord:** Sends a `ping` JSON message; you must return a `pong` message.
- **Amazon SNS:** Sends a confirmation URL that you must physically visit (via code or browser).

## 7. Security: Authentication and HMAC

**The Threat:** Your endpoint is a public URL. Anyone who guesses it can POST a JSON payload saying "payment successful for User 123," tricking your system into granting premium access. (HTTPS does not stop this; it only encrypts the traffic in transit, it doesn't verify the *sender's identity*).

**5 Ways to Authenticate a Webhook:**

1. **Secret in the URL (Weak):** `?token=abc`. Fails because URLs are logged in cloud providers (CloudWatch, Elasticsearch), leaking the secret.
2. **IP Allowlist:** Only accepting POSTs from GitHub's known IP blocks. Better, but incomplete if an attacker is on the same shared cloud infrastructure.
3. **Mutual TLS (mTLS):** The provider uses a client certificate. Highly secure but complex to set up.
4. **HMAC Signatures (Most Common):** 65% to 80% of providers use this.
5. **Public/Private Key Signatures:** The provider signs with a private key, you verify with a public key (used by Discord).

**Deep Dive: HMAC (Hash-Based Message Authentication Code)** Hashing is a one-way math function. You feed it data, it outputs a fixed-length fingerprint. If you change a single space in the data, the fingerprint completely changes.

1. You and Stripe share a secret string (generated during registration).
2. Stripe takes the JSON body + the secret, runs it through an algorithm (SHA-256), and gets a hash. They put this hash in the header.
3. Your server receives the JSON. You take the JSON + your copy of the secret, run it through SHA-256, and get a hash.
4. If your hash matches their hash in the header, the request **must** have come from Stripe, because no one else has the secret.

**Signature Formats vary by provider:**

- *GitHub:* Signs just the body.
- *Stripe:* Signs the timestamp + `.` + the body (to prevent replays, covered below). E.g., `v1=...hash...`
- *Standard Webhook Spec:* Signs the Delivery ID + `.` + timestamp + `.` + body.
- *Twilio:* Signs the exact URL + sorted form fields using SHA-1.

**The Framework Parsing Gotcha:** If you use NodeJS/Express, middleware like `express.json()` reads the incoming raw bytes and converts them into a JavaScript object. If you then convert that object back into a string to verify the HMAC, your stringifier might add spaces (e.g., `{"name": "john"}`) where the original provider sent none (`{"name":"john"}`).

- *The Result:* The bytes changed, so the hashes will not match.
- *The Fix:* You must read and verify the **raw incoming bytes** *before* allowing the framework to parse it into JSON.

## 8. Security: Replay and Timing Attacks

**Replay Attacks:** If an attacker intercepts a legitimate webhook (including its valid signature header), they can resend that exact same payload to your server 2 hours later. Because the signature matches the payload, your HMAC check will pass.

- *The Fix:* Providers like Stripe include the current timestamp *inside* the string they hash. When you verify, you extract the timestamp. If the timestamp is older than 5 minutes, you reject it, even if the signature is valid.

**Timing Attacks:** When comparing your computed hash against the provider's header hash, do not use standard string equality (`==`). Standard equality checks character by character and stops at the *first mismatch*.

- *The Threat:* An attacker can send a million slightly different hashes and measure the microscopic time differences in your server's response to figure out exactly where the string failed, allowing them to guess the signature byte-by-byte.
- *The Fix:* Use **Constant Time Comparison** functions provided by your language (e.g., `hmac.Equal` in Go, `crypto.timingSafeEqual` in Node, `hmac.compare_digest` in Python). These take the exact same amount of time to compute, regardless of where the mismatch occurs.

## 9. Security: Provider-Side SSRF

What if you are the webhook provider? If a malicious user registers a webhook URL like `http://169.254.169.254` (the AWS Instance Metadata Service), your backend will make a POST request to that internal IP. It might receive your server's internal AWS root credentials and leak them to the attacker. This is **Server-Side Request Forgery (SSRF)**.

**Defenses for Providers:**

1. **Resolve the domain yourself:** Before making the HTTP call, resolve the domain name to an IP address. Check that IP against a fixed list of private, local, or metadata ranges. If it's private, abort.
2. **Never follow redirects:** An attacker can register a public URL, pass your validation, but when you send the POST, their public URL returns a `302 Redirect` pointing to `169.254.169.254`. Standard HTTP clients automatically follow redirects. You must configure your HTTP client to refuse redirects (treat 300-series codes as failures).
3. **Egress Proxies:** Route all outbound webhook traffic through an isolated network proxy (like Stripe's open-source tool, **Smokescreen**) that physically cannot route to internal metadata APIs.

## 10. Reliability: Retries and Idempotency

Because webhooks traverse the open internet, connections drop, load balancers restart, and timeouts happen. If your server processes the webhook, updates the database, and sends a `200 OK`, but that `200 OK` gets lost in the network, the provider assumes you failed.

Providers guarantee **"At Least Once"** delivery. They will retry. This means you *will* receive duplicate events.

**Idempotency (Safe Retries):** Your receiver must be designed so that receiving the same event 100 times results in the database side-effect happening exactly once.

- **The Fix:** Every provider includes a unique Delivery/Event ID (e.g., `X-GitHub-Delivery` or Stripe's `event_id`).
- You create a database table to store processed Webhook IDs with a `UNIQUE` constraint.

**The Transaction Rule:** You must insert the Delivery ID into the database in the **exact same database transaction** as the actual business work.

| Step | Action within a Single SQL Transaction (`BEGIN ... COMMIT`) |
| --- | --- |
| 1 | `INSERT INTO processed_webhooks (delivery_id) VALUES ('123');` (Fails immediately if duplicate) |
| 2 | `UPDATE users SET plan = 'premium' WHERE id = 5;` |
- *Why this matters:* If you do the work first, then store the ID, and the server crashes in between, the retry will cause you to do the work twice. If you store the ID first, then do the work, and the work fails, the retry will see the ID and skip the work, leaving the user without premium. They must succeed or fail together.

## 11. Reliability: The Ordering Problem

In distributed systems, retries ruin chronological order.

- *Scenario:* A user creates an object, then immediately deletes it. Stripe generates Event A (Create) and Event B (Delete). Event A drops and is scheduled for a retry in 5 minutes. Event B succeeds in 1 second. You receive the Delete *before* the Create. If you process blindly, you will create a database record for an object that has already been deleted in Stripe.

**3 Solutions to Ordering:**

1. **Treat as a Signal Only (Best):** Do not trust the payload data. Use the webhook purely as an alarm. When it fires, make an API call back to Stripe to fetch the *current* state of the object, and save that.
2. **Versioning:** Rely on an `updated_at` timestamp on the object payload. Only apply the database update if the incoming payload's timestamp is newer than what you currently have.
3. **Buffering:** Hold events in a queue until earlier sequential events arrive (highly complex and unpredictable). *(Note: Some providers offer strict ordering for a premium fee).*

## 12. Retry Schedules and Bus Traffic

When you fail to reply within the timeout, when do providers retry?

- **Stripe:** Uses exponential backoff for up to 3 days. If still failing, it disables your endpoint and emails you.
- **Svix (Webhook-as-a-service):** Immediately, then 5s, 5m, 30m, 2h, 5h, 10h.
- **GitHub:** **Zero retries.** If your server is down, the webhook is gone. You must manually press "Redeliver" in their UI or write an API script to fetch missed events.

**Bus Traffic / Thundering Herd:** If a marketing tool bills half a million users on the 1st of the month, they will fire half a million webhooks at your server at the exact same time.

## 13. The Thin Receiver Architecture

If your webhook handler does the signature verification, writes to 3 database tables, calls an external API, and *then* returns a 200 OK, it will easily take longer than Shopify's 5-second timeout. Shopify marks it failed and retries. Your server is now doing heavy processing for the original request AND the retries, causing a load spike that takes down your database.

**The Solution:**

1. Handler reads raw bytes.
2. Verifies HMAC signature.
3. Stores the raw payload in a local Database Queue/Table.
4. Immediately returns `202 Accepted`.
5. A completely separate background worker pulls from the queue and processes the heavy database logic asynchronously.

## 14. Building a Sender: The Outbox Pattern

If you are building an app that *provides* webhooks (e.g., users want a webhook when a `task.moved` event happens), how do you safely send them?

**The Naive Approach:** Inside your backend's "Move Task" handler, after updating the DB, you do an `http.Post` to the customer's URL.

- *Failure 1:* If the customer's API is slow, your backend hangs, making your UI slow for your user.
- *Failure 2:* If your DB updates, but the server crashes before the HTTP POST, the event is never sent.
- *Failure 3:* If you HTTP POST first, and the DB update fails, you lied to the customer—telling them a task moved when it actually didn't.

**The Outbox Pattern (Write-Ahead Log):** You use your database as the source of truth for outbound events.

1. Start a database transaction.
2. Update the `tasks` table.
3. Insert the webhook payload intent into a dedicated `outbox` table.
4. Commit the transaction.

Because it's a single transaction, the business logic and the webhook trigger are perfectly synchronized. A separate "Dispatcher" process constantly reads the `outbox` table and makes the actual HTTP network calls asynchronously.

## 15. Sender Infrastructure: The Dispatcher and Retries

Your sender infrastructure requires three tables: `endpoints` (customer URLs and secrets), `outbox` (pending events), and `deliveries` (log of attempts).

**The Dispatcher Workflow:**

1. Pulls a row from the outbox.
2. Signs the payload using the customer's secret (using standard id + timestamp + body formatting).
3. Makes the POST request with a strict **10-second timeout**.
4. Logs the HTTP status and first 2KB of the response into the `deliveries` table.
5. Performs SSRF checks (DNS resolution, blocking internal IPs) *right before* sending, not just at registration, because an attacker could change their DNS records after registering.

**Sender Retries & Logic:**

- **Exponential Backoff + Jitter:** If the delivery fails, delay the next attempt by an increasing amount of time (e.g., 5s, 5m, 15m, 1h). Add **Jitter** (randomized seconds) so that if 1,000 webhooks fail simultaneously, the retries spread out over time rather than hammering the network all at exactly 5 minutes.
- **Retry-After:** Respect the `Retry-After` HTTP header if the consumer provides one.
- **Exhaustion:** After 10 consecutive failures, mark the event "exhausted," completely disable the customer's endpoint, and send them an email.
- **Isolation:** Use **one queue per endpoint**. If Customer A's server is dead and timing out, it shouldn't block the queue delivering webhooks to Customer B.

## 16. The Anti-Pattern: Syncing Data via Webhooks

Webhooks are notifications, not data replication tools.

**The Clerk Auth Example:** Clerk is an Authentication-as-a-Service provider. They hold your user data. Because querying Clerk's API takes 500ms and querying your local DB takes 50ms, developers try to keep a local, synchronized copy of the `users` table in their own DB using Clerk's webhooks (`user.created`, `user.updated`).

**Why this fails:** Because of timeouts, retries, and the ordering problem (receiving an update before a create), your local copy of the user data will inevitably become corrupted and out of sync.

**The Right Way to Sync:** Providers like Clerk offer an `/events` API endpoint, which is a strictly ordered log of everything that happened on their end.

- *Solution 1 (Cron):* If a 5-minute delay is acceptable, run a cron job every 5 minutes that calls the `/events` API, starting from the last Event ID you processed.
- *Solution 2 (Webhook as Signal):* Subscribe to a generic "Event Log Updated" webhook. When your server receives this webhook, it does not trust the payload. Instead, it wakes up a background worker, which reaches out to the `/events` API to fetch the strictly ordered changes since the last processed ID. Your data remains perfectly perfectly synchronized, instantly.