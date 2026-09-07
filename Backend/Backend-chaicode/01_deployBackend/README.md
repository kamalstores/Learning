# Part 1: Local Setup & Project Initialization

## Step 1: Install the Prerequisite (Node.js)

The only thing you must have installed on your system is Node.js.

Go to [nodejs.org](https://nodejs.org) and download the LTS (Long Term Support) version.

Installation is a simple "Next, Next, Finish" process.

Once installed, open your terminal and verify the installation by checking the versions:

```bash
# Check Node.js version
node -v

# Check Node Package Manager (npm) version
npm -v
```

## Step 2: Initialize Your Node.js Project

Create an empty folder for your project (e.g., `chai-backend`).

Open this folder in your code editor (like VS Code) and open the built-in terminal.

To turn this empty folder into a Node.js project, run:

```bash
npm init
```

> **Why not `npm init -y`?** The `-y` flag skips all questions and accepts all defaults. As a beginner, it's crucial to see what you are setting up. `npm init` is a utility that walks you through creating your `package.json` file.

This utility will ask you a few questions:

- **package name:** The name of your project (e.g., `chai-backend`).
- **version:** (1.0.0 is fine).
- **description:** A brief description (e.g., "A basic app for deployment").
- **entry point:** This is important. It's the main file that will run when your application starts. (The default, `index.js`, is perfect).
- **test command:** (Press Enter to skip).
- **git repository:** (Press Enter to skip).
- **keywords:** (e.g., "node", "chai").
- **author:** (Your name).
- **license:** (Press Enter to skip).

This process creates one file: `package.json`. This file is the "manifest" of your project. It lists your project's details and, most importantly, will track all its dependencies (packages we install).

## Step 3: Create and Run Your First Script

Create the entry point file you just defined: `index.js`.

Inside `index.js`, write a simple line of JavaScript:

```js
console.log("Chai aur Code");
```

How to run this file?

**Method 1 (Direct):** You can run it directly with Node.

```bash
node index.js
# Output: Chai aur Code
```

**Method 2 (The "Scripts" Way):** The professional way is to use the scripts section of your `package.json`. This is what deployment servers will use.

Open `package.json` and modify the scripts object:

```json
// ... inside package.json
"scripts": {
	"start": "node index.js"
},
// ...
```

Now, you can run your application using this new start script:

```bash
npm run start
# Or, for the "start" script, you can just use:
npm start

# Output: Chai aur Code
```

# Part 2: Building a Web Server with Express.js

## Step 4: Understanding Core Concepts

- **Client-Server Model:** Your browser is a client. It makes a request (e.g., "GET me the google.com homepage") to a server. The server (our code) listens for this request, processes it, and sends back a response (the HTML, data, etc.).
- **Express.js:** This is a web framework (a package) for Node.js. Its entire job is to make it easy to handle requests and send responses.
- **Routes:** A route is the specific URL path the user is trying to access.
	- `/` is the "home" or "root" route.
	- `/login` is the "login" route.
	- `/profile` is the "profile" route. Our server will need to listen for each route we want to support.
- **Request Types:** The most common type is a GET request, which is what a browser does when you type a URL. We'll learn about POST, PUT, DELETE, etc., later.

## Step 5: Install and Set Up Express

In your terminal, install the express package:

```bash
npm install express
```

This command does two things:

1. Downloads express (and its dependencies) into a new folder called `node_modules`.
2. Automatically adds express to your `package.json` under dependencies.

Now, let's write the server code. Replace the content of `index.js` with the "Hello World" code from the Express.js documentation:

```js
// 1. Import the express library
const express = require('express');

// 2. Create an instance of an express application
const app = express();

// 3. Define a port for the server to listen on
const port = 3000;

// 4. Create a route for the home page
// app.get(route, callback_function)
app.get('/', (req, res) => {
	// 5. Send a response back to the client
	res.send('Hello World!');
});

// 6. Start the server and make it listen on the defined port
app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
```

**Code Breakdown:**

- `const app = express()`: `app` is now our main variable. It holds all the power of Express. We'll use it for everything, like `app.get()`, `app.listen()`, etc.
- `const port = 3000`: A computer has thousands of "virtual ports." A server needs to listen on a specific, available port. 3000 is a common one for development.
- `app.get('/', (req, res) => { ... })`:
	- `app.get` means we are handling a GET request.
	- `/` means we are handling it for the home route.
	- `(req, res) => { ... }` is our callback function that runs every time someone visits this route. It always receives two objects:
		- `req` (Request): Contains all information about the request (e.g., who is asking, what data are they sending?).
		- `res` (Response): Contains a set of methods to send a response back to the client.
	- `res.send('Hello World!')`: We use the res object's `.send()` method to send a simple text response.
- `app.listen(port, ...)`: This is the command that actually starts the server. It's a long-running process.

## Step 6: Run and Test Your Server

Run the server from your terminal:

```bash
npm start
```

You will see: `Example app listening on port 3000`. Notice: The command doesn't finish! Your terminal is now "stuck." This is not a bug. This is what a server does—it runs continuously, listening for requests.


## Step 7: Add More Routes

Let's add more routes to `index.js` to see how it works.

```js
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
	res.send('Hello World!');
});

// New route
app.get('/twitter', (req, res) => {
	res.send('Welcome to my Twitter!');
});

// New route (sending HTML)
app.get('/login', (req, res) => {
	res.send('<h1>Please login at chai aur code</h1>');
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
```

Now, there's a problem. If you save this file and go to [http://localhost:3000/twitter](http://localhost:3000/twitter), it will fail and say `Cannot GET /twitter`.

### Understanding the "Server Restart" Problem

When you ran `npm start`, Node.js loaded your original `index.js` file into memory. It has no idea you just saved new changes to the file. For the new code (like the `/twitter` route) to be loaded, you must restart the server.

Go to your terminal.

Press `Ctrl + C` to stop the running server.

Run `npm start` again to restart it with the new code.

Now, [http://localhost:3000/twitter](http://localhost:3000/twitter) will work. This manual restart process is annoying. Tools like nodemon exist to fix this, but it's important to first feel the pain and understand the problem (servers don't auto-restart) before installing a solution.

# Part 3: Preparing for Production (Deployment)

## Step 8: The Problem with "Hardcoding"

Our code has `const port = 3000;`. This is hardcoded.

- **Problem 1:** What if our deployment server (DigitalOcean, AWS, etc.) doesn't have port 3000 available? What if it requires us to use port 8080? Our app would crash.
- **Problem 2 (Secrets):** What if we had a database password? `const DBP_PASSWORD = "secret123"` If we push this code to a public GitHub repository, everyone will see our password.

## Step 9: The Solution (Environment Variables)

The solution is Environment Variables. These are variables that live outside our code, in the "environment" of the server itself.

We will use a package called `dotenv` to manage these.

Install dotenv:

```bash
npm install dotenv
```

Create a `.env` file: In the root of your project, create a new file named `.env` (it must start with a dot).

Add variables: Inside `.env`, add your variables. **IMPORTANT:** Do not add quotes.

```env
PORT=4000
# We're using 4000 to prove it's working (vs. the 3000)
```

Load .env variables: In `index.js`, add this line at the very top of the file:

```js
require('dotenv').config();
```

This line tells dotenv to find the `.env` file and load all its variables into a global object called `process.env`.

Use the variables: Now, change your hardcoded port in `index.js`:

```js
// Old: const port = 3000;

// New:
const port = process.env.PORT;

// ... rest of your code ...

app.listen(port, () => {
	// The ${port} will now come from the .env file
	console.log(`Example app listening on port ${port}`);
});
```

Now, restart your server (`Ctrl + C`, then `npm start`). You will see: `Example app listening on port 4000`

It works! Our app is now reading its configuration from the environment. When we deploy, the production server will provide its own `PORT` variable, and our app will automatically use it.

# Part 4: Deploying to the Internet

## Step 10: Push Your Code to GitHub

Deployment platforms work by pulling your code from a Git repository.

Create a `.gitignore` file: We must never push our secrets (`.env`) or our huge dependencies folder (`node_modules`) to GitHub. Create a file named `.gitignore` in your root folder:

```gitignore
# This folder is auto-generated
node_modules

# This file contains secrets
.env
```

Create a GitHub Repo: Go to GitHub and create a new, public repository (e.g., `chai-backend-deploy`).

Push your code: Follow the commands from GitHub to push your local project:

```bash
# Initialize git in your folder
git init

# Add all files (except those in .gitignore)
git add .

# Create your first "save"
git commit -m "first commit: basic express server"

# Set your main branch name
git branch -M main

# Link your local repo to the GitHub repo
git remote add origin <YOUR_GITHUB_REPO_URL.git>

# Push your code to GitHub
git push -u origin main
```

Refresh GitHub. Your code (minus `node_modules` and `.env`) is now online.

## Step 11: Deploy to a Cloud Platform

There are many platforms (Heroku, Railway, Render, DigitalOcean). Most are now paid ($5-$7/month) because free tiers were abused for crypto mining.

If you don't have a credit card, just watch this part. The process is the most important thing to learn.

We will use DigitalOcean for this demo. The steps are very similar for all platforms:

1. **Create an "App":** In the DigitalOcean dashboard, click Create -> App.
2. **Connect Source:** Connect your GitHub account and select your `chai-backend-deploy` repository and the main branch.
3. **Enable Autodeploy:** Check the box for "Autodeploy on Push." This means any new git push will automatically trigger a new deployment.
4. **Configure Resources (The "Money" Part):** This is where you pick your server plan. He selects the "Basic" plan for $5/month.
5. **Set Environment Variables:** This is the most important step! The platform will ask for your environment variables.
	 - Click "Edit" next to "Environment Variables."
	 - Add a new variable:
		 - **Key:** PORT
		 - **Value:** 8080 (or whatever the platform suggests)
	 - (Note: DigitalOcean overrides this specific PORT variable anyway, but this is where you would add your DB_PASSWORD or other secrets.)
6. **Review and Create:** Click "Next" and finally "Create Resource."

DigitalOcean will now pull your code from GitHub, detect it's a Node.js project, run `npm install`, and then run `npm start`.

You can watch the "Build Logs" to see this happen. If all goes well, you'll see your message: `Example app listening on port 8080` (or whatever port it was assigned).

## Step 12: Test Your Live App

Once it says "Deployed Successfully," DigitalOcean will give you a public URL (e.g., `https://my-app-random-name.ondigitalocean.app`).

- Go to that URL: You'll see "Hello World!"
- Go to `[your-url]/twitter`: You'll see "Welcome to my Twitter!"
- Go to `[your-url]/login`: You'll see the `<h1>` login message.

Your app is now live on the internet!



# Part 5: Sending JSON Data (Making a Real API)

Let's add a new feature: an API route that sends JSON data, just like api.github.com.

## Step 13: Create a JSON Route

In `index.js`, let's create a new route. This time, instead of `res.send()`, we'll use `res.json()`, which is the proper method for sending JSON.

```js
// ... other routes ...

// A mock database object
const githubData = {
	"login": "hiteshchoudhary",
	"id": 11613311,
	"followers": 17882,
	"following": 0
};

app.get('/github', (req, res) => {
	// This will send the object as a JSON response
	res.json(githubData);
});

// ... app.listen() ...
```

Test locally: Stop your server (`Ctrl + C`), restart (`npm start`), and go to [http://localhost:4000/github](http://localhost:4000/github). You will see the raw JSON data in your browser.

## Step 14: Deploy the New Feature

How do we get this new `/github` route into production? Thanks to our "Autodeploy" setup, it's just 3 Git commands:

```bash
# 1. Add your changes
git add .

# 2. Commit your changes
git commit -m "feat: added github data route"

# 3. Push to GitHub
git push
```

That's it! If you go back to your DigitalOcean dashboard, you'll see a new "Build" has automatically started. Once it's done, your live app will have the new `/github` route.

## Step 15: (CRITICAL) Destroy Your App

To avoid being charged, you must destroy your app when you are done.

In DigitalOcean, go to your App -> Actions -> Destroy App.

# Final Recap

In this one video, we:

- Learned that a backend server is just a continuously running Node.js process.
- Used Express.js to listen for GET requests on different routes.
- Used `res.send()` and `res.json()` to send responses.
- Understood why we must restart the server on changes.
- Learned the most important production concept: using dotenv and .env files to keep code and configuration separate.
- Used `process.env.PORT` to make our app flexible.
- Pushed our code to GitHub, making sure to ignore `node_modules` and `.env` with `.gitignore`.
- Deployed our app to a live production server and saw the full "push-to-deploy" workflow.

The "scary" idea of deployment is just a few clicks once your app is configured correctly with environment variables.
