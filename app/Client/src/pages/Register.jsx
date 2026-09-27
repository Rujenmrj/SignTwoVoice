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
export default function Register({ setIsAuthenticated }) {
  // Controlled form state for user registration
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
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
  // SECTION 5: PASSWORD VALIDATION LOGIC
  // ============================================================================
  // Ensures password has >= 8 chars, uppercase, lowercase, number, and special char
  const validatePassword = (password) => {
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/
    return regex.test(password)
  }

  // ============================================================================
  // SECTION 6: REGISTRATION SUBMIT HANDLER
  // ============================================================================
  // Validates matching passwords & complexity, posts new user to backend, and authenticates
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Check confirm password
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    // Check password strength
    if (!validatePassword(formData.password)) {
      setError(
        "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character"
      )
      setLoading(false)
      return
    }

    try {
      const response = await axios.post(`${API_BASE}/auth/register`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })

      localStorage.setItem("token", response.data.token)
      localStorage.setItem("user", JSON.stringify(response.data.user))

      setIsAuthenticated(true)
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // SECTION 7: UI RENDER (CARD CONTAINER, HEADER, INPUTS & ACTIONS)
  // ============================================================================
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header & Subtitle */}
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your Sign2Voice account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join the future of sign language communication
          </p>
        </div>

        {/* Registration Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Username Input */}
            <div>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
              />
            </div>
            {/* Email Input */}
            <div>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            {/* Password Input */}
            <div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            {/* Confirm Password Input */}
            <div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Error Message Alert */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>

          {/* Navigation to Login */}
          <div className="text-center">
            <Link
              to="/"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
