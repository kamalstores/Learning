# Untitled

## 1. Why Single PUT Requests Stop Working

Everything works perfectly when sending a small 300KB image straight from a browser to a bucket. But when dealing with massive objects—like 4.6GB video files, database dumps, CAD files, or raw drone footage—a single `PUT` request breaks down due to four distinct architectural limitations.

### Reason One: The Hard Limit

A single upload request cannot physically exceed **5GB**. This isn't a restriction created by your backend framework, memory size, or HTTP specifications—it is actively enforced and refused by the Object Storage API itself. If you build a platform for videographers or data engineers, you are architecturally forced to abandon the simple `PUT` method.

### Reason Two: All or Nothing

Single streams have no concept of checkpoints. If a user on a mobile connection is uploading a 5GB file and reaches **4.8 GB**, they might experience a micro-drop in connectivity. *Real-life comparison:* Imagine hauling a grand piano up 10 flights of stairs, but if you stumble on step 99, you are teleported back to the lobby.

A consumer mobile connection might take **20 to 30 minutes** to upload a large file (as opposed to a professional 100 or 200 Mbps Wi-Fi network). The moment the Wi-Fi blinks, the power changes from main to backup, or the cell tower hands off, the upload is entirely canceled. There is no resume button. The next attempt starts from zero, making large uploads functionally impossible on spotty networks.

### Reason Three: TCP Throughput and Congestion Windows

Underneath the HTTP request sits a single TCP connection. A single TCP stream is notoriously bad at saturating a high-speed network link. Its maximum throughput is strictly bounded by a mathematical ratio: the **window size divided by the roundtrip time (RTT)**.

Worse, TCP is extremely sensitive to packet loss. If even **one packet** is lost, the entire congestion window collapses, dropping the transmission speed drastically so it can safely "climb back up again."

- **The Result:** You might be paying for a 200 megabit or even a 500 megabit fiber connection, but your single-stream upload stubbornly maxes out at **30 megabits**.
- **Why this matters (not stated in the source):** On wireless mobile networks, minor radio interference causes dropped packets. TCP misinterprets this wireless noise as "network congestion" and heavily throttles the speed.

**The Fix:** The solution isn't physical; it's done at the network level by opening **more connections**. Multiple parallel streams get their own independent congestion windows. If one stream loses a packet and stalls, the other streams continue firing at full speed. This is exactly how tools like **Internet Download Manager (IDM)** or **Free Download Manager**achieve blazing fast speeds. They don't make your physical wire faster; they simply open **eight different connections** for the exact same file and download byte ranges in parallel.

### Reason Four: User Experience

With a single massive request, the progress bar the browser can calculate is very rough and imprecise. Furthermore, the user cannot click a "pause" button, and if they accidentally close the browser tab, the entire transfer is vaporized instantly.

## 2. The Multipart Upload Protocol

To solve the 5GB limit, the resume problem, and the TCP throughput issue, object storage provides the **Multipart Upload** technique. It fundamentally changes the upload from one monolithic stream into exactly three API calls.

1. **Create Multipart Upload:** The backend tells the object storage service the target bucket, the key (filename), and the content type. In return, the service provides an **Upload ID**.
    - **The Staging Area:** This Upload ID acts as a staging area. If you use Git, this is exactly like doing a `git add`before a `git commit`. The file parts will accumulate in this hidden staging space.
    - **404 Not Found:** At this exact moment, nothing actually exists at the target key. If a client attempts a `GET`request to fetch the object, they will receive a **404 Not Found error** because the object isn't finalized.
2. **Upload Part (Once per chunk):** The client sends the Upload ID, a **part number**, and the raw bytes. Because these are completely independent HTTP requests, they have two massive benefits:
    - **Parallelism and Unordered Delivery:** They can be sent simultaneously. Part 7 can arrive at the server before Part 2. There is no ordering constraint.
    - **Granular Retries:** If Part 5 fails due to a network blink, it can be retried individually without affecting any other chunk.
    - **ETag Return:** Every time a part successfully reaches the service, the service returns an **ETag**. You *must* store these ETags because they act as receipts required for the final step.
