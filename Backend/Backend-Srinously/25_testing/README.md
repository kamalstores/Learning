# Untitled

## The Philosophy and Definition of Testing

In many tutorials, tests are written hastily alongside the core concepts. This source explicitly avoided that for 25 previous sessions because **writing a bad, rushed, or incomplete test is more harmful than having no tests at all.** A bad test suite gives a team a false sense of confidence; you merge broken code assuming the green checkmarks meant it was safe.

So, what exactly is a test? Fundamentally, **a test is a second program that runs your main program and makes claims about what happened.**

### Regressions and CI

The primary, most vital reason we write tests is to catch **regressions**.

- *Real-life comparison:* Imagine healing from a broken leg. You go to the gym a month later to train your upper body, but a poorly planned exercise accidentally re-injures your leg. That's a regression.
- *Technical context:* A regression is a previously fixed bug that comes back to life because new code (added months later) accidentally broke the old, working logic.

In modern workflows, we catch regressions using **Continuous Integration (CI)** (like GitHub Actions). When a developer opens a Pull Request (PR), the CI server automatically runs the entire test suite. If any test fails, the PR is blocked from merging into the main branch. This allows a team to move incredibly fast—you can aggressively refactor or add features, knowing the CI safety net will catch you if you break existing behavior.

*Note on scope:* This guide covers backend engineer testing, which makes up about 80% of testing in a product team. We are intentionally excluding QA testing, browser automation (frontend testing), and mobile testing.

## The Application Under Test: The Task Board

To understand the testing strategies, we need context on the application being tested. The codebase is a real-time Task Board (like Trello/Jira). It is written in Go, but all concepts apply universally (NodeJS, Java, Python).

The backend consists of about 11 files structured neatly:

- `cmd/board`: Contains the executable binary and the `main` file (the entry point that wires everything together).
- `internal/board`: The domain logic (Tasks, Columns).
- `internal/hub`: Manages websocket rooms, subscribers, and user counters.
- `internal/bus`: An interface for the event bus with two methods. Crucially, it has two implementations: one purely in-process memory (used for tests) and one powered by Redis (used in production).
- `internal/store`: The database interface (three methods) backed by PostgreSQL.
- `internal/http/api`: The route table containing all exposed HTTP endpoints and URLs.

Currently, this application has zero tests.

## Test Runners and the Anatomy of a Test

If you had no libraries or tools, you could write a test manually. You would write a normal function in your language that calls a backend function, checks the result with an `if` condition (e.g., `if output != 20`), and throws an exception or returns an error if it doesn't match.

But handwriting these checks and looping through hundreds of them doesn't scale. That is why programming languages and frameworks provide **Test Runners**.

A Test Runner is a program that searches your entire codebase for test files, compiles them, executes them, and outputs a formatted report of passes and failures.

### Behind the Scenes of a Go Test Runner

When you write a test in Go, it might look like this first test: it creates a board, moves a task from the `todo` column to the `done` column, and checks where it ended up. If we intentionally break the expectation (e.g., the code puts it in `doing` but the test expects `done`), the runner prints a helpful error indicating the file, line number, what it *wanted*, and what it *got*.

But what does the tool actually do? If you run the command `go test -work` (which tells Go to keep the temporary build folder instead of deleting it), you can look inside and find a file named `_testmain.go` that **you didn't write**.

If you look inside `_testmain.go`:

1. It lists every test function it found in your package.
2. It generates a `func main()` executable.
3. Inside `main()`, it calls `testing.mainStart` to run the list of tests.
4. It calls `os.Exit` to terminate the program with the correct success/failure code.

If you run `go test -x` (which prints every terminal command the tool executes), you see it compiles a binary called `board.test` and then executes `./board.test`.

*Why this matters (not stated in the source):* Test runners generate this boilerplate so developers only have to focus on writing domain logic tests. Without runners, you would have to manually maintain massive arrays of test functions and write your own execution loops.

### Assertions

The part of the code that does the actual complaining is called an **assertion**. It stops or fails the test if a condition is false.

- In languages like Java or NodeJS, you use library functions like `assertEquals()` or `assertNotEquals()`.
- In Go, there is no separate assert library in the standard package. You write a standard `if` statement and call `t.Errorf()`.

**Critical Rule:** Always write meaningful failure messages. If a test fails at 2:00 AM on a CI server, the developer reading the logs needs to know exactly what broke without having to pull down the code and run a debugger.

## The Testing Pyramid vs. The Scope Mental Model

