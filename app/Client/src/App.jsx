"use client"

// ============================================================================
// SECTION 1: IMPORTS & ROUTER DEPENDENCIES
// ============================================================================
// React Router components for client-side routing and navigation guards
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"

// Page components: Authentication, User Dashboard, and Admin management
import AuthPage from "./pages/AuthPage"
import Dashboard from "./pages/Dashboard"
import AdminLogin from "./pages/AdminLogin"
import AdminPanel from "./pages/AdminPanel" // ✅ import AdminPanel

// ============================================================================
// SECTION 2: ROOT APP COMPONENT & STATE INITIALIZATION
// ============================================================================
function App() {
  // Authentication status for end-users
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  // Loading state while verifying stored authentication token
  const [loading, setLoading] = useState(true)

  // ============================================================================
  // SECTION 3: SESSION VERIFICATION (LIFECYCLE EFFECT)
  // ============================================================================
  // Checks localStorage on initial load to restore existing user session
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) setIsAuthenticated(true)
    setLoading(false)
  }, [])

  // Retrieves admin authentication token to protect admin routes
  const adminToken = localStorage.getItem("adminToken") // ✅ admin token

  // ============================================================================
  // SECTION 4: INITIAL LOADING FALLBACK SCREEN
  // ============================================================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  // ============================================================================
  // SECTION 5: APPLICATION ROUTING & ACCESS CONTROL
  // ============================================================================
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* ------------------------------------------------------------------ */}
          {/* 5.1 User Routes (Public Auth & Protected Dashboard)                 */}
          {/* ------------------------------------------------------------------ */}
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage setIsAuthenticated={setIsAuthenticated} />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage setIsAuthenticated={setIsAuthenticated} />
            }
          />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <Dashboard setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/" />}
          />

          {/* ------------------------------------------------------------------ */}
          {/* 5.2 Admin Routes (Admin Login & Protected Admin Panel)              */}
          {/* ------------------------------------------------------------------ */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route
            path="/admin-panel"
            element={
              adminToken ? <AdminPanel /> : <Navigate to="/admin-login" />
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

// ============================================================================
// SECTION 6: MODULE EXPORT
// ============================================================================
export default App
