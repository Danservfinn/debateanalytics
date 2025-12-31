#!/usr/bin/env python3
"""
Reddit User Fetcher
Downloads a Reddit user's comment history and analyzes their debate patterns.

Usage:
    python reddit_user_fetcher.py <username> [--output <filename>] [--limit <count>]

Examples:
    python reddit_user_fetcher.py wabeka
    python reddit_user_fetcher.py MiketheTzar --output user_analysis.json --limit 100
"""

import json
import re
import sys
import ssl
import argparse
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path
from collections import Counter
from typing import Optional

# Create SSL context that doesn't verify certificates (for macOS compatibility)
SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


def fetch_reddit_json(url: str) -> dict:
    """Fetch JSON data from Reddit API."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    req = Request(url, headers=headers)

    try:
        with urlopen(req, timeout=30, context=SSL_CONTEXT) as response:
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        raise Exception(f"HTTP Error {e.code}: {e.reason}")
    except URLError as e:
        raise Exception(f"URL Error: {e.reason}")


def fetch_user_comments(username: str, limit: int = 100) -> list:
    """
    Fetch user's comment history with pagination.
    Reddit returns 25 comments per page, max 1000 total.
    """
    all_comments = []
    after = None
    pages_fetched = 0
    max_pages = (limit // 25) + 1

    while len(all_comments) < limit and pages_fetched < max_pages:
        url = f"https://www.reddit.com/user/{username}/comments.json?limit=25"
        if after:
            url += f"&after={after}"

        try:
            data = fetch_reddit_json(url)
        except Exception as e:
            if pages_fetched == 0:
                raise e
            break

        children = data.get('data', {}).get('children', [])
        if not children:
            break

        for child in children:
            if child.get('kind') == 't1':
                comment_data = child.get('data', {})
                all_comments.append({
                    'id': comment_data.get('id', ''),
                    'body': comment_data.get('body', ''),
                    'score': comment_data.get('score', 0),
                    'subreddit': comment_data.get('subreddit', ''),
                    'subreddit_id': comment_data.get('subreddit_id', ''),
                    'link_title': comment_data.get('link_title', ''),
                    'link_id': comment_data.get('link_id', ''),
                    'permalink': comment_data.get('permalink', ''),
                    'created_utc': comment_data.get('created_utc', 0),
                    'controversiality': comment_data.get('controversiality', 0),
                    'edited': comment_data.get('edited', False),
                    'parent_id': comment_data.get('parent_id', ''),
                    'is_submitter': comment_data.get('is_submitter', False),
                })

        after = data.get('data', {}).get('after')
        if not after:
            break

        pages_fetched += 1

    return all_comments[:limit]


def analyze_argument_quality(body: str) -> dict:
    """
    Analyze a comment for argument quality indicators.
    Returns quality metrics based on text analysis.
    """
    body_lower = body.lower()
    word_count = len(body.split())

    # Evidence indicators
    evidence_patterns = [
        r'according to', r'research shows', r'studies indicate',
        r'data suggests', r'evidence shows', r'source:', r'https?://',
        r'statistic', r'percent', r'\d+%', r'published in'
    ]
    evidence_count = sum(1 for p in evidence_patterns if re.search(p, body_lower))

    # Logical structure indicators
    logical_patterns = [
        r'therefore', r'because', r'however', r'although',
        r'in conclusion', r'first.*second', r'on the other hand',
        r'my argument is', r'the reason', r'this shows that'
    ]
    logical_count = sum(1 for p in logical_patterns if re.search(p, body_lower))

    # Fallacy indicators
    fallacy_patterns = {
        'ad_hominem': [r'you\'re (an? )?(idiot|moron|stupid)', r'people like you'],
        'straw_man': [r'so you\'re saying', r'you think that'],
        'appeal_to_emotion': [r'think of the children', r'won\'t someone'],
        'whataboutism': [r'what about', r'but what about'],
        'hasty_generalization': [r'all \w+ are', r'everyone knows', r'nobody']
    }

    detected_fallacies = []
    for fallacy_type, patterns in fallacy_patterns.items():
        for p in patterns:
            if re.search(p, body_lower):
                detected_fallacies.append(fallacy_type)
                break

    # Quality score calculation (1-10)
    base_score = 5

    # Length bonus (substantive comments)
    if word_count >= 100:
        base_score += 1
    if word_count >= 200:
        base_score += 0.5

    # Evidence bonus
    base_score += min(evidence_count, 2)

    # Logical structure bonus
    base_score += min(logical_count, 1.5)

    # Fallacy penalty
    base_score -= len(detected_fallacies) * 1.5

    # Clamp score
    quality_score = max(1, min(10, base_score))

    # Determine quality tier
    if quality_score >= 7:
        quality = 'strong'
    elif quality_score >= 4:
        quality = 'moderate'
    else:
        quality = 'weak'

    return {
        'quality': quality,
        'score': round(quality_score, 1),
        'word_count': word_count,
        'evidence_indicators': evidence_count,
        'logical_indicators': logical_count,
        'fallacies_detected': detected_fallacies
    }


def determine_rhetorical_style(comments: list) -> str:
    """
    Determine the user's overall rhetorical style.
    """
    all_text = ' '.join(c['body'].lower() for c in comments)

    analytical_score = len(re.findall(r'(because|therefore|evidence|data|analysis|study)', all_text))
    emotional_score = len(re.findall(r'(feel|believe|terrible|amazing|love|hate|angry|sad)', all_text))
    aggressive_score = len(re.findall(r'(wrong|stupid|idiotic|never|always|obviously)', all_text))
    passive_score = len(re.findall(r'(maybe|perhaps|might|could|possibly|not sure)', all_text))

    scores = {
        'analytical': analytical_score,
        'emotional': emotional_score,
        'aggressive': aggressive_score,
        'passive': passive_score
    }

    max_style = max(scores, key=scores.get)
    max_value = scores[max_style]

    # Check for balanced style
    values = list(scores.values())
    if max_value > 0 and max(values) / (sum(values) / len(values)) < 1.5:
        return 'balanced'

    return max_style


def calculate_activity_patterns(comments: list) -> dict:
    """
    Calculate user's activity patterns.
    """
    if not comments:
        return {
            'mostActiveHour': 0,
            'mostActiveDay': 'Unknown',
            'avgCommentsPerDay': 0,
            'accountAgeDays': 0
        }

    # Convert timestamps to datetime
    dates = [datetime.fromtimestamp(c['created_utc']) for c in comments]

    # Most active hour
    hours = Counter(d.hour for d in dates)
    most_active_hour = hours.most_common(1)[0][0] if hours else 0

    # Most active day
    days = Counter(d.strftime('%A') for d in dates)
    most_active_day = days.most_common(1)[0][0] if days else 'Unknown'

    # Average comments per day (based on date range in sample)
    if len(dates) >= 2:
        date_range = (max(dates) - min(dates)).days or 1
        avg_per_day = len(comments) / date_range
    else:
        avg_per_day = 0

    # Account age estimate (from oldest comment in sample)
    oldest_date = min(dates) if dates else datetime.now()
    account_age = (datetime.now() - oldest_date).days

    return {
        'mostActiveHour': most_active_hour,
        'mostActiveDay': most_active_day,
        'avgCommentsPerDay': round(avg_per_day, 2),
        'accountAgeDays': account_age
    }


def analyze_user(username: str, comments: list) -> dict:
    """
    Perform comprehensive analysis of user's debate patterns.
    """
    if not comments:
        return None

    # Basic metrics
    total_karma = sum(c['score'] for c in comments)
    avg_karma = total_karma / len(comments) if comments else 0

    # Subreddit activity
    subreddit_stats = {}
    for c in comments:
        sub = c['subreddit']
        if sub not in subreddit_stats:
            subreddit_stats[sub] = {'count': 0, 'karma': 0}
        subreddit_stats[sub]['count'] += 1
        subreddit_stats[sub]['karma'] += c['score']

    top_subreddits = [
        {
            'subreddit': sub,
            'commentCount': stats['count'],
            'totalKarma': stats['karma'],
            'avgKarma': round(stats['karma'] / stats['count'], 1) if stats['count'] > 0 else 0
        }
        for sub, stats in sorted(subreddit_stats.items(), key=lambda x: x[1]['count'], reverse=True)[:10]
    ]

    # Analyze each comment for argument quality
    analyses = [analyze_argument_quality(c['body']) for c in comments]

    strong_count = sum(1 for a in analyses if a['quality'] == 'strong')
    moderate_count = sum(1 for a in analyses if a['quality'] == 'moderate')
    weak_count = sum(1 for a in analyses if a['quality'] == 'weak')

    total_evidence = sum(a['evidence_indicators'] for a in analyses)
    avg_length = sum(a['word_count'] for a in analyses) / len(analyses) if analyses else 0

    # Fallacy profile
    all_fallacies = []
    for a in analyses:
        all_fallacies.extend(a['fallacies_detected'])

    fallacy_counts = Counter(all_fallacies)
    fallacy_types = [
        {'type': f_type, 'count': count}
        for f_type, count in fallacy_counts.most_common()
    ]
    total_fallacies = len(all_fallacies)
    fallacy_rate = round((total_fallacies / len(comments)) * 100, 2) if comments else 0

    # Calculate overall quality score
    avg_quality_score = sum(a['score'] for a in analyses) / len(analyses) if analyses else 5

    # Activity patterns
    activity = calculate_activity_patterns(comments)

    # Rhetorical style
    rhetorical_style = determine_rhetorical_style(comments)

    return {
        'username': username,
        'fetchedAt': datetime.now().isoformat(),
        'totalComments': len(comments),
        'totalKarma': total_karma,
        'avgKarma': round(avg_karma, 1),
        'topSubreddits': top_subreddits,
        'activityPatterns': activity,
        'argumentMetrics': {
            'strongArguments': strong_count,
            'moderateArguments': moderate_count,
            'weakArguments': weak_count,
            'evidenceCited': total_evidence,
            'netArgumentScore': strong_count - weak_count,
            'avgArgumentLength': round(avg_length, 0)
        },
        'fallacyProfile': {
            'totalFallacies': total_fallacies,
            'fallacyTypes': fallacy_types,
            'fallacyRate': fallacy_rate
        },
        'rhetoricalStyle': rhetorical_style,
        'qualityScore': round(avg_quality_score, 1)
    }


def generate_radar_data(user_metrics: dict) -> dict:
    """
    Generate radar chart data for skill visualization.
    """
    metrics = user_metrics['argumentMetrics']
    fallacy = user_metrics['fallacyProfile']

    # Normalize scores to 0-100
    def normalize(value, max_val, invert=False):
        score = min(100, (value / max_val) * 100) if max_val > 0 else 50
        return 100 - score if invert else score

    total_args = metrics['strongArguments'] + metrics['moderateArguments'] + metrics['weakArguments']

    skills = [
        {
            'skill': 'Evidence Use',
            'value': normalize(metrics['evidenceCited'], total_args * 2),
            'fullMark': 100
        },
        {
            'skill': 'Argument Quality',
            'value': user_metrics['qualityScore'] * 10,
            'fullMark': 100
        },
        {
            'skill': 'Logical Rigor',
            'value': normalize(metrics['strongArguments'], total_args) if total_args > 0 else 50,
            'fullMark': 100
        },
        {
            'skill': 'Fallacy Avoidance',
            'value': normalize(fallacy['fallacyRate'], 20, invert=True),
            'fullMark': 100
        },
        {
            'skill': 'Engagement',
            'value': normalize(user_metrics['avgKarma'], 50),
            'fullMark': 100
        },
        {
            'skill': 'Depth',
            'value': normalize(metrics['avgArgumentLength'], 300),
            'fullMark': 100
        }
    ]

    return {
        'username': user_metrics['username'],
        'skills': skills
    }


def main():
    parser = argparse.ArgumentParser(
        description='Download Reddit user comment history and analyze debate patterns',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s wabeka
    %(prog)s MiketheTzar --output /path/to/output.json
    %(prog)s username --limit 200 --raw
        """
    )
    parser.add_argument('username', help='Reddit username (without u/)')
    parser.add_argument('-o', '--output', help='Output JSON file path', default=None)
    parser.add_argument('-l', '--limit', type=int, default=100, help='Max comments to fetch (default: 100)')
    parser.add_argument('--raw', action='store_true', help='Also save raw comment data')
    parser.add_argument('--radar', action='store_true', help='Include radar chart data')
    parser.add_argument('--dir', default='.', help='Output directory (default: current)')

    args = parser.parse_args()

    username = args.username.lstrip('u/')
    print(f"Fetching comments for u/{username}...")

    # Fetch comments
    try:
        comments = fetch_user_comments(username, args.limit)
    except Exception as e:
        print(f"Error fetching comments: {e}", file=sys.stderr)
        sys.exit(1)

    if not comments:
        print(f"No comments found for u/{username}", file=sys.stderr)
        sys.exit(1)

    print(f"Fetched {len(comments)} comments. Analyzing...")

    # Analyze user
    user_metrics = analyze_user(username, comments)

    if args.radar:
        user_metrics['radarData'] = generate_radar_data(user_metrics)

    # Output
    output_dir = Path(args.dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.output:
        output_path = Path(args.output)
    else:
        output_path = output_dir / f"user_{username.lower()}.json"

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(user_metrics, f, indent=2)
    print(f"Saved analysis: {output_path}")

    if args.raw:
        raw_path = output_dir / f"user_{username.lower()}_raw.json"
        with open(raw_path, 'w', encoding='utf-8') as f:
            json.dump(comments, f, indent=2)
        print(f"Saved raw comments: {raw_path}")

    # Print summary
    print(f"\n=== Analysis Summary for u/{username} ===")
    print(f"Total Comments: {user_metrics['totalComments']}")
    print(f"Total Karma: {user_metrics['totalKarma']}")
    print(f"Avg Karma: {user_metrics['avgKarma']}")
    print(f"Quality Score: {user_metrics['qualityScore']}/10")
    print(f"Rhetorical Style: {user_metrics['rhetoricalStyle']}")
    print(f"\nArgument Breakdown:")
    print(f"  Strong: {user_metrics['argumentMetrics']['strongArguments']}")
    print(f"  Moderate: {user_metrics['argumentMetrics']['moderateArguments']}")
    print(f"  Weak: {user_metrics['argumentMetrics']['weakArguments']}")
    print(f"\nFallacy Rate: {user_metrics['fallacyProfile']['fallacyRate']}%")
    print(f"Top Subreddits: {', '.join(s['subreddit'] for s in user_metrics['topSubreddits'][:5])}")


if __name__ == '__main__':
    main()
