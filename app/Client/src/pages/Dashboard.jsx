"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import {
  Volume2,
  VolumeX,
  Trash2,
  Delete,
  Sparkles,
  Save,
  Copy,
  Check,
  BookOpen,
  Camera,
  CameraOff,
  CornerDownLeft,
  X,
  Zap,
} from "lucide-react"

export default function Dashboard({ setIsAuthenticated }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [loadingStep, setLoadingStep] = useState(0)
  const [sentences, setSentences] = useState([])
  const [stats, setStats] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [weather, setWeather] = useState({ temp: 22, condition: "Loading...", icon: "⏳" })
  const [systemStatus, setSystemStatus] = useState({ cpu: 0, memory: 0, network: "Checking..." })
  const [todayGoal, setTodayGoal] = useState({ target: 10, completed: 2 })

  // Camera & Detection state
  const [cameraActive, setCameraActive] = useState(false)
  const [streamUrl, setStreamUrl] = useState("")
  const [detectionState, setDetectionState] = useState("Waiting for camera")
  const [detectedLetter, setDetectedLetter] = useState("")
  const [detectedConfidence, setDetectedConfidence] = useState(0)
  const [voteProgress, setVoteProgress] = useState(0)
  const [handDetected, setHandDetected] = useState(false)
  const [fps, setFps] = useState(30)
  const [mirrorView, setMirrorView] = useState(false)
  const [speedPreset, setSpeedPreset] = useState("balanced")

  // Sentence & Suggestion state
  const [sentence, setSentence] = useState("")
  const [suggestions, setSuggestions] = useState(["HELLO", "THANK", "YOU", "PLEASE"])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAslGuide, setShowAslGuide] = useState(false)
  const [savingSentence, setSavingSentence] = useState(false)

  const sseRef = useRef(null)
  const pollingRef = useRef(null)
  const sentenceEndSpokenRef = useRef("")
  const navigate = useNavigate()

  const loadingSteps = [
    "Initializing Sign2Voice AI...",
    "Loading CNN Landmark Classification Model...",
    "Setting up MediaPipe Hand Landmark Tracking...",
    "Starting Video Stream & Suggestion Engine...",
    "Ready to sign!",
  ]

  // ASL Alphabet data for cheat sheet
  const aslAlphabet = [
    { letter: "A", desc: "Fist with thumb resting on side" },
    { letter: "B", desc: "Open palm with 4 fingers up, thumb folded" },
    { letter: "C", desc: "Curved hand forming a 'C' shape" },
    { letter: "D", desc: "Index finger pointing up, others touching thumb" },
    { letter: "E", desc: "All fingers curled down to thumb" },
    { letter: "F", desc: "Index and thumb touching, 3 fingers up" },
    { letter: "G", desc: "Index and thumb pointing sideways parallel" },
    { letter: "H", desc: "Index and middle fingers pointing sideways" },
    { letter: "I", desc: "Pinky finger pointing straight up" },
    { letter: "J", desc: "Pinky draws a 'J' in the air" },
    { letter: "K", desc: "Index up, middle forward, thumb in middle" },
    { letter: "L", desc: "Index and thumb form an 'L' shape" },
    { letter: "M", desc: "Three fingers over folded thumb" },
    { letter: "N", desc: "Two fingers over folded thumb" },
    { letter: "O", desc: "Fingers curved touching thumb ('O' circle)" },
    { letter: "P", desc: "Downwards pointing 'K' shape" },
    { letter: "Q", desc: "Downwards pointing 'G' shape" },
    { letter: "R", desc: "Index and middle fingers crossed" },
    { letter: "S", desc: "Fist with thumb wrapped across front" },
    { letter: "T", desc: "Thumb between index and middle fingers" },
    { letter: "U", desc: "Index and middle fingers held together upright" },
    { letter: "V", desc: "Index and middle fingers spread in 'V' (peace)" },
    { letter: "W", desc: "Index, middle, and ring fingers spread up" },
    { letter: "X", desc: "Index finger bent like a hook" },
    { letter: "Y", desc: "Thumb and pinky extended (hang loose)" },
    { letter: "Z", desc: "Index finger traces a 'Z' in the air" },
    { letter: "space", desc: "Open palm or special gesture for Space" },
    { letter: "del", desc: "Special gesture to Backspace/Delete" },
  ]

  // Authentication check
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

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Weather & stats initialization
  useEffect(() => {
    fetchStats()
  }, [])

  // Loading animation step timer
  useEffect(() => {
    let interval
    if (loading) {
      setLoadingStep(0)
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev))
      }, 1200)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [loading])

  // Speech function using Web Speech API + backend fallback
  const speakText = useCallback((text) => {
    if (!text || !text.trim()) return
    const clean = text.trim()
    setIsSpeaking(true)

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utterance)
    } else {
      // Fallback to backend pyttsx3
      axios
        .post("http://localhost:5000/api/camera/speak", { text: clean })
        .finally(() => setIsSpeaking(false))
    }
  }, [])

  // Action dispatcher to AI engine (handles clear, backspace, space, suggestion, etc.)
  const dispatchAction = useCallback(async (action, payload = {}) => {
    try {
      // Try direct engine on 5001 first, fallback to Express proxy on 5000
      let res
      try {
        res = await axios.post("http://localhost:5001/action", { action, ...payload }, { timeout: 2000 })
      } catch (e) {
        res = await axios.post("http://localhost:5000/api/camera/action", { action, ...payload })
      }

      if (res && res.data) {
        setSentence(res.data.sentence || "")
        if (res.data.suggestions && res.data.suggestions.length > 0) {
          setSuggestions(res.data.suggestions)
        }
      }
    } catch (err) {
      console.error("Failed to dispatch action:", err)
    }
  }, [])

  // State synchronization via SSE and polling
  useEffect(() => {
    if (!cameraActive) {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    // Try Server-Sent Events (SSE)
    try {
      const sse = new EventSource("http://localhost:5001/events")
      sseRef.current = sse

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data) {
            setSentence(data.sentence || "")
            if (data.suggestions && data.suggestions.length > 0) {
              setSuggestions(data.suggestions)
            }
            setDetectedLetter(data.letter || "")
            setDetectedConfidence(Math.round((data.confidence || 0) * 100))
            setVoteProgress(Math.round((data.vote_progress || 0) * 100))
            setHandDetected(Boolean(data.hand_detected))
            if (data.fps) setFps(data.fps)
            setDetectionState(
              data.hand_detected
                ? `Hand detected • ${Math.round((data.confidence || 0) * 100)}% confidence`
                : "Waiting for hand...",
            )
          }
        } catch (e) {
          console.error("SSE parse error", e)
        }
      }

      sse.onerror = () => {
        // Fallback to polling every 250ms if SSE has an issue
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            try {
              const res = await axios.get("http://localhost:5001/state", { timeout: 1500 })
              const data = res.data
              if (data) {
                setSentence(data.sentence || "")
                if (data.suggestions && data.suggestions.length > 0) {
                  setSuggestions(data.suggestions)
                }
                setDetectedLetter(data.letter || "")
                setDetectedConfidence(Math.round((data.confidence || 0) * 100))
                setVoteProgress(Math.round((data.vote_progress || 0) * 100))
                setHandDetected(Boolean(data.hand_detected))
                if (data.fps) setFps(data.fps)
              }
            } catch (pollErr) {
              // Ignore transient poll drops
            }
          }, 250)
        }
      }
    } catch (e) {
      console.error("Could not initialize SSE", e)
    }

    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [cameraActive])

  // Auto-speak on completed words if enabled
  useEffect(() => {
    if (autoSpeak && sentence.endsWith(" ") && sentence.trim() !== sentenceEndSpokenRef.current) {
      const words = sentence.trim().split(/\s+/)
      const lastWord = words[words.length - 1]
      if (lastWord) {
        sentenceEndSpokenRef.current = sentence.trim()
        speakText(lastWord)
      }
    }
  }, [autoSpeak, sentence, speakText])

  // Keyboard controls (S=speak, C=clear, Space=space, Backspace=delete, 1-4=suggestion)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is focused inside an input/textarea
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return

      const key = e.key.toLowerCase()

      if (key === "s") {
        e.preventDefault()
        speakText(sentence)
      } else if (key === "c") {
        e.preventDefault()
        dispatchAction("clear")
      } else if (e.key === "Backspace") {
        e.preventDefault()
        dispatchAction("backspace")
      } else if (e.key === " ") {
        e.preventDefault()
        dispatchAction("space")
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        const index = parseInt(e.key) - 1
        if (suggestions[index]) {
          e.preventDefault()
          handleSelectSuggestion(suggestions[index])
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [sentence, suggestions, speakText, dispatchAction])

  // Start webcam stream
  const handleStartWebcam = async () => {
    if (loading || cameraActive) return
    setLoading(true)
    setMessage("")

    try {
      const res = await axios.post("http://localhost:5000/api/camera/start-webcam")
      if (res.data && res.data.success) {
        setStreamUrl(`http://localhost:5001/stream?ts=${Date.now()}`)
        setCameraActive(true)
        setMessage("✅ Sign2Voice AI Engine is active!")
      } else {
        throw new Error(res.data?.message || "Failed to start camera")
      }
    } catch (err) {
      console.error("Camera start failed:", err)
      setMessage("❌ Could not start the Python AI webcam. Please check your camera permissions.")
    } finally {
      setLoading(false)
    }
  }

  // Stop webcam stream
  const handleStopWebcam = async () => {
    try {
      await axios.post("http://localhost:5000/api/camera/stop-webcam")
    } catch (e) {
      console.error("Error stopping webcam:", e)
    } finally {
      setCameraActive(false)
      setStreamUrl("")
      setDetectedLetter("")
      setDetectedConfidence(0)
      setVoteProgress(0)
      setDetectionState("Camera stopped")
      setMessage("Webcam stopped")
    }
  }

  // Selecting a word suggestion
  const handleSelectSuggestion = (word) => {
    dispatchAction("select_suggestion", { word })
    if (autoSpeak) {
      speakText(word)
    }
  }

  // Speed sensitivity presets
  const handleSetPreset = (preset) => {
    setSpeedPreset(preset)
    dispatchAction("set_sensitivity", { preset })
    setMessage(`⚡ Recognition mode: ${preset.toUpperCase()}`)
  }

  // Save current sentence to MongoDB
  const handleSaveSentence = async () => {
    if (!sentence || !sentence.trim()) {
      setMessage("⚠️ Please sign or type a sentence before saving.")
      return
    }

    const token = localStorage.getItem("token")
    if (!token) return

    setSavingSentence(true)
    try {
      const res = await axios.post(
        "http://localhost:5000/api/sentences/save",
        { text: sentence.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (res.status === 201) {
        setMessage("✅ Sentence saved to your history!")
        fetchStats()
        // Increment daily goal completed
        setTodayGoal((prev) => ({
          ...prev,
          completed: Math.min(prev.target, prev.completed + 1),
        }))
      }
    } catch (err) {
      console.error("Failed to save sentence:", err)
      setMessage("❌ Error saving sentence to database")
    } finally {
      setSavingSentence(false)
    }
  }

  // Copy sentence to clipboard
  const handleCopySentence = () => {
    if (!sentence) return
    navigator.clipboard.writeText(sentence)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Fetch stats and sentences from MongoDB
  const fetchStats = async () => {
    try {
      setHistoryLoading(true)
      const token = localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await axios.get("http://localhost:5000/api/sentences/stats", { headers })
      const allStats = res.data.stats || []
      setSentences(allStats)

      const totalSentences = allStats.length
      const totalWords = allStats.reduce((sum, s) => sum + (s.wordCount || 0), 0)
      const avgWordsPerSentence = totalSentences ? totalWords / totalSentences : 0

      setStats({ totalSentences, totalWords, avgWordsPerSentence })

      // Update today's goal
      const today = new Date().toISOString().split("T")[0]
      const todayCount = allStats.filter((s) => {
        const sentenceDate = new Date(s.createdAt || Date.now()).toISOString().split("T")[0]
        return sentenceDate === today
      }).length

      setTodayGoal((prev) => ({ ...prev, completed: todayCount }))
    } catch (err) {
      console.error("Error fetching stats:", err)
    } finally {
      setHistoryLoading(false)
    }
  }

  // Delete sentence
  const deleteSentence = async (sentenceId) => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      await axios.delete(`http://localhost:5000/api/sentences/${sentenceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setSentences((prev) => prev.filter((s) => s._id !== sentenceId))
      setMessage("✅ Sentence removed")
      fetchStats()
    } catch (err) {
      console.error("Error deleting sentence:", err)
    }
  }

  const handleLogout = () => {
    if (cameraActive) {
      handleStopWebcam()
    }
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setIsAuthenticated(false)
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col items-center justify-start p-4 sm:p-6 relative overflow-x-hidden">
      {/* Background aesthetic glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-zinc-900 pointer-events-none"></div>
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Navbar */}
      <header className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/80 p-4 sm:p-5 flex flex-wrap justify-between items-center w-full max-w-6xl mb-6 rounded-2xl relative z-10 shadow-2xl gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-2xl">👋</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Sign2Voice <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">AI Live</span>
            </h1>
            <p className="text-gray-400 text-xs">
              {user ? `Logged in as ${user.username}` : "ASL to Speech Platform"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* ASL Reference Guide Button */}
          <button
            onClick={() => setShowAslGuide(true)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3.5 py-2 rounded-xl text-sm font-medium border border-gray-700/60 flex items-center gap-2 transition-all shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span>ASL Chart</span>
          </button>

          {/* Clock */}
          <div className="hidden sm:flex flex-col items-center bg-gray-800/60 rounded-xl px-3 py-1.5 border border-gray-700/40 text-xs">
            <span className="font-bold text-blue-400">
              {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-gray-500 text-[10px]">
              {currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="bg-red-600/90 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Translation Workspace */}
      <main className="w-full max-w-6xl relative z-10 space-y-6">
        {/* Banner Notification Message */}
        {message && (
          <div className="bg-gray-900/90 border border-blue-500/30 rounded-xl p-3 text-center text-sm font-medium text-blue-300 shadow-lg flex items-center justify-between px-6">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="text-gray-400 hover:text-white ml-3">
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Video Stream Box (7 columns) */}
          <div className="lg:col-span-7 bg-gray-900/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${cameraActive ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}></div>
                <h2 className="text-lg font-bold text-white">Live ASL Camera</h2>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
                  {cameraActive ? "MediaPipe + CNN" : "Offline"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {cameraActive && (
                  <button
                    onClick={() => setMirrorView(!mirrorView)}
                    title="Toggle mirror (selfie) view"
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      mirrorView
                        ? "bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-sm"
                        : "bg-gray-800 text-gray-400 border-gray-700 hover:text-white"
                    }`}
                  >
                    🪞 {mirrorView ? "Mirrored" : "Normal"}
                  </button>
                )}

                {cameraActive ? (
                  <button
                    onClick={handleStopWebcam}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    Stop Camera
                  </button>
                ) : (
                  <button
                    onClick={handleStartWebcam}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {loading ? "Starting..." : "Start Camera"}
                  </button>
                )}
              </div>
            </div>

            {/* Video Container */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-black aspect-video flex items-center justify-center shadow-inner">
              {cameraActive && streamUrl ? (
                <img
                  key={streamUrl}
                  src={streamUrl}
                  alt="Sign2Voice live feed"
                  className={`w-full h-full object-cover transition-transform duration-200 ${
                    mirrorView ? "-scale-x-100" : ""
                  }`}
                  onError={() => {
                    setMessage("⚠️ Camera stream interrupted. Retrying...")
                  }}
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-gray-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
                    <Camera className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Webcam Feed is Offline</h3>
                  <p className="text-sm text-gray-400 max-w-sm mb-4">
                    Click "Start Camera" to activate real-time American Sign Language detection.
                  </p>
                  <button
                    onClick={handleStartWebcam}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20"
                  >
                    {loading ? "Launching AI Engine..." : "Activate Sign2Voice"}
                  </button>
                </div>
              )}

              {/* HUD Overlay inside video */}
              {cameraActive && (
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end pointer-events-none">
                  {/* Status chip */}
                  <div className="bg-black/75 backdrop-blur-md border border-gray-700/60 px-3 py-1.5 rounded-xl text-xs text-gray-300 shadow-lg">
                    {detectionState}
                  </div>

                  {/* Keyboard hint */}
                  <div className="bg-black/75 backdrop-blur-md border border-gray-700/60 px-2.5 py-1 rounded-lg text-[11px] text-gray-400 shadow-lg hidden sm:block">
                    Press <span className="text-blue-400 font-bold">S</span> to speak • <span className="text-red-400 font-bold">C</span> to clear
                  </div>
                </div>
              )}
            </div>

            {/* Bottom info bar with FPS and Speed Presets */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 pt-2 border-t border-gray-800/50">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-white font-semibold">{fps} FPS</span> • 1.5ms Inference
              </span>

              <div className="flex items-center gap-1 bg-gray-800/80 p-1 rounded-xl border border-gray-700/60">
                <span className="text-[10px] text-gray-400 px-1.5">Speed:</span>
                {[
                  { id: "fast", label: "Fast", desc: "Quickest" },
                  { id: "balanced", label: "Balanced", desc: "Default" },
                  { id: "strict", label: "Strict", desc: "Steadiest" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSetPreset(item.id)}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      speedPreset === item.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Sign Recognition & Sentence Workspace (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Live Sign Detector HUD Card */}
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-bold tracking-wider text-blue-400">Current Gesture</span>
                <span className="text-xs text-gray-400">
                  {detectedLetter ? `${detectedConfidence}% confidence` : "No hand"}
                </span>
              </div>

              <div className="flex items-center gap-5">
                {/* Big glowing letter badge */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border-2 border-blue-500/40 flex items-center justify-center shadow-lg shadow-blue-500/10">
                  <span className="text-4xl font-extrabold text-white tracking-wide">
                    {detectedLetter || "—"}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Vote Buffer Stability</span>
                    <span className="font-semibold text-blue-400">{voteProgress}%</span>
                  </div>
                  {/* Buffer vote progress bar */}
                  <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-700/50">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-150"
                      style={{ width: `${voteProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {voteProgress >= 100
                      ? "Letter added to sentence!"
                      : "Hold sign steadily to commit letter"}
                  </p>
                </div>
              </div>
            </div>

            {/* Smart Word Suggestions Card */}
            <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-5 shadow-2xl flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Smart Word Suggestions</h3>
                  </div>
                  <span className="text-[11px] text-gray-400">Click to complete</span>
                </div>

                {/* Suggestions pill list */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {suggestions && suggestions.length > 0 ? (
                    suggestions.map((word, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggestion(word)}
                        className="group bg-gradient-to-r from-gray-800 to-gray-800/90 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold px-3.5 py-2 rounded-xl text-xs border border-gray-700/70 hover:border-blue-400 flex items-center gap-2 transition-all shadow-md hover:scale-105 active:scale-95"
                      >
                        <span className="w-4 h-4 rounded-full bg-gray-700 group-hover:bg-blue-700 text-[10px] flex items-center justify-center text-gray-300 group-hover:text-white">
                          {idx + 1}
                        </span>
                        <span>{word}</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500 italic">No suggestions yet</span>
                  )}
                </div>
              </div>

              {/* Auto speak toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-800/60">
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  {autoSpeak ? <Volume2 className="w-3.5 h-3.5 text-green-400" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
                  Auto-pronounce finished words
                </span>
                <button
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors ${autoSpeak ? "bg-green-500" : "bg-gray-700"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${autoSpeak ? "translate-x-5" : "translate-x-0"}`}
                  ></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width Sentence Translation & Controls Bar */}
        <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-blue-400">Translated Sentence</span>
              <span className="text-xs text-gray-500">
                ({sentence.trim().split(/\s+/).filter(Boolean).length} words • {sentence.length} chars)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySentence}
                disabled={!sentence}
                className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-1.5 transition-all disabled:opacity-40"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Active Sentence Input Box */}
          <div className="relative">
            <textarea
              value={sentence}
              onChange={(e) => dispatchAction("set_sentence", { sentence: e.target.value })}
              placeholder="Sign gestures will appear here as words... (or click suggestions above)"
              rows={3}
              className="w-full bg-black/60 border border-gray-800 rounded-2xl p-4 text-xl sm:text-2xl font-medium text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/50 resize-none transition-all"
            />
            {sentence && (
              <div className="absolute bottom-4 right-4 pointer-events-none">
                <span className="inline-block w-2.5 h-6 bg-blue-400 animate-pulse rounded-sm"></span>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Speak Button */}
              <button
                onClick={() => speakText(sentence)}
                disabled={!sentence || !sentence.trim()}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${
                  isSpeaking
                    ? "bg-purple-600 text-white animate-pulse"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100"
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>{isSpeaking ? "Speaking..." : "Speak (S)"}</span>
              </button>

              {/* Space Button */}
              <button
                onClick={() => dispatchAction("space")}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-700 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <CornerDownLeft className="w-4 h-4 text-gray-400" />
                <span>Space</span>
              </button>

              {/* Backspace Button */}
              <button
                onClick={() => dispatchAction("backspace")}
                disabled={!sentence}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-700 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
              >
                <Delete className="w-4 h-4 text-gray-400" />
                <span>Backspace</span>
              </button>

              {/* Clear Button */}
              <button
                onClick={() => dispatchAction("clear")}
                disabled={!sentence}
                className="bg-gray-800 hover:bg-red-900/30 text-gray-300 hover:text-red-400 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-700 hover:border-red-800 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear (C)</span>
              </button>
            </div>

            {/* Save Sentence Button */}
            <button
              onClick={handleSaveSentence}
              disabled={!sentence || !sentence.trim() || savingSentence}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 ml-auto"
            >
              <Save className="w-4 h-4" />
              <span>{savingSentence ? "Saving..." : "Save to History"}</span>
            </button>
          </div>
        </div>

        {/* History & Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Daily Goal Card */}
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600/30 border border-emerald-500/40 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎯</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Daily Practice Goal</h3>
                  <p className="text-xs text-gray-400">Complete 10 sentences</p>
                </div>
              </div>
              <span className="text-xs bg-gray-800 text-emerald-400 font-bold px-2.5 py-1 rounded-full border border-gray-700">
                {todayGoal.completed} / {todayGoal.target}
              </span>
            </div>

            <div className="w-full bg-gray-800 rounded-full h-3 mb-2 overflow-hidden border border-gray-700/40">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (todayGoal.completed / todayGoal.target) * 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400">
              {todayGoal.target - todayGoal.completed > 0
                ? `${todayGoal.target - todayGoal.completed} more sentences to reach today's target!`
                : "🎉 Daily target achieved! Outstanding work!"}
            </p>
          </div>

          {/* Lifetime Sentences Stat */}
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-xl flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/40 rounded-2xl flex items-center justify-center text-2xl">
              📝
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Sentences</p>
              <h4 className="text-3xl font-extrabold text-white mt-0.5">{stats ? stats.totalSentences : 0}</h4>
              <p className="text-xs text-blue-400 mt-1">Saved in database</p>
            </div>
          </div>

          {/* Toggle History View */}
          <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Sentence History</h3>
              <p className="text-xs text-gray-400">Review, manage, or delete past translated sentences.</p>
            </div>
            <button
              onClick={() => {
                if (!showHistory) fetchStats()
                setShowHistory(!showHistory)
              }}
              className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 rounded-xl text-sm border border-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <span>{showHistory ? "Hide History" : "View History"}</span>
              <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full">{sentences.length}</span>
            </button>
          </div>
        </div>

        {/* Expanded History Table */}
        {showHistory && (
          <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📚</span> Past Translations
              </h3>
              <button
                onClick={fetchStats}
                className="text-xs text-blue-400 hover:text-blue-300 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Loading history...</div>
            ) : sentences.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {sentences.map((s) => (
                  <div
                    key={s._id}
                    className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-4 flex items-center justify-between gap-4 hover:bg-gray-800 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-base truncate">{s.text}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{new Date(s.createdAt || Date.now()).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>{s.wordCount || s.text.split(" ").length} words</span>
                        <span>•</span>
                        <span className="uppercase text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                          {s.source || "web"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => speakText(s.text)}
                        title="Pronounce sentence"
                        className="text-gray-300 hover:text-blue-400 bg-gray-700/50 hover:bg-gray-700 p-2 rounded-xl transition-all"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSentence(s._id)}
                        title="Delete from history"
                        className="text-gray-400 hover:text-red-400 bg-gray-700/50 hover:bg-red-900/30 p-2 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                No sentences recorded yet. Start signing and click "Save to History"!
              </div>
            )}
          </div>
        )}
      </main>

      {/* ASL Alphabet Reference Modal */}
      {showAslGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🤟</span> ASL Alphabet & Gesture Guide
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Quick reference for the 28 gestures supported by Sign2Voice</p>
              </div>
              <button
                onClick={() => setShowAslGuide(false)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {aslAlphabet.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-800/80 border border-gray-700/60 rounded-xl p-3 text-center hover:border-blue-500/50 transition-all"
                >
                  <div className="w-12 h-12 mx-auto rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-2xl font-extrabold text-blue-400 mb-1">
                    {item.letter.toUpperCase()}
                  </div>
                  <p className="text-[10px] text-gray-400 line-clamp-2">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gray-950 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setShowAslGuide(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2 rounded-xl"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {loading && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl text-center max-w-md w-full shadow-2xl space-y-5">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>
              <h3 className="text-xl font-bold text-white">Starting Sign2Voice AI</h3>
              <p className="text-sm text-gray-400 mt-1">Starting the camera & gesture neural network...</p>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-400 font-medium">{loadingSteps[loadingStep]}</p>
          </div>
        </div>
      )}
    </div>
  )
}