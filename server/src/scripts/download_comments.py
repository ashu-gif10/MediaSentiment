#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YouTube Comment Downloader & Dual VADER + Emoji Sentiment Analyzer for MediaSentiment
Fetches up to N comments without quota limits using youtube-comment-downloader.
Runs VADER sentiment analysis and detects real emojis with text-emoji conflict analysis.
Outputs clean UTF-8 JSON to stdout.
"""

import sys
import os
import json
import argparse
import re

# Ensure stdout uses UTF-8 to prevent charmap encoding errors on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Add current script directory to path for local imports
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from emoji_analyzer import extract_and_analyze_emojis

def parse_votes(votes_raw):
    """Convert raw vote string (e.g. '2.2k', '1.5M', '12', None) to integer."""
    if not votes_raw:
        return 0
    val_str = str(votes_raw).strip().lower().replace(',', '')
    try:
        if val_str.endswith('k'):
            return int(float(val_str[:-1]) * 1000)
        elif val_str.endswith('m'):
            return int(float(val_str[:-1]) * 1000000)
        return int(float(val_str))
    except Exception:
        return 0

def normalize_url(url_or_id):
    """Normalize video ID or URL into standard https://www.youtube.com/watch?v=ID format."""
    trimmed = (url_or_id or '').strip()
    if re.match(r'^[a-zA-Z0-9_-]{11}$', trimmed):
        return f"https://www.youtube.com/watch?v={trimmed}", trimmed
    
    match = re.search(r'(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', trimmed)
    if match:
        vid = match.group(1)
        return f"https://www.youtube.com/watch?v={vid}", vid
    
    return trimmed, ""

def classify_vader_compound(compound):
    """Standard VADER classification threshold."""
    if compound >= 0.05:
        return "Positive"
    elif compound <= -0.05:
        return "Negative"
    else:
        return "Neutral"

