#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Emoji Detection & Sentiment Analysis Utility for MediaSentiment
Extracts all actual Unicode emojis, maps their official names and sentiments,
analyzes text-vs-emoji relationship, and detects emotional polarity conflicts.
"""

import emoji
import re

SKIN_TONE_AND_VS_RE = re.compile(r'[\U0001F3FB-\U0001F3FF\uFE0E\uFE0F]')

# Comprehensive Unicode Emoji Sentiment Dictionary (based on Emoji Sentiment Ranking)
# Format: char -> (Sentiment: "Positive"|"Negative"|"Neutral", Score: float between -1.0 and 1.0)
EMOJI_SENTIMENT_MAP = {
    # Positive / Smiling / Laughter
    "😂": ("Positive", 0.85),
    "🤣": ("Positive", 0.90),
    "😀": ("Positive", 0.75),
    "😃": ("Positive", 0.75),
    "😄": ("Positive", 0.75),
    "😁": ("Positive", 0.80),
    "😆": ("Positive", 0.75),
    "😅": ("Positive", 0.60),
    "😊": ("Positive", 0.70),
    "😇": ("Positive", 0.75),
    "🙂": ("Positive", 0.50),
    "🙃": ("Positive", 0.40),
    "😉": ("Positive", 0.65),
    "😍": ("Positive", 0.95),
    "🥰": ("Positive", 0.95),
    "😘": ("Positive", 0.85),
    "🤩": ("Positive", 0.90),
    "😋": ("Positive", 0.70),
    "😛": ("Positive", 0.65),
    "😜": ("Positive", 0.70),
    "🤪": ("Positive", 0.70),
    "😝": ("Positive", 0.65),
    "🤗": ("Positive", 0.80),
    "🤭": ("Positive", 0.60),
    "🥳": ("Positive", 0.90),
    "😺": ("Positive", 0.70),
    "😸": ("Positive", 0.75),
    "😹": ("Positive", 0.80),
    "😻": ("Positive", 0.90),

    # Hearts & Affection
    "❤️": ("Positive", 0.95),
    "❤": ("Positive", 0.95),
    "🧡": ("Positive", 0.85),
    "💛": ("Positive", 0.85),
    "💚": ("Positive", 0.85),
    "💙": ("Positive", 0.85),
    "💜": ("Positive", 0.85),
    "🖤": ("Positive", 0.70),
    "🤍": ("Positive", 0.80),
    "🤎": ("Positive", 0.75),
    "💖": ("Positive", 0.95),
    "💗": ("Positive", 0.90),
    "💓": ("Positive", 0.90),
    "💞": ("Positive", 0.90),
    "💕": ("Positive", 0.90),
    "💘": ("Positive", 0.90),
    "💝": ("Positive", 0.90),
    "❣️": ("Positive", 0.85),

    # Praise, Victory & Celebration
    "🔥": ("Positive", 0.85),
    "👏": ("Positive", 0.80),
    "🙌": ("Positive", 0.80),
    "🫶": ("Positive", 0.90),
    "👍": ("Positive", 0.75),
    "👌": ("Positive", 0.70),
    "🤝": ("Positive", 0.70),
    "💯": ("Positive", 0.85),
    "✨": ("Positive", 0.75),
    "⭐": ("Positive", 0.75),
    "🌟": ("Positive", 0.80),
    "🎉": ("Positive", 0.90),
    "🎊": ("Positive", 0.85),
    "🚀": ("Positive", 0.80),
    "💪": ("Positive", 0.75),
    "👑": ("Positive", 0.85),
    "🏆": ("Positive", 0.85),
    "💎": ("Positive", 0.80),
    "🥂": ("Positive", 0.75),
    "🎯": ("Positive", 0.70),
    "🙏": ("Positive", 0.70),

    # Negative / Anger / Disgust / Insult
    "😡": ("Negative", -0.85),
    "😠": ("Negative", -0.75),
    "🤬": ("Negative", -0.95),
    "👿": ("Negative", -0.80),
    "😈": ("Negative", -0.50),
    "🖕": ("Negative", -0.95),
    "🤮": ("Negative", -0.90),
    "🤢": ("Negative", -0.80),
    "💩": ("Negative", -0.70),
    "👎": ("Negative", -0.80),
    "💔": ("Negative", -0.85),
    "🗑️": ("Negative", -0.75),
    "🚮": ("Negative", -0.70),
    "🤡": ("Negative", -0.65),

    # Sadness / Distress / Fear
    "😢": ("Negative", -0.65),
    "😭": ("Negative", -0.50), # Often used for laughing in comedy, but negative baseline
    "😞": ("Negative", -0.60),
    "😔": ("Negative", -0.55),
    "😟": ("Negative", -0.50),
    "😕": ("Negative", -0.40),
    "🙁": ("Negative", -0.45),
    "☹️": ("Negative", -0.50),
    "😣": ("Negative", -0.55),
    "😖": ("Negative", -0.60),
    "😫": ("Negative", -0.65),
    "😩": ("Negative", -0.65),
    "🥺": ("Negative", -0.30),
    "😨": ("Negative", -0.60),
    "😰": ("Negative", -0.65),
    "😱": ("Negative", -0.70),
    "🥶": ("Negative", -0.40),
    "🥵": ("Neutral", 0.0),
    "😳": ("Neutral", 0.0),

    # Neutral / Thinking / Casual / Ambiguous Markers
    "🤔": ("Neutral", 0.0),
    "🧐": ("Neutral", 0.0),
    "🤨": ("Neutral", -0.10),
    "😐": ("Neutral", -0.10),
    "😑": ("Neutral", -0.15),
    "😶": ("Neutral", 0.0),
    "🙄": ("Neutral", -0.25),
    "😬": ("Neutral", -0.20),
    "🤥": ("Negative", -0.50),
    "🤫": ("Neutral", 0.0),
    "🤐": ("Neutral", 0.0),
    "😴": ("Neutral", 0.0),
    "🥱": ("Neutral", -0.10),
    "😵": ("Neutral", -0.20),
    "🤷": ("Neutral", 0.0),
    "🤷‍♂️": ("Neutral", 0.0),
    "🤷‍♀️": ("Neutral", 0.0),
    "🤦": ("Negative", -0.40),
    "🤦‍♂️": ("Negative", -0.40),
    "🤦‍♀️": ("Negative", -0.40),
    "💀": ("Neutral", 0.15), # Often slang for dying of laughter
    "☠️": ("Neutral", 0.0),
    "👀": ("Neutral", 0.10),
    "👁️": ("Neutral", 0.0),
    "💬": ("Neutral", 0.0),
    "💭": ("Neutral", 0.0),
    "📢": ("Neutral", 0.0),
    "🔍": ("Neutral", 0.0),
    "📍": ("Neutral", 0.0),
}

def clean_emoji_name(raw_char):
    """Convert emoji character to human-friendly title name."""
    try:
        demojized = emoji.demojize(raw_char)
        # e.g. ":face_with_tears_of_joy:" -> "Face With Tears Of Joy"
        cleaned = demojized.strip(":").replace("_", " ").title()
        return cleaned
    except Exception:
        return "Unknown Emoji"

def get_single_emoji_sentiment(raw_char):
    """Get polarity label and compound score for a single emoji."""
    if raw_char in EMOJI_SENTIMENT_MAP:
        return EMOJI_SENTIMENT_MAP[raw_char]
    
    # Strip skin tone modifiers and variation selectors
    normalized = SKIN_TONE_AND_VS_RE.sub("", raw_char)
    if normalized in EMOJI_SENTIMENT_MAP:
        return EMOJI_SENTIMENT_MAP[normalized]
        
    return ("Neutral", 0.0)

def extract_and_analyze_emojis(text, text_sentiment="Neutral"):
    """
    Extracts all real Unicode emojis from comment text, groups them by frequency,
    computes cumulative emoji sentiment, and analyzes text-emoji alignment/conflict.
    
    Returns:
        dict: {
            "hasEmojis": bool,
            "emojiCount": int,
            "uniqueCount": int,
            "list": [ { "char": str, "name": str, "count": int, "sentiment": str, "score": float } ],
            "summarySentiment": str ("Positive"|"Negative"|"Neutral"|"None"),
            "averageScore": float,
            "conflict": {
                "hasConflict": bool,
                "type": str,
                "explanation": str
            }
        }
    """
    if not text:
        return {
            "hasEmojis": False,
            "emojiCount": 0,
            "uniqueCount": 0,
            "list": [],
            "summarySentiment": "None",
            "averageScore": 0.0,
            "conflict": {
                "hasConflict": False,
                "type": "No Emojis",
                "explanation": "Comment contains text only."
            }
        }

    raw_matches = emoji.emoji_list(text)
    if not raw_matches:
        return {
            "hasEmojis": False,
            "emojiCount": 0,
            "uniqueCount": 0,
            "list": [],
            "summarySentiment": "None",
            "averageScore": 0.0,
            "conflict": {
                "hasConflict": False,
                "type": "No Emojis",
                "explanation": "Comment contains text only."
            }
        }

    # Group counts and preserve order
    counts = {}
    for match in raw_matches:
        em_char = match["emoji"]
        counts[em_char] = counts.get(em_char, 0) + 1

    emoji_list = []
    total_score = 0.0
    pos_emojis = 0
    neg_emojis = 0
    neu_emojis = 0

    for em_char, cnt in counts.items():
        sent_label, sent_score = get_single_emoji_sentiment(em_char)
        em_name = clean_emoji_name(em_char)

        total_score += (sent_score * cnt)
        if sent_label == "Positive":
            pos_emojis += cnt
        elif sent_label == "Negative":
            neg_emojis += cnt
        else:
            neu_emojis += cnt

        emoji_list.append({
            "char": em_char,
            "name": em_name,
            "count": cnt,
            "sentiment": sent_label,
            "score": sent_score,
        })

    total_emojis = len(raw_matches)
    avg_score = round(total_score / total_emojis, 3) if total_emojis > 0 else 0.0

    if avg_score >= 0.15 or (pos_emojis > neg_emojis and pos_emojis > 0):
        emoji_overall_sentiment = "Positive"
    elif avg_score <= -0.15 or (neg_emojis > pos_emojis and neg_emojis > 0):
        emoji_overall_sentiment = "Negative"
    else:
        emoji_overall_sentiment = "Neutral"

    # Analyze Relationship Between Text Sentiment and Emoji Sentiment
    has_conflict = False
    conflict_type = "Aligned"
    explanation = "Text and emojis express aligned emotion."

    clean_text = emoji.replace_emoji(text, replace="").strip()
    # If text is virtually empty, emoji is the entire sentiment
    if not clean_text:
        conflict_type = "Emoji Only"
        explanation = "Comment consists purely of visual emojis without text."
    elif text_sentiment == "Negative" and emoji_overall_sentiment == "Positive":
        has_conflict = True
        conflict_type = "Text-Emoji Conflict (Negative Text + Positive Emoji)"
        explanation = "Negative textual wording is contrasted by positive or laughing emoji(s), indicating emotional polarity divergence."
    elif text_sentiment == "Positive" and emoji_overall_sentiment == "Negative":
        has_conflict = True
        conflict_type = "Text-Emoji Conflict (Positive Text + Negative Emoji)"
        explanation = "Complimentary text is contrasted by negative, distressed, or critical emoji(s)."
    elif text_sentiment == "Positive" and emoji_overall_sentiment == "Positive":
        has_conflict = False
        conflict_type = "Positive Reinforcement"
        explanation = "Positive statement is enthusiastically reinforced by positive emojis."
    elif text_sentiment == "Negative" and emoji_overall_sentiment == "Negative":
        has_conflict = False
        conflict_type = "Negative Reinforcement"
        explanation = "Negative criticism is directly reinforced by negative/distressed emojis."
    elif text_sentiment == "Neutral" and emoji_overall_sentiment != "Neutral":
        has_conflict = False
        conflict_type = f"Emoji-Driven {emoji_overall_sentiment}"
        explanation = f"Neutral descriptive text is given emotional valence ({emoji_overall_sentiment}) through emojis."
    else:
        has_conflict = False
        conflict_type = "Neutral Alignment"
        explanation = "Text and emojis maintain a calm, inquiry, or neutral tone."

    return {
        "hasEmojis": True,
        "emojiCount": total_emojis,
        "uniqueCount": len(emoji_list),
        "list": emoji_list,
        "summarySentiment": emoji_overall_sentiment,
        "averageScore": avg_score,
        "conflict": {
            "hasConflict": has_conflict,
            "type": conflict_type,
            "explanation": explanation
        }
    }
