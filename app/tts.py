# app/tts.py
import threading
import queue
import pyttsx3

_tts_queue = queue.Queue()
_worker_thread = None
_lock = threading.Lock()

def _tts_worker():
    """Worker thread that processes speech requests sequentially."""
    engine = None
    try:
        engine = pyttsx3.init()
        engine.setProperty("rate", 175)
        engine.setProperty("volume", 1.0)
    except Exception as e:
        print(f"[TTS Init Error] {e}", flush=True)

    while True:
        text = _tts_queue.get()
        if text is None:
            break
        if not text or not text.strip():
            _tts_queue.task_done()
            continue

        try:
            if engine is None:
                engine = pyttsx3.init()
                engine.setProperty("rate", 175)
                engine.setProperty("volume", 1.0)

            print(f"[TTS Speaking] {text}", flush=True)
            engine.say(text)
            engine.runAndWait()
        except Exception as e:
            print(f"[TTS Error] {e}", flush=True)
            # Recreate engine on error
            try:
                engine = pyttsx3.init()
                engine.setProperty("rate", 175)
                engine.setProperty("volume", 1.0)
            except Exception:
                engine = None
        finally:
            _tts_queue.task_done()

def speak(text: str):
    """Speak text asynchronously without blocking the calling thread."""
    global _worker_thread
    if not text or not text.strip():
        return

    with _lock:
        if _worker_thread is None or not _worker_thread.is_alive():
            _worker_thread = threading.Thread(target=_tts_worker, daemon=True)
            _worker_thread.start()

    _tts_queue.put(text.strip())

if __name__ == "__main__":
    import time
    speak("Testing Sign to Voice speech synthesis")
    time.sleep(2)
    print("TTS test completed.")