3. **Complete Multipart Upload:** The client sends one final payload: the Upload ID, along with the complete, ordered list of Part Numbers and their corresponding ETags. The service then combines all the chunks into one single object.

### The Metadata vs. Data Plane Distinction

The surprising magic of the "Complete" call is that it takes the exact same amount of time (a few hundred milliseconds) whether combining a 50MB object or a **50GB object**.

The object storage provider does not physically stitch 50GB of data together on a hard drive. It executes a **metadata operation**. It simply writes down a record stating, "This specific object consists of these 10,000 parts, read in this specific order." It records the *structure*, never touching the underlying data bytes.

- **Why this matters (not stated in the source):** This highlights the separation between the Control/Metadata Plane (which holds lightweight database pointers) and the Data Plane (which holds the heavy bytes). By only updating pointers, finalizing a massive upload is instant and decoupled from disk I/O bottlenecks.

## 3. Optimizing Part Sizes and the 10,000 Part Limit

Multipart uploads have a strictly enforced hard cap: you can only upload a maximum of **10,000 parts**.

If you just lazily rely on a default part size—say, **5 megabytes** per part—you will hit a brick wall. 5MB multiplied by 10,000 parts equals **50GB**. That becomes the absolute largest file your system can accept.

If a user attempts to upload a **60GB file** with 5MB parts, the system will hum along fine until it hits part 10,000. Exactly at part **10,001**, the upload will violently fail. 50GB of bandwidth and time will have been burned for nothing. This is an incredibly expensive engineering mistake.

### The Part Size Formula

The naive fix is to compute a dynamic part size on the fly: `Part Size = File Size / 10,000` However, applying this to a 4MB file results in ridiculously microscopic parts. To balance efficiency, you must use a formula that respects both small and huge files: **Use whichever is larger: Your default baseline OR (File Size / 10,000).**

A production "sweet spot" is using **16MB or 32MB** as a floor. By defaulting to 32MB, your system naturally handles files up to **320GB** without needing to alter the math.

### Why not use huge parts (e.g., 500MB)?

If part sizes dictate the total file size, why not just make every part 500MB? The reason is **retry granularity**. The part size is your smallest atomic retry unit. If a mobile user's connection drops during a 500MB part, they have to re-upload the entire 500MB block. By keeping parts small (between 16MB and **64MB max**), retries remain cheap and virtually unnoticeable to the user.

## 4. The ETag Integrity Bug

When you execute a standard single `PUT` request, S3 naturally computes the **MD5 hash** of the uploaded contents and returns it as the ETag. Developers often use this to write integrity checks: hash the file locally on the client, upload it, check the returned ETag, and if they match, the file is perfectly intact.

The moment you switch to Multipart Uploads, this code silently breaks. The ETag you receive back for a completed multipart object **is NOT the MD5 hash of your file**. Instead, S3 computes the MD5 hash of *each individual part's* binary data, joins those hashes together, hashes that resultant string, and appends a hyphen followed by the number of parts. You will receive bizarre ETags that look like `...-42` at the end.

### How to achieve real integrity:

1. **Checksums:** Modern AWS S3 SDKs allow you to request a full object checksum using algorithms like **CRC32C**or **SHA 256** per part, and the service verifies it natively.
2. **User Metadata:** Compute your own SHA256 hash of the file purely on the client side before uploading. Send that hash as standard HTTP user metadata. Later, run an asynchronous background job to verify the actual file against that metadata string.
    - **Why this matters (not stated in the source):** By storing a confirmed SHA256 hash in the database or metadata, you get **file deduplication for free**. If a user uploads a file with a hash that already exists, you can just map a new database record to the existing S3 object instead of storing it twice.

## 5. The Hidden Cost of Incomplete Uploads

