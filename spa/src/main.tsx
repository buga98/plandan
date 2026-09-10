import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const storedTheme = document.documentElement.dataset.theme
if (!storedTheme) document.documentElement.style.colorScheme = 'light dark'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
