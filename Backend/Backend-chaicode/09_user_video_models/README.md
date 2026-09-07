Hello and welcome! I'm glad you're here. In this video, we're continuing our backend development series. The main goal is to build the data models for our application, specifically the **User model** and the **Video model**.

Think of a "model" as a blueprint. It tells our database (MongoDB) exactly what kind of information to expect and how to structure it. For example, our User model will define that every user must have a `username`, an `email`, a `password`, and so on.

This video might seem a bit easier than previous ones, but that's only because we've already had some practice with data modeling. The more familiar you are with a concept, the easier it becomes.

We'll be covering some very important and advanced topics:

1.  **User Model**: The blueprint for all our user data.
    
2.  **Video Model**: The blueprint for all our video data.
    
3.  **Bcrypt**: A crucial library for **securing passwords**. We'll learn how to hash passwords so we never store them in plain text.
    
4.  **JWT (JSON Web Tokens)**: The standard way to handle user **authentication** (logging in and staying logged in).
    
5.  **A Special Plugin**: We'll add a plugin to our Video model (`mongoose-aggregate-paginate-v2`) that will help us write very complex, production-level database queries later.
    

Let's get started.

----------

## Project Setup & File Creation

First, we need to create the files for our models. We'll go into our `src/models/` directory and create two new files:

1.  `user.model.js`
    
2.  `video.model.js`
    

Using `.model.js` is a common naming convention that makes it clear what the purpose of the file is.

----------

## Data Model Design (The "Why")

Before we write code, let's look at the plan. We're focusing on the `User` and `Video` models together for a very specific reason: they are **tightly coupled**.

-   A **User** will have a `watchHistory`, which will be a list of **Videos** they have watched.
    
-   A **Video** will have an `owner`, which will be the **User** who uploaded it.
    

Since they directly reference each other, it makes sense to build them at the same time.

----------

## The User Model (`user.model.js`)

Let's build the `userSchema` step-by-step.

First, we import `mongoose` and pull the `Schema` class from it.

JavaScript

```
import mongoose, { Schema } from "mongoose";

// This is where we'll define all the fields
const userSchema = new Schema(
    {
        // Fields go here...
    },
    {
        // Options go here...
    }
);

// This is how we export it
export const User = mongoose.model("User", userSchema);

```

Now, let's add the fields inside the first object `{}`.

### User Fields

1.  **`username`**:
    
    JavaScript
    
    ```
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true, 
        index: true
    },
    
    ```
    
    -   `type: String`: It must be a string.
        
    -   `required: true`: A user cannot be created without a username.
        
    -   `unique: true`: No two users can have the same username. The database will enforce this.
        
    -   `lowercase: true`: Automatically converts "Hitesh" to "hitesh" before saving.
        
    -   `trim: true`: Removes any leading or trailing whitespace (e.g., " myuser " becomes "myuser").
        
    -   **`index: true`**: This is important for optimization. It tells MongoDB to create an index on this field, making it much faster to search for users by their username. Think of it as an index in a textbook.
        
2.  **`email`**:
    
    JavaScript
    
    ```
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true, 
    },
    
    ```
    
    -   This has similar validations. We don't add an `index` here because searching by username will be our primary method.
        
3.  **`fullName`**:
    
    JavaScript
    
    ```
    fullName: {
        type: String,
        required: true,
        trim: true, 
        index: true
    },
    
    ```
    
    -   We add `index: true` here as well, in case we want to allow users to search for other users by their full name.
        
4.  **`avatar` & `coverImage`**:
    
    JavaScript
    
    ```
    avatar: {
        type: String, // We will get a URL from a service like Cloudinary
        required: true,
    },
    coverImage: {
        type: String, // This will also be a URL from Cloudinary
    },
    
    ```
    
    -   We won't store images or videos directly in our database. That's very inefficient.
        
    -   Instead, we'll upload them to a third-party service (like **Cloudinary** or AWS S3). That service will give us a URL (a string), and we'll store that URL in our database.
        
5.  **`watchHistory`**:
    
    JavaScript
    
    ```
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    
    ```
    
    -   This is our first **relationship**.
        
    -   The `[]` brackets mean it's an **array**. A user can watch many videos.
        
    -   `type: Schema.Types.ObjectId`: This is Mongoose's special type for storing a unique ID of another document.
        
    -   `ref: "Video"`: This is the crucial part. It tells Mongoose, "The ID stored here belongs to a document in the **'Video'** collection." This allows us to easily fetch all the video details later.
        