What happens when an upload fails permanently? Assume a user is uploading a large video. They upload **300 parts**, each being **32 MB**. That is roughly **10 GB** of data sitting in the S3 staging area. Then, they close their browser tab. The final Complete API is never called, and the Abort API is never called.

Those 10GB of parts are permanently orphaned. You will be billed for them every single month, forever. The worst part? They are invisible. If you log into the AWS Console, the bucket might claim it only holds one single **184 megabytes object**. If you run an API script to list bucket objects, it returns the same. The `List` operation looks for *objects*, and since the final commit was never made, no object exists.

To find the leak, you must explicitly ask the API a different question using the AWS CLI: `aws s3api list-multipart-uploads --bucket GB --query 'Uploads[{Key, Initiated}]' --output table` Running this might reveal that parts pushed days ago are still sitting there, quietly hoarding **460 MB** of paid space.

**The Fix:** You must apply a **Lifecycle Rule** to every single bucket you create from day one. Configure the rule to: **"Abort incomplete multipart uploads after 7 days."** It costs nothing to turn on and permanently closes a massive financial leak.

## 6. The Production Multipart Upload Architecture

Combining Pre-signed URLs with Multipart uploads is the gold standard for large files on the modern web.

### 1 Initialize via Backend

The browser makes a `POST /uploads/init` request to your backend, passing the file name, the file size, and the content type.

### 2 Authorize and Plan

The backend authenticates the user, authorizes the action, and computes the ideal dynamic part size (the max of the default vs size/10,000).

### 3 Create the Upload

The backend calls `CreateMultipartUpload` against S3. It then inserts a row in your database with a status of `pending`.

### 4 Pre-sign the URLs

The backend generates a Pre-signed `PUT` URL for *each* required part. It responds to the browser with the `Upload ID`, the `part size`, and an array containing all the URLs.

### 5 Parallel Browser Uploads (Direct to Bucket)

The browser begins communicating directly with the S3 bucket. It starts `n` parallel `PUT` requests (usually a concurrency of 4 to 6), sending the raw byte slices directly to the pre-signed URLs without ever touching your backend.

### 6 Complete the Upload

Once all parts succeed and the browser has collected all ETags, it calls a final API on your backend: `POST /upload/complete`, attaching the `Upload ID` and the array of ordered parts + ETags.

### 7 Backend Verification

The backend calls `CompleteMultipartUpload` to S3. To ensure the client didn't spoof the metadata, the backend immediately executes a `HEAD` object call to verify that the final object's size and content-type match what was originally promised.

### 8 Database and Events

The backend flips the database row status from `pending` to `completed`. In a highly decoupled system, it emits a `file.uploaded` event onto a message queue. This queue can handle audit logging or fire a WebSocket message back to the frontend to confirm success.

### Crucial Engineering Notes on this Architecture:

- **Don't Pre-sign Everything at Once:** If a file requires 10,000 parts, do not pre-sign all 10,000 URLs upfront during the `init` call. Your JSON response payload will swell to several megabytes. Pre-sign them in batches (e.g., 100 at a time) and have the browser request the next batch as it works through the queue.
- **The Concurrency Limit:** Opening 4 to 6 parallel requests is the sweet spot. If you push beyond 6, the local streams begin fighting each other for the exact same bandwidth, causing localized congestion and offering zero speed benefit.
- **Browser Memory Profiling:** You never load the full 50GB file into browser memory. JavaScript provides a `file.slice()` method that returns a `Blob`. Blobs are **lazy**—they only load into RAM exactly when requested. The total memory footprint of the browser tab will roughly equal `Part Size × Concurrency` (e.g., 32MB x 5 = 160MB of RAM utilized), saving the tab from crashing.
- **CORS Configuration:** You absolutely must expose the ETag header in your bucket's CORS config (`ExposeHeaders: ["ETag"]`). If you skip this, JavaScript's security model will prevent your frontend code from reading the ETag in the HTTP response, making it impossible to assemble the final payload.

## 7. Implementing Upload Resumes & UI Progress

