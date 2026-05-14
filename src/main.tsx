import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans/latin-400.css'
import '@fontsource/noto-sans/latin-500.css'
import '@fontsource/noto-sans/latin-600.css'
import '@fontsource/noto-sans/latin-700.css'
import '@fontsource/noto-sans/latin-800.css'
import '@fontsource/noto-sans/latin-900.css'
import './index.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
