# Untitled

## Horizontal Scaling & Statelessness

Before diving in, remember the core difference in scaling:

- **Vertical Scaling:** Going to your cloud dashboard and making a single machine bigger (adding more CPU cores and RAM).
- **Horizontal Scaling:** Adding *multiple instances* (distinct machines) running the exact same backend code, distributing the traffic among them.

Horizontal scaling is the industry standard for high traffic, but it requires designing your application from the ground up to have a specific property: **Statelessness**.

> **The Analogy:** Think of a stateful server as a restaurant host who remembers every guest's name purely in their own head. If that host goes on break (server crashes), the new host has no idea who anyone is. A stateless system gives the host a shared clipboard (a centralized database). Now, it doesn't matter which host greets you; they all read from the same clipboard.
> 

**Statelessness** means no single server instance (Instance A, B, C, or D) holds data exclusive to itself. The result of a request must always be identical regardless of which server processes it. If Instance B is deleted, Instances A, C, and D must continue operating with the exact same behavior.

### Examples of Breaking Statelessness (and how to fix them)

1. **Authentication Sessions:**
    - *The Bad Way:* User authenticates with email/password on Instance A. Instance A saves the session ID in a browser cookie and stores the user's session data in an **in-memory array** on its own RAM. On the next request, the load balancer sends the user to Instance B. Instance B checks its own RAM, doesn't find the session, and throws a **401 Unauthorized** error, forcing the user to log in again.
    - *The Fix:* Use a centralized in-memory database like **Redis**. Instance A writes the session to Redis. Instance B reads from Redis. Both servers share the state.
2. **File Storage:**
    - *The Bad Way:* User uploads a profile picture. Instance A saves it to its local **SSD**. The next day, the user requests the image, but the request hits Instance C, which returns a 404 error.
    - *The Fix:* Upload files to centralized object storage. The source specifically names **Amazon S3**, **Cloudflare R2**, or on-premise **MinIO**.
3. **Databases:**
    - *The Bad Way:* Using a local file-based database like standard **SQLite** stored on the server's hard drive.
    - *The Fix:* Use centralized databases like centralized SQLite, **PostgreSQL**, or AWS **RDS** (Relational Database Service).

## Load Balancers (LBs)

If you have multiple horizontally scaled servers, you need a way to decide which server gets which user request. This is the **Load Balancer (LB)**. It sits as a middleman between the internet (user browsers) and your server instances.

```
[User Browsers] ---> (Internet) ---> [ LOAD BALANCER ]
                                          |---> [Server A]
                                          |---> [Server B]
                                          |---> [Server C]
```

### Routing Logic: Load Balancer Algorithms

Load balancers don't just guess; they use algorithms to distribute traffic.

- **Round Robin:** The simplest method. It routes in a strict rotating order: Request 1 goes to Server A, Request 2 to B, 3 to C, 4 to A, and so on.
    - *When it works:* When servers have identical capacity (e.g., all have **4GB RAM, 2 core CPUs**) and requests take similar effort.
    - *When it fails:* When requests have vastly different costs. Imagine Request 1 is a simple DB read (`SELECT * FROM users`) taking **200-300 milliseconds**. Request 2 is a heavy operation making a call to an external service (like Elasticsearch) followed by a DB write.
    - *Why this matters (not stated in the source):* DB writes are expensive because they force the database to re-calculate B-tree indices. A write with index updates plus an external HTTP call might take **2 seconds**. A naive Round Robin might accidentally send four 2-second requests to Server A in a row, causing Server A to crash while Server B sits idle.
- **Weighted Round Robin:** Used when hardware isn't equal. If Server A has **8GB RAM and 4 CPU cores**, while B and C have **4GB RAM and 2 cores**, you assign a weight to A. The LB will send two requests to A for every one request sent to B and C.
- **Least Connections:** A smarter algorithm. It checks which server currently holds the fewest active connections.
    - *How it works:* HTTP (specifically HTTP/1.1 over TCP) holds the connection open while waiting for the server to process. If Server A is stuck on a 2-second heavy request, its connection stays active. The LB sees Server A has 1 active connection, while B and C have 0. The next incoming lightweight request is routed to B or C.
