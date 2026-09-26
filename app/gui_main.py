import io
import json
import os
import sys
import threading
import time
from collections import Counter, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

try:
    from app.tts import speak
except Exception:
    try:
        from tts import speak
    except Exception:
        def speak(text: str):
            return None

try:
    from app.suggestions import get_suggestions
except Exception:
    try:
        from suggestions import get_suggestions
    except Exception:
        def get_suggestions(text: str, k: int = 4):
            return ["HELLO", "THANK", "YOU", "PLEASE"]


def resolve_model_path(*relative_parts):
    candidates = [
        os.path.join(PROJECT_ROOT, *relative_parts),
        os.path.join(APP_DIR, *relative_parts),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return candidates[0]


MODEL_PATH = resolve_model_path("models", "landmark_cnn.h5")
CLASSES_PATH = resolve_model_path("models", "landmark_classes.json")

print(f"[startup] project_root={PROJECT_ROOT}", flush=True)
print(f"[startup] model_path={MODEL_PATH}", flush=True)
print(f"[startup] classes_path={CLASSES_PATH}", flush=True)

# ── Global Shared State ────────────────────────────────────────────────────────
STATE_LOCK = threading.Lock()
LATEST_FRAME = None
FRAME_LOCK = threading.Lock()

current_state = {
    "connected": True,
    "camera_active": False,
    "hand_detected": False,
    "letter": "",
    "confidence": 0.0,
    "vote_letter": "",
    "vote_count": 0,
    "buffer_vote": 6,
    "vote_progress": 0.0,
    "sentence": "",
    "current_word": "",
    "suggestions": get_suggestions(""),
    "last_added": "",
    "status": "Initializing...",
}

# Subscribed SSE clients
sse_clients = []
sse_lock = threading.Lock()


def get_current_word(sentence: str) -> str:
    if not sentence or sentence.endswith(" "):
        return ""
    words = sentence.strip().split()
    return words[-1] if words else ""


def apply_suggestion_to_sentence(current_sentence: str, word: str) -> str:
    """Replaces current partial word or appends suggestion word with space."""
    word = word.strip().upper()
    if not current_sentence:
        return word + " "
    if current_sentence.endswith(" "):
        return current_sentence + word + " "
    
    # Replace last partial word
    last_space = current_sentence.rfind(" ")
    if last_space == -1:
        return word + " "
    else:
        return current_sentence[:last_space + 1] + word + " "


class StreamHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/":
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Sign2Voice AI Engine running on port 5001")
            return

        if path == "/stream":
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()

            try:
                while True:
                    with FRAME_LOCK:
                        frame = None if LATEST_FRAME is None else LATEST_FRAME.copy()

                    if frame is None:
                        time.sleep(0.04)
                        continue

                    ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    if not ok:
                        time.sleep(0.04)
                        continue

                    jpg = encoded.tobytes()
                    self.wfile.write(b"--frame\r\n")
                    self.wfile.write(b"Content-Type: image/jpeg\r\n")
                    self.wfile.write(f"Content-Length: {len(jpg)}\r\n\r\n".encode("utf-8"))
                    self.wfile.write(jpg)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()
                    time.sleep(0.033)
            except Exception:
                pass
            return

        if path == "/state":
            with STATE_LOCK:
                data = json.dumps(current_state).encode("utf-8")

            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(data)
            return

        if path == "/suggestions":
            qs = parse_qs(parsed.query)
            text = qs.get("text", [""])[0]
            suggestions = get_suggestions(text)
            payload = json.dumps({"suggestions": suggestions}).encode("utf-8")

            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == "/events":
            # Server-Sent Events endpoint
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()

            try:
                last_sent = ""
                while True:
                    with STATE_LOCK:
                        current_json = json.dumps(current_state)
                    
                    if current_json != last_sent:
                        msg = f"data: {current_json}\n\n".encode("utf-8")
                        self.wfile.write(msg)
                        self.wfile.flush()
                        last_sent = current_json

                    time.sleep(0.1)
            except Exception:
                pass
            return

        self.send_error(404, "Not found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/action":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                req_data = json.loads(body.decode("utf-8"))
            except Exception:
                req_data = {}

            action = req_data.get("action", "")
            global current_state

            with STATE_LOCK:
                if action == "speak":
                    text_to_speak = req_data.get("text", current_state["sentence"])
                    if text_to_speak and text_to_speak.strip():
                        speak(text_to_speak)
                elif action == "clear":
                    current_state["sentence"] = ""
                    current_state["current_word"] = ""
                    current_state["last_added"] = ""
                    current_state["suggestions"] = get_suggestions("")
                elif action == "backspace":
                    if current_state["sentence"]:
                        current_state["sentence"] = current_state["sentence"][:-1]
                        current_state["current_word"] = get_current_word(current_state["sentence"])
                        current_state["suggestions"] = get_suggestions(current_state["sentence"])
                elif action == "space":
                    if not current_state["sentence"].endswith(" "):
                        current_state["sentence"] += " "
                        current_state["current_word"] = ""
                        current_state["suggestions"] = get_suggestions(current_state["sentence"])
                elif action == "select_suggestion":
                    word = req_data.get("word", "")
                    if word:
                        current_state["sentence"] = apply_suggestion_to_sentence(current_state["sentence"], word)
                        current_state["current_word"] = ""
                        current_state["suggestions"] = get_suggestions(current_state["sentence"])
                        # Reset last_added so next gestures can be signed freely
                        current_state["last_added"] = ""
                elif action == "set_sentence":
                    new_sentence = req_data.get("sentence", "")
                    current_state["sentence"] = new_sentence
                    current_state["current_word"] = get_current_word(new_sentence)
                    current_state["suggestions"] = get_suggestions(new_sentence)
                elif action == "add_letter":
                    let = req_data.get("letter", "")
                    if let:
                        if let == "space":
                            current_state["sentence"] += " "
                        elif let == "del":
                            current_state["sentence"] = current_state["sentence"][:-1]
                        else:
                            current_state["sentence"] += let
                        current_state["current_word"] = get_current_word(current_state["sentence"])
                        current_state["suggestions"] = get_suggestions(current_state["sentence"])

                resp_data = json.dumps(current_state).encode("utf-8")

            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(resp_data)
            return

        self.send_error(404, "Not found")

    def log_message(self, format, *args):
        return


def load_model_and_labels():
    print("Loading TensorFlow model...", flush=True)
    try:
        model = tf.keras.models.load_model(MODEL_PATH)
        print("✅ Model loaded successfully", flush=True)
    except Exception as e:
        print(f"❌ Error loading model: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

    print("Loading class names...", flush=True)
    with open(CLASSES_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)

    print("SIGN2VOICE_READY", flush=True)
    return model, class_names


def start_stream_server():
    server = ThreadingHTTPServer(("0.0.0.0", 5001), StreamHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print("STREAM_READY http://localhost:5001/stream", flush=True)
    return server


def main():
    global LATEST_FRAME, current_state
    model, class_names = load_model_and_labels()
    server = start_stream_server()

    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        min_detection_confidence=0.3,
        min_tracking_confidence=0.3,
    )
    mp_draw = mp.solutions.drawing_utils

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Could not open webcam", file=sys.stderr, flush=True)
        server.shutdown()
        server.server_close()
        sys.exit(1)

    # Initialize video capture resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    pred_buffer = deque(maxlen=10)
    buffer_vote = 6
    last_added = ""

    with STATE_LOCK:
        current_state["camera_active"] = True
        current_state["status"] = "Camera live. Ready for ASL signing."

    print("📸  Sign2Voice AI engine active and streaming", flush=True)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.01)
                continue

            frame = cv2.flip(frame, 1)  # mirror image for natural signing experience
            h, w, _ = frame.shape
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(img_rgb)

            hand_detected = False
            detected_letter = ""
            conf_val = 0.0
            vote_letter = ""
            vote_count = 0
            vote_progress = 0.0

            if results.multi_hand_landmarks:
                hand_detected = True
                hand = results.multi_hand_landmarks[0]
                lm_vec = [coord for p in hand.landmark for coord in (p.x, p.y, p.z)]
                preds = model.predict(np.expand_dims(lm_vec, 0), verbose=0)[0]
                conf_val = float(preds.max())
                detected_letter = class_names[int(preds.argmax())]

                if conf_val > 0.8:
                    pred_buffer.append(detected_letter)
                    vote_letter, vote_count = Counter(pred_buffer).most_common(1)[0]
                    vote_progress = min(1.0, vote_count / buffer_vote)

                    if vote_count >= buffer_vote and vote_letter != last_added:
                        with STATE_LOCK:
                            if vote_letter == "space":
                                if not current_state["sentence"].endswith(" "):
                                    current_state["sentence"] += " "
                            elif vote_letter == "del":
                                current_state["sentence"] = current_state["sentence"][:-1]
                            else:
                                current_state["sentence"] += vote_letter

                            current_state["current_word"] = get_current_word(current_state["sentence"])
                            current_state["suggestions"] = get_suggestions(current_state["sentence"])
                            current_state["last_added"] = vote_letter

                        last_added = vote_letter
                        pred_buffer.clear()
                        vote_count = 0
                        vote_progress = 0.0

                # Draw landmarks on frame
                mp_draw.draw_landmarks(
                    frame,
                    hand,
                    mp_hands.HAND_CONNECTIONS,
                    mp_draw.DrawingSpec(color=(0, 255, 128), thickness=2, circle_radius=3),
                    mp_draw.DrawingSpec(color=(255, 180, 0), thickness=2, circle_radius=2),
                )

                # Draw elegant HUD on top-left of video frame
                cv2.rectangle(frame, (10, 10), (280, 80), (20, 20, 20), -1)
                cv2.rectangle(frame, (10, 10), (280, 80), (60, 60, 60), 1)

                display_text = f"{detected_letter}  ({int(conf_val*100)}%)"
                cv2.putText(
                    frame,
                    display_text,
                    (22, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1.1,
                    (0, 255, 128) if conf_val > 0.8 else (200, 200, 200),
                    2,
                )

                # Progress bar for buffer vote
                bar_x = 22
                bar_y = 65
                bar_w = 236
                bar_h = 6
                cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (50, 50, 50), -1)
                cv2.rectangle(
                    frame,
                    (bar_x, bar_y),
                    (bar_x + int(bar_w * vote_progress), bar_y + bar_h),
                    (0, 220, 255),
                    -1,
                )

            else:
                pred_buffer.clear()
                last_added = ""

            # Update shared state
            with STATE_LOCK:
                current_state["hand_detected"] = hand_detected
                current_state["letter"] = detected_letter if hand_detected else ""
                current_state["confidence"] = conf_val if hand_detected else 0.0
                current_state["vote_letter"] = vote_letter
                current_state["vote_count"] = vote_count
                current_state["vote_progress"] = vote_progress
                current_state["current_word"] = get_current_word(current_state["sentence"])

            with FRAME_LOCK:
                LATEST_FRAME = frame.copy()

            time.sleep(0.01)

    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()