#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VADER & Emoji Sentiment Analyzer helper for MediaSentiment.
Reads JSON array of comments from stdin or file, returns enriched comments,
VADER summary, and Emoji Analytics.
"""

import sys
import os
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')

script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from emoji_analyzer import extract_and_analyze_emojis

def classify_compound(compound):
    if compound >= 0.05:
        return "Positive"
    elif compound <= -0.05:
        return "Negative"
    return "Neutral"

def main():
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    except ImportError as e:
        sys.stderr.write(json.dumps({"success": False, "error": f"vaderSentiment missing: {e}"}))
        sys.exit(1)

    try:
        raw_input_data = sys.stdin.read()
        if not raw_input_data.strip():
            sys.stdout.write(json.dumps({"success": False, "error": "Empty input"}))
            sys.exit(0)
        comments = json.loads(raw_input_data)
    except Exception as e:
        sys.stderr.write(f"Failed to parse stdin JSON: {e}\n")
        sys.exit(2)

    analyzer = SentimentIntensityAnalyzer()
    pos_count = 0
    neg_count = 0
    neu_count = 0
    compound_sum = 0.0

    total_emojis_detected = 0
    comments_with_emojis_count = 0
    emoji_frequency = {}
    emoji_sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
    conflicting_comments = []

    enriched = []
    for c in comments:
        text = c.get("text", "")
        scores = analyzer.polarity_scores(text)
        comp = round(float(scores["compound"]), 4)
        sentiment = classify_compound(comp)

        compound_sum += comp
        if sentiment == "Positive":
            pos_count += 1
        elif sentiment == "Negative":
            neg_count += 1
        else:
            neu_count += 1

        # Emoji detection & conflict analysis
        emoji_analysis = extract_and_analyze_emojis(text, text_sentiment=sentiment)
        if emoji_analysis["hasEmojis"]:
            comments_with_emojis_count += 1
            total_emojis_detected += emoji_analysis["emojiCount"]

            for em in emoji_analysis["list"]:
                ch = em["char"]
                if ch not in emoji_frequency:
                    emoji_frequency[ch] = {
                        "char": ch,
                        "name": em["name"],
                        "count": 0,
                        "sentiment": em["sentiment"],
                    }
                emoji_frequency[ch]["count"] += em["count"]

                if em["sentiment"] == "Positive":
                    emoji_sentiment_counts["positive"] += em["count"]
                elif em["sentiment"] == "Negative":
                    emoji_sentiment_counts["negative"] += em["count"]
                else:
                    emoji_sentiment_counts["neutral"] += em["count"]

            if emoji_analysis["conflict"]["hasConflict"]:
                conflicting_comments.append({
                    "id": c.get("id"),
                    "author": c.get("author", "User"),
                    "text": text,
                    "vaderSentiment": sentiment,
                    "emojiSentiment": emoji_analysis["summarySentiment"],
                    "conflictType": emoji_analysis["conflict"]["type"],
                    "explanation": emoji_analysis["conflict"]["explanation"],
                    "emojis": emoji_analysis["list"],
                })

        enriched_comment = dict(c)
        enriched_comment["vader"] = {
            "sentiment": sentiment,
            "compound": comp,
            "pos": round(float(scores["pos"]), 3),
            "neg": round(float(scores["neg"]), 3),
            "neu": round(float(scores["neu"]), 3),
        }
        enriched_comment["emojis"] = emoji_analysis["list"]
        enriched_comment["emojiCount"] = emoji_analysis["emojiCount"]
        enriched_comment["emojiSentiment"] = emoji_analysis["summarySentiment"]
        enriched_comment["emojiConflict"] = emoji_analysis["conflict"]

        enriched.append(enriched_comment)

    total = len(enriched)
    pos_pct = round((pos_count / total) * 100) if total > 0 else 0
    neg_pct = round((neg_count / total) * 100) if total > 0 else 0
    neu_pct = max(0, 100 - pos_pct - neg_pct) if total > 0 else 0
    avg_comp = round(compound_sum / total, 4) if total > 0 else 0.0

    top_emojis = sorted(emoji_frequency.values(), key=lambda x: x["count"], reverse=True)[:15]
    emoji_usage_pct = round((comments_with_emojis_count / total) * 100) if total > 0 else 0

    output = {
        "success": True,
        "vaderAnalysis": {
            "totalAnalyzed": total,
            "stats": {
                "positive": pos_count,
                "negative": neg_count,
                "neutral": neu_count,
            },
            "percentages": {
                "positive": pos_pct,
                "negative": neg_pct,
                "neutral": neu_pct,
            },
            "averageCompound": avg_comp,
        },
        "emojiAnalytics": {
            "totalEmojisDetected": total_emojis_detected,
            "uniqueEmojisCount": len(emoji_frequency),
            "commentsWithEmojisCount": comments_with_emojis_count,
            "emojiUsagePercentage": emoji_usage_pct,
            "sentimentDistribution": emoji_sentiment_counts,
            "topEmojis": top_emojis,
            "conflictingCommentsCount": len(conflicting_comments),
            "conflictingComments": conflicting_comments[:10],
        },
        "comments": enriched,
    }

    sys.stdout.write(json.dumps(output, ensure_ascii=False))
    sys.stdout.flush()

if __name__ == "__main__":
    main()