When you test a feature (like the Task board's "Move" handler), you have choices in how deeply you test it. The source demonstrates testing the exact same `move` logic in four ways:

1. **Mock Bus:** Uses a fake event bus that just records what was published. (0 seconds)
2. **Real Bus & Hub:** Connects to the actual internal websocket hub. (0 seconds)
3. **Real HTTP Server:** Spins up a local port, sends a real POST request, parses the HTTP response. (0 seconds)
4. **Real PostgreSQL Database:** Connects to an actual database container. (**10.5 seconds**)

Notice that testing the entire HTTP stack was still instant (0s), but talking to Postgres took 10.5 seconds. *The time sink is not how much logic you cover, but whether you leave the internal memory of the process.*

### The Traditional Pyramid

Traditionally, the industry defines tests like this:

- **Unit Test (The wide base):** Tests one "unit" of code in isolation. It's cheap, fast, and you should have thousands of them.
- **Integration Test (The middle):** Checks two or more parts working together (like your app + a database).
- **End-to-End / E2E Test (The peak):** Drives the whole system exactly as a user would. It is slow and expensive (in CPU, memory, and time). An E2E test *must* include the full user journey (e.g., logging in to get an auth token before moving a task), whereas an integration test can artificially bypass the authentication middleware.

### The Scope Mental Model (A Better Way)

The problem with the traditional pyramid is that developers argue endlessly about what constitutes a "unit" (Is it a function? A class? A package?).

A more practical, strict mental model categorizes tests by **what they are allowed to touch**:

- **Small Test:** Runs strictly in *one process*. It does not touch the network, does not touch a database, does not touch the file system, and does not use artificial `sleep()` timers. (Because it doesn't touch the internet, it is inherently deterministic and immune to flakiness).
- **Medium Test:** Can talk to different processes on the *same machine* (e.g., a local Docker container running Redis or Postgres). Still no internet access.
- **Large Test:** Can do anything, including talking to external third-party APIs across the internet.

*Other test variations you will hear about (Regression, Functional, Performance, Security) are not separate architectures; they are just specific use-cases built on top of Small, Medium, or Large tests.*

## Dealing with External Dependencies (Test Doubles & Mocks)

If your real backend handler saves to a database, charges a credit card via Stripe, and sends a welcome email via SendGrid, how do you test it without accidentally charging a real card or spamming an inbox?

You use a **Test Double**.

- *Real-life comparison:* In filmmaking, a stunt double steps in to take a dangerous fall so the expensive lead actor doesn't get hurt. To the camera (and the audience), it looks exactly like the real actor.
- *Technical context:* You pass the function something that looks and acts exactly like the external service, but is actually safe, controlled, test-specific code.

While developers colloquially call all of these "mocks", there are actually 5 distinct types of Test Doubles:

1. **Dummy:** A value passed in just because the function signature requires it, but the test never actually uses it. (e.g., Passing an empty Logger object to a service constructor because you don't care about logging in this test).
2. **Stub:** Returns a hardcoded, pre-written answer no matter what you ask it. (e.g., You ask for User ID 7, it gives you a fake User 7 object. You ask for User 99, it still gives you User 7).
3. **Spy:** A stub that also *records* what you did to it. (e.g., It returns User 7, but also records that your test tried to change the name from X to Y, allowing you to assert that the change was attempted).
4. **Mock:** A double configured with strict expectations upfront. (e.g., You configure it to fail the test immediately if the `Save()` method is called more or less than exactly *once*).
5. **Fake:** A fully working implementation that is just unsuitable for production. (e.g., Instead of saving to a Postgres database, a Fake Repository saves users into an in-memory Map. The data persists during the test, you can query it back, but it vanishes when the test ends).

### State vs. Interaction Verification

When you write an assertion, you have two choices:

1. **State Verification:** Ask the system what it looks like *now*. (e.g., "Is the task currently in the 'done' column?")
2. **Interaction (Behavior) Verification:** Ask the Spy/Mock what happened. (e.g., "Was the `publish()` function called exactly once with a 'task' event?")

**The Thumb Rule:** Only use State Verification unless absolutely necessary. Why? Because Interaction tests are **Change Detector Tests**. If a developer optimizes the code to publish one combined event instead of two separate events, the end state of the system remains perfectly correct. But an interaction test will immediately fail because it was hardcoded to look for two function calls. Interaction tests break every time you refactor, making developers hate testing. Only use them for critical side-effects, like ensuring you don't send a user 5 identical emails.

## Architectural Patterns for Testing

### 1. "Do Not Mock What You Do Not Own"

A massive trap developers fall into: Mocking a 3rd party API (like a payment provider). You read the Stripe docs, write a mock that expects a specific payload and returns a JSON object with `{ "data": "success", "new_balance": 100 }`. Your test passes. You deploy. Production crashes.

Why? Because Stripe changed their error format, or your mock misunderstood how they handle duplicate charges. Your mock validated your assumptions, not reality.

**The Solution:**

1. Wrap the 3rd party SDK in your own internal interface (Wrapper). Create your own internal success/failure objects. Mock *your wrapper* in your business logic tests, because you control it.
2. Write a few separate, specialized tests that connect to the provider's actual **Sandbox API**. These tests exist solely to prove that your wrapper translates the 3rd party data correctly.

### 2. Dependency Injection

If a handler creates its own database client inside the function block (`db = new PostgresClient()`), you cannot test it because you can't reach inside the function to replace it with a double.

Instead, use **Dependency Injection**: pass the dependencies as arguments or constructor parameters. The function *receives*the database client, meaning in production you pass the real DB, and in testing, you pass a Fake.

### 3. Functional Core, Imperative Shell

- *Real-life comparison:* A restaurant kitchen. The chefs (Functional Core) stay in the back, receiving ingredients (data) and reliably outputting perfectly cooked meals (results). The waiters (Imperative Shell) handle the messy outside world—taking orders, dealing with angry customers, and carrying the food to the table.
- *Technical context:* Push all calculations, business logic, and pure transformations into the center of your application. These functions should take values and return values without touching the network. Keep the messy database/network calls in a very thin wrapper (the shell) on the outside. Because the core has no external dependencies, it is incredibly easy to test.

## The Database Testing Dilemma

Because databases are slow and stateful, the instinct is to swap the database layer with an in-memory Fake (like NodeJS developers using memory arrays, Go developers using repository fakes, or Java developers using H2).

- **The Gain:** Massive speed, easy maintenance, full CPU utilization.
- **The Loss:** Fidelity (Accuracy).

The bugs that occur in data layers are usually things like missing indexes, unique constraint violations, failing transactions, or native database features (like Postgres JSON operators). A fake in-memory map will happily let you insert two identical emails, while Postgres will crash. By faking the database, you are bypassing the exact layer where the bugs live.

**The Solution:** Use a real database, but make it cheap and developer-friendly.

1. **Transaction Per Test:** Start a database transaction at the beginning of the test, run your code, and instead of committing, issue a `ROLLBACK` at the end. The DB remains perfectly clean for the next test. (Requires Dependency Injection so you can pass the transaction handle).
2. **Template Databases:** Postgres allows you to execute `CREATE DATABASE test_1 TEMPLATE main_db`. It copies a fully migrated database schema in milliseconds. Each test gets its own isolated database, meaning they can run simultaneously in parallel.
3. **Testcontainers:** A massively popular library (available in Go, Node, Java, etc.) that spins up a real Docker container from *inside* your test code.
    - *The Math:* In the video demo, spinning up a real Postgres v18 container via Testcontainers takes **7 seconds** (it boots at 58s, ready at 05s). But it only does this *once* for the whole test suite. It then runs 9 database tests in parallel using the template strategy, which takes only **3 seconds**. Total time: 10.5 seconds for total fidelity.

## Handling Network, Time, and Environments

### Network

When you want to test how your code actually forms HTTP requests (checking headers, query params), faking the internal function isn't enough.

- In Go, use the `httptest` library. It actually spins up a real HTTP server on a local TCP port that your client can hit.
- In NodeJS, tools like `MSW` (Mock Service Worker) intercept the request at the network layer itself.

### Time

*The Flaky Sleep Problem:* A background process takes time, so a junior developer writes `sleep(100ms)` in the test before checking the result. It passes locally. In CI, under heavy load, the machine is slow, the process takes 110ms, and the test fails. This is a false negative.

- **Solution 1 (Signals):** Never wait for a duration. Wait for a condition. Use Go Channels or NodeJS Callbacks to listen for an event that screams "I am done!" and assert immediately upon hearing it.
- **Solution 2 (Clock Injection):** Pass the clock as a dependency. When your test runs, you pass a fake clock. Your test can instantly "fast-forward" the application time by 2 hours without actually waiting.

### Hermetic Testing

All of the above (Testcontainers, HTTP servers, Clock injection) drive toward one goal: **Hermetic Testing**. Hermetic means *sealed*. A hermetic test brings its own environment. It does not rely on a database you started manually in another terminal. It boots everything it needs, runs, and destroys everything when finished. This ensures the test runs flawlessly on your laptop, your coworker's laptop, and the CI server.

## Test-Driven Development (TDD) Deep Dive

Test-Driven Development is not a *type* of test; it is a *workflow*. You write the test before you write the application logic.

The workflow consists of three cyclical phases:

1. **Red:** Write a test for a feature that doesn't exist. Run it. Watch it fail.
    - *Value:* This is a **Design** step. It forces you to imagine what the function's API looks like from the perspective of the *caller* (the user of the function). If it feels awkward to write the test, your API design is bad.
2. **Green:** Write the ugliest, fastest code possible to make the test pass.
    - *Value:* This is a **Proof** step. If you write code first and tests second, tests often pass on the first try, leaving you unsure if the test is actually checking anything or just acting as a rubber stamp. Going from Red to Green proves the test works.
3. **Refactor:** Now that you have a green safety net, clean up the ugly code, apply best practices, and run the test again. If it stays green, you're done. *Never skip this step.*

### A Practical TDD Example

**Requirement:** A task cannot be moved straight from `todo` to `done`. It must go to `doing` first. We have no code for this.

1. **Red:** We write a test that takes a `todo` task and moves it to `done`. We assert that it should return an error. We run it. It fails. (It returned `nil` because there is no blocking logic yet).
2. **Green:** We go into the `move()` method and slap a crude `if` statement right in the middle. We run the test. It passes (Green).
3. **Refactor:** The `move()` method is now messy (it's locking mutexes and doing business logic). We extract the `if`statement into a clean, isolated function called `canMove(from, to)`. We re-run the package. It is still green. We have successfully completed the TDD loop.

### The Discourse on TDD

TDD is highly controversial.

- **Kent Beck** created TDD.
- **Ian Cooper** argues (in his famous talk *TDD, Where Did It All Go Wrong?*) that people misunderstood "Unit test" to mean "Test every Class." They mocked everything, so every time a class changed, hundreds of tests broke. Cooper argues a "Unit" is a *behavior* (the public interface).
- **DHH** (Creator of Ruby on Rails) wrote a famous article titled *"TDD is dead. Long live testing."* He argued against designing systems purely for mockability and test-first culture.

**When should you use TDD?** Use it when you know exactly what the input and output should be, but the calculation is tricky (e.g., writing a JSON parser, calculating complex pricing rules, state machines). **When should you NOT use TDD?** Do not use it when you are exploring. If you are doing system design, trying out trade-offs, and figuring out what "feels right," TDD will slow you down and frustrate you.

## Flaky Tests: The Silent Killer

A flaky test is a test that sometimes passes and sometimes fails on the exact same code.

**Why they are worse than missing tests:** If a test is missing, you know there is a hole in your safety net. If a test is flaky, developers learn to ignore it. When CI fails, a developer says "Oh, that's just a flaky test, hit re-run." When it passes, they merge. Eventually, a real bug fails a test, developers hit re-run, and you ship broken code to production.

A 2014 study by Luo et al. analyzed 201 flaky test fixes in open-source projects. They found three main causes:

1. **Async Await (Sleeps):** Tests waiting for fixed times. (Fix: Wait for signals/conditions).
2. **Concurrency:** Race conditions inside the test. (Fix: Use sync testing primitives).
3. **Test Order Dependency:** Test B only passes if Test A runs first, because Test A left a lingering database row or global variable. If tests run in parallel or a new test is inserted between them, Test B suddenly fails.

**How to fix Test Order Dependency:**

1. *Delete it:* If the test is low value, just remove it.
2. *Quarantine it:* Move it out of the blocking CI suite into a separate "quarantine" suite. Tag it with the developer's name, the date, and a written reason why it is currently flaky. This documents the tech debt without blocking the team.
3. *Add a retry:* (This is a terrible practice. Do not do this).

## Measuring Test Quality: Code Coverage

Code Coverage is a metric showing the percentage of your code executed during a test suite.

**How the tool works:** Before building, the compiler rewrites your code. It breaks functions into "basic blocks" (sections of code with no branches) and puts a counter at the top of each block. It runs the tests, and if a counter is `> 0`, that block is "covered."

**Types of coverage:**

- *Line Coverage:* Did this line run?
- *Branch Coverage:* Did we take every path of a decision? (If an `if` statement evaluates to `true`, line coverage might say 100%, but branch coverage will say 50% because the `false` path was never tested).

### The Danger of Coverage Targets

In 2014, Laura and Reed Holmes published a study on large Java programs analyzing coverage vs. effectiveness. They used a critical method called *"controlling for suite size"*—meaning they didn't just compare a 10,000-line test suite to a 100-line suite, they compared two suites of the exact same size. They concluded there is only a **low-to-moderate correlation** between coverage and finding actual bugs.

The study provided rough benchmarks: **60% is acceptable, 75% is commendable, 90% is exemplary.**

If a company mandates 100% coverage, developers will game the system. They will write tests that call every function but `assert()` absolutely nothing. **The true value of a coverage report is in the red lines**—it shows you exactly what parts of your system are completely blind to your safety net.

## Mutation Testing (Testing Your Tests)

If code coverage is easily gamed, how do we know our tests are actually good? We use **Mutation Testing**.

- *Real-life comparison:* To test if your home security system actually works, you don't just ask the alarm company; you hire a fake burglar to try and break in. If the alarm sounds, the system is good. If they steal your TV silently, your security is bad.
- *Technical context:* A mutation tool (like Stryker for NodeJS) intentionally damages your source code (creating a "mutant") and runs your test suite.

**Examples of mutants:**

- Changing `>` to `>=`
- Changing `+` to
- Replacing a return value with `0`.

If your test fails, the mutant is **killed** (Good! Your test caught the damage). If your test passes, the mutant **survived** (Bad! Your test is blind to this logic failure).

**Example from the source:** A function takes a list and returns a paginated page. A developer wrote tests checking that the function "returns an array", "doesn't throw errors", and "length > 0". The code coverage was **100%**.

Then they ran Stryker. Stryker created 19 mutants. **9 survived, resulting in a score of 52.63%.** One surviving mutant changed a loop condition from `i <= offset + limit` to `i < offset + limit`. This broke the pagination math entirely, returning the wrong number of items. But because the tests only checked if the array was `> 0` instead of checking the exact length, the tests still passed. Mutation testing proved a 100% covered function was actually highly vulnerable.

## Measuring Code Quality: Complexity Metrics

Beyond tests, we measure the quality of the code itself using complexity metrics.

### 1. Cyclomatic Complexity

Invented by Thomas McCabe in 1976. It counts the number of independent paths through a piece of code.

- You map the function as a graph. Straight statements are nodes, jumps/branches are edges.
- Formula: `Edges - Nodes + 2`.
- Shortcut formula: `1 + number of decision points` (decision points = `if`, `loop`, `case`, `and`, `or`).

The general industry advice is to keep this score **under 10**. *The Flaw:* A giant `switch` statement with 20 independent cases will score a 21. By Cyclomatic standards, it is terrible code. But practically, a flat switch statement is incredibly easy for a human to read.

### 2. Cognitive Complexity

Invented by SonarSource, this metric abandons strict math to measure how hard code is for a human brain to hold in working memory. It heavily penalizes **nesting**.

*Example Comparison:* Look at a highly nested WebSocket `run` method vs. a flat `streamHandlers` list.

- **Cyclomatic Complexity** scores the `run` method at 8 (ranking it 3rd worst).
- **Cognitive Complexity** looks at the `if` inside a `loop` inside an `if` and scores the `run` method at **19** (ranking it 1st worst).

**Takeaway:** Never blindly trust either metric as a hard rule. Use them as flags. If a tool flags a function with a high score, review it with your team and decide human-to-human if it needs refactoring.

## Static Tools

Finally, testing isn't just running code. We can catch bugs without executing anything using static tools.

1. **Linter:** Checks for bad patterns, not syntax. (e.g., A linter will flag an `if` condition that will mathematically always evaluate to `true`, or warn you that you returned an error but never checked it). Examples include ESLint (Node) or `golangci-lint` (Go).
2. **Formatter:** Re-layouts your code to a team standard (spaces, brackets). It changes zero logic.
3. **Type Checker:** Integrated into editors like VS Code. Warns you if you try to perform arithmetic on a variable declared as a string upstream.
4. **Static Analysis:** An advanced linter. It traces a specific value dynamically through the lifecycle of your un-run program to predict edge-case crashes.

Code quality is ultimately subjective. There is no magic formula, but combining a strong test suite with static ecosystem tools ensures a stable, maintainable backend architecture.