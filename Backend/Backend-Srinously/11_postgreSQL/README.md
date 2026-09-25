# Untitled

## Introduction to Databases and Persistence

At its core, a database is a mechanism to achieve **persistence**—storing data in a way that allows it to survive after the program that created it has been terminated. For example, a to-do list app must retain your checked-off items even after you close and reopen the app. If persistence didn't exist, you would lose your progress and have to recreate your tasks every single time.

The term "database" is surprisingly broad. Any structured storage is technically a database. Your smartphone contact list, a simple `.txt` file where you jot down notes, and browser-based storage mechanisms (like Local Storage, Session Storage, and Cookies) all function as basic databases. Broadly, a database is just a persistent system that offers **CRUD**capabilities: Create, Read, Update, and Delete.

## Storage Mechanisms: RAM vs. Disk

In typical backend developer contexts, when we say "database," we are specifically referring to **disk-based databases**running on servers.

To understand why, you must understand the two tiers of system memory:

1. **Primary Memory (RAM):** Ram is incredibly fast, allowing the CPU to read and write data almost instantly. However, RAM is relatively expensive and scarce. Most consumer laptops have 8GB to 32GB of RAM. In backend systems, RAM is strictly used for application execution and **caching** (tools like Redis), where speed is prioritized over capacity.
2. **Secondary Memory (Disk / Hard Drives / SSDs):** Disk storage is much slower than RAM due to how data is physically laid out and retrieved. However, it is vastly cheaper and larger—a standard computer easily has 512GB to 2TB of disk storage.

Because applications accumulate massive amounts of data (hundreds to thousands of gigabytes), traditional databases (like PostgreSQL or MongoDB) trade the raw speed of RAM for the vast capacity of disk storage.

## What is a DBMS?

Simply dumping data onto a hard drive is not enough. You need to fetch, manipulate, and organize that data efficiently. A **DBMS (Database Management System)** is a software application whose sole responsibility is to handle this interaction efficiently.

A DBMS provides:

1. **Data Organization:** Structuring data so read/write operations are fast.
2. **Access:** Providing a language (like SQL) to perform CRUD operations.
3. **Integrity:** Ensuring data correctness and validity. If a field is meant to store a payment amount, the DBMS will aggressively block any attempts to store random text (like `"abc"`) in that field.
4. **Security:** Managing roles and unauthorized access.

## Why Not Use Text Files?

Before sophisticated DBMS software, developers tried storing backend data in plain text files. This fails at scale for three major reasons:

1. **Parsing Speed and Errors:** To find one user in a text file, your application code (JavaScript, Python) must read the file line-by-line, split strings, and compare values. This is incredibly slow and highly prone to data corruption if the code crashes mid-write.
2. **No Structure (Lack of Integrity):** A text file accepts anything. You cannot easily enforce rules like "this field must only contain numbers" or "this field cannot be empty."
3. **Concurrency Issues:** If two users try to update the same text file simultaneously (e.g., User A adds 20 to a balance of 40, User B subtracts 20), they both read the initial state (40). Whoever saves their version last will blindly overwrite the other person's action. A DBMS has built-in concurrency mechanisms (locks and transactions) to ensure both operations are calculated mathematically accurately in sequence.

## Relational vs. Non-Relational Databases

DBMS software is divided into two primary categories.

### Relational Databases (SQL)

Examples: PostgreSQL, MySQL, SQL Server, SQLite.

- **Structure:** Data is organized into strict Tables, Rows, and Columns.
- **Schema:** You must pre-define the exact schema (column names and exact data types) *before* you can insert any data.
- **Integrity:** Highly rigid. The strictness guarantees data consistency and accuracy over time.
- **Use Case Example (CRM):** A Customer Relationship Management system requires complex linking between customers, orders, and sales opportunities. A relational database excels here because relationships are strictly enforced.

### Non-Relational Databases (NoSQL)

Examples: MongoDB.

