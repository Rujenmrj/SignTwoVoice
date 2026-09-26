# app/suggestions.py
import re
import threading
from functools import lru_cache
from typing import List

# Common conversational starters and phrases for instant lookup
STARTER_WORDS = ["I", "Hello", "How", "Thank", "What", "Please", "My", "Good", "Yes", "No", "We", "Where", "When", "Why", "You"]

CONVERSATIONAL_MAP = {
    "how": ["are", "is", "can", "do"],
    "how are": ["you", "things", "they", "we"],
    "how are you": ["doing", "today", "feeling"],
    "thank": ["you", "so", "very"],
    "thank you": ["so", "very", "much", "again"],
    "thank you so": ["much"],
    "nice to": ["meet", "see", "hear"],
    "nice to meet": ["you"],
    "good": ["morning", "afternoon", "evening", "night", "job", "luck", "to", "day"],
    "good morning": ["everyone", "how", "to"],
    "i": ["am", "want", "need", "like", "feel", "can", "have", "will", "know"],
    "i am": ["fine", "good", "happy", "learning", "here", "ready", "sorry"],
    "i need": ["help", "water", "time", "to", "more"],
    "i want": ["to", "more", "water", "food"],
    "my": ["name", "friend", "family", "hand"],
    "my name": ["is"],
    "my name is": ["Alex", "John", "Sarah", "Sam"],
    "what": ["is", "are", "do", "can"],
    "what is": ["your", "this", "that", "the"],
    "what is your": ["name", "problem", "question"],
    "where": ["is", "are", "can", "do"],
    "where is": ["the", "my", "your", "it"],
    "please": ["help", "wait", "call", "come", "repeat", "sign"],
    "can you": ["help", "hear", "see", "repeat", "sign"],
    "see you": ["later", "soon", "tomorrow", "again"],
    "have a": ["good", "great", "nice", "wonderful"],
    "have a nice": ["day", "time"],
    "have a good": ["day", "time", "night"],
}

# A curated vocabulary list of common English and ASL dialogue words
COMMON_VOCAB = [
    # Greetings & polite
    "hello", "hi", "hey", "goodbye", "bye", "welcome", "please", "thanks", "thank",
    "sorry", "excuse", "pardon", "yes", "no", "okay", "fine", "alright", "sure",
    # Pronouns & people
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
    "my", "your", "his", "her", "our", "their", "friend", "family", "mother",
    "father", "sister", "brother", "teacher", "student", "doctor", "name",
    # Common verbs
    "am", "is", "are", "was", "were", "be", "being", "been", "have", "has", "had",
    "do", "does", "did", "go", "going", "went", "come", "see", "saw", "know",
    "think", "look", "want", "wanted", "give", "use", "find", "tell", "ask",
    "work", "working", "feel", "try", "leave", "call", "need", "needed", "feel",
    "help", "helped", "helping", "meet", "learn", "learning", "speak", "sign",
    "signing", "understand", "love", "like", "play", "wait", "hear", "talk", "say",
    # Question words
    "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
    # Adjectives & adverbs
    "good", "great", "well", "fine", "bad", "happy", "sad", "tired", "hungry",
    "thirsty", "ready", "new", "first", "last", "long", "little", "own", "other",
    "old", "right", "big", "small", "large", "next", "early", "young", "important",
    "few", "public", "bad", "same", "able", "again", "now", "always", "today",
    "tomorrow", "yesterday", "later", "soon", "here", "there", "very", "much",
    # Time & feelings
    "morning", "afternoon", "evening", "night", "day", "week", "month", "year",
    "time", "person", "thing", "way", "water", "food", "home", "school", "hospital",
    # Common words starting with letters
    "about", "above", "after", "again", "all", "also", "always", "and", "another",
    "any", "around", "back", "because", "before", "between", "both", "busy",
    "but", "by", "can", "cannot", "could", "different", "down", "during",
    "each", "either", "end", "even", "every", "everyone", "everything",
    "for", "from", "get", "give", "hand", "hands", "hearing", "help", "helmet",
    "hope", "idea", "if", "in", "into", "just", "keep", "kind", "know",
    "life", "make", "many", "may", "might", "more", "most", "much", "must",
    "neither", "never", "nothing", "now", "number", "off", "often", "on", "once",
    "one", "only", "or", "other", "our", "out", "over", "part", "people",
    "place", "problem", "put", "question", "same", "say", "see", "seem", "should",
    "show", "side", "since", "so", "some", "someone", "something", "sometimes",
    "still", "such", "take", "than", "that", "the", "their", "them", "then",
    "there", "these", "they", "thing", "think", "this", "those", "through", "time",
    "to", "together", "too", "under", "until", "up", "upon", "us", "use",
    "very", "voice", "want", "way", "we", "well", "went", "were", "what", "when",
    "where", "which", "while", "white", "who", "whole", "whom", "whose", "why",
    "will", "with", "within", "without", "work", "world", "would", "year", "yes",
    "yesterday", "yet", "you", "young", "your"
]

_gpt_model = None
_gpt_tokenizer = None
_model_lock = threading.Lock()
_model_loading = False
_model_ready = False