- **Weighted Least Connections:** Combines the intelligence of Least Connections with hardware weights (e.g., Server A gets twice the baseline traffic, but factoring in active connections).
- **Least Response Time:** The LB favors the server that is currently returning responses the fastest, indicating it is under the least load.
- **Resource-Based:** The LB directly monitors the RAM and CPU usage of the servers and routes away from servers approaching maximum utilization.

### Health Checks

What happens if Server A completely crashes? In a naive Round Robin, 1 out of every 3 users will get a **502 Bad Gateway** or **503 Service Unavailable** error.

To solve this, LBs use **Health Checks**.

1. While serving normal user traffic (blue requests), the LB constantly fires automated "test requests" (usually a simple `GET /health` endpoint) to every server, typically **every second**.
2. It expects a **200 series (Success)** HTTP response.
3. If Server A crashes, it fails to return a 200 (returning a 502/503 instead).
4. The LB instantly puts Server A on a **blacklist**. No user requests are sent to Server A.
5. The LB *keeps* sending the test requests to Server A. Once Server A reboots and returns a 200, the LB removes it from the blacklist and resumes normal routing.

## Database Scaling: The Stateful Problem

Scaling your stateless backend code is easy: just add more servers. Scaling your database—which must hold persistent state—is incredibly tricky. You cannot simply clone databases because all clones must remain *consistent* (showing the exact same data at the exact same time).

### Technique 1: Read Replicas

Database traffic is rarely symmetrical. In most standard SaaS architectures, roughly **70% of traffic is Read requests**(`SELECT`), and **30% is Write requests** (`INSERT`, `UPDATE`, `DELETE`).

A **Read Replica** architecture splits the database:

- **Primary (Master) Database:** Handles 100% of the Write traffic.
- **Secondary (Slave / Child) Databases:** Exact copies of the primary that handle the Read traffic.

You can distribute these geographically. You might put the Primary in the US, and Read Replicas in India, China, and Japan. This drops resource utilization on the primary drastically and lowers latency for international users.

#### The Consistency Problem (Replication Lag)

Because the replicas are physically distant, data takes time to copy from the Primary to the Replicas. Even traveling at the speed of light through fiber optic cables, data takes time.

1. A user in India changes their profile name from **"A"** to **"AB"**.
2. The frontend issues a Write request to the Primary DB in the US.
3. The Primary updates to "AB" and sends a 200 OK to the client.
4. The user's Single Page Application (SPA) instantly fires a GET request to fetch the updated profile.
5. This Read request is routed to the Read Replica in India.
6. However, the physical distance between the US and India introduces a **Replication Lag** of roughly **200 milliseconds**.
7. Because the GET request hit the replica *before* the 200ms lag finished syncing the data, the replica returns the outdated name **"A"**. The user is confused.

#### Solutions to Replication Lag

- **Intelligent Routing:** If the backend detects a Write operation on a specific table, it temporarily forces all subsequent Read queries for that user to go directly to the Primary DB, bypassing the replica.
- **Track and Block:** The backend monitors the exact replication lag (e.g., currently 250ms). When a Read query comes in, the backend intentionally blocks the query, waiting until the lag time clears before responding.
- **Frontend Delay:** Artificially delay the frontend SPA from firing the GET request (e.g., set a `setTimeout` for 300ms after a successful save).

### Technique 2: Sharding (Partitioning)

Read replicas solve read-heavy load, but what if you have an e-commerce `orders` table with **billions** of rows?

1. **Query Latency:** Even with database indexes, searching through billions of rows takes too much time.
2. **Hardware Limits:** A single Primary DB instance eventually runs out of hard drive space and CPU capacity to handle writes.

**Sharding** solves this by physically dividing the table across multiple database instances.

> **The Analogy:** Instead of trying to fit an entire encyclopedia into one giant, unliftable book (which takes forever to flip through), you split it into 26 smaller volumes (A, B, C...).
> 
- **The Setup:** Imagine your table has 10 rows (where 1 row represents 1 billion real rows).
- **The Sharding Key:** You must pick a rule to divide the data. For example, the `Date`.
- **The Split:** Instance 1 holds rows 1-5 (Orders from **January to June**). Instance 2 holds rows 6-10 (Orders from **June to December**).
- **The Benefit:** When a user asks for a July order, your backend routing layer knows to only query Instance 2. Instance 2 only has to search through 5 billion rows instead of 10 billion, halving the query latency and distributing the hardware load.

### Managed Distributed Databases (Dec 2025 Context)