- **Structure:** Data is stored in Collections (equivalent to tables) and Documents (equivalent to rows).
- **Schema:** Highly flexible/schema-less. You can insert any JSON-like data structure on the fly. Two documents in the same collection can have completely different fields.
- **Integrity:** Because the database doesn't enforce structure, the responsibility of ensuring data correctness falls entirely on your application code, which is more error-prone.
- **Use Case Example (CMS):** A Content Management System (like a blog backend) might have articles containing just text, or text plus a video embed, or text plus an image gallery. Because the shape of the data is unpredictable, a flexible NoSQL document store allows you to dump varied data without rigid planning.

## Why Choose PostgreSQL?

When choosing a relational database for a modern backend, PostgreSQL is widely considered the industry standard default choice for several reasons:

1. **Open Source:** It is free, not tied to a proprietary vendor, and can be self-hosted.
2. **SQL Compliance:** It adheres very strictly to standard SQL syntax. If you need to migrate to MySQL later, your queries won't require massive rewrites.
3. **Extensibility:** It has a massive ecosystem of extensions (like PostGIS for geographical data).
4. **First-Class JSON Support:** *Why this matters (not stated in the source):* Historically, developers chose MongoDB specifically to store flexible, schema-less data. Postgres implemented native `JSON` and `JSONB` data types that allow you to drop schema-less documents right alongside highly structured relational tables, and even index them for fast querying. This effectively eliminates the need to maintain a separate NoSQL database just for dynamic data.

## PostgreSQL Data Types

Using a GUI client like **TablePlus**, we can define the tables and columns that will hold our data. Here is the SQL syntax for exploring PostgreSQL's available data types.

SQL

```sql
CREATE TABLE data_types_demo (
    -- ID Generation
    id SERIAL,
    -- serial is an auto-incrementing integer. If omitted on insert, it increments to 1, 2, 3...
    -- In production, 'bigserial' is preferred for IDs as it has a much higher maximum limit.

    -- Numbers
    small_number SMALLINT,
    normal_number INTEGER,
    big_number BIGINT,

    -- Decimals & Floating Points
    exact_decimal DECIMAL(10, 2),
    exact_numeric NUMERIC(10, 2),
    fast_float REAL, -- or DOUBLE PRECISION, or FLOAT

    -- Strings
    fixed_string CHAR(10),
    variable_string VARCHAR(255),
    infinite_text TEXT,

    -- Booleans & Time
    is_active BOOLEAN,
    event_date DATE,
    event_time TIME,
    event_timestamp TIMESTAMP,
    event_timestamptz TIMESTAMPTZ, -- Timestamp with time zone
    duration INTERVAL,

    -- Advanced Types
    unique_identifier UUID,
    dynamic_data JSON,
    fast_dynamic_data JSONB
    -- Note: Postgres also supports Arrays, Network Addresses, Mac Addresses, XML, etc.
);
```

### Deep Dive into Data Type Decisions

**Decimal vs. Float:** `DECIMAL(10, 2)` means the number can have a maximum of 10 total digits, 2 of which sit to the right of the decimal point (e.g., `12345678.90`). Decimals store exact mathematical representations. You *must* use `DECIMAL` or `NUMERIC` for financial data (prices) where rounding errors are catastrophic. Floating point numbers (`FLOAT`, `REAL`) are mathematically approximate. *Why this matters (not stated in the source):* Computers represent floating points in binary fractions, which occasionally results in weird values like `0.30000000000000004`. However, floating-point math is processed significantly faster by CPUs. Use floats for non-critical measurements (like physical dimensions or coordinates) where microscopic variations don't matter, but speed does.

**Char vs. Varchar vs. Text:**

- `CHAR(10)`: Forces the string to be exactly 10 characters. If you insert "AB", the database silently pads the string with 8 spaces to force it to fit. Avoid this unless dealing with guaranteed uniform lengths (e.g., 2-letter country codes).
- `VARCHAR(255)`: A variable-length string that caps out at 255 characters. If you insert "AB", it only takes up 2 characters of space. Note: The number `255` is a legacy habit carried over from old MySQL limitations. In Postgres, it holds no specific performance benefit.
- `TEXT`: A variable-length string with no defined upper limit (technically caps out around 1GB). *Recommendation:* In Postgres, the official documentation states there is **zero performance difference** between `VARCHAR` and `TEXT`. Therefore, you should always default to `TEXT`. If you use `VARCHAR(255)` and a user later needs 300 characters, you are forced to run a risky, time-consuming database migration to alter the table structure. By using `TEXT`, you can just validate length constraints safely in your application code.

