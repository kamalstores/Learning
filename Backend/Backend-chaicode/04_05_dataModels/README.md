# 05th Video

## Introduction: The Most Important First Step in Backend

The instructor (Hitesh) welcomes you back to the "Chai aur Backend" series. He shares a story from his 10-12 years of experience to illustrate the video's core lesson.

He was consulting for a company where new (fresher) developers were hired for a project that included building an authentication (login/signup) system.

-   **The Fresher's Approach:** The new developer immediately started writing code for the login controller, thinking about how to take the email and password and check them against the database.
    
-   **The Experienced Approach:** An experienced developer first asks questions: What is the scope? _Why_ are we building this? _What_ should we be doing?
    

The lesson here is that when you start a backend project, **login and authentication are NOT the first things you should build.**

The very first, and most important, question you must answer is:

What data are we going to store?

Before you debate _where_ to store it (MySQL, MongoDB, PostgreSQL, etc.), you must define _what_ the data is.

-   What are the data points? (e.g., username, email, password, photo, date of birth)
    
-   What is the format of each field? (e.g., is "username" a string? Is "date of birth" a date?)
    

This entire video is dedicated to this single concept: **Data Modeling**.

----------

## What is Data Modeling?

Data modeling is the process of planning out the structure of your data. Think of it like creating a blueprint for a house before you start buying bricks.

The instructor compares it to defining the **characters in a movie**. Before you can write the story, you need to know who your characters are (the hero, the villain, etc.) and what properties they have.

In our database, these "characters" are our **models**. For example, a `User` is a model, a `Product` is a model, and a `Todo` is a model.

### Professional Tools for Data Modeling

The instructor briefly shows some professional tools that large companies use for this process. You don't need to use them, but you should know they exist.

1.  **Moon Modeler:** A paid, expensive tool that is very good for modeling MongoDB. It lets you visually create models and even generates the Mongoose code for you.
    
2.  **Eraser.io:** A more general diagramming tool (which he uses) that is good for creating "Entity Relation" (ER) diagrams. These diagrams visually show what models you have and how they are connected.
    
3.  **Pen and Paper:** The best, cheapest, and most essential tool. You should always start by sketching out your models and fields on paper.
    

### Why is This So Important? (The Photo Example)

The instructor demonstrates why this planning is critical.

-   **Scenario 1:** You design a **Register Form** with three fields:
    
    -   Username
        
    -   Email
        
    -   Password
        
-   **Scenario 2:** You design the _same_ form but add one more field:
    
    -   Username
        
    -   Email
        
    -   Password
        
    -   **Photo**
        

That one tiny change (**"Photo"**) completely changes your _entire_ backend logic. Storing text (like a username) is simple. Storing a file (like a photo) is complex. You now have to worry about file uploads, file storage (like on AWS S3 or Cloudinary), file URLs, and much more.

This is why you **must** define all data fields _before_ you write any code.

----------

## Our Example Project: A "Todo" App Model

To practice this, the instructor guides you through modeling a complex Todo application.

He sketches it out:

1.  **Main "Todo" Box:** This isn't the todo item itself, but the _category_ (e.g., "YouTube Videos", "Gym").
    
2.  **Sub-Todo Items:** Inside each main box, there are the actual tasks (e.g., "Record video on data modeling," "Do 10 pushups").
    

Based on this, he identifies three main "characters" or **models** we need to create:

1.  **`User`**: Who owns the todos?
    
2.  **`Todo`**: The main category box (e.g., "YouTube").
    
3.  **`SubTodo`**: The individual task (e.g., "Record video").
    

----------

## Phase 2: Practical Data Modeling with Mongoose

This is where the practical coding begins.

-   **Tool:** We will use **Mongoose**. Mongoose is an **Object Data Modeling (ODM)** library for MongoDB. In simple terms, it's a "helper" that makes it easy to create and manage our data _models_ and _validations_ (like `required`, `unique`, etc.) when working with a MongoDB database.
    
-   **Environment:** To avoid the hassle of setting up a local project (npm init, etc.), he uses **StackBlitz**, an online code editor. This lets us focus _only_ on the Mongoose code.
    