The explicit advice for junior developers is: **Do not roll your own database infrastructure.** Managing replication lag, sharding keys, and backups is notoriously difficult. Instead, rely on modern managed distributed databases:

- **PlanetScale:** Built on Vitess, primarily for MySQL.
- **Neon:** A serverless Postgres database written purely in **Rust**.
- **CockroachDB & Yugabyte:** Cloud-native distributed SQL databases.

## Content Delivery Networks (CDNs)

Even if you optimize your database and code perfectly, you are bound by physics.

- The speed of light through fiber optic cables is roughly **200,000 km/second**.
- If a user in Tokyo requests a server in **US East 1 (North Virginia)**, the round trip is **20,000 km**.
- This physical distance mandates a hard minimum latency of **100 milliseconds** just for the data to travel back and forth.

### The Backend Latency Breakdown

When that request actually hits the server in the US, processing takes time:

1. **Routing Layer:** Matching the URL via Regular Expressions (very fast).
2. **Deserialization:** Converting the incoming HTTP JSON payload into a language-specific structure (e.g., a JavaScript Object in Node.js, or a Struct in Go).
3. **Service/DB Layer:** Running business logic and querying the DB (takes **50-100ms**).
4. **External APIs:** Calling third-party services (takes **~200ms**). *Total perceived latency to the Tokyo user:* **500 - 800 milliseconds**.

### How CDNs Solve This

CDNs deploy **Edge Locations** or **POPs (Points of Presence)** in major global regions (Tokyo, Mumbai, Singapore). Instead of traveling 20,000 km, the Tokyo user's request travels 100-200 km to the Tokyo POP. Latency drops from 100ms to **2-3 milliseconds**. Furthermore, by serving cached content from the edge, your primary server in the US receives **50% less traffic**.

### What belongs in a CDN?

1. **Static Content:** JS bundles, CSS, HTML for SPAs (like React builds), fonts, images, and videos. These rarely change.
2. **API Responses:** Things like e-commerce product catalogs.
    - *Cache Invalidation:* You don't have to serve stale data forever. CDN providers like Cloudflare allow you to attach **tags** to cached content. If a user updates their blog, your backend sends a request to Cloudflare to "purge" the specific tag associated with that user's ID, forcing the CDN to fetch fresh data from the origin server.
3. **Security (DDoS Protection):** An attacker might control a botnet of **20,000 bots** via malware to flood your server (a Denial of Service attack).
    - If you rely purely on horizontal autoscaling, your infrastructure will keep spinning up new servers to handle the terabytes/petabytes of fake traffic, potentially costing you **$50,000 in one day**.
    - Putting Cloudflare's CDN in front of your server absorbs this traffic. Cloudflare's network is massive enough to handle petabytes of data without crashing, and it intercepts malicious traffic using Captchas before it ever reaches (or bills) your primary server.

## Edge Computing

CDNs traditionally sat in the infrastructure of **ISPs (Internet Service Providers)**—like Airtel or ACT in India—just serving static files without "thinking." **Edge Computing** introduces actual code execution at these ISP-level edge nodes.

### Edge Use Cases

- **Authentication:** Instead of a user in Tokyo sending an invalid cookie all the way to the US (taking 100ms just to get a 401 Unauthorized rejection), the edge node inspects the JWT/cookie. If it's invalid, the edge returns the 401 in **2-3 milliseconds**. Your primary server is spared the wasted compute.
- **Localization:** The edge node checks the user's browser HTTP headers. If it detects Japanese, it automatically routes the request to the Japanese localized version of your site before hitting the main server.

### Edge Constraints (Why we don't put everything on the Edge)

1. **ISP Hardware limits:** Because edge nodes sit in ISP routing centers, they don't have massive racks of servers. An edge node might only give you **1GB of RAM and 1 CPU core**, compared to massive 16GB data center servers.
2. **Runtime constraints:** Platforms like **Cloudflare Workers** achieve incredible speed using **V8 Isolates** (the JavaScript engine from Google Chrome) rather than booting up full virtual machines.
    - *Why this matters (not stated in the source):* V8 Isolates are highly restrictive sandboxes. You cannot interact with a traditional file system, and you cannot open raw TCP socket connections (which traditional databases require). You are highly limited in what external systems you can talk to.

## Asynchronous Processing

To radically reduce perceived latency for the user, you must decouple heavy tasks from the standard synchronous HTTP request-response cycle.

