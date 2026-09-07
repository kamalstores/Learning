

## Introduction: Still Setting Up!

Even though the previous video covered a lot of setup, we're **still in the setup phase**. We're not writing the main application logic (like creating users or videos) just yet. Why? Because professional, large-scale applications require a solid foundation _before_ you start building the features.

This video focuses on setting up a few more crucial pieces:

1.  **Custom Error Handling:** Creating a standard way to handle errors throughout the application.
    
2.  **Standard API Responses:** Creating a consistent way to send responses back to the frontend.
    
3.  **Middleware Basics:** Touching upon how middleware works in Express.
    
4.  **Installing More Packages:** Adding a couple more necessary tools.
    

He emphasizes that these steps are common in professional codebases you'll encounter in companies or on GitHub.

----------

## Part 1: Setting up `app.js` (The Express Core)

First, we need to set up the main Express application file.

1.  **Open `src/app.js`:** This file was created in the previous video but was mostly empty.
    
2.  **Import Express:**
    
    JavaScript
    
    ```
    import express from "express";
    
    ```
    
3.  **Create the Express App:**
    
    JavaScript
    
    ```
    const app = express();
    
    ```
    
    This line creates the core Express application instance. We typically call this variable `app`.
    
4.  **Export the App:**
    
    JavaScript
    
    ```
    export { app };
    
    ```
    
    We export the `app` variable so that other files (like our main `index.js`) can import and use it.
    

----------

## Part 2: Refining the Database Connection (`index.js`)

In the last video, we created a `connectDB` function that connects to MongoDB. Now, we need to handle its result properly in our main `src/index.js` file.

1.  **The Problem:** The `connectDB` function is `async`, meaning it returns a **Promise**. A Promise represents an operation that hasn't completed yet (like connecting to a database far away). We need to wait for it to finish _before_ starting our web server.
    
2.  **The Solution (`.then()` and `.catch()`):** We modify `src/index.js` to handle the Promise returned by `connectDB`.
    
    JavaScript
    
    ```
    import dotenv from "dotenv";
    import connectDB from "./db/index.js";
    import { app } from './app.js'; // Import the app
    
    dotenv.config({
        path: './.env'
    });
    
    connectDB()
    .then(() => {
        // Database connected successfully! Now start the server.
    
        // Optional: Listen for errors on the app itself
        app.on("error", (error) => {
            console.error("EXPRESS APP ERROR: ", error);
            throw error; // Or handle more gracefully
        })
    
        app.listen(process.env.PORT || 8000, () => {
            console.log(`⚙️ Server is running at port : ${process.env.PORT || 8000}`);
        });
    })
    .catch((err) => {
        // Database connection failed! Log the error.
        console.error("MONGO db connection failed !!! ", err);
        // process.exit(1); // Optional: Exit if DB fails (already in connectDB)
    });
    
    ```
    
    **Explanation:**
    
    -   We import our `app` from `app.js`.
        
    -   We call `connectDB()`.
        
    -   `.then(() => { ... })`: This block of code runs **only if** the `connectDB` function completes successfully. Inside it:
        
        -   We start the Express server using `app.listen()`.
            
        -   We tell it to listen on the port defined in our `.env` file (`process.env.PORT`) or use port 8000 as a default.
            
        -   We log a message confirming the server is running.
            
        -   _(Optional)_ He mentions adding an `app.on("error", ...)` listener. This is an advanced Express feature to catch rare errors specifically related to the Express app _after_ the DB connects but _before_ or _during_ listening. He leaves implementing this fully as a small assignment.
            
    -   `.catch((err) => { ... })`: This block runs **only if** the `connectDB` function fails (throws an error). Inside it:
        
        -   We log a specific error message indicating the MongoDB connection failed.
            

----------

## Part 3: Configuring Express Middleware (`app.js`)

Now, back in `src/app.js`, we need to tell our Express app how to handle various things like security, cookies, and different data formats. We do this using **middleware**.

Middleware are functions that run _between_ the incoming request and our actual route handler (the code that sends the response). `app.use()` is the primary way to apply middleware.

