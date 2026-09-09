import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import cv2, json, time, numpy as np, tensorflow as tf
import mediapipe as mp
from collections import deque, Counter

try:
    from app.tts import speak
except Exception:
    try:
        from tts import speak
    except Exception:
        def speak(text: str):
            return None

# ── Load model & class labels ──────────────────────────────────────────────
model_candidates = [
    ROOT / "models" / "landmark_cnn.h5",
    ROOT / "app" / "models" / "landmark_cnn.h5",
]
label_candidates = [
    ROOT / "models" / "landmark_classes.json",
    ROOT / "app" / "models" / "landmark_classes.json",
]

model_path = next((p for p in model_candidates if p.exists()), model_candidates[0])
labels_path = next((p for p in label_candidates if p.exists()), label_candidates[0])

print(f"Loading model from: {model_path}")
print(f"Loading labels from: {labels_path}")
model = tf.keras.models.load_model(str(model_path))
class_names = json.load(open(labels_path, encoding="utf-8"))

# ── Mediapipe setup ───────────────────────────────────────────────────────
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.3,
    min_tracking_confidence=0.3
)
mp_draw = mp.solutions.drawing_utils

# ── Webcam ────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(0)

sentence     = ""
pred_buffer  = deque(maxlen=10)   # holds last 10 confident letters
buffer_vote  = 6                  # how many times a letter must appear
last_added   = ""                 # last letter actually added

print("📸  Q=quit  C=clear  S=speak")

while True:
    ok, frame = cap.read()
    if not ok:
        break

    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(img_rgb)

    h, w, _ = frame.shape

    if results.multi_hand_landmarks:
        hand = results.multi_hand_landmarks[0]
        lm_vec = [c for p in hand.landmark for c in (p.x, p.y, p.z)]
        preds  = model.predict(np.expand_dims(lm_vec, 0), verbose=0)[0]
        conf   = preds.max()
        letter = class_names[int(preds.argmax())]

        if conf > 0.8:
            pred_buffer.append(letter)

            # Majority vote in buffer
            vote_letter, vote_count = Counter(pred_buffer).most_common(1)[0]
            if vote_count >= buffer_vote and vote_letter != last_added:
                # Map special tokens
                if vote_letter == "space":
                    sentence += " "
                elif vote_letter == "del":
                    sentence  = sentence[:-1]
                else:
                    sentence += vote_letter
                last_added  = vote_letter
                pred_buffer.clear()          # reset buffer after accepting

            cv2.putText(frame, f"{letter} ({conf:.2f})",
                        (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.5,
                        (0, 255, 0), 3)

        mp_draw.draw_landmarks(frame, hand, mp_hands.HAND_CONNECTIONS)
    else:
        pred_buffer.clear()
        last_added = ""

    # ── Display sentence bar ────────────────────────────────────────────
    cv2.rectangle(frame, (0, h-60), (w, h), (0,0,0), -1)
    cv2.putText(frame, sentence, (10, h-20), cv2.FONT_HERSHEY_SIMPLEX,
                1.2, (255,255,255), 2)

    cv2.imshow("Sign2Voice: Real-time ASL", frame)
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'): break
    if key == ord('c'): sentence = ""
    if key == ord('s'): speak(sentence)

cap.release()
cv2.destroyAllWindows()
