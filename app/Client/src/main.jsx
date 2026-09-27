// ============================================================================
// SECTION 1: REACT & ROOT DEPENDENCIES
// ============================================================================
// Core React libraries and root mounting utilities
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router-dom"

// ============================================================================
// SECTION 2: APPLICATION COMPONENT & GLOBAL STYLES
// ============================================================================
// Root Application component and Tailwind/global CSS styles
import App from './App.jsx'
import './index.css'

// ============================================================================
// SECTION 3: DOM MOUNTING & ROOT RENDER
// ============================================================================
// Initializes React application and mounts it onto the DOM root element
createRoot(document.getElementById('root')).render(
  <StrictMode>

      <App />

  </StrictMode>,
)
