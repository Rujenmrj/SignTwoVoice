import io
import json
import os
import sys
import threading
import time
from collections import Counter, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf
from tensorflow import keras

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

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
        def speak(*args, **kwargs):
            return None


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
LATEST_FRAME = None
FRAME_LOCK = threading.Lock()

print(f"[startup] project_root={PROJECT_ROOT}")
print(f"[startup] model_path={MODEL_PATH}")
print(f"[startup] classes_path={CLASSES_PATH}")


class StreamHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Sign2Voice stream is running")
            return

        if self.path != "/stream":
            self.send_error(404, "Not found")
            return

        self.send_response(200)
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
                    time.sleep(0.05)
                    continue

                ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if not ok:
                    time.sleep(0.05)
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

    def log_message(self, format, *args):
        return


def load_model_and_labels():
    print("Loading TensorFlow model...")
    try:
        model = keras.models.load_model(MODEL_PATH)
        print("✅ Model loaded successfully")
    except Exception as e:
        print(f"❌ Error loading model: {e}", file=sys.stderr)
        model = tf.keras.models.load_model(MODEL_PATH)

    print("Loading class names...")
    with open(CLASSES_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)

    print("SIGN2VOICE_READY")
    print("STREAM_READY http://localhost:5001/stream")
    return model, class_names


def start_stream_server():
    server = ThreadingHTTPServer(("0.0.0.0", 5001), StreamHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def main():
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
        print("❌ Could not open webcam", file=sys.stderr)
        server.shutdown()
        server.server_close()
        sys.exit(1)

    sentence = ""
    pred_buffer = deque(maxlen=10)
    buffer_vote = 6
    last_added = ""

    print("📸  Stream started in browser UI")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(img_rgb)
            h, w, _ = frame.shape

            if results.multi_hand_landmarks:
                hand = results.multi_hand_landmarks[0]
                lm_vec = [coord for p in hand.landmark for coord in (p.x, p.y, p.z)]
                preds = model.predict(np.expand_dims(lm_vec, 0), verbose=0)[0]
                conf = preds.max()
                letter = class_names[int(preds.argmax())]

                if conf > 0.8:
                    pred_buffer.append(letter)
                    vote_letter, vote_count = Counter(pred_buffer).most_common(1)[0]
                    if vote_count >= buffer_vote and vote_letter != last_added:
                        if vote_letter == "space":
                            sentence += " "
                        elif vote_letter == "del":
                            sentence = sentence[:-1]
                        else:
                            sentence += vote_letter
                        last_added = vote_letter
                        pred_buffer.clear()

                    cv2.putText(
                        frame,
                        f"{letter} ({conf:.2f})",
                        (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1.5,
                        (0, 255, 0),
                        3,
                    )

                mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)
            else:
                pred_buffer.clear()
                last_added = ""

            cv2.rectangle(frame, (0, h - 60), (w, h), (0, 0, 0), -1)
            cv2.putText(
                frame,
                sentence,
                (10, h - 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (255, 255, 255),
                2,
            )

            with FRAME_LOCK:
                LATEST_FRAME = frame.copy()

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("c"):
                sentence = ""
            if key == ord("s"):
                try:
                    speak(sentence)
                except Exception as e:
                    print(f"TTS error: {e}", file=sys.stderr)
    finally:
        cap.release()
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()