**JSON vs JSONB:** `JSON` stores the data exactly as inputted (as a raw string). `JSONB` (JSON Binary) takes slightly longer to insert because the DBMS translates the JSON into a custom binary structure. However, `JSONB` is exponentially faster to query and can be indexed. Always choose `JSONB`.

SQL

```sql
-- Inserting data into the demo table
INSERT INTO data_types_demo (
    small_number, exact_decimal, variable_string, is_active,
    event_timestamptz, unique_identifier, fast_dynamic_data
) VALUES (
    42,
    99.99,
    'Hello World',
    true,
    '2025-10-31 10:00:00+00',
    '550e8400-e29b-41d4-a716-446655440000',
    '{"key": "value"}'
);
```

## Database Migrations

You cannot simply open a GUI like TablePlus and execute `CREATE TABLE` commands in a production environment. Doing so leaves no historical record of who changed the database, when they changed it, or what the prior state was.

Instead, changes are handled via **Database Migrations**. A migration is a version-controlled SQL file (e.g., `1_create_users.sql`, `2_add_status.sql`) that lives alongside your backend code. You use a command-line tool (like `dbmate`, `golang-migrate`, or Prisma) that reads these files sequentially and executes them against the database.

The tool automatically creates a hidden tracking table in your database (usually called `schema_migrations`) which stores the version number of the latest executed file. If someone adds a new file, the tool checks this table, realizes it hasn't run the new file yet, and applies it.

Migrations are split into two halves:

1. **Up Migrations:** The code that applies your new changes (creating tables, adding columns).
2. **Down Migrations:** The exact opposite code required to safely undo the "Up" changes (dropping tables, removing columns). This is a vital emergency fallback if an update breaks production and you need to immediately roll back the database to its previous state.

### Setting up `dbmate`

To use the CLI tool `dbmate`, you must point it to your database via an environment file.

Bash

```sql
# In a file named .env at the root of your project
DATABASE_URL="postgres://username:password@localhost:5432/my_database?sslmode=disable"
```

Create the first migration file:

Bash

```sql
dbmate new create_users_table
```

This generates a timestamped file: `db/migrations/20250303100000_create_users_table.sql`.

## Modeling the Database: Up Migrations

In the generated `.sql` file, we will model a complete Project Management backend (users, profiles, projects, and tasks) showcasing different relational configurations.

SQL

```sql
-- migrate:up

-- 1. Create Custom Enum Types
CREATE TYPE project_status AS ENUM ('active', 'completed', 'archived');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');

-- 2. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- 3. User Profiles Table (One-to-One Relationship)
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    image_url TEXT,
    bio TEXT,
    phone TEXT
);

-- 4. Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active' NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- 5. Tasks Table (One-to-Many Relationship)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 1 NOT NULL CHECK (priority >= 1 AND priority <= 5),
    status task_status DEFAULT 'pending' NOT NULL,
    due_date DATE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- 6. Project Members Table (Many-to-Many Linking Table)
CREATE TABLE project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role member_role DEFAULT 'member' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (project_id, user_id)
);
```

### Deep Dive: Modeling Decisions