6.  **`password`**:
    
    JavaScript
    
    ```
    password: {
        type: String,
        required: [true, 'Password is required'],
    },
    
    ```
    
    -   This is a plain string for now, but this is a **major security risk**. We will **never** store passwords in plain text.
        
    -   We will use a **Mongoose Hook** (middleware) to intercept this password _before_ it's saved and **hash (encrypt)** it. We'll do this using a library called `bcrypt`.
        
    -   Note: `required` can also take an array with a custom error message.
        
7.  **`refreshToken`**:
    
    JavaScript
    
    ```
    refreshToken: {
        type: String
    }
    
    ```
    
    -   This field is for authentication. When a user logs in, we'll give them two tokens: an _Access Token_ and a _Refresh Token_.
        
    -   The Refresh Token is long-lived and will be stored here in the database to verify the user's identity when their Access Token expires.
        

### Schema Options

After the fields, we pass a second object for options:

JavaScript

```
const userSchema = new Schema(
    { ...fields... },
    {
        timestamps: true
    }
);

```

-   `timestamps: true`: This is a magic setting. Mongoose will automatically add two fields to our document: `createdAt` and `updatedAt`, and manage them for us.
    

### Exporting the Model

Finally, we compile our schema into a model and export it:

JavaScript

```
export const User = mongoose.model("User", userSchema);

```

-   `mongoose.model()` takes the singular name of our collection, `"User"`.
    
-   MongoDB will automatically pluralize this and create a collection named `"users"` (all lowercase) in the database.
    

----------

## Advanced Topic 1: Password Hashing with `bcrypt`

We can't save a password as "123456". We need to hash it. Hashing is a one-way process; you can't un-hash it.

First, install bcrypt:

npm install bcrypt

Now, back in `user.model.js`, _before_ we export the model, we'll add a **Mongoose "pre" hook**. This is code that runs _before_ a specific event, like `"save"`.

JavaScript

```
// This hook runs just BEFORE the data is saved to the DB
userSchema.pre("save", async function (next) {
    // We only run this code if the password was actually modified
    if (!this.isModified("password")) return next();

    // 'this' refers to the current user document
    // We hash the password with 10 rounds of "salt"
    this.password = await bcrypt.hash(this.password, 10);
    next(); // Pass control to the next middleware (or the actual save)
});

```

**Key parts explained:**

1.  `userSchema.pre("save", ...)`: We're telling Mongoose to run this function before any `save` event.
    
2.  `async function (next)`:
    
    -   It **must** be a `function()` declaration, **not** an arrow function (`() =>`). This is because we need access to the user document via the `this` keyword, which arrow functions don't provide in this context.
        
    -   It's `async` because `bcrypt.hash` is an asynchronous operation (it takes time to run).
        
    -   It receives a `next` function, which we **must** call when we're done to continue the save process.
        
3.  `if (!this.isModified("password"))`: This is a critical optimization. If the user is just updating their avatar, we don't want to re-hash their already-hashed password. This code ensures we only hash the password if it's new or has been changed.
    
4.  `this.password = await bcrypt.hash(this.password, 10)`: This is the core logic.
    
    -   `this.password` on the right is the plain-text password (e.g., "123456").
        
    -   `bcrypt.hash()` scrambles it. The `10` is the "salt rounds," which determines how complex the hash is. 10 is a good, standard number.
        
    -   We then overwrite `this.password` (on the left) with the new hashed password (e.g., "$2b$10$asdf...").
        
5.  `next()`: We're done. Proceed with saving the user.
    

### Comparing Passwords

Now we have a hashed password. When a user tries to log in, how do we check if their "123456" matches the hash in our database? We can't un-hash.

Instead, `bcrypt` gives us a `compare` function. We'll add this as a custom **method** to our user schema.

JavaScript

```
// We are injecting a custom method called 'isPasswordCorrect'
userSchema.methods.isPasswordCorrect = async function (password) {
    // 'this.password' is the hashed password from the database
    // 'password' is the plain-text password from the user login
    return await bcrypt.compare(password, this.password);
};

```

-   `userSchema.methods` allows us to add our own functions to every user document.
    
-   `bcrypt.compare()` will take the plain-text password, hash it using the same salt (which is stored as part of the hash), and see if it matches the one in the database.
    
-   It returns `true` or `false`.
    

----------

## Advanced Topic 2: Authentication with JWT

Now for logging in. We'll use **JSON Web Tokens (JWT)**.

