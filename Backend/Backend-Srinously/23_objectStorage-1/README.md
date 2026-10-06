# Untitled

## 1. The Initial Requirement and the Naive Approach

Imagine a working backend with authentication, database connectivity, handlers, and services. A new requirement comes in: users need to upload a profile picture.

If we follow our intuition without thinking about production-grade architecture, we might build it like this:

1. The frontend browser sends the file using **form data**.
2. The backend extracts the file and saves it to the **local file system** (usually a Linux file system like **FS** or **ext4**).
3. We record the exact path where the file is stored into a database row mapped to the user.
4. When the user requests their profile, we read the path from the database, locate the file on disk, and send it back.

For profile pictures (usually 300KB to 10MB, maybe 15MB-20MB if from a high-end mirrorless camera), this might actually seem to work fine because the files easily fit into the server's memory without causing traffic spikes.

But if we expand this requirement to handling video uploads (social feeds or messaging) which can range from a few megabytes to multiple gigabytes, this intuitive pattern completely collapses.

## 2. The Six Problems with Local File Storage in Production

When that user uploads a 4GB video using our naive pattern, it triggers a chain reaction of failures. Let's break down the six reasons why local storage fails at scale.

### Problem 1: Ephemeral Disks and Memory Limits

If your server is provisioned with 4GB of memory, and your web framework helpfully reads a 4GB file entirely into RAM before handing it to your code, your server will instantly run out of memory.

This results in an **OOM (Out of Memory) error**, instantly killing your container.

In modern deployments (like Docker, Kubernetes, or PaaS/Serverless providers like **Railway**, **Render**, **Vercel**, or **Netlify**), containers automatically restart when they crash. However, container file systems are **ephemeral**—meaning they are stateless and temporary.

- **The result:** The moment the container restarts, every single file ever uploaded to that instance is wiped clean.
- **The partial solution:** You *could* attach a **Persistent Volume** to the container (which keeps storage alive across restarts), but that still fails against the next two problems.

### Problem 2: Horizontal Scaling

If you have scaled your backend to three instances sitting behind a Load Balancer, local files break your system's statelessness.

1. User uploads a file. The load balancer's **Round Robin algorithm** (rotating traffic sequentially) routes it to Instance #1. The file is saved to Instance #1's disk.
2. Two minutes later, the user requests the file back. The load balancer routes this new request to Instance #3.
3. Instance #3 has no idea this file exists. It returns a `404 Not Found` error.

*Why this matters (not stated in the source):* True horizontal scalability requires that any server instance can answer any request identically. Holding state (like a file) on one local disk permanently ties that specific user's request to that specific server, destroying load balancing logic.

### Problem 3: Disks are Fixed Size

Adding more servers is horizontal scaling. Adding a bigger disk is a **vertical operation**. If 1,000 users upload 100MB each, your storage grows by 100GB a month forever (because users rarely delete files). To handle this on a local server, you must continually buy larger disks.

- This requires downtime to disable, resize, and reattach the copied disk.
- Cloud providers enforce strict maximum ceilings on single disk sizes.

### Problem 4: Availability vs. Durability

A server disk dying (hardware crash, power failure) is a normal, expected event. If it dies, the only copy of your user's files is gone.