Because of this architecture, resuming a crashed upload is incredibly easy. If the user refreshes the page or their tab crashes midway through, the client checks the file and asks the backend: *"Do I have an upload in progress for this file?"*The backend checks the database, finds the `pending` row, and issues a `ListParts` call to S3 using the Upload ID. It discovers exactly which parts are successfully sitting in the staging area. The backend then issues a fresh set of pre-signed URLs **only for the missing parts** and hands them back to the browser. The browser seamlessly resumes the transfer from part **341** without re-uploading a single wasted byte.

**The User Interface:** A robust UI represents this process visually as a grid. For a 2GB file using 16MB parts, you have exactly **125 parts** (125 squares in the grid).

- **Gray:** Waiting in queue.
- **Blue (Blinking):** Inflight requests (exactly 5 blinking at any moment).
- **Green:** Completed. Because the UI knows exactly how many parts are finished and the exact size of each part, it computes a highly stable progress bar locally. The progress does not wildly jump or glitch out; it is derived from deterministic math rather than fluctuating network estimates.

## 8. Serving Downloads: Why We Never Proxy

People download files vastly more often than they upload them. The number one rule for serving files from object storage is simple: **Do not relay or proxy downloads through your application backend.**

When your web framework (e.g., Node.js or Go) handler does a `GetObject` call to S3 and then pipes the bytes byte-by-byte to the client, it completely consumes a server worker (a goroutine, a thread, or an event loop tick) for the entire duration of the download. If 1,000 users download a large file on a slow connection, you will exhaust your backend's connection pool entirely.

Worse, you pay for **Bandwidth (Egress)**. Moving data from S3 to your EC2 server, and then from EC2 out to the public internet, doubles your network travel and bills. Furthermore, your server only exists in one or two global regions, making downloads brutally slow for users on the other side of the planet.

Instead, data must flow directly from the bucket (or a CDN) straight to the browser.

## 9. Caching Downloads with CDNs

There are two primary patterns for serving files directly, depending on security requirements.

### Pattern 1: Objectively Public Content

For files that require zero privacy (website CSS bundles, Javascript, public product images), the cheapest and fastest pattern is to make the bucket strictly private and place a **Content Delivery Network (CDN)** in front of it. Only the CDN has permission to read the bucket. You then enforce a massively long Cache-Control header. To handle updates, you use a **Content Addressed Key**. The filename itself is literally the hash of its contents (e.g., `8f3c1a90b2.css`). When the code changes, the hash changes, the URL changes, and the CDN naturally pulls the new file without you ever needing to worry about manual cache invalidation.

### Pattern 2: Pre-Signed GET Requests