**Setup in StackBlitz:**

1.  He creates a new **Node.js (Express)** project.
    
2.  He opens the terminal and installs Mongoose: `npm install mongoose`
    
3.  He creates a `models` folder to store all our model files.
    
4.  Inside `models`, he creates a `todos` folder for this specific project.
    
5.  Inside `todos`, he creates our three "character" files:
    
    -   `user.models.js`
        
    -   `todo.models.js`
        
    -   `sub_todo.models.js`
        

He notes that the `.models.js` extension is just a naming convention. It's still a regular JavaScript file, but it makes it clear to other developers that this file defines a data model.

----------

## Part 1: Building the User Model (`user.models.js`)

This is the most detailed part, as it teaches you all the fundamentals.

### Step 1: The 3-Line Mongoose Boilerplate

Every Mongoose model file you ever create will have this basic 3-step structure.

JavaScript

```
// Step 1: Import mongoose
import mongoose from 'mongoose';

// Step 2: Define the Schema
// A schema defines the *structure* of the document (the fields)
const userSchema = new mongoose.Schema(
    {
      // ... fields will go here
    }
);

// Step 3: Create and Export the Model
// The model is a wrapper on the Schema that provides an interface
// to the database for creating, querying, updating, deleting records, etc.
export const User = mongoose.model('User', userSchema);

```

### Step 2: Defining Basic Fields

Let's add our fields (username, email, password) inside the `userSchema` object.

There is a simple way and a professional way.

The Simple Way:

You can just provide the data type.

JavaScript

```
const userSchema = new mongoose.Schema(
    {
      username: String,
      email: String,
      password: String
    }
);

```

This works, but it offers no validation. A user could sign up with an empty password.

The Professional Way:

Instead of just a type, you provide an object of options for each field. This is where Mongoose becomes very powerful.

JavaScript

```
const userSchema = new mongoose.Schema(
    {
      username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
      },
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
      },
      password: {
        type: String,
        required: true
      }
    }
);

```

Let's break down those properties:

-   `type: String`: The data type (can also be `Number`, `Boolean`, `Date`, etc.).
    
-   `required: true`: Mongoose will not save this document to the database if this field is missing.
    
-   `unique: true`: Mongoose will ensure that no two documents in this collection have the same value for this field. This is perfect for usernames and emails.
    
-   `lowercase: true`: Mongoose will automatically convert the value to lowercase before saving it. This is great for emails to prevent "Test@gmail.com" and "test@gmail.com" from being treated as different accounts.
    

Even More Advanced:

The instructor also mentions you can provide a custom error message for required:

JavaScript

```
password: {
    type: String,
    required: [true, "Password is required"] // Custom message
}

```

### Step 3: Adding Timestamps

A very common requirement is to know _when_ a user was created and _when_ they were last updated. Mongoose can do this for you automatically.

You pass a **second object** to the `new mongoose.Schema()` constructor with the `timestamps` option.

JavaScript

```
const userSchema = new mongoose.Schema(
    {
      // ... all our fields (username, email, password)
    },
    {
      timestamps: true // This is the new part
    }
);

```

By just adding `{ timestamps: true }`, Mongoose will automatically add two fields to your model:

1.  `createdAt`
    
2.  `updatedAt`
    

### Step 4: A Note on `mongoose.model()`

This line is very important: `export const User = mongoose.model('User', userSchema);`

-   The `mongoose.model()` method takes two arguments:
    
    1.  **The name of the model (as a string):** `"User"`
        
    2.  **The schema it should use:** `userSchema`
        

**Crucial Beginner Tip:** The instructor points out a key detail. When Mongoose creates this model in your MongoDB database, it will _not_ be named "User". MongoDB will name the collection **"users"** (plural and all lowercase). This is an automatic conversion and a common interview question.

User becomes users

Todo becomes todos

Product becomes products

----------

## Part 2: Building the `Todo` and `SubTodo` Models

Now we build the other two models, which will teach us about **relationships**.