- **Enums for Data Integrity & Documentation:** We could store status as a simple `TEXT` field and validate it in JavaScript. However, creating a custom `ENUM` in the database guarantees that buggy application code can *never*accidentally insert a typo like "pendng". Furthermore, anyone reading the database schema immediately knows the exact allowed states without having to dig through backend source code.
- **Primary Keys:** Assigning `PRIMARY KEY` to an `id` field implicitly adds two constraints behind the scenes: `NOT NULL`(it cannot be empty) and `UNIQUE` (no two rows can have the same ID).
- **One-to-One (User Profiles):** Why separate the profile from the `users` table? A user's core auth data (email, password) rarely changes. But their profile might scale to include 50 fields (social links, preferences, avatars) that update frequently. Abstracting it into a separate table keeps the core `users` table lean. To link them 1-to-1, we do not create a standard `id` field on `user_profiles`. Instead, we make `user_id` both the Foreign Key referencing the user, AND the Primary Key of the profile row itself.
- **Referential Integrity Constraints (ON DELETE):** This governs what happens when a referenced record is deleted.
    - `ON DELETE RESTRICT` (Projects -> Owner): If an admin tries to delete a user who currently owns a project, the DBMS will block the deletion and throw an error. The user cannot be deleted until ownership is transferred or the project is deleted first.
    - `ON DELETE CASCADE` (Tasks -> Project): If a project is deleted, the DBMS will automatically sweep through the tasks table and permanently delete every task belonging to that project.
    - `ON DELETE SET NULL` (Tasks -> Assigned User): If you delete a user who had tasks assigned to them, the tasks are kept intact, but their `assigned_to` field is wiped blank (`NULL`).
- **Check Constraints:** In the tasks table, `CHECK (priority >= 1 AND priority <= 5)` is a custom rule ensuring no one can pass `99` into the priority integer field.
- **Many-to-Many (Project Members):** A user can join multiple projects. A project has multiple users. This relationship cannot be stored directly on either table. Instead, we create a **Linking Table**. Its Primary Key is a "Composite Key" made by merging the `project_id` and `user_id`. This guarantees a specific user can only be linked to a specific project exactly one time.

## Modeling the Database: Down Migrations

In the same file, below the `-- migrate:down` flag, we write the reversal logic. *Note: Order is critical. Because `tasks`relies on `projects`, you must drop `tasks` before you drop `projects`.*

SQL

```sql
-- migrate:down

DROP TABLE project_members;
DROP TABLE tasks;
DROP TABLE projects;
DROP TABLE user_profiles;
DROP TABLE users;

DROP TYPE member_role;
DROP TYPE task_status;
DROP TYPE project_status;
```

To execute this migration against the database, run:

Bash

```
dbmate up
```

## Executing Migrations & Seeding Data

In development environments, querying empty tables is useless for testing API behavior. You need test data. Pushing test data via SQL scripts is called **Seeding**.

Bash

```
dbmate new seed_data
```

Inside the new migration file (`..._seed_data.sql`), we use CTEs (Common Table Expressions, denoted by the `WITH`keyword). *Why this matters (not stated in the source):* CTEs allow you to execute an `INSERT` statement, return the randomly generated UUIDs, and instantly pass those specific IDs into the very next insert statement. This is crucial for wiring up foreign keys in a single script.

SQL

```sql
-- migrate:up

WITH inserted_users AS (
    INSERT INTO users (email, full_name, password_hash)
    VALUES
        ('alice@example.com', 'Alice Brown', 'hash123'),
        ('bob@example.com', 'Bob Smith', 'hash456')
    RETURNING id, email
),
inserted_profiles AS (
    INSERT INTO user_profiles (user_id, image_url, bio, phone)
    SELECT
        id,
        'https://example.com/avatar.png',
        CASE
            WHEN email = 'alice@example.com' THEN 'Backend Dev'
            ELSE 'Frontend Dev'
        END,
        '555-1234'
    FROM inserted_users
)
-- Additional inserts for projects, tasks, etc., follow this pattern
SELECT 1;

-- migrate:down
-- (Typically leave empty or write DELETE statements for seed files)
```

Run `dbmate up` again to inject the test data.

## API Database Queries: GET All Users

When a client hits `GET /v1/users`, our backend must query the database to retrieve a list of all users, along with their associated profile data.

SQL

```sql
SELECT
    u.*,
    to_jsonb(up.*) AS profile
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY u.created_at DESC;
```

