import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.js'
import { installViewportTagger } from './viewport/index.js'
import './styles/globals.css'
import './styles/viewport-iphone.css'

installViewportTagger()

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}
