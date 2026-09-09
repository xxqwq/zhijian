import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { persistTheme, readStoredTheme } from './lib/themes'
import './styles/app.css'

persistTheme(readStoredTheme())

function syncFrameSize(): void {
  const root = document.documentElement
  root.style.setProperty('--frame-w', `${window.innerWidth}px`)
  root.style.setProperty('--frame-h', `${window.innerHeight}px`)
}

syncFrameSize()
window.addEventListener('resize', syncFrameSize)
window.visualViewport?.addEventListener('resize', syncFrameSize)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
