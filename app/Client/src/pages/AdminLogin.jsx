"use client";

// ============================================================================
// SECTION 1: IMPORTS & EXTERNAL DEPENDENCIES
// ============================================================================
// React hooks and HTTP client
import { useState } from "react";
import axios from "axios";

// UI primitives and layout components
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Animation & Icon utilities
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ============================================================================
// SECTION 2: API BASE CONFIGURATION
// ============================================================================
const API_BASE = "http://localhost:5000/api/admin"; // Admin routes

// ============================================================================
// SECTION 3: COMPONENT DEFINITION & STATE INITIALIZATION
// ============================================================================
export default function AdminLogin() {
  // Form input values for admin credentials
  const [formData, setFormData] = useState({ email: "", password: "" });
  // Password visibility toggle flag
  const [showPassword, setShowPassword] = useState(false);
  // Async submission loading state
  const [loading, setLoading] = useState(false);
  // Error message for invalid authentication attempts
  const [error, setError] = useState("");
  // Navigation hook to redirect upon successful login
  const navigate = useNavigate();

  // ============================================================================
  // SECTION 4: FORM INPUT HANDLER
  // ============================================================================
  // Synchronizes controlled inputs with formData state and clears active errors
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  // ============================================================================
  // SECTION 5: ADMIN AUTHENTICATION SUBMIT HANDLER
  // ============================================================================
  // Submits admin credentials to server, stores admin token and navigates to panel
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API_BASE}/login`, formData);

      localStorage.setItem("adminToken", response.data.token);
      localStorage.setItem("admin", JSON.stringify(response.data.admin));

      navigate("/admin-panel");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SECTION 6: UI RENDER (CARD, FORM INPUTS, SUBMIT BUTTON & ERROR BANNER)
  // ============================================================================
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      {/* Admin Login Container Card */}
      <Card className="w-full max-w-md bg-gray-800 shadow-xl border border-gray-700 rounded-2xl overflow-hidden">
        {/* Card Header & Title */}
        <CardHeader className="bg-gray-700 text-white text-center py-8">
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <p className="text-gray-300 mt-2">Sign in with your admin credentials</p>
        </CardHeader>

        {/* Card Body & Form */}
        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input Field */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <Input
                type="email"
                name="email"
                placeholder="Enter admin email"
                value={formData.email}
                onChange={handleChange}
                required
                className="h-12 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400 focus:ring-blue-400"
              />
            </div>

            {/* Password Input Field with Visibility Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-12 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-400 focus:ring-blue-400 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Animated Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-lg text-center text-sm font-medium bg-red-900/50 text-red-300 border border-red-800"
            >
              {error}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