def _init_gpt_model():
    """Initializes the GPT model in a thread-safe manner."""
    global _gpt_model, _gpt_tokenizer, _model_ready, _model_loading
    with _model_lock:
        if _model_ready or _model_loading:
            return
        _model_loading = True

    try:
        from transformers import GPT2Tokenizer, GPT2LMHeadModel
        print("[suggestions] Loading distilgpt2 for contextual prediction...", flush=True)
        tokenizer = GPT2Tokenizer.from_pretrained("distilgpt2")
        model = GPT2LMHeadModel.from_pretrained("distilgpt2")
        model.eval()
        _gpt_tokenizer = tokenizer
        _gpt_model = model
        _model_ready = True
        print("[suggestions] distilgpt2 loaded and ready.", flush=True)
    except Exception as e:
        print(f"[suggestions] Could not load distilgpt2: {e}", flush=True)
    finally:
        _model_loading = False

# Warm up model asynchronously
_warmup_thread = threading.Thread(target=_init_gpt_model, daemon=True)
_warmup_thread.start()

def _clean_token(tok: str) -> str:
    tok = tok.strip()
    return tok if len(tok) > 1 and re.fullmatch(r"[A-Za-z']+", tok) else ""

def _get_prefix_matches(prefix: str, k: int = 4) -> List[str]:
    """Finds words starting with the prefix from common vocabulary."""
    prefix_lower = prefix.lower()
    matches = []
    
    # Exact match check first
    for word in COMMON_VOCAB:
        if word.lower() == prefix_lower:
            matches.append(word.upper())
            break
            
    # Then prefix matches
    for word in COMMON_VOCAB:
        if word.lower().startswith(prefix_lower) and word.upper() not in matches:
            matches.append(word.upper())
            if len(matches) >= k:
                break
                
    return matches

def _get_gpt_predictions(context: str, k: int = 3) -> List[str]:
    """Uses distilgpt2 for contextual next-token prediction if ready."""
    global _gpt_model, _gpt_tokenizer, _model_ready
    if not _model_ready or _gpt_model is None or _gpt_tokenizer is None:
        return []

    try:
        import torch
        context = context.strip()
        if not context:
            return []
            
        input_ids = _gpt_tokenizer.encode(context, return_tensors="pt")
        with torch.no_grad():
            logits = _gpt_model(input_ids).logits
        next_logits = logits[0, -1]
        top_k = torch.topk(next_logits, k * 4)
        tokens = top_k.indices.tolist()

        suggestions = []
        for tid in tokens:
            word = _clean_token(_gpt_tokenizer.decode([tid]))
            if word and word.upper() not in [s.upper() for s in suggestions]:
                suggestions.append(word.upper())
            if len(suggestions) >= k:
                break
        return suggestions
    except Exception as e:
        return []

@lru_cache(maxsize=256)
def get_suggestions(context: str, k: int = 4) -> List[str]:
    """
    Intelligent hybrid suggestions:
    1. If currently typing a word (e.g. 'hel'), return autocompletions ('HELLO', 'HELP', etc.).
    2. If text ends with a space (word boundary), return next-word predictions.
    3. If empty, return popular starter words.
    """
    if not context or not context.strip():
        return [w.upper() for w in STARTER_WORDS[:k]]

    # Check if user is in the middle of spelling a word
    ends_with_space = context.endswith(" ")
    words = context.strip().split()
    
    if not ends_with_space and words:
        # Autocompletion for current partial word
        current_word = words[-1]
        completions = _get_prefix_matches(current_word, k=k)
        if completions:
            return completions

    # User completed a word (or context ends with space) -> Next Word Prediction
    normalized_context = " ".join(words).lower()
    
    # 1. Check conversational n-gram map (multi-word match, e.g. "how are")
    results = []
    # Check 3-word, 2-word, 1-word suffix in context
    for n in [3, 2, 1]:
        if len(words) >= n:
            key = " ".join(words[-n:]).lower()
            if key in CONVERSATIONAL_MAP:
                for candidate in CONVERSATIONAL_MAP[key]:
                    upper_c = candidate.upper()
                    if upper_c not in results:
                        results.append(upper_c)
                    if len(results) >= k:
                        return results

    # 2. Query GPT model for open-ended next-word prediction
    gpt_preds = _get_gpt_predictions(normalized_context, k=k)
    for pred in gpt_preds:
        if pred not in results:
            results.append(pred)
        if len(results) >= k:
            return results

    # 3. Fallback: starter / common conversational words
    for starter in STARTER_WORDS:
        su = starter.upper()
        if su not in results and (not words or su != words[-1].upper()):
            results.append(su)
        if len(results) >= k:
            break

    return results

if __name__ == "__main__":
    print("Empty context:", get_suggestions(""))
    print("Prefix 'H':", get_suggestions("H"))
    print("Prefix 'HEL':", get_suggestions("HEL"))
    print("Prefix 'WHA':", get_suggestions("WHA"))
    print("Next word after 'HOW ARE ':", get_suggestions("HOW ARE "))
    print("Next word after 'THANK ':", get_suggestions("THANK "))
    print("Next word after 'MY NAME IS ':", get_suggestions("MY NAME IS "))
