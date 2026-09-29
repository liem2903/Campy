import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { status: string }) => setStatus(data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main>
      <h1>Campi</h1>
      <p>API status: {status}</p>
    </main>
  )
}

export default App