### The Synchronous Way (Slow)

User updates profile -> Server validates -> Server writes to DB -> Server returns 200 OK.

### The Asynchronous Way (Fast)

Imagine a user invites a teammate to a Jira or Notion workspace by entering `user1@gmail.com`.

- **The naive approach:**
    1. Validate request.
    2. Check if user is in team DB.
    3. Insert user into DB as "Pending" (**~100ms** elapsed).
    4. Make an external HTTP call to an email provider (**Mailchimp, SendGrid, or Resend**). Waiting for their server to send the email takes **~300ms**.
    5. Return 200 OK to frontend. *Total time:* **400ms** staring at a loading spinner.
- **The Queue approach:**
    1. Validate and insert user into DB as "Pending" (**100ms**).
    2. Push a "send email" task to a **Message Queue**.
    3. *Immediately return 200 OK to the frontend.*
    4. In the background, a **Consumer/Worker** pulls the task from the queue and calls Mailchimp. *Total time:* The user sees a success checkmark in **100ms**. The email sends a moment later, which the user expects anyway.

### Other Async Use Cases

- **Video Processing:** When uploading to YouTube, the HTTP request ends once the raw file bytes are uploaded. In the background, async queues trigger tasks to generate thumbnails, encode the video into HD, and generate subtitles. This can take **10 to 20 minutes**, but your browser tab doesn't have to stay open.
- **Account Deletion:** If a user with 10 years of history deletes their to-do app account, the backend might have to delete data from 8 different tables (categories, schedules, profile, foreign keys). If each table takes **5ms** to query, plus business logic overhead, the total operation might take **4 to 8 seconds**. Staring at an 8-second spinner is terrible UX. Instead, authenticate the request, log the user out instantly (return 200 OK), and push a `delete_user_id` job to a queue to slowly wipe the DB in the background.

### Queue Technologies

The standard tools for this are **RabbitMQ**, event streaming platforms like **Kafka**, or managed Redis queues. A highly recommended stack for Node.js is **BullMQ** (which runs on top of Redis Pub/Sub) combined with a managed Redis provider like **Upstash**. BullMQ handles the complexities of retrying failed jobs and rate-limiting.

## Microservices vs. Monoliths

As your company scales, you will inevitably hear about Microservices. But they are a solution to *human* scaling problems, not just machine performance.

**Monolith:** A single deployable unit. One codebase, one GitHub repo. The routing, payments, and notifications logic are all just different folders in the same app, running on the same process. They are incredibly easy to develop, test, and deploy.

### Why adopt Microservices?

You only adopt this when you have **large teams (100 to 200+ developers)**.

1. **Deployment Dependencies:** In a monolith, if the Payments team finishes a critical patch, but the Notifications team committed broken code to the `main` branch, the Payments team is blocked from deploying. Microservices allow independent deployments.
2. **Independent Scaling:** Payments might require massive CPU and RAM resources during a Black Friday sale, while the Notification module requires very little. In a monolith, you must scale the whole massive app. In microservices, you just spin up more Payment containers.
3. **Polyglot Tech Stacks:** Imagine you are building a blog platform (like Medium or Hashnode).
    - Module A handles markdown parsing. The best libraries for this are npm packages in **Node.js** or Python.
    - Module B handles image manipulation/resizing. Node.js is terrible at heavy CPU tasks (taking **~500ms**). A systems language like **Go** or **Rust** can do it in **50ms**.
    - Microservices allow you to build Module A in Node.js and Module B in Rust, deploying them separately to talk to each other.

### The Trade-offs of Microservices

- **The Network:** A simple function call in a monolith (`processPayment()`) becomes an HTTP or **gRPC** network call in microservices. *Why this matters:* Networks fail. You now have to write complex logic to handle timeouts, packet loss, and automatic retries.
- **Debugging:** If a user request touches the Load Balancer -> Routing service -> Order service -> Payment service -> Notification service, and it crashes, where did it fail? You have to look at the logs of four different codebases. You are forced to implement complex **Distributed Tracing** infrastructure.
- **Data Consistency:** Microservices strictly isolate data. The Orders service has its own DB, and Payments has its own DB. Ensuring data consistency across independent databases without traditional foreign keys is an incredibly difficult distributed systems problem.

## Serverless Computing