### The `SubTodo` Model (`sub_todo.models.js`)

We'll start with the smallest piece. A sub-todo is just a task.

JavaScript

```
import mongoose from 'mongoose';

const subTodoSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    complete: {
      type: Boolean,
      default: false, // By default, a new task is not complete
    },
    createdBy: {
      // We need to link this to the user who created it!
      // This is a special type
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // This is the "User" from mongoose.model('User', ...)
    }
  },
  { timestamps: true }
);

export const SubTodo = mongoose.model('SubTodo', subTodoSchema);

```

**New Concepts Introduced Here:**

1.  `default: false`: This is another validation option. If the `complete` field is not provided when creating a new sub-todo, it will automatically be set to `false`.
    
2.  **Relationships (`type` and `ref`):** This is how you link two models together.
    
    -   `type: mongoose.Schema.Types.ObjectId`: This is a special data type. Instead of `String` or `Number`, we are telling Mongoose to store a unique ID...
        
    -   `ref: 'User'`: ...and that ID will be a **reference** to a document from the `'User'` model.
        

### The `Todo` Model (`todo.models.js`)

This is the main "category" box. It needs to hold its own content (like "Gym") AND references to the user who created it AND all the sub-todos inside it.

JavaScript

```
import mongoose from 'mongoose';

const todoSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    complete: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // This is the most complex part
    subTodos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubTodo',
      },
    ], // This will be an array of SubTodos
  },
  { timestamps: true }
);

export const Todo = mongoose.model('Todo', todoSchema);

```

**The Final New Concept: Array of Relationships**

Look closely at the subTodos field:

subTodos: [ ... ]

-   The square brackets `[]` tell Mongoose that `subTodos` will be an **array**.
    
-   The object `{ ... }` _inside_ the array tells Mongoose what _each item in the array_ will be.
    
-   In this case, each item in the array is an object with `type: mongoose.Schema.Types.ObjectId` and `ref: 'SubTodo'`.
    

This means the `subTodos` field will store an **array of ObjectIDs**, and each of those IDs will be a reference to a document in the `SubTodo` collection.

This is how you model a **one-to-many** relationship (one `Todo` has many `SubTodo`s).

----------

## Conclusion and What's Next

The instructor ends the video here, as it has been a very dense, one-hour lesson.

You have learned:

-   The **philosophy** of "data modeling first."
    
-   How to set up a basic **Mongoose schema**.
    
-   How to add **validations** (`required`, `unique`, `default`, `lowercase`).
    
-   How to automatically add **timestamps**.
    
-   How to create **relationships** between models using `ObjectId` and `ref`.
    
-   How to create an **array of relationships** to model one-to-many connections.
    

In the next video, he will continue this practice with two new examples: modeling an **e-commerce platform** and a **hospital management system** to give you even more practice.

# 06th Video


## Introduction: Why Data Modeling is Your Most Important Skill

The instructor (Hitesh) begins by emphasizing that **data modeling** is the most critical skill for a backend developer. Many beginners get stuck _after_ building a few things because they don't know how to structure a new, complex application.

The secret is to _first_ think about the **data points** you need to collect and store, even before you write any code.

This video builds on the previous lesson (where you modeled a Todo app) to make you more comfortable with Mongoose. The goal is to practice with two complex, real-world examples. By the end, you'll be able to look at any application idea and start planning its data structure.

This video is divided into two phases:

1.  **Phase 1:** Building the data models for an **E-commerce** website.
    
2.  **Phase 2:** Building the data models for a **Hospital Management System**.
    

----------

## Phase 1: E-commerce Data Modeling

First, the instructor creates a new folder named `ecommerce` to hold all the models for this project.

He explains that just like in a movie, you first need to identify your "characters." For an e-commerce site, the main characters (or **models**) are:

-   **User:** The person buying the products.
    
-   **Category:** The type of product (e.g., "Electronics," "Apparel").
    
-   **Product:** The item being sold.
    
-   **Order:** A record of a completed purchase.
    

He creates a file for each: `user.models.js`, `category.models.js`, `product.models.js`, and `order.models.js`.

