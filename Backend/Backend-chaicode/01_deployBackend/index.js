console.log("Chai aur code");

require('dotenv').config()
const express = require('express')
const app = express()
const port = 3000

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// })

app.get('/kamal', (req,res) => {
    console.log("Kamal Sharma");
    res.send('Hello Kamal Sharma!')
})

app.get('/sharma', (req,res)=>{
    res.send('<h1>This is Kamal Sharma</h1>')
})

const githubProfile = {
  "login": "kamalstores",
  "id": 173465351,
  "node_id": "U_kgDOClbfBw",
  "avatar_url": "https://avatars.githubusercontent.com/u/173465351?v=4",
  "gravatar_id": "",
  "url": "https://api.github.com/users/kamalstores",
  "html_url": "https://github.com/kamalstores",
  "followers_url": "https://api.github.com/users/kamalstores/followers",
  "following_url": "https://api.github.com/users/kamalstores/following{/other_user}",
  "gists_url": "https://api.github.com/users/kamalstores/gists{/gist_id}",
  "starred_url": "https://api.github.com/users/kamalstores/starred{/owner}{/repo}",
  "subscriptions_url": "https://api.github.com/users/kamalstores/subscriptions",
  "organizations_url": "https://api.github.com/users/kamalstores/orgs",
  "repos_url": "https://api.github.com/users/kamalstores/repos",
  "events_url": "https://api.github.com/users/kamalstores/events{/privacy}",
  "received_events_url": "https://api.github.com/users/kamalstores/received_events",
  "type": "User",
  "user_view_type": "public",
  "site_admin": false,
  "name": "Kamal Sharma",
  "company": null,
  "blog": "",
  "location": null,
  "email": null,
  "hireable": true,
  "bio": null,
  "twitter_username": null,
  "public_repos": 8,
  "public_gists": 0,
  "followers": 0,
  "following": 0,
  "created_at": "2024-06-21T11:49:36Z",
  "updated_at": "2025-09-30T05:53:07Z"
}

app.get('/github', (req,res) => {
  res.json(githubProfile)
})

app.get('/about', (req, res) => {
  res.send('This is about page')
})

app.listen(process.env.PORT, () => {
  console.log(`Example app listening on port ${process.env.PORT}`)
})
 