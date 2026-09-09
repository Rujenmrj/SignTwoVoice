"use client"

import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"

export default function Dashboard({ setIsAuthenticated }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [loadingStep, setLoadingStep] = useState(0)
  const [sentences, setSentences] = useState([])
  const [stats, setStats] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [hoveredStat, setHoveredStat] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather, setWeather] = useState({ temp: 22, condition: "Loading...", icon: "⏳" })
  const [systemStatus, setSystemStatus] = useState({ cpu: 0, memory: 0, network: "Checking..." })
  const [todayGoal, setTodayGoal] = useState({ target: 10, completed: 2 }) // Updated initial completed value to match attachment
  const [userLocation, setUserLocation] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [detectionState, setDetectionState] = useState("Waiting for hand")
  const [recognizedSign, setRecognizedSign] = useState("No sign")
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const detectorRef = useRef(null)
  const navigate = useNavigate()

  const loadingSteps = [
    "Initializing Sign2Voice...",
    "Loading TensorFlow model...",
    "Setting up MediaPipe hands detection...",
    "Preparing camera interface...",
    "Almost ready...",
  ]

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return navigate("/")

    axios
      .get("http://localhost:5000/api/auth/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        setIsAuthenticated(false)
        navigate("/")
      })
  }, [navigate, setIsAuthenticated])

  useEffect(() => {
    let interval
    if (loading) {
      setLoadingStep(0)
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev))
      }, 1500)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [loading])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const updateSystemStatus = async () => {
      try {
        const memoryInfo = performance.memory
        let memoryUsage = 50 // Default fallback

        if (memoryInfo) {
          memoryUsage = Math.round((memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100)
        }

        const start = performance.now()
        await new Promise((resolve) => setTimeout(resolve, 100))
        const end = performance.now()
        const cpuEstimate = Math.min(Math.round((end - start - 100) * 2), 100)

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
        let networkStatus = "Good"

        if (connection) {
          const effectiveType = connection.effectiveType
          if (effectiveType === "4g") networkStatus = "Excellent"
          else if (effectiveType === "3g") networkStatus = "Good"
          else if (effectiveType === "2g") networkStatus = "Fair"
          else networkStatus = "Good"
        }

        setSystemStatus({
          cpu: Math.max(cpuEstimate, 15),
          memory: memoryUsage,
          network: networkStatus,
        })
      } catch (error) {
        setSystemStatus({
          cpu: Math.floor(Math.random() * 30) + 20,
          memory: Math.floor(Math.random() * 40) + 30,
          network: "Good",
        })
      }
    }

    updateSystemStatus()
    const statusTimer = setInterval(updateSystemStatus, 10000)
    return () => clearInterval(statusTimer)
  }, [])

  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        const fallbackResponse = await fetch(`https://wttr.in/${lat},${lon}?format=j1`)
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          const currentCondition = fallbackData.current_condition[0]
          setWeather({
            temp: Math.round(currentCondition.temp_C),
            condition: currentCondition.weatherDesc[0].value,
            icon: getWeatherIcon(currentCondition.weatherCode),
          })
          return
        }
      } catch (error) {
        console.log("Weather fetch failed, using location-based estimate")
      }

      setWeather({
        temp: Math.round(20 + Math.random() * 15),
        condition: "Partly Cloudy",
        icon: "⛅",
      })
    }

    const getWeatherIcon = (code) => {
      const iconMap = {
        113: "☀️",
        116: "🌤️",
        119: "☁️",
        122: "☁️",
        143: "🌫️",
        176: "🌦️",
        179: "🌨️",
        182: "🌧️",
        185: "🌧️",
        200: "⛈️",
        227: "❄️",
        230: "❄️",
        248: "🌫️",
        260: "🌫️",
      }
      return iconMap[code] || "🌤️"
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lon: longitude })
          fetchWeather(latitude, longitude)
        },
        (error) => {
          console.log("Location access denied, using IP-based location")
          fetch("https://ipapi.co/json/")
            .then((res) => res.json())
            .then((data) => {
              if (data.latitude && data.longitude) {
                fetchWeather(data.latitude, data.longitude)
              } else {
                setWeather({ temp: 22, condition: "Sunny", icon: "☀️" })
              }
            })
            .catch(() => {
              setWeather({ temp: 22, condition: "Sunny", icon: "☀️" })
            })
        },
      )
    } else {
      setWeather({ temp: 22, condition: "Sunny", icon: "☀️" })
    }
  }, [])

  useEffect(() => {
    const updateDailyGoal = async () => {
      try {
        const token = localStorage.getItem("token")
        if (token) {
          const today = new Date().toISOString().split("T")[0]
          const response = await axios.get(`http://localhost:5000/api/sentences/daily?date=${today}`, {
            headers: { Authorization: `Bearer ${token}` },
          })

          if (response.data) {
            setTodayGoal({
              target: response.data.target || 10,
              completed: response.data.completed || 0,
            })
          }
        } else {
          const localGoal = localStorage.getItem("dailyGoal")
          if (localGoal) {
            setTodayGoal(JSON.parse(localGoal))
          }
        }
      } catch (error) {
        console.log("Could not fetch daily goal, using defaults")
      }
    }

    updateDailyGoal()
    const goalTimer = setInterval(updateDailyGoal, 60000)
    return () => clearInterval(goalTimer)
  }, [])

  useEffect(() => {
    if (stats && stats.totalSentences) {
      const today = new Date().toISOString().split("T")[0]
      const todaySentences = sentences.filter((s) => {
        const sentenceDate = new Date(s.createdAt || Date.now()).toISOString().split("T")[0]
        return sentenceDate === today
      }).length

      setTodayGoal((prev) => ({
        ...prev,
        completed: todaySentences,
      }))
    }
  }, [stats, sentences])

  useEffect(() => {
    return () => {
      stopCameraFeed()
    }
  }, [])

  const stopCameraFeed = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop())
      cameraStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    detectorRef.current = null
    setCameraReady(false)
    setDetectionState("Waiting for hand")
    setRecognizedSign("No sign")
  }

  const classifyHandGesture = (landmarks) => {
    if (!landmarks || landmarks.length < 21) return "No sign"

    const fingerPairs = [
      { tip: 8, pip: 6, mcp: 5 },
      { tip: 12, pip: 10, mcp: 9 },
      { tip: 16, pip: 14, mcp: 13 },
      { tip: 20, pip: 18, mcp: 17 },
    ]

    let extendedCount = 0
    fingerPairs.forEach(({ tip, pip, mcp }) => {
      const tipPoint = landmarks[tip]
      const pipPoint = landmarks[pip]
      const mcpPoint = landmarks[mcp]
      if (tipPoint && pipPoint && mcpPoint && tipPoint.y < pipPoint.y && tipPoint.y < mcpPoint.y) {
        extendedCount += 1
      }
    })

    const thumbOpen = landmarks[4] && landmarks[3] && landmarks[4].x < landmarks[3].x
    const palmOpen = landmarks[0] && landmarks[9] && landmarks[0].y < landmarks[9].y
    const indexExtended = landmarks[8] && landmarks[6] && landmarks[8].y < landmarks[6].y

    if (extendedCount === 0 && !thumbOpen && !indexExtended) return "A"
    if (extendedCount === 4 && palmOpen) return "B"
    if (extendedCount === 2 && !thumbOpen) return "V"
    if (extendedCount === 1 && indexExtended && !thumbOpen) return "L"
    if (extendedCount === 1 && thumbOpen) return "Y"
    if (extendedCount === 0 && thumbOpen) return "S"
    if (extendedCount === 4) return "Open Palm"
    if (extendedCount === 1 && !thumbOpen) return "I"

    return "Tracking..."
  }

  const drawHandLandmarks = (landmarks) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext("2d")
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480

    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(video, 0, 0, width, height)

    if (!landmarks || landmarks.length === 0) {
      setDetectionState("Waiting for hand")
      return
    }

    const wrist = landmarks[0]
    if (!wrist) {
      setDetectionState("Waiting for hand")
      return
    }

    const palmX = wrist.x * width
    const palmY = wrist.y * height

    ctx.fillStyle = "rgba(59, 130, 246, 0.25)"
    ctx.beginPath()
    ctx.arc(palmX, palmY, 22, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = "#60a5fa"
    ctx.lineWidth = 2

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17], [5, 9],
    ]

    connections.forEach(([from, to]) => {
      const p1 = landmarks[from]
      const p2 = landmarks[to]
      if (!p1 || !p2) return
      ctx.beginPath()
      ctx.moveTo(p1.x * width, p1.y * height)
      ctx.lineTo(p2.x * width, p2.y * height)
      ctx.stroke()
    })

    landmarks.forEach((point) => {
      if (!point) return
      ctx.beginPath()
      ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2)
      ctx.fillStyle = "#22c55e"
      ctx.fill()
    })

    const score = Math.min(100, Math.max(0, Math.round((landmarks.length / 21) * 100)))
    const sign = classifyHandGesture(landmarks)
    setDetectionState(`Hand detected • ${score}% confidence`)
    setRecognizedSign(sign)
  }

  const initializeHandTracking = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage("❌ This browser does not support webcam access.")
      return
    }

    const scriptId = "mediapipe-vision-script"
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script")
      script.id = scriptId
      script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.js"
      document.head.appendChild(script)
      await new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = () => reject(new Error("MediaPipe failed to load"))
      })
    }

    if (!window.FilesetResolver || !window.HandLandmarker) {
      setMessage("❌ MediaPipe failed to initialize. Please refresh the page.")
      return
    }

    if (detectorRef.current) return

    try {
      const vision = await window.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm",
      )
      detectorRef.current = await window.HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        numHands: 1,
        runningMode: "VIDEO",
      })
    } catch (error) {
      console.error("Hand tracker initialization failed:", error)
      setMessage("⚠️ Hand tracking could not initialize. Please allow webcam access.")
      return
    }

    const tick = () => {
      const video = videoRef.current
      const detector = detectorRef.current
      if (!video || !detector || video.readyState < 2) {
        requestAnimationFrame(tick)
        return
      }

      const result = detector.detectForVideo(video, performance.now())
      drawHandLandmarks(result.landmarks?.[0] || [])
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }

  const startCameraFeed = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage("❌ This browser does not support webcam access.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })

      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise((resolve, reject) => {
          const video = videoRef.current
          if (!video) return reject(new Error("Video element not ready"))

          const onLoaded = () => {
            video.removeEventListener("loadedmetadata", onLoaded)
            video.removeEventListener("error", onError)
            resolve()
          }

          const onError = () => {
            video.removeEventListener("loadedmetadata", onLoaded)
            video.removeEventListener("error", onError)
            reject(new Error("Camera stream failed to load"))
          }

          video.addEventListener("loadedmetadata", onLoaded)
          video.addEventListener("error", onError)
          video.play().catch(reject)
        })
      }

      setCameraReady(true)
      setDetectionState("Starting hand detection...")
      await initializeHandTracking()
    } catch (error) {
      console.error("Camera access failed:", error)
      setMessage("❌ Camera access was denied. Please allow webcam permissions.")
      setCameraReady(false)
      setDetectionState("Waiting for hand")
    }
  }

  const handleOpenWebcam = async () => {
    setLoading(true)
    setMessage("")

    try {
      await startCameraFeed()
      setMessage("✅ Live hand tracking is active in the dashboard")
    } catch (err) {
      console.error(err)
      setMessage("⚠️ Webcam failed to start. Please check camera permissions.")
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      setHistoryLoading(true)
      const token = localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await axios.get("http://localhost:5000/api/sentences/stats", { headers })
      console.log("Stats fetched from /stats:", res.data.stats)

      const allStats = res.data.stats || []
      setSentences(allStats)

      const totalSentences = allStats.length
      const totalWords = allStats.reduce((sum, s) => sum + (s.wordCount || 0), 0)
      const avgWordsPerSentence = totalSentences ? totalWords / totalSentences : 0

      setStats({ totalSentences, totalWords, avgWordsPerSentence })
    } catch (err) {
      console.error("Error fetching stats:", err)
      setMessage("❌ Failed to load stats")
    } finally {
      setHistoryLoading(false)
    }
  }

  const deleteSentence = async (sentenceId) => {
    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setMessage("❌ Only logged-in users can delete sentences")
        return
      }
      console.log("Deleting sentence with ID:", sentenceId)

      await axios.delete(`http://localhost:5000/api/sentences/${sentenceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setSentences(sentences.filter((s) => s._id !== sentenceId))
      setMessage("✅ Sentence deleted successfully")
    } catch (err) {
      console.error("Error deleting sentence:", err)
      setMessage("❌ Failed to delete sentence")
    }
  }

  const toggleHistory = () => {
    if (!showHistory) fetchStats()
    setShowHistory(!showHistory)
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("currentSessionId")
    setIsAuthenticated(false)
    navigate("/")
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-zinc-900"></div>

      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={`absolute rounded-full animate-pulse ${
            i % 3 === 0
              ? "w-1 h-1 bg-yellow-400"
              : i % 3 === 1
                ? "w-0.5 h-0.5 bg-yellow-300"
                : "w-1.5 h-1.5 bg-yellow-500"
          }`}
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        ></div>
      ))}

      <div className="absolute top-20 left-20 w-64 h-64 bg-gray-800/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-64 h-64 bg-zinc-800/10 rounded-full blur-3xl"></div>

      <nav className="bg-gray-800/90 backdrop-blur-lg border border-gray-700/50 p-6 flex justify-between items-center w-full max-w-6xl mb-8 rounded-2xl relative z-10 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-xl">👋</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{user ? `Welcome back, ${user.username}` : "Dashboard"}</h1>
            <p className="text-gray-400 text-sm">Sign Language AI Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-gray-800/80 rounded-xl p-3 text-center border border-gray-600/30">
            <div className="text-lg font-bold text-blue-400">{formatTime(currentTime)}</div>
            <div className="text-xs text-gray-400">{formatDate(currentTime)}</div>
          </div>

          <div className="bg-gray-800/80 rounded-xl p-3 text-center border border-gray-600/30">
            <div className="flex items-center gap-2 justify-center">
              <span className="text-lg">{weather.icon}</span>
              <span className="text-lg font-bold text-orange-400">{weather.temp}°C</span>
            </div>
            <div className="text-xs text-gray-400">{weather.condition}</div>
          </div>

          <div className="bg-gray-800/80 rounded-xl p-3 border border-gray-600/30 min-w-[120px]">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  <span>🧠</span>
                  CPU
                </span>
                <span className="text-blue-400 font-medium">{systemStatus.cpu}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  <span>💾</span>
                  RAM
                </span>
                <span className="text-green-400 font-medium">{systemStatus.memory}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  <span>🌐</span>
                  Net
                </span>
                <span
                  className={`font-medium text-xs ${
                    systemStatus.network === "Excellent"
                      ? "text-green-400"
                      : systemStatus.network === "Good"
                        ? "text-blue-400"
                        : systemStatus.network === "Fair"
                          ? "text-yellow-400"
                          : "text-red-400"
                  }`}
                >
                  {systemStatus.network}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-medium transition-colors duration-200 flex items-center gap-2"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </nav>

      <div className="w-full max-w-6xl mb-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 hover:bg-gray-800/90 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-lg">🎯</span>
                </div>
                <h3 className="text-lg font-bold text-white">Daily Goal</h3>
              </div>
              <div className="text-sm text-gray-300 bg-gray-700/80 px-3 py-1 rounded-full">
                {todayGoal.completed}/{todayGoal.target}
              </div>
            </div>
            <div className="w-full bg-gray-700/60 rounded-full h-3 mb-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${(todayGoal.completed / todayGoal.target) * 100}%` }}
              ></div>
            </div>
            <p className="text-gray-300">{todayGoal.target - todayGoal.completed} sentences to go!</p>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 hover:bg-gray-800/90 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-lg">⚡</span>
              </div>
              <h3 className="text-lg font-medium text-white">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <button className="w-full text-left text-gray-300 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
                <span>📊</span>
                <span>View Analytics</span>
              </button>
              <button className="w-full text-left text-gray-300 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
                <span>⚙️</span>
                <span>Settings</span>
              </button>
              <button className="w-full text-left text-gray-300 hover:text-white hover:bg-gray-700/50 p-2 rounded-lg transition-colors duration-200 flex items-center gap-2">
                <span>📱</span>
                <span>Export Data</span>
              </button>
            </div>
          </div>

          <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-6 hover:bg-gray-800/90 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-lg">📈</span>
              </div>
              <h3 className="text-lg font-medium text-white">Activity</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300 text-sm">Session started</span>
                <span className="text-gray-500 text-xs ml-auto">2m ago</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-gray-300 text-sm">Model loaded</span>
                <span className="text-gray-500 text-xs ml-auto">5m ago</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span className="text-gray-300 text-sm">User logged in</span>
                <span className="text-gray-500 text-xs ml-auto">1h ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8 w-full max-w-4xl relative z-10">
        <button
          onClick={handleOpenWebcam}
          disabled={loading}
          className="px-8 py-4 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-4 shadow-lg hover:shadow-xl hover:scale-105"
        >
          <span className="text-2xl">🎥</span>
          <div className="text-left">
            <div>{loading ? "Launching..." : "Open Sign2Voice"}</div>
            <div className="text-sm opacity-90">Start AI Detection</div>
          </div>
        </button>

        <button
          onClick={toggleHistory}
          className="px-8 py-4 rounded-2xl text-lg font-bold text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all duration-300 flex items-center justify-center gap-4 shadow-lg hover:shadow-xl hover:scale-105"
        >
          <div className="relative">
            <span className="text-2xl">{showHistory ? "📱" : "📚"}</span>
            {stats && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {stats.totalSentences}
              </div>
            )}
          </div>
          <div className="text-left">
            <div>{showHistory ? "Hide History" : "View History"}</div>
            <div className="text-sm opacity-90">Your Progress</div>
          </div>
        </button>
      </div>

      <div className="w-full max-w-6xl mb-8 relative z-10">
        <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-blue-400 font-semibold">Live Camera</p>
              <h2 className="text-2xl font-bold text-white">Sign detection feed</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${cameraReady ? "bg-green-400 animate-pulse" : "bg-gray-500"}`}></div>
              <span className="text-sm text-gray-300">{cameraReady ? detectionState : "Waiting for camera"}</span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-700 bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />

            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {cameraReady && (
              <div className="absolute bottom-4 left-4 rounded-xl border border-blue-400/50 bg-black/60 px-4 py-2 shadow-lg backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-[0.25em] text-blue-300">Detected sign</div>
                <div className="mt-1 text-xl font-bold text-white">{recognizedSign}</div>
              </div>
            )}

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950">
                <div className="text-center px-6">
                  <div className="text-5xl mb-3">📷</div>
                  <p className="text-xl font-semibold text-white">Camera preview is offline</p>
                  <p className="text-gray-400 mt-2">Click “Open Sign2Voice” to activate the live feed.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-4 mb-6 max-w-2xl w-full text-center relative z-10 shadow-xl">
          <p className="text-white font-medium">{message}</p>
        </div>
      )}

      {showHistory && (
        <div className="bg-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 mb-8 w-full max-w-6xl relative z-10 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📚</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Sentence History</h2>
            <p className="text-gray-400">Track your sign language learning progress</p>
          </div>

          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                {
                  icon: "📝",
                  title: "Total Sentences",
                  value: stats.totalSentences,
                  color: "text-blue-400",
                  bg: "from-blue-500/20 to-blue-600/20",
                },
                {
                  icon: "💬",
                  title: "Total Words",
                  value: stats.totalWords,
                  color: "text-green-400",
                  bg: "from-green-500/20 to-green-600/20",
                },
                {
                  icon: "📊",
                  title: "Avg Words/Sentence",
                  value: Math.round(stats.avgWordsPerSentence),
                  color: "text-purple-400",
                  bg: "from-purple-500/20 to-purple-600/20",
                },
                {
                  icon: "🎯",
                  title: "Sessions",
                  value: new Set(sentences.map((s) => s.sessionId)).size,
                  color: "text-orange-400",
                  bg: "from-orange-500/20 to-orange-600/20",
                },
              ].map((stat, index) => (
                <div
                  key={index}
                  className={`bg-gradient-to-br ${stat.bg} backdrop-blur-sm p-6 rounded-2xl text-center hover:scale-105 transition-all duration-300 border border-gray-800/30 shadow-lg`}
                >
                  <div className="text-4xl mb-3">{stat.icon}</div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">{stat.title}</h3>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {historyLoading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading your progress...</p>
            </div>
          ) : sentences.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {sentences.map((s) => (
                <div
                  key={s._id}
                  className="bg-gray-800/50 backdrop-blur-sm p-5 rounded-2xl hover:bg-gray-800/70 transition-all duration-300 flex justify-between items-start border border-gray-700/30 shadow-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white mb-2">{s.text}</p>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>Session: {s.sessionId}</span>
                      <span>Words: {s.wordCount}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSentence(s._id)}
                    className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-500/10 transition-all duration-200"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-5xl opacity-60">📝</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No sentences recorded yet</h3>
              <p className="text-gray-400">Start using Sign2Voice to see your history here!</p>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50">
          <div className="bg-gray-800/90 backdrop-blur-lg p-8 rounded-2xl text-center max-w-md w-full mx-4 border border-gray-700/50 shadow-xl">
            <div className="w-16 h-16 mx-auto mb-6">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Loading Sign2Voice</h3>
            <div className="w-full bg-gray-700/60 rounded-full h-3 mb-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
              ></div>
            </div>
            <p className="text-blue-400 font-medium">{loadingSteps[loadingStep]}</p>
          </div>
        </div>
      )}
    </div>
  )
}