### 1. The User Model (`user.models.js`)

This is a review of the previous lesson. A user needs basic credentials.

-   **Boilerplate:** He sets up the standard Mongoose boilerplate:
    
    1.  `import mongoose from 'mongoose'`
        
    2.  `const userSchema = new mongoose.Schema(...)`
        
    3.  `export const User = mongoose.model('User', userSchema)`
        
-   **Schema:** Inside the schema, he defines the fields:
    
    -   `username`: `type: String`, `required: true`, `unique: true`, `lowercase: true`
        
    -   `email`: `type: String`, `required: true`, `unique: true`, `lowercase: true`
        
    -   `password`: `type: String`, `required: true`
        
-   **Timestamps:** He adds the second object `{ timestamps: true }` to the schema to automatically get `createdAt` and `updatedAt` fields for every user.
    

### 2. The Category Model (`category.models.js`)

He explains that you should think about dependencies. A `Category` doesn't depend on any other model, so it's simple to create. A `Product`, however, _will depend_ on a `Category`, so we should create `Category` first.

-   **Boilerplate:** Standard setup for `categorySchema` and `Category` model.
    
-   **Schema:** This model is very simple. A category just needs a name.
    
    -   `name`: `type: String`, `required: true`
        
-   **Timestamps:** He also adds `{ timestamps: true }`.
    

### 3. The Product Model (`product.models.js`)

This model is more complex and introduces the concept of **relationships** (linking models together).

-   **Boilerplate:** Standard setup for `productSchema` and `Product` model.
    
-   **Schema Fields:**
    
    -   `name`: `type: String`, `required: true`
        
    -   `description`: `type: String`, `required: true`
        
    -   `productImage`: **(Key Concept!)**
        
        -   How do you store an image? You **do not** store the image file directly in the database. It's inefficient and makes the database huge and slow.
            
        -   **The Professional Way:** You upload the image to a third-party file storage service, like **Cloudinary** or AWS S3. That service gives you back a public URL (a string). You only store that **URL string** in your database.
            
        -   Therefore, the field is just: `type: String`, `required: true`
            
    -   `price`: `type: Number`, `required: true`, `default: 0`
        
    -   `stock`: `type: Number`, `default: 0`, `required: true`
        
    -   `category`: **(This is the relationship!)**
        
        -   This field will link the product to its category. We store the unique `_id` of the category.
            
        -   `type: mongoose.Schema.Types.ObjectId`
            
        -   `ref: 'Category'` (This tells Mongoose, "The `ObjectId` stored in this field belongs to a document in the 'Category' collection.")
            
    -   `owner`: (This is another relationship!)
        
        -   This field links the product to the user who created it (the seller).
            
        -   `type: mongoose.Schema.Types.ObjectId`
            
        -   `ref: 'User'`
            

### 4. The Order Model (`order.models.js`)

This is the most complex model in this section, as it introduces **nested schemas**.

-   **Boilerplate:** Standard setup for `orderSchema` and `Order` model.
    
-   **The Problem:** An order contains multiple products. A user might buy two shirts and one hat. We need to store:
    
    1.  _Which_ product was bought.
        
    2.  _How many_ (the quantity) of that product were bought.
        
-   We can't just create an array of `Product` references, because where would we store the `quantity`?
    
-   **The Solution: A "Mini-Schema" (or Sub-Schema)**
    
    -   Inside the _same file_, _before_ the `orderSchema`, he defines a _new, small schema_ that won't be exported as its own model.
        
    
    JavaScript
    
    ```
    const orderItemSchema = new mongoose.Schema({
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: {
        type: Number,
        required: true
      }
    });
    
    ```
    
    -   This small schema defines the structure for a _single item_ in an order.
        
