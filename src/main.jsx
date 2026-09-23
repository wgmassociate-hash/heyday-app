import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { loadAdSenseScript } from './utils/adsense.js'
import { loadGoogleAnalytics } from './utils/analytics.js'

loadAdSenseScript()
loadGoogleAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
