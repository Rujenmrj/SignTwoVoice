import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

let pythonProcess = null;
let startupPromise = null;
let startupLock = false;

const waitForPythonReady = (processRef) =>
  new Promise((resolve, reject) => {
    const timeoutMs = 60000;
    let stdoutBuffer = "";
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      processRef.stdout?.off("data", onStdout);
      processRef.stderr?.off("data", onStderr);
      processRef.off("close", onClose);
      processRef.off("error", onError);
    };

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const onStdout = (data) => {
      const output = data.toString();
      stdoutBuffer += output;
      console.log(`Python stdout: ${output}`);

      if (stdoutBuffer.includes("STREAM_READY http://localhost:5001/stream")) {
        console.log("✅ Webcam GUI is ready!");
        finish(() => resolve());
      }
    };

    const onStderr = (data) => {
      const output = data.toString();
      console.error(`Python stderr: ${output}`);

      if (
        output.toLowerCase().includes("could not open webcam") ||
        output.toLowerCase().includes("failed to open webcam")
      ) {
        finish(() => reject(new Error("Webcam could not start. Please check that your camera is available.")));
      }
    };

    const onClose = (code) => {
      if (!settled) {
        finish(() => reject(new Error(`Python webcam exited before signaling readiness (code ${code}).`)));
      }
    };

    const onError = (error) => {
      if (!settled) {
        finish(() => reject(error));
      }
    };

    const timeoutHandle = setTimeout(() => {
      finish(() => reject(new Error("Timed out waiting for the webcam to become ready.")));
    }, timeoutMs);

    processRef.stdout.on("data", onStdout);
    processRef.stderr.on("data", onStderr);
    processRef.on("close", onClose);
    processRef.on("error", onError);
  });

router.post("/start-webcam", async (req, res) => {
  if (startupLock || startupPromise) {
    return res.status(202).json({
      success: false,
      message: "Webcam startup is already in progress",
    });
  }

  if (pythonProcess && !pythonProcess.killed && pythonProcess.exitCode === null) {
    return res.status(400).json({
      success: false,
      message: "Webcam is already running",
    });
  }

  startupLock = true;

  try {
    const projectRoot = "C:\\Users\\LOQ\\Desktop\\s2v\\Sign2Voice_Final";
    const pythonPath = process.env.SIGN2VOICE_PYTHON || "C:\\Users\\LOQ\\anaconda3\\envs\\sign2voice\\python.exe";
    const scriptPath = path.join(projectRoot, "app", "gui_main.py");

    console.log(`🐍 Starting Python script: ${scriptPath}`);
    console.log(`🐍 Using Python: ${pythonPath}`);

    pythonProcess = spawn(pythonPath, [scriptPath], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
      detached: false,
      env: {
        ...process.env,
        PYTHONPATH: projectRoot,
        PYTHONUNBUFFERED: "1",
      },
    });

    startupPromise = waitForPythonReady(pythonProcess)
      .then(() => ({
        success: true,
        message: "Webcam GUI started successfully",
        streamUrl: "http://localhost:5001/stream",
      }))
      .catch((error) => {
        if (!pythonProcess || pythonProcess.killed || pythonProcess.exitCode !== null) {
          pythonProcess = null;
        }
        throw error;
      });

    pythonProcess.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      if (pythonProcess && (pythonProcess.killed || pythonProcess.exitCode !== null)) {
        pythonProcess = null;
      }
      startupPromise = null;
      startupLock = false;
    });

    pythonProcess.on("error", (err) => {
      console.error(`Failed to start Python process: ${err}`);
      if (!pythonProcess || pythonProcess.killed || pythonProcess.exitCode !== null) {
        pythonProcess = null;
      }
      startupPromise = null;
      startupLock = false;
    });

    const result = await startupPromise;
    startupPromise = null;
    startupLock = false;
    return res.json(result);
  } catch (error) {
    startupPromise = null;
    startupLock = false;
    console.error("Failed to start Python webcam stream:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to start the Python webcam stream",
    });
  }
});

router.post("/stop-webcam", (req, res) => {
  if (!pythonProcess || pythonProcess.killed) {
    return res.status(400).json({
      success: false,
      message: "No webcam process running",
    });
  }

  pythonProcess.kill("SIGTERM");
  pythonProcess = null;
  startupPromise = null;

  res.json({
    success: true,
    message: "Webcam stopped",
  });
});

router.get("/webcam-status", (req, res) => {
  const isRunning = pythonProcess !== null && !pythonProcess.killed;
  res.json({
    running: isRunning,
    message: isRunning ? "Webcam is running" : "Webcam is stopped",
  });
});

// Proxy to Python Engine state
router.get("/state", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5001/state");
    if (!response.ok) throw new Error("Failed to fetch state");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({
      connected: false,
      camera_active: false,
      hand_detected: false,
      letter: "",
      confidence: 0,
      sentence: "",
      suggestions: ["HELLO", "THANK", "YOU", "PLEASE"],
    });
  }
});

// Proxy to Python Engine action (speak, clear, backspace, space, select_suggestion, set_sentence)
router.post("/action", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5001/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Failed to dispatch action to AI engine" });
  }
});

// Proxy to Python Engine suggestions
router.get("/suggestions", async (req, res) => {
  try {
    const text = req.query.text || "";
    const response = await fetch(`http://localhost:5001/suggestions?text=${encodeURIComponent(text)}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.json({ suggestions: ["HELLO", "THANK", "YOU", "PLEASE"] });
  }
});

// Speak endpoint
router.post("/speak", async (req, res) => {
  try {
    const response = await fetch("http://localhost:5001/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "speak", text: req.body.text }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "Speech service unavailable" });
  }
});

export default router;