"use client"

// ============================================================================
// SECTION 1: IMPORTS & DEPENDENCIES
// ============================================================================
import { useState } from "react"
import { Link } from "react-router-dom"
import axios from "axios"

// ============================================================================
// SECTION 2: API CONFIGURATION
// ============================================================================
const API_BASE = "http://localhost:5000/api"

// ============================================================================
// SECTION 3: COMPONENT DEFINITION & FORM STATE
// ============================================================================
export default function Login({ setIsAuthenticated }) {
  // Controlled form state for user credentials
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  // Request loading state
  const [loading, setLoading] = useState(false)
  // Form error notification
  const [error, setError] = useState("")

  // ============================================================================
  // SECTION 4: FORM INPUT CHANGE HANDLER
  // ============================================================================
  // Updates local form data on keystrokes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  // ============================================================================
  // SECTION 5: AUTHENTICATION FORM SUBMIT HANDLER
  // ============================================================================
  // Submits credentials to login endpoint, saves token & user data, updates auth state
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await axios.post(`${API_BASE}/auth/login`, formData)

      localStorage.setItem("token", response.data.token)
      localStorage.setItem("user", JSON.stringify(response.data.user))

      setIsAuthenticated(true)
    } catch (err) {
      setError(err.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // SECTION 6: UI RENDER (CARD CONTAINER, BRANDING, FORM INPUTS & LINKS)
  // ============================================================================
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Branding & Subtitle */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to Sign2Voice</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Transform sign language into voice with AI</p>
        </div>

        {/* Login Credentials Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Error Message Alert */}
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          {/* Registration Redirect Link */}
          <div className="text-center">
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Don't have an account? Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