Install the library:

npm install jsonwebtoken

Here's the pattern:

1.  A user logs in with their email and password.
    
2.  We find the user in the DB.
    
3.  We use our `isPasswordCorrect` method to check their password.
    
4.  If it's correct, we generate two tokens:
    
    -   **Access Token**: A short-lived token (e.g., 1 day) that contains user data. The user sends this with _every_ request to prove who they are. We **do not** save this in the database.
        
    -   **Refresh Token**: A long-lived token (e.g., 10 days) with minimal data. Its _only_ job is to get a new Access Token when the old one expires. We **do** save this in our database (in the `refreshToken` field).
        

We need secret keys to "sign" these tokens. These keys **must** be kept private in your `.env` file.

**In your `.env` file:**

```
ACCESS_TOKEN_SECRET=your-super-strong-random-secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your-other-super-strong-random-secret
REFRESH_TOKEN_EXPIRY=10d

```

Now, let's create methods to _generate_ these tokens, just like we did for password checking.

First, import jwt at the top of user.model.js:

import jwt from "jsonwebtoken";

Then, add these methods:

JavaScript

```
// Method to generate an Access Token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            // This is the "payload" or data
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        }
    );
};

// Method to generate a Refresh Token
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            // Payload for refresh token is minimal
            _id: this._id, 
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        }
    );
};

```

-   `jwt.sign()` creates the token.
    
-   The first argument is the **payload**: the data we want to store inside the token. For the Access Token, we include user info. For the Refresh Token, we _only_ need the `_id`.
    
-   The second argument is our **secret key** from the `.env` file.
    
-   The third argument is the **expiry time**.
    

Now our `User` model is complete and incredibly powerful.

----------

## The Video Model (`video.model.js`)

This model will be a bit simpler, but it has its own important relationship.

JavaScript

```
import mongoose, { Schema } from "mongoose";

const videoSchema = new Schema(
    {
        videoFile: {
            type: String, // URL from Cloudinary
            required: true,
        },
        thumbnail: {
            type: String, // URL from Cloudinary
            required: true,
        },
        title: {
            type: String, 
            required: true,
        },
        description: {
            type: String, 
            required: true,
        },
        duration: {
            type: Number, // We'll get this from Cloudinary
            required: true,
        },
        views: {
            type: Number,
            default: 0,
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);

export const Video = mongoose.model("Video", videoSchema);

```

**Key fields explained:**

-   `videoFile`, `thumbnail`: Just like the user's avatar, these are string URLs from our file-hosting service.
    
-   `duration`: This will be a `Number` (in seconds). When we upload a video to Cloudinary, it will process it and tell us the duration, which we'll save.
    
-   `views`: A `Number` that starts at `0`.
    
-   `isPublished`: A `Boolean` (true/false) flag to control if the video is visible.
    
-   **`owner`**: This is the other side of our relationship. It's a single `ObjectId` that `ref`erences the `"User"` model. This links every video to the user who uploaded it.
    

----------

## Advanced Topic 3: Aggregation Plugin

We're building a complex app. We'll need to ask complex questions, like:

"Get all videos from a user's watchHistory, but also get the owner details for each of those videos, and sort them by views."

A simple `find()` query can't do this. We'll need to use **MongoDB Aggregation Pipelines**.

To make our lives easier, especially with pagination (showing "Page 1 of 10"), we'll use a plugin.

Install it:

npm install mongoose-aggregate-paginate-v2

Now, in `video.model.js`, import it and "plug it in" to our schema.

JavaScript

```
import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"; // 1. Import

const videoSchema = new Schema(
    { ...fields... },
    { ...options... }
);

videoSchema.plugin(mongooseAggregatePaginate); // 2. Inject the plugin

export const Video = mongoose.model("Video", videoSchema);

```

That's it! By adding `videoSchema.plugin(...)`, our `Video` model now has new methods available that will help us build and paginate complex aggregation queries, which we'll use in our controllers later.

----------

## Conclusion

That was a lot, but it was incredibly important. We have now built:

1.  A **User Model** with secure password hashing (`bcrypt`) and a complete authentication token system (`JWT`).
    
2.  A **Video Model** that is linked to the User model.
    
3.  We've prepared our Video model for advanced, production-level queries using an aggregation plugin.
    

These two models are the absolute core of our application. All the code for this is available on the GitHub repository.

I hope this detailed breakdown was helpful. If it was, please don't forget to leave a comment. Your support is what keeps this series going!