To understand Serverless, you must understand the pain of traditional servers (Virtual Machines like AWS EC2 running Ubuntu).

When you rent a traditional server, you define exact physical boundaries: **4GB RAM, 2 Core CPU, 30GB Hard Drive, 1TB Network bandwidth**.

### The Capacity Planning Nightmare

- **Underprovisioning:** You configure 4GB RAM. A massive traffic spike hits from a viral blog post. The server crashes, users get errors, and you lose reputation and revenue.
- **Overprovisioning:** You panic and configure **32GB of RAM**. The server handles the traffic perfectly. However, you only used about 20% of the server's capacity (around 8GB). You get a bill for **$5,000** for the week, when a properly sized 8GB server would have only cost **$500**. You burned money.

### Autoscaling and its Limits

You can implement autoscaling (spinning up new servers when CPU crosses **70%**), but:

1. **Time:** It takes time to boot Ubuntu -> fetch code -> run build -> start Node process -> attach to LB. It can take minutes. If traffic spikes in 3 seconds, you still crash.
2. **Limits:** If you set a max cap of 10 instances, you'll still crash on high load. If you set a max cap of 1,000 instances, a DDoS attack or viral spike could result in a **$100,000 bill**.
3. **Reactiveness:** It only scales *after* you are already under load.
4. **Always-on Cost:** Even at 3 AM with zero traffic, you pay for your baseline servers.

### The Serverless Model (Vercel, Netlify, Cloudflare)

In Serverless, you do not manage the OS, the RAM, or the scaling limits. You only provide two things:

1. **Code (Functions)**
2. **Events (Routes / Triggers via an API Gateway)**

When a request hits the API Gateway, the cloud provider instantly provisions a micro-container, runs your code, returns the HTTP response, and immediately destroys (or suspends) the container. **You only pay for the exact milliseconds your code executed.** If you have zero traffic, your bill is $0.

### Serverless Trade-offs

1. **Cold Starts:** The time it takes for the provider to provision that initial machine upon receiving a request.
    - *OS Cold Start:* Booting Linux is slow. AWS Lambda solved this by inventing **Firecracker microVMs** (built on KVM technology) that boot in fractions of a second.
    - *Runtime Cold Start:* Compiled languages like Java have terrible cold starts (loading the JVM). Interpreted languages like JS/Python are better. As mentioned earlier, **Cloudflare Workers** bypass this entirely using **V8 Isolates**, booting in **0-1 milliseconds** (bringing total cold start time to ~5ms).
    - *Workarounds:* Engineers use "automated pings" (cron jobs hitting the endpoint every few minutes) to trick the provider into keeping the container warm.
2. **Execution Limits:** Most Serverless functions (like AWS Lambda) have a hard timeout limit of **15 minutes**. Long-running video renders will fail.
3. **Statelessness:** You cannot hold open WebSockets or persistent TCP database connections, because the server disappears seconds after the HTTP response is sent. You must use serverless-native databases designed for connectionless HTTP polling.

## Core Engineering Principles

As you move to a senior level, adhere to these mental models:

1. **Always Start with a Problem (Measure First)**
    - Never assume where your backend is slow. *Measure it.*
    - Implement **Observability** (Metrics, Logs, and Traces). Use managed tools like **New Relic**, or open-source stacks like **Prometheus and Grafana**.
    - If you implement Redis before proving via metrics that the database is the actual bottleneck, you are doing *Premature Optimization*.
2. **Always Prefer Simple Solutions**
    - Complexity has a tangible operational cost. Every new component is a new failure point.
    - A Monolith is simpler than Microservices.
    - A large vertically scaled machine is simpler than managing a Kubernetes cluster.
    - Proper database Indexing is simpler than setting up and maintaining a Redis caching layer.
3. **Scale for the Problems You Actually Have**
    - Do not architect your day-one startup app to handle Netflix-level traffic (1 million users). You will likely never reach it. Build with a reasonable buffer, monitor your metrics, and fix bottlenecks as they arise.
4. **Implement Observability from Day One**
    - This is the *only* exception to the "keep it simple on day one" rule. Having metrics and traces running from day one prevents blind panic when the first crash inevitably happens.
5. **Scaling is a Mindset**
    - Like security, scaling isn't a checklist you complete once. It is a continuous process of watching systems struggle under new types of load, diagnosing via traces, and iteratively applying solutions.