-   **Schema Fields (for `orderSchema`):**
    
    -   `orderPrice`: `type: Number`, `required: true`
        
    -   `customer`: (Relationship to the user who placed the order)
        
        -   `type: mongoose.Schema.Types.ObjectId`,
            
        -   `ref: 'User'`
            
    -   `orderItems`: (Using the mini-schema!)
        
        -   `type: [orderItemSchema]`
            
        -   This tells Mongoose that `orderItems` will be an **array**, and _every object in that array must follow the structure of `orderItemSchema`_.
            
    -   `address`: `type: String`, `required: true`
        
    -   `status`: **(New Concept: Enum)**
        
        -   We want the status to be one of a few specific choices (e.g., "Pending", "Cancelled", "Delivered"). We don't want to allow any random string.
            
        -   `type: String`
            
        -   `enum: ["Pending", "Cancelled", "Delivered"]` (This array provides the only allowed values).
            
        -   `default: "Pending"` (Sets the default value for any new order).
            

----------

## Phase 2: Hospital Management System Modeling

This phase reinforces the concepts from Phase 1 with a new scenario. The instructor creates a new folder `hospital_management`.

The "characters" (models) for this system are:

-   `Doctor`
    
-   `Patient`
    
-   `Hospital`
    
-   `MedicalRecord`
    

He quickly sets up the boilerplate (import, schema, model, timestamps) for all four files.

### 1. The Patient Model (`patient.models.js`)

This is the "user" of this system.

-   **Schema Fields:**
    
    -   `name`: `type: String`, `required: true`
        
    -   `diagnosedWith`: `type: String`, `required: true`
        
    -   `address`: `type: String`, `required: true`
        
    -   `age`: `type: Number`, `required: true`
        
    -   `bloodGroup`: `type: String`, `required: true`
        
    -   `gender`: **(Enum)**
        
        -   `type: String`,
            
        -   `enum: ["M", "F", "Others"]`,
            
        -   `required: true`
            
    -   `admittedIn`: **(Relationship)**
        
        -   Links to the hospital where the patient is admitted.
            
        -   `type: mongoose.Schema.Types.ObjectId`,
            
        -   `ref: 'Hospital'`
            

### 2. The Doctor Model (`doctor.models.js`)

-   **Schema Fields:**
    
    -   `name`: `type: String`, `required: true`
        
    -   `salary`: `type: Number`, `required: true`
        
    -   `qualification`: `type: String`, `required: true`
        
    -   `experienceInYears`: `type: Number`, `default: 0`
        
    -   `worksInHospitals`: **(New Concept: Array of Relationships)**
        
        -   A doctor can work at _multiple_ hospitals. So, this field needs to be an **array of references**.
            
        -   `type: [{ ... }]` (The `[]` makes it an array).
            
        -   Inside the array, we define the reference object:
            
        -   `{ type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' }`
            
        -   _Insight:_ He also explains that if you needed to store _how many hours_ a doctor works at each hospital, you would use the "mini-schema" technique from the e-commerce `Order` model.
            

### 3. The Hospital Model (`hospital.models.js`)

-   **Schema Fields:**
    
    -   `name`: `type: String`, `required: true`
        
    -   `addressLine1`: `type: String`, `required: true`
        
    -   `addressLine2`: `type: String` (not required)
        
    -   `city`: `type: String`, `required: true`
        
    -   `pincode`: `type: String`, `required: true`
        
        -   **Key Insight:** Why `String` and not `Number`? He explains from experience that some international postal codes contain letters (e.g., in the UK or Canada). Using `String` is safer and more future-proof.
            
    -   `specializedIn`: **(New Concept: Array of Strings)**
        
        -   A hospital can have multiple specializations (e.g., "Cardiology," "Neurology"). This isn't a relationship; it's just a list of text.
            
        -   `type: [String]` (This is the shorthand for "an array of strings").
            

### 4. The Medical Record Model (`medical_record.models.js`)

-   The instructor sets up the boilerplate for this file but does not add any fields in this video. This model would likely link a `Patient` to one or more `Doctor`s and include details of the diagnosis and treatment.
    

## Conclusion

The instructor explains that after these detailed examples, you should feel much more confident in your ability to design a backend. You may not know how to build all the routes or controllers yet, but you now have the most important foundational skill: **you can plan the data model.**

He emphasizes that this is the real goal: giving you the **confidence** to look at any project and know exactly where to start.