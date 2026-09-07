// main difference between commonjs and es6 modules

import express from 'express'

const app = express()

app.get('/', (req, res) => {
    res.send('Server is Ready')
})

app.get('/api/jokes', (req,res) => {
    const jokes = [
        {
            id:1,
            title: "Why don't scientists trust atoms?",
            content: "Because they make up everything!"
        },
        {
            id:2,
            title: "Why did the math book look sad?",
            content: "Because it had too many problems."        
        },
        {
            id:3,
            title: "Why did the scarecrow win an award?",
            content: "Because he was outstanding in his field!"
        },
        {   
            id:4,
            title: "Why don't skeletons fight each other?",
            content: "They don't have the guts."
        },
        {
            id:5,
            title: "What do you call fake spaghetti?",
            content: "An impasta!"
        }
    ]
    res.send(jokes)
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log('Server is running on http://localhost:' + PORT)
})

