# Untitled

## Intro to the 12-Factor App & Deployment History

When you write code, you're inevitably making architectural decisions: putting configuration in environment variables, printing logs to the terminal (`stdout`), and keeping your servers stateless. We do these things instinctively today, but they aren't random. They stem from a methodology called the **12-Factor App**.

Written in 2011 by Adam Wiggins, co-founder of **Heroku** (one of the first major cloud platforms), these 12 rules form a contract between your backend application and the platform that runs it. By adhering to this contract, you ensure your app can be deployed, scaled, and managed predictably across *any* modern platform—because today, tools like **Docker, Kubernetes, Render, Railway, Fly, Cloud Run, App Runner, Vercel,** and **Netlify** all implicitly expect your app to follow these rules.

**Scope Limitations:** This methodology is strictly for web apps, APIs, and backend services. It does *not* apply to desktop software or mobile apps. Furthermore, these 12 rules govern the *platform-application interface*, not general programming best practices (so concepts like **DRY** [Don't Repeat Yourself] or **KISS** [Keep It Simple, Stupid] are out of scope).

### The Dark Ages of 2011 & "Snowflake Servers"

To understand why this manifesto was needed, we have to look at how software was deployed before **Platform as a Service (PaaS)** existed. (PaaS is a model where you just hand the platform your code, and it handles building, environments, and networking until it's live on the internet).

In 2011, developers had to:

1. Rent a physical machine or use an on-premise server.
2. Manually install an operating system (like Ubuntu).
3. Manually install the language runtime (Java, Python, Go).
4. Move files using **FTP (File Transfer Protocol)**.
5. Manually edit configuration files live on the server using **SSH**.

This resulted in **Snowflake Servers**—servers that were entirely unique, hand-built, and impossible to exactly reproduce. If a new developer joined the team, getting their laptop to mimic the server took days, birthing the infamous excuse: *"It works on my machine."* Over time, these servers suffered from **Software Erosion**; an app would mysteriously break simply because the underlying OS got a minor patch, or another app on the same server updated a shared library.

### The 2024 Open Source Rewrite

For 13 years, the 12-factor document remained largely frozen (with a minor update in 2017). Meanwhile, the industry evolved with Docker containers, Kubernetes, and Serverless architectures. In November 2024 at KubeCon, Heroku (now owned by Salesforce) announced they were open-sourcing the document. A neutral coalition of maintainers (including engineers from AWS and Google Cloud) are actively rewriting it under a Git branch called `Next`, modernizing the original 2011 principles for today's cloud landscape.

## Factor 1: One Codebase Tracked in Revision Control, Many Deploys

Before version control became the undisputed standard, developers notoriously passed around zipped code repositories with names like `final v2 really final.zip`. Factor 1 legally requires your app to live in a single version-controlled repository (like Git).

A **Deploy** is a single running instance of your application. You might have several deploys—such as a developer's local machine, Staging, and Production.

- **The Rule:** The *codebase* must be identical across all deploys. The only thing allowed to differ is the *configuration*.

If your local machine is on Commit `100` (plus unpushed changes), your internal Staging environment might be testing Commit `99`, while Production is still safely running Commit `97` from last Friday. When deployment day arrives, both Staging and Production simply pull Commit `100`. If you cannot describe your currently running environments entirely by citing a Git commit hash, your architecture is fundamentally flawed.

**What about Monorepos?** Many developers falsely believe monorepos (storing multiple apps in one Git repo) violate Factor 1. They do not. As long as there is a 1-to-1 mapping between a logical app and a sub-directory codebase (acting as its own root), it complies. The true violation is the reverse: maintaining the same application logic in two different repositories by *copy-pasting* code instead of extracting it into a managed library.

## Factor 2: Explicitly Declare and Isolate Dependencies

Your app cannot rely on the implicit existence of system-level packages. You must formally declare *everything* it needs to run.

**1. Declaration (Manifests & Lock Files)** Every modern language has a manifest file:

- NodeJS: `package.json`
- Go: `go.mod`
- Python: `requirements.txt` or `pyproject`
- Ruby: `Gemfile`

But manifests only specify acceptable *ranges* of versions. To guarantee predictability, we use **Lock files** (`package-lock.json`, `go.sum`). Lock files pin the exact version of your dependencies, *and* the dependencies of your dependencies, ensuring that a build run today installs the exact same bytes as a build run three years from now.

**2. Isolation** If you declare your dependencies but don't isolate them, you risk your app grabbing a globally installed library from the host OS instead of the one you specified. Historically, Ruby used `bundle exec` and Python used `virtualenv` to create tight execution bubbles.

To illustrate why isolation is critical, look at **Vendoring Tools**: Imagine your app uses shell commands to resize images via **ImageMagick**.

- On your local Mac, you installed it via Homebrew, which pulls version 7. The execution binary is named `magic`.
- On your production Ubuntu server, you installed it via `apt`, which pulls version 6. The execution binary is named `convert`.

Without strict isolation, your single codebase executes completely different underlying programs with different default behaviors based entirely on the host machine.

> **Why this matters (not stated in the source):** This is why **Docker** is widely considered the ultimate answer to Factor 2. A Docker image freezes not just your code's libraries, but the underlying OS, the system tools (like ImageMagick), and the language runtime into a single, portable block.
> 

## Factor 3: Store Config in the Environment

**Config** is defined as anything that varies between deploys.

- **Local Dev:** You connect to a local Postgres container, a local Redis container, a local Minio instance (for S3 mocking), and a sandbox email API.
- **Production:** You connect to Amazon RDS, ElastiCache, AWS S3, and the real production email API.

**The Open-Source Test:** Could you make your company's proprietary codebase public on GitHub *right now* without leaking a single credential? If the answer is no, your config is illegally mixed into your code.

Historically, frameworks kept config in files checked into Git (e.g., Java's `.properties` files or Ruby's `config/database.yml`). The 12-Factor rule mandates moving these to **Environment Variables**. In a Go backend example (the "Tasker" app), the system reads 38 granular environment variables (like `TASKER_SERVER_PORT`, `TASKER_DATABASE_HOST`) into a single internal `struct`. The environment changes across deploys, but the code interpreting it does not.

**Anti-Pattern:** Grouping configs by named environments (e.g., `config/environment/staging.rb`). This forces you to add more code every time a developer wants a slightly tweaked custom environment for a pull request preview. Configs must be granular and independent.

**The Security Exception (2017 to Present):** While environment variables are perfect for hostnames and ports, they are deeply insecure for passwords and tokens. In 2017, Diogo Monica (former Docker security lead) pointed out that environment variables leak into child processes, debug pages, crash reports, and are readable natively in Linux at `/proc/<pid>/environ`.

> **Why this matters (not stated in the source):** If your app crashes and dumps a stack trace to your logging provider, it often includes the environment variables, meaning you just accidentally broadcasted your production database password to a third-party logging vendor.
> 

The modern solution? Use a dedicated **Secret Manager** (like HashiCorp Vault or AWS Parameter Store). During the app's boot phase, the app fetches sensitive credentials over the network and holds them entirely in volatile memory, rotating them periodically.

## Factor 4: Treat Backing Services as Attached Resources

A **Backing Service** is any service your app communicates with over the network (e.g., Postgres, Redis, RabbitMQ queues, SMTP email providers like Resend, object storage like S3).

Your app's code should make absolutely no distinction between a local Dockerized database you run yourself, and a managed third-party database maintained by a massive corporation. They are all just "Attached Resources."

You attach resources using a **Resource Handle**, which is simply a URL combined with credentials.

| Scheme | User | Password | Host | Port | Database |
| --- | --- | --- | --- | --- | --- |
| `postgres://` | `user:` | `password@` | `host:` | `5432/` | `dbname` |

*(Note: `5432` is the default port for Postgres).*

If you are abiding by Factor 4, swapping out your local Postgres container for a cloud-managed service (like Neon, PlanetScale, Supabase, or Amazon RDS) requires changing *zero* lines of code. You merely update the environment variable containing the Resource Handle.

## Factor 5: Strictly Separate Build and Run Stages

To prevent production environments from diverging from your Git history, you must implement a strict, one-way CI/CD (Continuous Integration / Continuous Deployment) pipeline.

Plaintext

```
[ (1) BUILD STAGE ]
Code (Commit 97) + Dependency Manifest
      ↓ [Compiles/Bundles]
Immutable Executable Build (e.g., Docker Image)

[ (2) RELEASE STAGE ]
Immutable Build + Environment Config
      ↓ [Combines]
Release 100 (Append-only ledger entry)

[ (3) RUN STAGE ]
Release 100
      ↓ [Launches]
Live Process on Platform
```

**Why Immutability Saves You:** Releases act as an append-only ledger with unique IDs (Release 100, Release 101). A release cannot be edited; it can only be replaced by a newer release. Imagine you push code generating **Release 102**. Suddenly, your monitoring dashboard lights up with HTTP `405` errors, and users are screaming in Slack. Because the previous build (Release 101) is immutable, rolling back takes seconds. You immediately revert to Release 101, restoring stability to the users, and then you take your time debugging the broken Release 102 offline.

> **Why this matters (not stated in the source):** In the 2011 era, a dev might SSH into a live server and edit code directly on the file system to fix a bug ("hot patching"). While it fixed the immediate issue, that change was never saved to Git. The next time the server restarted, the patch vanished. Strict Build/Run separation makes hot-patching physically impossible, forcing all changes to travel safely through version control.
> 

## Factor 6: Execute the App as One or More Stateless Processes

A 12-factor app must be totally stateless. This means processes share nothing—no shared memory, no shared local disk state. Any data that must survive the end of the current request must be immediately shipped off to a stateful Backing Service (like Postgres or Redis).

You *can* use memory and the local disk, but strictly as a temporary cache for a single transaction (e.g., temporarily downloading a file to the disk so you can process it before writing the result to the DB and discarding the temp file).

**The Sticky Sessions Anti-Pattern:** If you store user login sessions in your server's RAM, the app will work fine on one instance. But to handle traffic, you put three servers behind a Load Balancer. A user logs in on Server 1. On their next click, the Load Balancer routes them to Server 2, which has empty RAM. The user is instantly and confusingly logged out. Historically, devs "fixed" this with **Sticky Sessions**, configuring the Load Balancer to force a user to hit the exact same server every time. This violates Factor 6, because if Server 1 crashes, every user assigned to it instantly loses their session. The correct fix is putting session state in Redis.

**The WebSockets Exception:** If you are building real-time apps with WebSockets, the active TCP socket *must* live in the process's memory, which technically violates statelessness.

> **Why this matters (not stated in the source):** If User A is connected via WebSocket to Server 1, and User B triggers an action on Server 2 that User A needs to know about, Server 2 has no physical way to talk to User A's socket.
> 

We resolve this by using a Pub/Sub system (Publish/Subscribe). Server 2 publishes the event to Redis, and Server 1 subscribes to Redis, allowing Server 1 to push the event to User A. The thumb rule: If killing a server causes a user to irrevocably lose data, you have state where it doesn't belong.

## Factor 7: Export Services via Port Binding

In 2011, languages didn't typically spin up their own web servers. A PHP app was just a module loaded inside a massive Apache server. A Java app was a file dropped into a Tomcat server folder. This meant the host OS's web server configuration became part of your app's environment, heavily contributing to Software Erosion.

Factor 7 mandates that your app be entirely self-contained. It must boot up its *own* HTTP server library (defined in its dependency manifest) and directly bind to an operating system port to listen for traffic (e.g., a Go backend natively binds to port `8080`, NodeJS apps often use `4000`). In production, you simply place a routing layer (a Reverse Proxy) in front of your app to forward public domain traffic directly to your bound port.

*Modern Exception:* In Serverless architectures (like AWS Lambda), your app technically does not bind to a long-running port. Instead, the cloud platform invokes an exported function on demand. The 2024 rewrite accommodates this by generalizing the rule to "export services via a declared interface."

## Factor 8: Scale Out via the Process Model

Historically, web applications struggled to scale efficiently. A Java JVM booted up, locked down massive amounts of RAM, and multiplexed requests internally via threads. PHP relied on Apache to spin up tiny child processes on demand. The 12-factor model demands that you treat the OS Process as a first-class citizen (borrowing from the UNIX daemon model) and categorize work into different **Process Types**.

Common process types:

- **Web Process:** Handles incoming HTTP requests.
- **Worker Process:** Handles heavy background jobs (video encoding, sending bulk emails) pulled from a queue.
- **Scheduler Process:** Triggers timed events (e.g., cron jobs firing at midnight).

**The Scaling Math:** Imagine a monolithic food delivery app where Web and Worker logic run inside a single massive process. Let's say the Web logic requires `500MB` of RAM and the Worker logic requires `500MB` (total `1GB`).

During the lunchtime rush, HTTP requests skyrocket, but background jobs remain low.

- **Monolithic Approach:** You scale the whole monolith to 10 instances. `10 instances x 1GB = 10GB RAM`. You are wasting huge amounts of memory running 10 idle copies of the Worker logic.
- **12-Factor Approach:** You scale the *Web Process* to 10 instances (`10 x 500MB = 5GB`), and leave the *Worker Process* at 2 instances (`2 x 500MB = 1GB`). You serve the exact same lunchtime traffic using only **6GB of RAM**. When nighttime hits, you scale the Web Process down to 5, and the Worker process up to 20 to handle nightly batch processing.

This process counting is called a **Process Formation**, and today we define this declaratively in orchestrators like Kubernetes using YAML files (e.g., `replicas: 3`).

*Note on threads:* You are completely allowed to use internal threading (like Go-routines or the Node Event Loop) inside a process to handle concurrency. But when you need to physically scale out to new hardware, the unit of scaling must be the process itself. You must never let your app "daemonize" itself (writing a PID file to track its own lifecycle). Process management is strictly the platform's job.

## Factor 9: Maximize Robustness with Fast Startup and Graceful Shutdown

Since cloud platforms dynamically scale instances based on load, processes are treated as entirely disposable. If you deploy an update 5 times a week across 10 servers, the orchestrator is stopping 50 processes and starting 50 new ones. Process death is a standard lifecycle event, not a system failure.

**1. Fast Startup:** If your app takes `60 seconds` to boot, a rolling deployment across 10 instances will take 10 agonizing minutes. Furthermore, if a sudden traffic spike triggers an auto-scaler, the new servers will arrive a full minute too late. If your app boots in `2 seconds`, latency is negligible.

**2. Graceful Shutdown:** When the orchestrator decides to kill a container, it politely sends a `SIGTERM` signal. Your app usually has around 30 seconds to react.

- **Web Processes:** Must stop accepting new incoming requests, finish processing existing "in-flight" HTTP requests, cleanly sever connections to the database pool, and then exit.
- **Worker Processes:** Must return their current job back to the backing queue so it isn't lost.

Returning a job to the queue requires **Re-entrancy**. When the worker aborts the job midway, it must leave no dirty state behind. You achieve this by wrapping database operations in SQL Transactions (so the whole half-finished job rolls back cleanly) or by designing the code to be **Idempotent**.

> **Why this matters (not stated in the source):** An idempotent operation yields the exact same result whether it is executed 1 time or 10,000 times. If a job crashes and is picked up by a second worker, the second worker safely overwrites or ignores the duplicate steps without duplicating data or crashing.
> 

**3. Sudden Death:** Sometimes hardware fails, or a memory leak triggers an **OOM (Out Of Memory)** kill from the OS. In these cases, there is no `SIGTERM` warning; the process is violently terminated mid-instruction. To survive this, applications lean into **Crash-Only Design**—architecting systems so robustly that the emergency crash recovery path is strong enough to act as the standard shutdown path.

## Factor 10: Keep Development, Staging, and Production as Similar as Possible

Known in the industry as **Dev/Prod Parity**, the goal is minimizing the three massive gaps that cause production bugs:

1. **The Time Gap:** A developer writes code today, but it doesn't deploy for a week, bundling it with massive, conflicting changes from other teams. (Fix: Deploy every few hours).
2. **The Personnel Gap:** The developer who wrote the code throws it over the wall to a separate "Operations" team who deploys it, meaning the person reading the error logs lacks context. (Fix: Devs deploy their own code).
3. **The Tools Gap:** Developing on a macOS environment with a lightweight SQLite database, while Production runs Linux with a heavy Postgres cluster.

**The Database Trap:** Developers often use an embedded SQLite database locally because it's fast, while relying on Postgres for production. They mask this discrepancy using an **ORM (Object Relational Mapper)** like Drizzle, Prisma, Gorm, or SQLAlchemy. Because the ORM abstracts the raw SQL, you might feel safe. However, SQLite and Postgres process logic differently. For example, in SQLite, the `LIKE` operator is case-insensitive by default for ASCII characters. In Postgres, `LIKE` is strictly case-sensitive (you must specifically use `ILIKE` for case-insensitivity). Your search bar will work perfectly on your laptop and fail silently in production without generating a single error log. The 12-Factor mandate is strict: use the exact same backing service (Postgres via Docker) locally that you use in production.

*Modern Nuance:* Today, managed cloud services (like AWS DynamoDB) complicate this. Emulators like LocalStack try to mimic DynamoDB locally, but since AWS code is proprietary, the emulation is imperfect. The modern tradeoff: if the operational benefits of a managed cloud service are massive, accepting a slight Dev/Prod parity gap might be worth the risk.

## Factor 11: Treat Logs as Event Streams

Stop thinking of logs as files stored on a server. A log file is merely an output format. A log is actually a continuous stream of events, ordered by time, generated endlessly as long as the app is running.

A 12-factor app should have absolutely zero awareness of routing logs, defining file paths, or setting up file rotation limits. The app has one job: dump unbuffered log strings directly to **Standard Output (`stdout`)**—the exact same terminal window output you see when running an app locally.

The execution platform takes over from there. It captures that `stdout` stream, stamps it with the process ID, and ships it to a log drain (historically Syslog, today tools like Loki or Datadog).

> **Why this matters (not stated in the source):** If you run 50 servers, you do not want to SSH into 50 different machines to read 50 isolated text files to track down an error. By dumping everything to `stdout`, your cloud orchestrator automatically aggregates all 50 streams into one unified, perfectly timestamped, searchable timeline in a central dashboard.
> 

*(Note: While 2011 focused strictly on Logs, modern "Observability" expands this concept to include Metrics and Traces).*

## Factor 12: Run Admin/Management Tasks as One-Off Processes

Sometimes a developer needs to run a one-off task, like migrating the database schema or running a script to fix a corrupted data record.

Historically, developers would SSH into the production server, manually connect to the production database via a REPL (interactive terminal), and execute raw `UPDATE` queries. This bypasses code review, leaves no audit trail, and creates invisible drift between what is in production and what is documented in Git.

Factor 12 requires that admin tasks run as isolated processes against the exact same release (the same code commit, the same config, and the same dependency isolation) as the long-running application.

**Tasker App Example Breakdown:** If you look at the Tasker app architecture in a Linux environment, Heroku invented the `Procfile` to manage this. Utilizing a process manager called `Overmind`, the system boots sequentially:

1. It runs a one-off schema check (Admin process).
2. It boots the background job server (Worker process).
3. The main server binds to the port (Web process).
4. Logs stream to standard output.
5. In a completely separate terminal pane, a one-off auto-archiving script is executed using identical configs.
6. When you send a `Ctrl-C` (interrupt) command, the connection pools politely close, workers pause, and the app cleanly shuts down, proving the architecture is perfectly disposable.