- **Aliases:** `users u` assigns the shorthand letter "u" to the users table, keeping the query readable.
- **LEFT JOIN:** We want all users. We merge them with their profile data where `u.id` matches the profile's `user_id`. We specifically use a `LEFT JOIN` (rather than an `INNER JOIN`) because a user might not have set up their profile yet. A `LEFT JOIN` guarantees the user row is still returned even if the profile match is blank. An `INNER JOIN` would silently drop users who lack a profile row.
- **`to_jsonb()`:** Instead of returning profile data scattered across raw, flat columns, this built-in Postgres function bundles the joined profile row into a neat, nested JSON object under the key `profile`, which perfectly matches how a frontend expects to receive API payloads.
- **Sorting:** Raw SQL returns data in random order based on physical disk location. You must explicitly `ORDER BY u.created_at DESC` to ensure the most recent users appear first.

## Parameterized Queries & SQL Injection

When building an API to get a single user (`GET /v1/users/:user_id`), the backend extracts the requested ID from the URL and injects it into the SQL query.

If you concatenate this dynamically using raw string addition (e.g., `"SELECT * FROM users WHERE id = '" + req.params.id + "'"`), you expose the application to **SQL Injection**. A malicious user could pass `' OR 1=1; DROP TABLE users; --` as the ID. The database would read that raw string as executable logic, and permanently delete your tables.

To prevent this, you must use **Parameterized Queries**. You put an empty slot (a parameter like `:user_id` or `$1`) in your query. You pass the query to the DBMS alongside a completely separate data variable. The database strictly evaluates the variable as a dumb, harmless string. It physically cannot be interpreted as executable logic.

## API Database Queries: GET Single User

In TablePlus, we can simulate parameterized queries using a colon.

SQL

```sql
SELECT
    u.*,
    to_jsonb(up.*) AS profile
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.id = :user_id;
-- The GUI (or backend driver) will prompt you to provide the UUID for this slot securely.
```

## API Database Queries: Dynamic Filtering, Sorting & Pagination

For robust list endpoints, frontends will send query parameters (e.g., `?letter=J&sort_by=email&sort_order=ASC&page=2&limit=10`). Your backend code parses these and conditionally constructs a complex SQL statement.

SQL

```sql
SELECT
    u.*,
    to_jsonb(up.*) AS profile
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id

-- FILTERING
WHERE u.full_name ILIKE :letter || '%'

-- SORTING
ORDER BY :sort_by :sort_order

-- PAGINATION
LIMIT :limit OFFSET :page;
```

- **`ILIKE`:** Performs a case-insensitive pattern match.
- **`|| '%'`:** The parameter (e.g., "J") is concatenated with the `%` wildcard. This tells SQL to return any name starting with J, ignoring whatever comes after it.
- **Pagination (`LIMIT` & `OFFSET`):** `LIMIT` defines the page size (e.g., return 10 items). `OFFSET` defines how many rows to skip before grabbing those 10. *Note:* Backend concepts of "Page 1" usually map to Database `OFFSET 0`, "Page 2" maps to `OFFSET 10`, etc.

## API Database Queries: POST Create User

SQL

```sql
INSERT INTO users (email, full_name, password_hash)
VALUES (:email, :full_name, :password_hash)
RETURNING *;
```

- **`RETURNING *`:** By default, an `INSERT` statement just returns a boolean confirmation. By adding `RETURNING *`, Postgres hands back the entire newly created row (including the auto-generated `id` and `created_at` timestamp). Your API can immediately send this exact data back to the frontend without needing to make a second `SELECT` call.

## API Database Queries: PATCH Update User

A `PATCH` API implies partial updates. The user might submit a form changing just their bio, but leaving their phone number untouched. The backend application logic determines which variables are present in the payload, and dynamically constructs the SQL to only update those specific columns.

SQL

```sql
UPDATE user_profiles
SET
    bio = :bio,
    phone = :phone
WHERE user_id = :user_id
RETURNING *;
```

### The Problem with `updated_at`

If you run the above query, the user's bio will change, but their `updated_at` timestamp column will stubbornly remain locked to the time the user was first created. To maintain an accurate audit trail, that timestamp needs to reflect the exact moment of this update.

