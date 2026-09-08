import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { persistTheme, readStoredTheme } from './lib/themes'
import './styles/app.css'

persistTheme(readStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