def main():
    parser = argparse.ArgumentParser(description="Download YouTube comments and analyze with VADER and Emoji analysis.")
    parser.add_argument("url", nargs="?", default="", help="YouTube video URL or 11-character video ID")
    parser.add_argument("--url", dest="opt_url", default="", help="Alternative URL option")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum number of comments to download (default 1000)")
    parser.add_argument("--sort", type=int, default=0, choices=[0, 1], help="0 for popular (default), 1 for recent")
    args = parser.parse_args()

    input_target = args.opt_url or args.url
    if not input_target:
        sys.stderr.write(json.dumps({"success": False, "error": "No YouTube URL or Video ID provided"}))
        sys.exit(1)

    normalized_url, video_id = normalize_url(input_target)

    # Initialize VADER Sentiment Analyzer
    vader_analyzer = None
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        vader_analyzer = SentimentIntensityAnalyzer()
    except ImportError:
        pass

    try:
        from youtube_comment_downloader import YoutubeCommentDownloader, SORT_BY_POPULAR, SORT_BY_RECENT
    except ImportError as e:
        sys.stderr.write(json.dumps({"success": False, "error": f"youtube-comment-downloader module missing: {e}"}))
        sys.exit(2)

    downloader = YoutubeCommentDownloader()
    sort_mode = SORT_BY_RECENT if args.sort == 1 else SORT_BY_POPULAR

    comments = []
    seen_cids = set()
    top_level_count = 0
    reply_count = 0
    is_comments_disabled = False

    # VADER metric accumulators
    vader_pos_count = 0
    vader_neg_count = 0
    vader_neu_count = 0
    total_compound_sum = 0.0

    # Emoji metric accumulators
    total_emojis_detected = 0
    comments_with_emojis_count = 0
    emoji_frequency = {} # char -> { char, name, count, sentiment }
    emoji_sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
    conflicting_comments = []

    target_limit = max(1, args.limit)

    try:
        generator = downloader.get_comments_from_url(normalized_url, sort_by=sort_mode)
        
        # Continuous loop without premature cut-off, with deduplication
        for item in generator:
            if len(comments) >= target_limit:
                break

            cid = item.get("cid")
            if cid and cid in seen_cids:
                continue

            raw_text = (item.get("text") or "").strip()
            if not raw_text:
                continue

            if cid:
                seen_cids.add(cid)

            is_reply = bool(item.get("reply", False))
            if is_reply:
                reply_count += 1
            else:
                top_level_count += 1

            votes = parse_votes(item.get("votes"))
            pub_time = item.get("time") or "Recently"
            author = item.get("author") or "YouTube User"

            # 1. VADER Sentiment Analysis
            vader_data = None
            v_sentiment = "Neutral"
            if vader_analyzer:
                scores = vader_analyzer.polarity_scores(raw_text)
                comp = round(float(scores["compound"]), 4)
                v_sentiment = classify_vader_compound(comp)
                
                vader_data = {
                    "sentiment": v_sentiment,
                    "compound": comp,
                    "pos": round(float(scores["pos"]), 3),
                    "neg": round(float(scores["neg"]), 3),
                    "neu": round(float(scores["neu"]), 3),
                }

                total_compound_sum += comp
                if v_sentiment == "Positive":
                    vader_pos_count += 1
                elif v_sentiment == "Negative":
                    vader_neg_count += 1
                else:
                    vader_neu_count += 1

            # 2. Emoji Detection & Text-Emoji Relationship Analysis
            emoji_analysis = extract_and_analyze_emojis(raw_text, text_sentiment=v_sentiment)

            if emoji_analysis["hasEmojis"]:
                comments_with_emojis_count += 1
                total_emojis_detected += emoji_analysis["emojiCount"]

                # Accumulate emoji frequencies and sentiment trends
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

                    # Sentiment counts
                    if em["sentiment"] == "Positive":
                        emoji_sentiment_counts["positive"] += em["count"]
                    elif em["sentiment"] == "Negative":
                        emoji_sentiment_counts["negative"] += em["count"]
                    else:
                        emoji_sentiment_counts["neutral"] += em["count"]

                # Track text-emoji polarity conflicts
                if emoji_analysis["conflict"]["hasConflict"]:
                    conflicting_comments.append({
                        "id": cid or f"py_cmt_{len(comments) + 1}",
                        "author": author,
                        "text": raw_text,
                        "vaderSentiment": v_sentiment,
                        "emojiSentiment": emoji_analysis["summarySentiment"],
                        "conflictType": emoji_analysis["conflict"]["type"],
                        "explanation": emoji_analysis["conflict"]["explanation"],
                        "emojis": emoji_analysis["list"],
                    })

            comments.append({
                "id": cid or f"py_cmt_{len(comments) + 1}",
                "author": author,
                "text": raw_text,
                "likeCount": votes,
                "isReply": is_reply,
                "publishedAt": pub_time,
                "timeParsed": item.get("time_parsed"),
                "authorProfileImageUrl": item.get("photo") or "",
                "channelId": item.get("channel") or "",
                "heart": bool(item.get("heart", False)),
                "vader": vader_data,
                "emojis": emoji_analysis["list"],
                "emojiCount": emoji_analysis["emojiCount"],
                "emojiSentiment": emoji_analysis["summarySentiment"],
                "emojiConflict": emoji_analysis["conflict"],
            })
    except Exception as e:
        err_str = str(e).lower()
        if "comments are turned off" in err_str or "disabled" in err_str:
            is_comments_disabled = True
        else:
            if len(comments) == 0:
                sys.stderr.write(f"Error fetching comments: {str(e)}\n")

    total_c = len(comments)
    vader_pos_pct = round((vader_pos_count / total_c) * 100) if total_c > 0 else 0
    vader_neg_pct = round((vader_neg_count / total_c) * 100) if total_c > 0 else 0
    vader_neu_pct = max(0, 100 - vader_pos_pct - vader_neg_pct) if total_c > 0 else 0
    avg_compound = round(total_compound_sum / total_c, 4) if total_c > 0 else 0.0

    # Top Emojis sorted by usage count
    top_emojis = sorted(emoji_frequency.values(), key=lambda x: x["count"], reverse=True)[:15]

    emoji_usage_pct = round((comments_with_emojis_count / total_c) * 100) if total_c > 0 else 0

    result = {
        "success": True,
        "videoId": video_id,
        "totalFetched": total_c,
        "topLevelCount": top_level_count,
        "replyCount": reply_count,
        "commentsDisabled": is_comments_disabled,
        "vaderAnalysis": {
            "totalAnalyzed": total_c,
            "stats": {
                "positive": vader_pos_count,
                "negative": vader_neg_count,
                "neutral": vader_neu_count,
            },
            "percentages": {
                "positive": vader_pos_pct,
                "negative": vader_neg_pct,
                "neutral": vader_neu_pct,
            },
            "averageCompound": avg_compound,
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
        "comments": comments
    }

    # Output formatted JSON string to stdout
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    sys.stdout.flush()

if __name__ == "__main__":
    main()