1.  **Install Necessary Packages:** We need two more packages for common middleware tasks.
    
    Bash
    
    ```
    npm install cookie-parser cors
    
    ```
    
    -   `cors`: Handles **C**ross-**O**rigin **R**esource **S**haring. This is a security feature browsers enforce. We need to tell our backend which frontend URLs are allowed to make requests to it.
        
    -   `cookie-parser`: Allows our server to read and set cookies on the user's browser securely.
        
2.  **Import Packages in `app.js`:**
    
    JavaScript
    
    ```
    import cors from "cors";
    import cookieParser from "cookie-parser";
    
    ```
    
3.  **Apply Middleware using `app.use()`:** Add these lines _after_ `const app = express();` but _before_ `export { app };`:
    
    -   **CORS Configuration:**
        
        JavaScript
        
        ```
        app.use(cors({
            origin: process.env.CORS_ORIGIN, // Allow requests only from the frontend URL specified in .env
            credentials: true // Allow cookies to be sent back and forth
        }));
        
        ```
        
        -   He emphasizes that `origin` should be set to your specific frontend URL (stored in `.env`) for security, not just `*`.
            
    -   **JSON Data Handling:**
        
        JavaScript
        
        ```
        app.use(express.json({ limit: "16kb" }));
        
        ```
        
        -   Allows the app to understand incoming requests that have a JSON body (common for APIs).
            
        -   `limit: "16kb"` prevents users from sending excessively large JSON payloads, which could crash the server.
            
    -   **URL Encoded Data Handling:**
        
        JavaScript
        
        ```
        app.use(express.urlencoded({ extended: true, limit: "16kb" }));
        
        ```
        
        -   Allows the app to understand data coming from HTML forms submitted via the URL (e.g., `?name=hitesh&age=30`).
            
        -   `extended: true` allows for more complex data structures within the URL data.
            
        -   `limit: "16kb"` provides a similar security limit.
            
    -   **Static File Serving:**
        
        JavaScript
        
        ```
        app.use(express.static("public"));
        
        ```
        
        -   Tells Express that if a request comes in for a file that exists in the `public` folder (like an image, CSS file, etc.), it should just send that file directly.
            
    -   **Cookie Parsing:**
        
        JavaScript
        
        ```
        app.use(cookieParser());
        
        ```
        
        -   Enables the app to parse (read) cookies sent by the browser and allows you to set cookies using `res.cookie()`.
            

----------

## Part 4: Understanding Middleware (Conceptual)

He briefly revisits the concept of middleware using a mental diagram:

-   **Request** comes from the browser/user.
    
-   It hits **Middleware 1** (e.g., `cors`). If okay, it calls `next()`.
    
-   It hits **Middleware 2** (e.g., `cookieParser`). If okay, it calls `next()`.
    
-   It hits **Middleware 3** (e.g., check if user is logged in). If okay, it calls `next()`.
    
-   Finally, it reaches your **Route Handler** (the actual code for that specific URL).
    
-   Your **Route Handler** sends the **Response** back.
    

The **`next` function** is the key. Each middleware does its job and then calls `next()` to pass the request along the chain. If a middleware _doesn't_ call `next()`, the request stops there.

He also mentions the standard parameters often seen in middleware: `(req, res, next)` or sometimes `(err, req, res, next)` for error-specific middleware.

----------

## Part 5: Utility - The Async Handler Wrapper (`asyncHandler.js`)

This is a very common and useful pattern in professional Node.js development.

1.  **The Problem:** Many of our route handlers (controllers) will need to interact with the database. Database operations are asynchronous (`async/await`) and can fail (`try...catch`). Writing `async` and `try...catch` in _every single_ route handler is repetitive and clutters the code.
    
2.  **The Solution:** Create a **wrapper function** (a higher-order function) that takes our route handler function as input and automatically adds the necessary `async` handling and error catching.
    
3.  **Create the File:** `src/utils/asyncHandler.js`
    
