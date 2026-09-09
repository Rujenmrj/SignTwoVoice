import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Store the Python process reference
let pythonProcess = null;

router.post("/start-webcam", (req, res) => {
  // Check if already running
  if (pythonProcess && !pythonProcess.killed) {
    return res.status(400).json({ 
      success: false, 
      message: "Webcam is already running" 
    });
  }

  const projectRoot = "C:\\Users\\LOQ\\Desktop\\s2v\\Sign2Voice_Final";
  const pythonPath = process.env.SIGN2VOICE_PYTHON || "C:\\Users\\LOQ\\anaconda3\\envs\\sign2voice\\python.exe";
  const scriptPath = path.join(projectRoot, "app", "gui_main.py");

  console.log(`🐍 Starting Python script: ${scriptPath}`);
  console.log(`🐍 Using Python: ${pythonPath}`);

  // Spawn Python process (better than exec for long-running processes)
  pythonProcess = spawn(pythonPath, [scriptPath], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
    env: {
      ...process.env,
      PYTHONPATH: projectRoot,
    },
  });

  // Handle stdout
  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`Python stdout: ${output}`);
    
    // Check for ready signal
    if (output.includes('SIGN2VOICE_READY')) {
      console.log('✅ Webcam GUI is ready!');
    }
  });

  // Handle stderr
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data.toString()}`);
  });

  // Handle process exit
  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null;
  });

  // Handle errors
  pythonProcess.on('error', (err) => {
    console.error(`Failed to start Python process: ${err}`);
    pythonProcess = null;
  });

  // Send response immediately
  res.json({ 
    success: true, 
    message: "Webcam GUI started successfully" 
  });
});

// Route to stop webcam
router.post("/stop-webcam", (req, res) => {
  if (!pythonProcess || pythonProcess.killed) {
    return res.status(400).json({ 
      success: false, 
      message: "No webcam process running" 
    });
  }

  // Kill the process
  pythonProcess.kill('SIGTERM');
  pythonProcess = null;

  res.json({ 
    success: true, 
    message: "Webcam stopped" 
  });
});

// Route to check status
router.get("/webcam-status", (req, res) => {
  const isRunning = pythonProcess !== null && !pythonProcess.killed;
  res.json({ 
    running: isRunning,
    message: isRunning ? "Webcam is running" : "Webcam is stopped"
  });
});

export default router;