You *could* handle this manually in your backend code by explicitly appending `updated_at = :current_time` to every single `UPDATE` query you ever write. However, this is tedious and prone to human error. If a developer forgets it on one endpoint, the data integrity is compromised.

## Database Triggers

A better approach is to let the database handle it automatically using a **Trigger**. A trigger is an automated workflow configured inside the DBMS. You define a condition (e.g., "Anytime someone executes an UPDATE on this table"), and assign an action to fire automatically when that condition is met. We will use a trigger to force the `updated_at` column to become `CURRENT_TIMESTAMP` automatically on every update.

## Database Indexes

In our query examples, we frequently searched for users by ID, filtered by name, joined on foreign keys (`project_id`), or ordered by `created_at`.

If a table has a million rows, and you query `WHERE email = 'bob@example.com'`, the database executes a **Sequential Scan**. It goes to the physical hard disk and blindly reads row 1, then row 2, then row 3... all the way to row 1,000,000, checking every single email string for a match. This is agonizingly slow.

An **Index** is an internal lookup mechanism designed to fix this. It functions exactly like the index at the back of a physical textbook. Instead of flipping through 500 pages to find mentions of "PostgreSQL", you look at the alphabetical index, find the exact page number, and jump straight to it.

When you create an index on the `email` column, the DBMS generates a separate, heavily optimized internal table (usually structured as a B-Tree). This structure holds just two things: the email address, and a direct pointer to the exact physical location of that row on the hard disk. Because the B-Tree is mathematically sorted, the database can find a match in milliseconds, bypass the sequential scan, and jump straight to the data on disk.

- **When to create an index:** As a rule of thumb, you should strongly consider indexing any column that is frequently utilized in a `WHERE` clause, a `JOIN` condition (like foreign keys), or an `ORDER BY` statement.
- **Why not index everything?** *Why this matters (not stated in the source):* Indexes are not free. Every time you `INSERT`, `UPDATE`, or `DELETE` a row, the database must write the data to the main table, and then do extra computational work to update the sorted index B-Tree. If you index every column, your read speeds will be fast, but your write speeds will grind to a halt under the massive overhead.
- **Primary Keys:** The DBMS automatically indexes the `PRIMARY KEY` of every table. You do not need to do this manually.

## Migrations for Indexes & Triggers

To implement these performance and automation upgrades, we run one final migration.

SQL

```sql
-- migrate:up

-- 1. Create Indexes to optimize JOINs and frequent WHERE/ORDER BY clauses
CREATE INDEX ON users (email);
CREATE INDEX ON users (created_at DESC); -- Optimize DESC sorting for default lists
CREATE INDEX ON tasks (project_id); -- Optimize JOIN fetching all tasks for a project
CREATE INDEX ON tasks (assigned_to); -- Optimize JOIN fetching tasks for a user
CREATE INDEX ON tasks (created_at DESC);
CREATE INDEX ON tasks (status); -- Optimize WHERE filtering by status

-- 2. Create the Trigger Function
-- This defines the behavior: set the target row's updated_at field to 'now'
CREATE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the Trigger to our tables
-- Instruct the DBMS to execute the function right before it finalizes any UPDATE
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- migrate:down

DROP TRIGGER set_timestamp ON tasks;
DROP TRIGGER set_timestamp ON projects;
DROP TRIGGER set_timestamp ON user_profiles;
DROP TRIGGER set_timestamp ON users;

DROP FUNCTION trigger_set_timestamp;

-- Note: The syntax for dropping indexes usually requires naming them explicitly
-- Postgres auto-names them table_column_idx (e.g., users_email_idx)
DROP INDEX users_email_idx;
DROP INDEX users_created_at_idx;
DROP INDEX tasks_project_id_idx;
DROP INDEX tasks_assigned_to_idx;
DROP INDEX tasks_created_at_idx;
DROP INDEX tasks_status_idx;
```

Once this migration is run via `dbmate up`, executing the PATCH update query from earlier will successfully alter the bio *and* automatically bump the timestamp to the exact second the query executed.