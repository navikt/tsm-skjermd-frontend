import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css';

// Import dev mocks early when running in Vite dev mode
if ((import.meta as any).env.DEV) {
  import('./mocks/setupMocks');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)