- **Availability:** Can I reach the data *right now*? (If a server goes down, users just have to wait for it to boot back up. The data isn't lost).
- **Durability:** Does the data still exist *somewhere* in the world? (If a disk dies without backups, the data is destroyed permanently. Waiting won't fix it).

The only solution to durability is **replication** (keeping backups elsewhere), implementing checksums, and building background repair processes—a massively complex engineering domain you don't want to build for a simple backend.

### Problem 5: Downloads Tie Up the Backend

Your backend is built to crunch logic, not act as a slow **Content Delivery Network (CDN)**. If a user on a slow mobile connection (2 Megabits per second) requests a 50MB video, that download takes about 3.5 minutes. For 3.5 minutes, one of your **Goroutines** (if using Go) or one of your **NodeJS Event Loop Workers** is sitting idle, slowly dripping bytes across the world.

- **CPU-bound work:** Doing math, processing logic.
- **IO-bound work:** Waiting on network or disk reads. A backend usually maxes out around 100 concurrent connections. Tying them up on IO-bound file transfers will paralyze your API.

### Problem 6: No Transactions Between File System and Database

Your database and your local file system are two entirely separate systems. There is no atomic transaction linking them.

- **Scenario A:** You write the file to disk successfully, but the database insert fails. You now have an **orphan file**eating up disk space that no user can ever access.
- **Scenario B:** You insert the row into the database successfully, but the disk write fails. You now have an invalid path in your database. When requested, your app throws a `500 Internal Server Error` or a `404`.

## 3. The Three Types of Storage Systems

To solve these problems, we need to understand our storage options.

| Storage Type | Characteristics & Features | Trade-offs |
| --- | --- | --- |
| **Block Storage** | Gives a raw array of fixed-size blocks (usually **512 bytes** or **4 KB**). This is what an **SSD** or **Amazon EBS (Elastic Block Storage)** is. | So primitive you can't build normal apps on it. Can only be attached to **exactly one machine** at a time. |
| **File Storage** | An abstraction built on top of blocks. Provides directories, permissions, inodes, and **POSIX semantics** (standard OS operations). | Doesn't scale across network boundaries well. **NFS (Network File Systems)** exist, but coordinating locks globally is painfully slow. |
| **Object Storage** | The absolute minimum interface designed to scale to **Exabyte / Planet-scale**. Just four operations: `PUT`, `GET`, `DELETE`, `LIST`. | Highly constrained. Immutability means no in-place edits (must re-upload the whole thing). Slower latencies (milliseconds, not microseconds). |

### A Deeper Look at File Storage (POSIX Semantics)

File storage gives you standard operations like opening, closing, seeking to byte 5-million, or atomic renaming.

*Real-life analogy:* If you are editing a file in **VS Code**, the moment you type, VS Code writes to a temporary file. When you hit "Save", it moves those changes to a new file, atomically swaps it with the original, and deletes the temp file. This ensures another program never accidentally reads a half-saved, corrupted file. This requires complex OS-level **locking and coordination**.

### The Object Storage Trade-off

Object storage intentionally strips away features to achieve infinite scale.

- No in-place modifications (immutable). If you want to change one byte of a 1GB file, you must download 1GB, change the byte, and upload 1GB.
- No partial reads/writes (no seeking).
- No atomic renames. A rename is actually a full copy of the object to a new name, followed by deleting the old one (which costs you the bandwidth of the entire file size).
- No real directories (more on this below).
- Latency sits in the tens of milliseconds because every operation crosses a network boundary as an **HTTP request**.

**Why use it?** By removing the need for locking, coordinating, and tree-rebalancing, any of the 10,000 servers in an AWS data center can serve any request statelessly. Every object is directly HTTP addressable, meaning any browser or app can talk directly to it without hitting your server first.

## 4. The Anatomy of an Object and the Folder Illusion

An object consists of four parts:

1. **Key:** A string that acts as the complete, entire identity of the object.
2. **Value:** The binary blob of bytes (the actual file).
3. **System Metadata:** Standard info like Size, Last Modified, Content-Type, and **ETag** (an identifier/fingerprint for the specific version of the file).
4. **User Metadata:** Dynamic key-value pairs you can attach (e.g., `uploaded_by: user_123`).

Objects live inside a **Bucket** (a named container). The bucket name must be globally unique across the entire cloud platform (like AWS).

### The Folder Illusion

When you open an AWS or Cloudflare dashboard, you might see a structure like `uploads/2026/cat.png`. It looks exactly like a folder tree. **It is a lie.**

There are no folders. There is no parent-child relationship. There is exactly one object, and its Key string happens to contain forward slash characters (`/`). You could replace the slashes with hyphens or asterisks; it makes no operational difference.

If you use the AWS CLI to run a raw listing, you will see a flat list of giant strings. If you ask the CLI for a prefix with a delimiter (`/`), the server literally chops the strings at the slash, groups the left sides together, and reports it in a field called **CommonPrefixes**. Folders are just a real-time "group-by" algorithm applied to strings.

This is why you cannot natively have an "empty folder" in object storage. (A conceptual workaround exists where tools create a zero-byte object whose key ends in a trailing slash, tricking the algorithm).

## 5. Rules for Designing Object Keys

Because the Key is the entire identity of the object, designing it correctly is critical.

### Rule 1: Never use the user's filename

If a user uploads `resume.pdf`, do not use `resume.pdf` as the key.

- **Collisions:** If User B uploads `resume.pdf`, Object Storage executes a `PUT` operation. A `PUT` strictly means "replace". It will silently destroy User A's file with no warning. (Unlike a `POST`, which creates new entries).
- **Path Traversal:** Filenames can contain dots (`../`) which could accidentally escape your intended prefix.
- **Corruption:** Users can send emojis, right-to-left override characters, or null bytes that can crash your backend parsers.
- **The Fix:** Generate a random UUID for the key. Store the original filename in your database (or User Metadata) and only use it when downloading.

### Rule 2: Put High Entropy (Randomness) at the front

Many developers structure keys chronologically: `date/user/file`. Object storage under the hood partitions its massive indexes based on the key prefix. If you put the date at the front, every file uploaded in the next hour hits the exact same index partition. This creates a **Hot Partition**, causing the system to throw `503 Slow Down` errors under heavy load.

- **The Fix:** Put high entropy at the start. Use `tenantID/userID/UUID` instead.

### Rule 3: Make the key carry ownership

If your key is `tenantID/userID/objectID`, your backend middleware can perform authorization checks with a simple string comparison against the JWT/Session, entirely skipping a database hop.

## 6. Under the Hood: Data Plane vs. Metadata Plane

When a 100MB file hits an AWS stateless front-end node, it authenticates the request and splits the work into two completely different architectural problems.

### The Data Plane (Storing the Bytes)

The naive way to ensure the bytes survive hardware crashes is replication (making 3 copies on 3 different drives in 3 different physical power domains). But at an exabyte scale, a 200% overhead costs billions of dollars.

Instead, cloud providers use **Erasure Coding**. Using a mathematical formula called the **Reed-Solomon algorithm**, the system takes your object and splits it into **14 data shards**. It then computes **6 parity shards**.

- You now have 20 total shards scattered across 20 different drives in different buildings.
- *The Magic:* Because of the algorithm, if you possess *any* 14 of those 20 shards, you can perfectly reconstruct the entire original object.
- *The Trade-off:* It only requires 1.43x storage overhead (instead of 3x), and can survive 6 simultaneous drive failures (instead of 2). You pay for this efficiency with the CPU power required to run the math upon reconstruction.

This math creates AWS's famous **11 9s of Durability (99.999999999%)**. Statistically, if you store 10 million objects, you will lose exactly one due to hardware failure every 10,000 years.

*Warning: Durability is not a Backup.* The system protects against hardware death, not human error. If your code accidentally issues a delete command on the wrong prefix, the system will reliably and permanently delete your data with 11 9s of confidence. To protect against human error, you must enable **Versioning** (overwrites create new versions instead of destroying old ones) or setup cross-account replication.

### The Metadata Plane (The Index)

While storing bytes is easy, maintaining a globally distributed, sorted key-value index mapped to those bytes is incredibly hard. This index is essentially a massive distributed **B-Tree** (Balanced Tree).

Because it's a B-Tree partitioned by ranges, running a `LIST` operation over a bucket is a slow **range scan**.

- **Critical Rule:** Never use the `LIST` method in the critical path of an API request. Your database should be the index of what files exist; the bucket is just the dumb storage layer.

Historically, the metadata plane was **Eventually Consistent**. If you uploaded a file and immediately fetched it, you might get a `404 Not Found` because the read request hit an index replica that hadn't updated yet. Developers used to write messy retry-loops and sleep functions to get around this. Since December 2020, S3 is **Strongly Consistent**—a read immediately following a write is guaranteed to return a `200 OK`.

## 7. Conditional Writes and Distributed Locks

For 20 years, a `PUT` request silently overwrote existing objects. If Client A and Client B saved a file simultaneously, whoever arrived last won, and the loser's data was destroyed without them ever knowing.

In 2024, AWS introduced **Conditional Writes**. This provided two massive new headers:

1. `If-None-Match: *` If you send this, S3 will only create the object if the key does not exist. If it does, S3 rejects it with a `412 Precondition Failed` error. This completely protects against accidental duplicate key bugs.
2. `If-Match: <ETag>` This enables a **Compare and Swap (CAS)** operation.
    - Client A downloads a file and gets `ETag: 123`.
    - Client A edits the file and uploads it with `If-Match: 123`.
    - If Client B modified the file in the background (changing the server's ETag to `456`), Client A's upload is rejected with a `412`. Client B's data is safely preserved.

Because S3 is now strongly consistent and supports Compare and Swap, engineers are now using S3 as a massively scalable **Write Ahead Log (WAL)** for custom distributed databases, replacing traditional file system locks.

*Warning:* Many alternative providers (like Cloudflare R2 or Backblaze B2) advertise being **"S3 Compatible"**. This just means they accept the AWS SDK protocol. However, not all of them support conditional writes (e.g., Backblaze B2 does not), so verify before depending on it.

## 8. Upload Architectures: Through Server vs. Direct

How does the file actually get from a user's laptop to S3?

### Architecture 1: Through the Server

The browser posts the file to your API, your backend receives it, and forwards it to S3.

- **The Problem:** Buffering. Using standard libraries like Go's `parse multipart form` reads the file entirely into RAM. 20 concurrent users uploading 100MB each will spike your server RAM by 2GB instantly, crashing it.
- **The Mitigation:** Streaming. Instead of parsing the form, you use a multi-part reader (like in Go) to grab chunks as they arrive and pipe them directly to the S3 uploader. Memory stays perfectly flat at a few kilobytes. You also wrap the reader in a strict size limit so large payloads are immediately rejected.
- **The True Bottleneck:** Even with streaming, your server is tied up moving bytes. Load balancers have 60-second idle timeouts. Reverse proxies like **Nginx** have body size limits that throw `413 Request Entity Too Large` errors. API Gateways have hard, unchangeable payload caps.

### Architecture 2: Pre-signed URLs (The Production Way)

The solution is to let the browser bypass your backend and send the file directly to the S3 bucket. But since the bucket is (and must be) private, how do we authorize the browser without leaking our AWS credentials?

We use a **Pre-signed URL**. This is a standard S3 endpoint URL wrapped in query parameters detailing an explicit, temporary permission. It includes:

- The Algorithm
- Your Access Key ID
- A Timestamp and an Expiry (e.g., 60 seconds)
- The allowed Headers
- **The Signature (An HMAC)**

*Why this matters (not stated in the source):* An HMAC (Hash-based Message Authentication Code) is generated by taking the URL, Method, Key, and Expiry, and mathematically hashing them using your top-secret AWS Secret Key.

The backend generates this URL and hands it to the browser. The browser sends a `PUT` to it. S3 looks at the URL, takes its own copy of your Secret Key, and re-runs the HMAC math. If the hashes match, the upload is allowed. If a hacker alters even a single character (like changing the filename or extending the expiry), the mathematical hash completely changes, and S3 rejects the request with a `403 Forbidden`.

## 9. Fixing Pre-Signed URL Vulnerabilities with Policies

There is a massive security bug in the standard Pre-signed URL. While it locks down the destination and time limit, **it does not enforce a file size limit**. A user could request a URL for a profile picture, but push a 5GB file to it. S3 would gladly accept it.

The fix is upgrading to a **Pre-signed POST URL with a Policy**. Instead of just signing a URL, your backend signs a small JSON policy document that contains strict conditions, and returns it to the client along with form fields.

Conditions you can enforce at the S3 level:

- `content-length-range`: A hard minimum and maximum (e.g., 1KB to 5MB).
- `content-type`: Must start with `image/`.
- **Key prefix:** Must start with `tenant/user/` so they can't path-traverse.

If the browser violates any of these, S3 directly throws a `400 Entity Too Large` error, saving your backend entirely.

*Frontend Implementation Detail:* When sending this POST, the `file` field must be appended **last** in the FormData object. Furthermore, you must *not* set the `Content-Type` header on your fetch request—you must leave it blank so the browser can automatically calculate and inject the correct multi-part boundaries.

## 10. The Two-Phase Upload Flow and Synchronization

If the browser sends the file directly to S3, your backend never sees it happen. How does the database know the file exists?

We solve this with a **Two-Phase Flow**:

1. **Phase 1 (Intent):** The browser requests an upload. The backend validates permissions, generates a secure random Object Key, and writes a row to the database with the status set to `pending`. It then sends the Pre-signed POST URL and an `Upload ID` (not the actual key) back to the client.
2. **Phase 2 (Completion):** The browser uploads to S3. Upon success, the browser hits a backend "Completion API" with the `Upload ID`.
3. **Verification:** The backend looks up the pending row, gets the Key, and makes a **HEAD Object** request directly to S3. A `HEAD` request costs virtually nothing and returns only metadata. It verifies the file is actually there, is the correct size, and has the correct type. If valid, the database row is flipped from `pending` to `completed`.

### The Cleanup Workflow

Because networks fail and browsers crash, a percentage of uploads will get abandoned mid-flight. Your database will be full of `pending` rows, and your S3 bucket might hold orphaned files.

- You configure a **Lifecycle Rule** on the S3 bucket to automatically delete any object in a `pending` prefix older than 24 hours.
- You run a backend **Background Job** that sweeps the database every night, marking `pending` rows older than 24 hours as `expired`. This guarantees your Database (the truth of intent) and S3 (the truth of actual bytes) never drift out of sync.

### CORS Configuration

Because the browser (running on `yourdomain.com`) is directly contacting S3 (running on `amazonaws.com`), it triggers a Cross-Origin Resource Sharing (CORS) security check. If your upload works in cURL or Postman but fails in the browser, it is a CORS issue. Your bucket must have a CORS policy that explicitly:

1. Allows your frontend site origin.
2. Allows `PUT` and `POST` methods.
3. Exposes the `ETag` header to the browser (which is heavily required for multipart/resumable uploads of large files).