For private files (a user's personal tax PDF), you use a Pre-Signed `GET` request. Just like the upload flow, the browser asks the server, the server authorizes the user, and returns a temporary URL valid for **5 to 15 minutes**.

**The Caching Problem:** Pre-signed URLs contain cryptographic signatures and timestamps injected into the query string (`X-Amz-Signature=...`). This means every single time a user requests the exact same file, the URL string is physically different. A CDN treats different URLs as different objects. The Cache Hit Rate drops to **0%**, making the CDN utterly useless while you continue paying full egress bandwidth.

**The Fixes:**

1. **The Cheap Fix:** Change the expiry logic. Instead of signing "valid for 15 minutes from *now*", sign it "valid until the **top of the next hour**." Every user asking for the file at 2:15 PM and 2:45 PM gets the identical URL string. The CDN can finally cache it. You sacrifice exact expiry precision for massive bandwidth savings.
2. **The Proper Fix (Scale):** Relinquish signing to the CDN. Modern CDNs offer their own Signed URLs or **Signed Cookies**. The authorization check moves out of your backend and happens at the **Edge** (the small CDN servers located at every physical network node globally). The CDN authorizes the user and has full control to serve from the cache.

## 10. Range Requests and Byte-Level Fetching

Modern web development heavily relies on an HTTP semantic called **Range Requests**. It allows a browser to say: *"Don't send me the whole 5GB file. Send me `Range: bytes=1000000-3000000` (from 1 million to 3 million or 2 million)."* The server responds with a status code of **206 Partial Content** and a `Content-Range` header detailing the exact byte boundaries. If the request makes no sense, it throws a **416 Range Not Satisfiable** error.

Because Object Storage is built on pure HTTP, it natively supports range requests. This unlocks incredibly powerful behaviors:

- **Video Scrubbing:** If a user drags a video scrubber to the **30 minute** mark, the browser doesn't download the first 30 minutes. It reads the file index (a microsecond call), calculates exactly which byte offset represents 30 minutes, and issues a range request starting precisely at that byte. Playback is instant.
- **Resumable Downloads:** If a download manager drops connection at byte 400 million, its retry mechanism simply issues a new request with `Range: bytes=400000000-`.
- **Parallel Downloads:** A download manager opens 6 different connections to the same URL, giving each connection a distinctly different byte range to fetch, allowing it to bypass TCP single-stream bottlenecks.

**CLI Byte-Level Demo:** You can test this interaction locally using `curl`. Running `curl -r 0-99` requests the first 100 bytes of an object and returns a `206 Partial Content` status. More powerfully, if you ask for just the first **eight bytes**and pipe that binary response to a hex dump tool like **XXT (likely xxd)**, the output instantly reveals a PNG file header. You have successfully identified the file type programmatically across the internet without downloading a single megabyte of the actual image.

Was this visual helpful?

YesNo

## 11. Segmented Video Streaming (HLS/DASH)

Progressive downloads over range headers work well up to a point, but they suffer from one fatal flaw: **there is exactly one version of the file.**

Major platforms like **Netflix, YouTube, Amazon Video, and Hot Star** never serve the exact same file to every user. They use **Adaptive Bitrate Streaming**, detecting the user's live connection speed to seamlessly drop from a pristine **4K** file down to a low-quality mobile file without pausing playback.

To achieve this, the architecture uses **Segmented Streaming** utilizing formats like **HLS (HTTP Live Streaming)** or **DASH**.

1. **Transcoding:** A backend worker takes the massive master file and converts it into several different resolutions and bitrates.
2. **Segmenting:** It chops every single quality tier into tiny files, usually just a few seconds long.
3. **The Manifest:** It creates a Manifest file (the `.m3u8` or `.mpd`), which maps out all the available resolutions and lists the exact URLs for all thousands of segments.

The video player fetches the Manifest first. It begins downloading segments one at a time. Between fetches, the player measures its own download speed. If a high-quality segment took too long to fetch, it dynamically swaps to a lower-quality list of segments for the next request.

**The Crucial Insight:** From the object storage perspective, absolutely nothing changes. The thousands of video segments are just standard objects. The Manifest is just an object. Serving this architecture is entirely solved by simply putting a CDN in front of an S3 bucket. The truly difficult engineering lies in building the backend **transcoding pipeline**—the queues, the background jobs, and the workers that fire upon upload to slice and encode the video. If video is just a minor feature of your app, buy a hosted solution like **Mox (Mux)** or **Bunny Cydian (Bunny CDN)** and let them handle the pipeline. You should only build a custom transcoding pipeline if video streaming is 90% of your core platform.

## 12. The 3 Pillars of Object Storage Pricing

Architectural decisions are heavily driven by the cloud pricing model, which charges you across three distinct vectors:

1. **Storage:** Measured per gigabyte, per month. This is what you keep.
2. **Operations:** Measured per request. It's critical to know that write operations (`PUT`, `DELETE`, etc.) are roughly **10 times more expensive** than read operations (`GET`).
3. **Egress:** The term for data physically leaving your cloud provider's network out to the internet. Every time a user fetches a file, it counts as egress. Egress is notoriously expensive on major clouds, which is why alternative object storage providers like **Cloudflare R2** have become highly famous—they offer absolutely **free egress**, allowing limitless downloads without unpredictable bandwidth bills.