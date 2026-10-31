#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from emoji_analyzer import extract_and_analyze_emojis

test_cases = [
    {
        "name": "No emojis",
        "text": "This is a great video with no emojis whatsoever.",
        "text_sentiment": "Positive"
    },
    {
        "name": "Single emoji",
        "text": "Brilliant standup 😂",
        "text_sentiment": "Positive"
    },
    {
        "name": "Repeated identical emojis",
        "text": "Haha funny 😂😂😂😂😂",
        "text_sentiment": "Positive"
    },
    {
        "name": "Multiple distinct emojis",
        "text": "Loved the set ❤️🔥👏 keep it up 💯",
        "text_sentiment": "Positive"
    },
    {
        "name": "Repeated and mixed emojis",
        "text": "Omg 😂😂😂❤️❤️🔥",
        "text_sentiment": "Positive"
    },
    {
        "name": "Skin tone and modifier emojis",
        "text": "Great job brother 👍🏽 and thanks 🙏🏼",
        "text_sentiment": "Positive"
    },
    {
        "name": "Negative text + Positive emoji (Polarity conflict)",
        "text": "Worst comedy routine ever, complete waste of money 😂😂😂",
        "text_sentiment": "Negative"
    },
    {
        "name": "Positive text + Negative emoji (Polarity conflict)",
        "text": "Such a masterpiece but the ending broke my heart 😭😭💔",
        "text_sentiment": "Positive"
    },
    {
        "name": "Negative text + Negative emoji (Aligned negative)",
        "text": "Awful audio mic quality, could not hear anything 😡👎",
        "text_sentiment": "Negative"
    },
    {
        "name": "Neutral question + Neutral emoji",
        "text": "What song is playing in the background at 04:15? 🤔",
        "text_sentiment": "Neutral"
    }
]

print("=== EMOJI ANALYZER TEST SUITE ===")
all_passed = True
total_emojis_sum = 0
sentiment_dist = {"positive": 0, "negative": 0, "neutral": 0}

for tc in test_cases:
    res = extract_and_analyze_emojis(tc["text"], text_sentiment=tc["text_sentiment"])
    sum_counts = sum(item["count"] for item in res["list"])
    is_count_consistent = (sum_counts == res["emojiCount"])

    if not is_count_consistent:
        all_passed = False
        print(f"FAILED count consistency on {tc['name']}: {sum_counts} vs {res['emojiCount']}")

    total_emojis_sum += res["emojiCount"]
    for item in res["list"]:
        s = item["sentiment"].lower()
        sentiment_dist[s] += item["count"]

    print(f"\n[Case: {tc['name']}]")
    print(f"  Text: {tc['text']}")
    print(f"  hasEmojis: {res['hasEmojis']}, Count: {res['emojiCount']}, Unique: {res['uniqueCount']}")
    print(f"  List: {[(item['char'], 'x' + str(item['count']), item['name'], item['sentiment']) for item in res['list']]}")
    print(f"  Emoji Sentiment: {res['summarySentiment']}, Score: {res['averageScore']}")
    print(f"  Conflict: {res['conflict']}")

print("\n=== AGGREGATE CONSISTENCY CHECK ===")
dist_sum = sentiment_dist["positive"] + sentiment_dist["negative"] + sentiment_dist["neutral"]
print(f"Total emojis processed: {total_emojis_sum}")
print(f"Sentiment distribution: {sentiment_dist}")
print(f"Sum of sentiments: {dist_sum}")
print(f"Consistency check: {total_emojis_sum == dist_sum}")

if not (total_emojis_sum == dist_sum):
    all_passed = False

if all_passed:
    print("\nALL EMOJI UNIT TESTS PASSED SUCCESSFULLY! ✅")
else:
    print("\nSOME TESTS FAILED! ❌")