4.  **Two Implementations:** He shows two ways to write this wrapper:
    
    -   **Method 1 (Using `try...catch`):** (He explains this but comments it out)
        
        JavaScript
        
        ```
        // const asyncHandler = (fn) => async (req, res, next) => {
        //     try {
        //         await fn(req, res, next);
        //     } catch (error) {
        //         res.status(error.code || 500).json({
        //             success: false,
        //             message: error.message
        //         });
        //     }
        // }
        
        ```
        
        -   This takes a function `fn`, returns a new `async` function. Inside, it `try`s to `await fn`. If it catches an error, it sends a standardized error response.
            
    -   **Method 2 (Using Promises):** (This is the one he chooses to use)
        
        JavaScript
        
        ```
        const asyncHandler = (requestHandler) => {
            return (req, res, next) => {
                Promise.resolve(requestHandler(req, res, next))
                       .catch((err) => next(err));
            }
        }
        
        export { asyncHandler };
        
        ```
        
        -   This takes a function `requestHandler`.
            
        -   It returns a _new_ function (the one Express will actually call).
            
        -   Inside the returned function, it wraps the execution of `requestHandler` in `Promise.resolve()`. This ensures it works whether `requestHandler` is async or not.
            
        -   If `requestHandler` throws an error (or returns a rejected Promise), the `.catch((err) => next(err))` block catches it.
            
        -   **Crucially**, instead of sending a response directly, it calls `next(err)`. This passes the error to Express's dedicated error handling mechanism, which is generally considered a cleaner approach.
            

**How it will be used (later):** Instead of writing `app.get('/', async (req, res) => { try {...} catch {...} })`, you'll write `app.get('/', asyncHandler(async (req, res) => { ... }))`. The wrapper handles the boilerplate.

----------

## Part 6: Utility - Standardizing API Errors (`ApiError.js`)

We need a consistent way to structure error responses sent back to the frontend.

1.  **The Problem:** Node.js has a basic `Error` class, but it doesn't include important details like an HTTP `statusCode` (e.g., 404 Not Found, 401 Unauthorized) or a `success` flag.
    
2.  **The Solution:** Create our _own_ custom error class that **inherits** from Node's built-in `Error` class and adds the extra properties we need.
    
3.  **Create the File:** `src/utils/ApiError.js`
    
4.  **The Code:**
    
    JavaScript
    
    ```
    class ApiError extends Error {
        constructor(
            statusCode,
            message = "Something went wrong", // Default message
            errors = [], // For multiple validation errors
            stack = "" // Optional stack trace
        ) {
            super(message); // Call the parent Error class constructor
            this.statusCode = statusCode;
            this.data = null; // Standardize: Errors typically don't have data
            this.message = message;
            this.success = false; // Standardize: Errors always have success: false
            this.errors = errors;
    
            // Capture stack trace properly (important for debugging)
            if (stack) {
                this.stack = stack;
            } else {
                Error.captureStackTrace(this, this.constructor);
            }
        }
    }
    
    export { ApiError };
    
    ```
    
    Now, whenever we want to signal an error in our code, we can `throw new ApiError(404, "User not found")` instead of just `throw new Error("User not found")`. This carries much more useful information.
    

----------

## Part 7: Utility - Standardizing API Responses (`ApiResponse.js`)

Similarly, we want a consistent structure for _successful_ responses.

1.  **The Problem:** We want every successful response to look similar, usually including a status code, the actual data, a message, and a success flag.
    
2.  **The Solution:** Create a simple class to structure these responses.
    
3.  **Create the File:** `src/utils/ApiResponse.js`
    
4.  **The Code:**
    
    JavaScript
    
    ```
    class ApiResponse {
        constructor(statusCode, data, message = "Success") {
            this.statusCode = statusCode;
            this.data = data;
            this.message = message;
            // Automatically determine success based on HTTP status code convention
            this.success = statusCode < 400; 
        }
    }
    
    export { ApiResponse };
    
    ```
    
    Now, when sending a successful response, instead of just `res.json(userData)`, we can do `res.status(200).json(new ApiResponse(200, userData, "User logged in successfully"))`. This ensures consistency.
    

----------

## Conclusion and Next Steps

-   The instructor emphasizes that all this setup (middleware, custom classes, wrappers) makes the actual application code (controllers, routes) much cleaner and easier to write later.
    
-   He pushes all the new code to GitHub.
    
-   He explains that you can't really "test" these utility files directly right now. They are infrastructure. Their effectiveness will become apparent when we start building actual API endpoints that _use_ them.
    
-   The **next video** will focus on writing a **custom error-handling middleware** that will specifically use the `ApiError` class we just created.