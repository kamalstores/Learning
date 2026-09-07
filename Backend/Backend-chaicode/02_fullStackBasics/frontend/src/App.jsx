import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import axios from 'axios' 

function App() {
  const [jokes, setJokes] = useState([])

  useEffect(()=>{
    axios.get('/api/jokes')
    .then(response => {
      setJokes(response.data)
    })
    .catch(error => {
      console.error('There was an error fetching the jokes!', error);
    });
  })

  return (
    <>
      <h1>Chai or backend</h1>
      <p> Jokes : {jokes.length}</p>
      {
        jokes.map((joke, index) => (
          <div key={index}>
            <h3>{joke.title}</h3>
            <p>{joke.content}</p>
          </div>
        ))
      }
    </>
  )
}

export default App
