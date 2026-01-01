#!/usr/bin/env python3
"""
Debate Analyzer Web Interface
=============================
A Flask-based web interface for viewing Reddit debate analyses.
Provides historical tracking, user/thread browsing, and refresh capabilities.

Now includes sophisticated Thread Deep Analysis powered by Claude.

Usage:
    python debate_analyzer_web.py [--port 5000] [--debug]
"""

import os
import json
import sqlite3
import threading
import argparse
import hashlib
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template_string, jsonify, request, redirect, url_for
from collections import defaultdict

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass  # dotenv not installed, rely on system environment

# Import the fetcher module
from reddit_debate_fetcher import (
    RedditClient, DebateAnalyzer, ARGUMENT_TYPES, LOGICAL_FALLACIES
)

# Import thread deep analyzer
try:
    from thread_deep_analyzer import ThreadDeepAnalyzer, HAS_ANTHROPIC
    HAS_THREAD_ANALYZER = True
except ImportError:
    HAS_THREAD_ANALYZER = False
    HAS_ANTHROPIC = False

app = Flask(__name__)
DB_PATH = Path(__file__).parent / "debate_analyses.db"

# =============================================================================
# Database Setup
# =============================================================================

def get_db():
    """Get database connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database schema."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_analyzed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_threads INTEGER DEFAULT 0,
            total_comments INTEGER DEFAULT 0,
            total_words INTEGER DEFAULT 0,
            avg_debate_score REAL DEFAULT 0,
            win_count INTEGER DEFAULT 0,
            loss_count INTEGER DEFAULT 0,
            draw_count INTEGER DEFAULT 0,
            fallacy_rate REAL DEFAULT 0,
            primary_arg_style TEXT,
            primary_fallacy TEXT,
            data_json TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER NOT NULL,
            thread_id TEXT NOT NULL,
            title TEXT,
            subreddit TEXT,
            url TEXT,
            debate_score REAL DEFAULT 0,
            user_comment_count INTEGER DEFAULT 0,
            total_words INTEGER DEFAULT 0,
            exchange_partners TEXT,
            FOREIGN KEY (analysis_id) REFERENCES analyses(id)
        );

        CREATE TABLE IF NOT EXISTS argument_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER NOT NULL,
            arg_type TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            FOREIGN KEY (analysis_id) REFERENCES analyses(id)
        );

        CREATE TABLE IF NOT EXISTS fallacies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER NOT NULL,
            fallacy_type TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            examples TEXT,
            FOREIGN KEY (analysis_id) REFERENCES analyses(id)
        );

        CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id);
        CREATE INDEX IF NOT EXISTS idx_threads_analysis ON threads(analysis_id);

        -- Thread Deep Analysis Tables
        CREATE TABLE IF NOT EXISTS thread_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_url TEXT NOT NULL,
            thread_id TEXT,
            thread_title TEXT,
            subreddit TEXT,
            op_username TEXT,
            analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            outcome_type TEXT,
            winner TEXT,
            loser TEXT,
            verdict_confidence REAL,
            quality_grade TEXT,
            quality_score INTEGER,
            participant_count INTEGER,
            total_comments INTEGER,
            total_clashes INTEGER,
            total_fallacies INTEGER,
            overall_civility INTEGER,
            narrative_summary TEXT,
            full_analysis_json TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_thread_analyses_url ON thread_analyses(thread_url);
        CREATE INDEX IF NOT EXISTS idx_thread_analyses_subreddit ON thread_analyses(subreddit);
    """)
    conn.commit()
    conn.close()


# =============================================================================
# Analysis Logic
# =============================================================================

def run_analysis(username: str, comment_limit: int = 100) -> dict:
    """Run debate analysis for a user and store results."""
    client = RedditClient()
    analyzer = DebateAnalyzer(username, client)

    # Fetch and analyze threads
    threads = analyzer.analyze_user_threads(
        comment_limit=comment_limit,
        post_limit=100,
        fetch_thread_context=True,
    )

    if not threads:
        return {'error': 'No threads found'}

    # Filter threads meeting threshold
    debate_threads = [t for t in threads if t.debate_score >= 0.05]

    # Collect all comments for rhetoric analysis
    all_comments = []
    for t in debate_threads:
        all_comments.extend(t.user_comments)

    # Perform rhetoric analysis
    rhetoric = analyzer.analyze_user_rhetoric(all_comments) if all_comments else {}

    # Calculate win/loss (simplified scoring)
    wins, losses, draws = 0, 0, 0
    for t in debate_threads:
        avg_karma = sum(c.score for c in t.user_comments) / len(t.user_comments) if t.user_comments else 0
        indicators = t.debate_indicators
        score = 0
        if avg_karma >= 3: score += 2
        elif avg_karma >= 1: score += 0
        else: score -= 1
        if indicators.get('rebuttal', 0) > 0.02: score += 1
        if indicators.get('logical', 0) > 0.02: score += 1
        if t.user_comment_count >= 3: score += 1

        if score >= 3: wins += 1
        elif score <= 1: losses += 1
        else: draws += 1

    # Get primary styles
    arg_types = rhetoric.get('argument_types', {})
    fallacies = rhetoric.get('fallacies', {})

    primary_arg = max(arg_types.items(), key=lambda x: x[1])[0] if arg_types else None
    primary_fallacy = max(fallacies.items(), key=lambda x: x[1]['count'])[0] if fallacies else None

    total_args = sum(arg_types.values())
    total_fallacies = sum(f['count'] for f in fallacies.values())
    fallacy_rate = (total_fallacies / total_args * 100) if total_args > 0 else 0

    # Store in database
    conn = get_db()
    cursor = conn.cursor()

    # Upsert user
    cursor.execute("""
        INSERT INTO users (username, last_analyzed_at)
        VALUES (?, CURRENT_TIMESTAMP)
        ON CONFLICT(username) DO UPDATE SET last_analyzed_at = CURRENT_TIMESTAMP
    """, (username,))

    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    user_id = cursor.fetchone()[0]

    # Insert analysis
    cursor.execute("""
        INSERT INTO analyses (
            user_id, total_threads, total_comments, total_words,
            avg_debate_score, win_count, loss_count, draw_count,
            fallacy_rate, primary_arg_style, primary_fallacy, data_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id,
        len(debate_threads),
        len(all_comments),
        sum(t.total_words for t in debate_threads),
        sum(t.debate_score for t in debate_threads) / len(debate_threads) if debate_threads else 0,
        wins, losses, draws,
        fallacy_rate,
        primary_arg,
        primary_fallacy,
        json.dumps(rhetoric)
    ))
    analysis_id = cursor.lastrowid

    # Insert threads
    for t in debate_threads:
        cursor.execute("""
            INSERT INTO threads (
                analysis_id, thread_id, title, subreddit, url,
                debate_score, user_comment_count, total_words, exchange_partners
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            analysis_id, t.thread_id, t.thread_title, t.subreddit, t.thread_url,
            t.debate_score, t.user_comment_count, t.total_words,
            json.dumps(list(t.exchange_partners.keys()))
        ))

    # Insert argument types
    for arg_type, count in arg_types.items():
        cursor.execute("""
            INSERT INTO argument_types (analysis_id, arg_type, count)
            VALUES (?, ?, ?)
        """, (analysis_id, arg_type, count))

    # Insert fallacies
    for fallacy, data in fallacies.items():
        cursor.execute("""
            INSERT INTO fallacies (analysis_id, fallacy_type, count, examples)
            VALUES (?, ?, ?, ?)
        """, (analysis_id, fallacy, data['count'], json.dumps(data.get('examples', []))))

    conn.commit()
    conn.close()

    return {
        'success': True,
        'username': username,
        'analysis_id': analysis_id,
        'threads': len(debate_threads),
        'comments': len(all_comments),
    }


def run_thread_analysis(thread_url: str) -> dict:
    """Run deep thread analysis and store results."""
    if not HAS_THREAD_ANALYZER:
        return {'error': 'Thread analyzer not available. Install thread_deep_analyzer.py'}

    if not HAS_ANTHROPIC:
        return {'error': 'Anthropic API not available. Install anthropic package and set ANTHROPIC_API_KEY'}

    try:
        # Pass Reddit OAuth credentials for authenticated API access
        analyzer = ThreadDeepAnalyzer(
            reddit_client_id=os.environ.get('REDDIT_CLIENT_ID'),
            reddit_client_secret=os.environ.get('REDDIT_CLIENT_SECRET')
        )
        analysis = analyzer.analyze_thread(thread_url, use_cache=True)

        # Store in database
        conn = get_db()
        cursor = conn.cursor()

        # Get fallacy count
        fallacy_count = len(analysis.fallacies) if analysis.fallacies else 0
        clash_count = len(analysis.clashes) if analysis.clashes else 0

        cursor.execute("""
            INSERT INTO thread_analyses (
                thread_url, thread_id, thread_title, subreddit, op_username,
                outcome_type, winner, loser, verdict_confidence,
                quality_grade, quality_score, participant_count, total_comments,
                total_clashes, total_fallacies, overall_civility,
                narrative_summary, full_analysis_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            thread_url,
            analysis.thread_id,
            analysis.thread_title,
            analysis.subreddit,
            analysis.op_username,
            analysis.verdict.outcome_type,
            analysis.verdict.winner,
            analysis.verdict.loser,
            analysis.verdict.confidence,
            analysis.thread_quality_grade,
            analysis.thread_quality_score,
            analysis.participant_count,
            analysis.structure.total_comments,
            clash_count,
            fallacy_count,
            analysis.overall_civility,
            analysis.narrative_summary,
            json.dumps(analyzer._analysis_to_dict(analysis))
        ))

        analysis_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return {
            'success': True,
            'analysis_id': analysis_id,
            'thread_title': analysis.thread_title,
            'winner': analysis.verdict.winner,
            'outcome': analysis.verdict.outcome_type
        }
    except Exception as e:
        return {'error': str(e)}


# =============================================================================
# HTML Templates
# =============================================================================

BASE_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ page_title | default('Debate Analytics') }}</title>
    <style>
        :root {
            --bg: #0a0a0f;
            --bg-secondary: rgba(20, 20, 30, 0.8);
            --bg-card: rgba(30, 30, 45, 0.6);
            --border: rgba(139, 92, 246, 0.3);
            --border-hover: rgba(139, 92, 246, 0.5);
            --text: #e2e8f0;
            --text-muted: #94a3b8;
            --accent: #a855f7;
            --accent-light: #c084fc;
            --green: #22c55e;
            --red: #ef4444;
            --yellow: #eab308;
            --purple: #a855f7;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            min-height: 100vh;
            position: relative;
        }
        /* Gradient background overlay */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background:
                radial-gradient(ellipse at 0% 0%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse at 100% 100%, rgba(234, 88, 12, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(20, 20, 30, 0.5) 0%, transparent 100%);
            pointer-events: none;
            z-index: -1;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        nav {
            background: rgba(10, 10, 15, 0.9);
            border-bottom: 1px solid var(--border);
            padding: 16px 0;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
        }
        nav .container {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        nav .nav-left {
            display: flex;
            align-items: center;
            gap: 30px;
        }
        nav .nav-links {
            display: flex;
            align-items: center;
            gap: 24px;
        }
        nav a {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            transition: color 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        nav a:hover { color: var(--accent-light); }
        nav .logo {
            font-size: 1.3em;
            font-weight: 600;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        nav .logo-icon {
            width: 28px;
            height: 28px;
            background: var(--accent);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        nav .logo span { color: var(--accent); }
        nav .ai-badge {
            font-size: 12px;
            color: var(--text-muted);
        }
        h1, h2, h3 { margin-bottom: 16px; color: var(--text); }
        h1 span, h2 span { color: var(--accent); }
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            backdrop-filter: blur(10px);
            transition: border-color 0.2s;
        }
        .card:hover {
            border-color: var(--border-hover);
        }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }
        th { color: var(--text-muted); font-weight: 500; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:hover { background: rgba(139, 92, 246, 0.05); }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
        }
        .btn:hover {
            background: var(--accent-light);
            transform: translateY(-1px);
        }
        .btn-sm { padding: 6px 14px; font-size: 12px; }
        .btn-outline {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text);
        }
        .btn-outline:hover {
            border-color: var(--accent);
            color: var(--accent);
            background: rgba(139, 92, 246, 0.1);
        }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            position: relative;
            overflow: hidden;
        }
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 60px;
            height: 60px;
            background: rgba(139, 92, 246, 0.1);
            border-radius: 0 12px 0 40px;
        }
        .stat-card .stat-icon {
            position: absolute;
            top: 12px;
            right: 12px;
            font-size: 18px;
            opacity: 0.6;
        }
        .stat-label { color: var(--text-muted); font-size: 13px; margin-bottom: 8px; }
        .stat-value { font-size: 2.2em; font-weight: 700; color: var(--text); }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-green { background: rgba(34, 197, 94, 0.2); color: var(--green); }
        .badge-red { background: rgba(239, 68, 68, 0.2); color: var(--red); }
        .badge-yellow { background: rgba(234, 179, 8, 0.2); color: var(--yellow); }
        .badge-purple { background: rgba(168, 85, 247, 0.2); color: var(--purple); }
        .progress-bar {
            height: 8px;
            background: rgba(139, 92, 246, 0.2);
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-light)); }
        .chart-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        .chart-label { width: 150px; font-size: 14px; }
        .chart-value { width: 50px; text-align: right; color: var(--text-muted); }
        .chart-fill {
            height: 20px;
            background: linear-gradient(90deg, var(--accent), var(--accent-light));
            border-radius: 4px;
            min-width: 4px;
        }
        input[type="text"] {
            padding: 12px 16px;
            background: rgba(20, 20, 30, 0.8);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 14px;
            width: 280px;
            transition: border-color 0.2s;
        }
        input[type="text"]::placeholder { color: var(--text-muted); }
        input[type="text"]:focus { outline: none; border-color: var(--accent); }
        .form-inline { display: flex; gap: 12px; align-items: center; }
        .loading { opacity: 0.6; pointer-events: none; }
        .alert {
            padding: 14px 18px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        .alert-success { background: rgba(34, 197, 94, 0.1); border: 1px solid var(--green); }
        .alert-error { background: rgba(239, 68, 68, 0.1); border: 1px solid var(--red); }
        .text-muted { color: var(--text-muted); }
        .text-green { color: var(--green); }
        .text-red { color: var(--red); }
        .text-accent { color: var(--accent); }
        .mt-4 { margin-top: 24px; }
        .mb-4 { margin-bottom: 24px; }
        /* Hero section */
        .hero {
            text-align: center;
            padding: 40px 0 50px;
        }
        .hero h1 {
            font-size: 2.5em;
            margin-bottom: 12px;
        }
        .hero p {
            color: var(--text-muted);
            font-size: 1.1em;
            max-width: 600px;
            margin: 0 auto;
        }
        /* Pills/tags */
        .tag-pills {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 16px;
            justify-content: center;
        }
        .pill {
            padding: 6px 14px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 20px;
            font-size: 13px;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s;
        }
        .pill:hover {
            border-color: var(--accent);
            color: var(--accent);
        }
        /* Section titles */
        .section-title {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 20px;
            color: var(--text);
        }
        /* Footer */
        .footer {
            text-align: center;
            padding: 40px 0;
            color: var(--text-muted);
            font-size: 14px;
            border-top: 1px solid var(--border);
            margin-top: 60px;
        }
    </style>
</head>
<body>
    <nav>
        <div class="container">
            <div class="nav-left">
                <a href="/" class="logo">
                    <span class="logo-icon">💬</span>
                    Debate<span>Analytics</span>
                </a>
                <div class="nav-links">
                    <a href="/users">📊 Dashboard</a>
                    <a href="/threads">🏆 Leaderboard</a>
                    <a href="/thread-analysis">🔬 Thread Analysis</a>
                </div>
            </div>
            <span class="ai-badge">Powered by AI Analysis</span>
        </div>
    </nav>
    <div class="container">
        {% block content %}{% endblock %}
    </div>
    <script>
        function refreshAnalysis(username) {
            if (!confirm('Re-analyze u/' + username + '? This may take a minute.')) return;

            const btn = event.target;
            btn.classList.add('loading');
            btn.textContent = 'Analyzing...';

            fetch('/api/analyze/' + username, { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        alert('Error: ' + (data.error || 'Unknown error'));
                        btn.classList.remove('loading');
                        btn.textContent = '🔄 Refresh';
                    }
                })
                .catch(err => {
                    alert('Error: ' + err);
                    btn.classList.remove('loading');
                    btn.textContent = '🔄 Refresh';
                });
        }

        function analyzeUser() {
            const input = document.getElementById('username');
            const username = input.value.trim().replace(/^u\\//, '');
            if (!username) return;

            const btn = event.target;
            btn.classList.add('loading');
            btn.textContent = 'Analyzing...';

            fetch('/api/analyze/' + username, { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        window.location.href = '/users/' + username;
                    } else {
                        alert('Error: ' + (data.error || 'Unknown error'));
                        btn.classList.remove('loading');
                        btn.textContent = 'Analyze';
                    }
                })
                .catch(err => {
                    alert('Error: ' + err);
                    btn.classList.remove('loading');
                    btn.textContent = 'Analyze';
                });
        }
    </script>
</body>
</html>
"""

HOME_TEMPLATE = """
<div class="hero">
    <h1>Reddit <span>Debate Analytics</span></h1>
    <p>AI-powered analysis of Reddit debates. Track argument quality, detect logical fallacies, and compare debaters across threads.</p>

    <div class="form-inline mt-4" style="justify-content: center;">
        <input type="text" id="username" placeholder="Enter Reddit username or thread URL..." style="width: 400px;" />
        <button class="btn" onclick="analyzeUser()">Analyze</button>
    </div>

    <div class="tag-pills">
        <span class="pill">r/changemyview</span>
        <span class="pill">r/politics</span>
        <span class="pill">r/philosophy</span>
    </div>
</div>

<h2 class="section-title">Overview</h2>
<div class="stat-grid">
    <div class="stat-card">
        <span class="stat-icon">💬</span>
        <div class="stat-label">Threads Analyzed</div>
        <div class="stat-value">{{ stats.total_threads }}</div>
    </div>
    <div class="stat-card">
        <span class="stat-icon">👥</span>
        <div class="stat-label">Unique Debaters</div>
        <div class="stat-value">{{ stats.total_users }}</div>
    </div>
    <div class="stat-card">
        <span class="stat-icon">🏆</span>
        <div class="stat-label">Strong Arguments</div>
        <div class="stat-value">{{ stats.total_analyses }}</div>
    </div>
    <div class="stat-card">
        <span class="stat-icon">⚠️</span>
        <div class="stat-label">Fallacies Detected</div>
        <div class="stat-value">-</div>
    </div>
</div>

<h2 class="section-title mt-4">Recent Threads</h2>
{% if recent_users %}
<div class="card">
    <table>
        <thead>
            <tr>
                <th>User</th>
                <th>Last Analyzed</th>
                <th>Threads</th>
                <th>Win Rate</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {% for user in recent_users %}
            <tr>
                <td><a href="/users/{{ user.username }}" style="color: var(--accent);">u/{{ user.username }}</a></td>
                <td class="text-muted">{{ user.last_analyzed_at }}</td>
                <td>{{ user.total_threads or 0 }}</td>
                <td>
                    {% if user.total_threads %}
                    <span class="badge badge-green">{{ "%.1f"|format(user.win_count / (user.win_count + user.loss_count + user.draw_count) * 100 if (user.win_count + user.loss_count + user.draw_count) > 0 else 0) }}%</span>
                    {% else %}-{% endif %}
                </td>
                <td><a href="/users/{{ user.username }}" class="btn btn-sm btn-outline">View</a></td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
{% else %}
<div class="card" style="text-align: center; padding: 60px 20px;">
    <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
    <p class="text-muted">No threads analyzed yet.</p>
    <p class="text-muted">Paste a Reddit thread URL above to get started!</p>
</div>
{% endif %}

<div class="footer">
    Debate Analytics - AI-Powered Reddit Analysis
</div>
"""

USERS_TEMPLATE = """
<div class="card-header">
    <h1>Analyzed Users</h1>
    <div class="form-inline">
        <input type="text" id="username" placeholder="Analyze new user..." />
        <button class="btn" onclick="analyzeUser()">Analyze</button>
    </div>
</div>

<div class="card">
    <table>
        <thead>
            <tr>
                <th>User</th>
                <th>Analyses</th>
                <th>Threads</th>
                <th>Comments</th>
                <th>Win Rate</th>
                <th>Fallacy Rate</th>
                <th>Primary Style</th>
                <th>Last Analyzed</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {% for user in users %}
            <tr>
                <td><a href="/users/{{ user.username }}">u/{{ user.username }}</a></td>
                <td>{{ user.analysis_count }}</td>
                <td>{{ user.total_threads or 0 }}</td>
                <td>{{ user.total_comments or 0 }}</td>
                <td>
                    {% set total = (user.win_count or 0) + (user.loss_count or 0) + (user.draw_count or 0) %}
                    {% if total > 0 %}
                    <span class="badge badge-green">{{ "%.0f"|format((user.win_count or 0) / total * 100) }}%</span>
                    {% else %}-{% endif %}
                </td>
                <td>
                    {% if user.fallacy_rate %}
                    <span class="badge {% if user.fallacy_rate > 40 %}badge-red{% elif user.fallacy_rate > 20 %}badge-yellow{% else %}badge-green{% endif %}">
                        {{ "%.0f"|format(user.fallacy_rate) }}%
                    </span>
                    {% else %}-{% endif %}
                </td>
                <td><span class="badge badge-purple">{{ user.primary_arg_style or '-' }}</span></td>
                <td class="text-muted">{{ user.last_analyzed_at[:16] if user.last_analyzed_at else '-' }}</td>
                <td><a href="/users/{{ user.username }}" class="btn btn-sm btn-outline">View</a></td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
"""

USER_DETAIL_TEMPLATE = """
<div class="card-header">
    <h1>u/{{ user.username }}</h1>
    <button class="btn" onclick="refreshAnalysis('{{ user.username }}')">🔄 Refresh Analysis</button>
</div>

{% if analysis %}
<div class="stat-grid">
    <div class="stat-card">
        <div class="stat-value">{{ analysis.total_threads }}</div>
        <div class="stat-label">Debate Threads</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ analysis.total_comments }}</div>
        <div class="stat-label">Comments</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ analysis.total_words }}</div>
        <div class="stat-label">Words Written</div>
    </div>
    <div class="stat-card">
        <div class="stat-value text-green">{{ analysis.win_count }}-{{ analysis.draw_count }}-{{ analysis.loss_count }}</div>
        <div class="stat-label">W-D-L Record</div>
    </div>
    <div class="stat-card">
        <div class="stat-value {% if analysis.fallacy_rate > 40 %}text-red{% elif analysis.fallacy_rate > 20 %}text-muted{% else %}text-green{% endif %}">
            {{ "%.1f"|format(analysis.fallacy_rate) }}%
        </div>
        <div class="stat-label">Fallacy Rate</div>
    </div>
    <div class="stat-card">
        <div class="stat-value" style="font-size: 1em;">{{ analysis.primary_arg_style or '-' }}</div>
        <div class="stat-label">Primary Style</div>
    </div>
</div>

<div class="card mt-4">
    <h3>Argument Types</h3>
    {% for arg in arg_types %}
    <div class="chart-bar">
        <div class="chart-label">{{ arg.arg_type }}</div>
        <div class="chart-fill" style="width: {{ arg.pct }}%;"></div>
        <div class="chart-value">{{ arg.count }} ({{ "%.0f"|format(arg.pct) }}%)</div>
    </div>
    {% endfor %}
</div>

<div class="card mt-4">
    <h3>Logical Fallacies Detected</h3>
    {% if fallacies %}
    <table>
        <thead>
            <tr>
                <th>Fallacy</th>
                <th>Count</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            {% for f in fallacies %}
            <tr>
                <td><span class="badge badge-red">{{ f.fallacy_type }}</span></td>
                <td>{{ f.count }}x</td>
                <td class="text-muted">{{ fallacy_descriptions.get(f.fallacy_type, '') }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% else %}
    <p class="text-muted">No obvious logical fallacies detected! 🎉</p>
    {% endif %}
</div>

<div class="card mt-4">
    <h3>Debate Threads</h3>
    <table>
        <thead>
            <tr>
                <th>Thread</th>
                <th>Subreddit</th>
                <th>Score</th>
                <th>Comments</th>
                <th>Words</th>
            </tr>
        </thead>
        <tbody>
            {% for t in threads %}
            <tr>
                <td><a href="{{ t.url }}" target="_blank">{{ t.title[:60] }}{% if t.title|length > 60 %}...{% endif %}</a></td>
                <td>r/{{ t.subreddit }}</td>
                <td>{{ "%.3f"|format(t.debate_score) }}</td>
                <td>{{ t.user_comment_count }}</td>
                <td>{{ t.total_words }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>

<div class="card mt-4">
    <h3>Analysis History</h3>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Threads</th>
                <th>Comments</th>
                <th>Win Rate</th>
                <th>Fallacy Rate</th>
            </tr>
        </thead>
        <tbody>
            {% for h in history %}
            <tr>
                <td>{{ h.analyzed_at }}</td>
                <td>{{ h.total_threads }}</td>
                <td>{{ h.total_comments }}</td>
                <td>
                    {% set total = h.win_count + h.loss_count + h.draw_count %}
                    {{ "%.0f"|format(h.win_count / total * 100 if total > 0 else 0) }}%
                </td>
                <td>{{ "%.1f"|format(h.fallacy_rate) }}%</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
{% else %}
<div class="alert alert-error">No analysis found for this user. Click Refresh to analyze.</div>
{% endif %}
"""

THREADS_TEMPLATE = """
<h1>All Debate Threads</h1>

<div class="card">
    <table>
        <thead>
            <tr>
                <th>Thread</th>
                <th>Subreddit</th>
                <th>User</th>
                <th>Debate Score</th>
                <th>Comments</th>
                <th>Words</th>
            </tr>
        </thead>
        <tbody>
            {% for t in threads %}
            <tr>
                <td><a href="{{ t.url }}" target="_blank">{{ t.title[:50] }}{% if t.title|length > 50 %}...{% endif %}</a></td>
                <td>r/{{ t.subreddit }}</td>
                <td><a href="/users/{{ t.username }}">u/{{ t.username }}</a></td>
                <td>{{ "%.3f"|format(t.debate_score) }}</td>
                <td>{{ t.user_comment_count }}</td>
                <td>{{ t.total_words }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
"""

THREAD_ANALYSIS_LIST_TEMPLATE = """
<div class="hero">
    <h1>Thread <span>Deep Analysis</span></h1>
    <p>
        Analyze any Reddit thread for sophisticated debate insights: participant rankings,
        argument clashes, fallacy detection, key moments, and verdict determination.
    </p>
    {% if not has_anthropic %}
    <p class="text-red" style="margin-top: 12px;">⚠️ Claude API not available. Set ANTHROPIC_API_KEY environment variable.</p>
    {% endif %}

    <div class="form-inline mt-4" style="justify-content: center;">
        <input type="text" id="thread_url" placeholder="Paste Reddit thread URL..." style="width: 450px;" />
        <button class="btn" onclick="analyzeThread()" {% if not has_anthropic %}disabled{% endif %}>
            🔬 Deep Analyze
        </button>
    </div>

    <div class="tag-pills">
        <span class="pill">r/changemyview</span>
        <span class="pill">r/unpopularopinion</span>
    </div>
</div>

<h2 class="section-title">Overview</h2>
<div class="stat-grid">
    <div class="stat-card">
        <span class="stat-icon">🔬</span>
        <div class="stat-label">Threads Analyzed</div>
        <div class="stat-value">{{ stats.total_analyses }}</div>
    </div>
    <div class="stat-card">
        <span class="stat-icon">🏆</span>
        <div class="stat-label">Clear Winners</div>
        <div class="stat-value">{{ stats.clear_winners }}</div>
    </div>
    <div class="stat-card">
        <span class="stat-icon">🤝</span>
        <div class="stat-label">Avg Civility</div>
        <div class="stat-value">{{ stats.avg_civility }}%</div>
    </div>
</div>

<h2 class="section-title mt-4">Recent Analyses</h2>
{% if recent_analyses %}
<div class="card">
    <table>
        <thead>
            <tr>
                <th>Thread</th>
                <th>Subreddit</th>
                <th>Verdict</th>
                <th>Winner</th>
                <th>Grade</th>
                <th>Analyzed</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {% for a in recent_analyses %}
            <tr>
                <td><a href="/thread-analysis/{{ a.id }}" style="color: var(--accent);">{{ a.thread_title[:40] }}{% if a.thread_title|length > 40 %}...{% endif %}</a></td>
                <td><span class="pill" style="font-size: 11px;">r/{{ a.subreddit }}</span></td>
                <td>
                    <span class="badge {% if a.outcome_type == 'clear_winner' %}badge-green{% elif a.outcome_type == 'draw' %}badge-yellow{% else %}badge-purple{% endif %}">
                        {{ a.outcome_type }}
                    </span>
                </td>
                <td>{% if a.winner %}<span style="color: var(--green);">u/{{ a.winner }}</span>{% else %}-{% endif %}</td>
                <td><span class="badge badge-purple">{{ a.quality_grade or 'N/A' }}</span></td>
                <td class="text-muted">{{ a.analyzed_at[:16] }}</td>
                <td><a href="/thread-analysis/{{ a.id }}" class="btn btn-sm btn-outline">View</a></td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
{% else %}
<div class="card" style="text-align: center; padding: 60px 20px;">
    <div style="font-size: 48px; margin-bottom: 16px;">🔬</div>
    <p class="text-muted">No threads analyzed yet.</p>
    <p class="text-muted">Paste a Reddit thread URL above to get started!</p>
</div>
{% endif %}

<script>
function analyzeThread() {
    const input = document.getElementById('thread_url');
    const url = input.value.trim();
    if (!url) return;

    if (!url.includes('reddit.com')) {
        alert('Please enter a valid Reddit thread URL');
        return;
    }

    const btn = event.target;
    btn.classList.add('loading');
    btn.textContent = 'Analyzing... (this may take 1-2 min)';

    fetch('/api/thread-analysis', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url: url})
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            window.location.href = '/thread-analysis/' + data.analysis_id;
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
            btn.classList.remove('loading');
            btn.textContent = '🔬 Deep Analyze';
        }
    })
    .catch(err => {
        alert('Error: ' + err);
        btn.classList.remove('loading');
        btn.textContent = '🔬 Deep Analyze';
    });
}
</script>
"""

THREAD_ANALYSIS_DETAIL_TEMPLATE = """
<style>
/* Enhanced Analysis Styles */
.analysis-container {
    max-width: 1400px;
    margin: 0 auto;
}

/* Animated Counter */
@keyframes countUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-in {
    animation: countUp 0.6s ease-out forwards;
}

/* Progress Bar Animation */
@keyframes fillBar {
    from { width: 0; }
}

.progress-fill {
    animation: fillBar 1s ease-out forwards;
}

/* Card Hover Effects */
.hover-card {
    transition: all 0.3s ease;
    cursor: pointer;
}

.hover-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(139, 92, 246, 0.2);
    border-color: var(--accent);
}

/* Expandable Sections */
.expandable-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 16px;
    background: var(--bg-card);
    border-radius: 12px;
    border: 1px solid var(--border);
    transition: all 0.3s ease;
}

.expandable-header:hover {
    border-color: var(--accent);
}

.expandable-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.5s ease-out;
}

.expandable-content.expanded {
    max-height: 5000px;
}

.expand-icon {
    transition: transform 0.3s ease;
    font-size: 1.2em;
}

.expand-icon.rotated {
    transform: rotate(180deg);
}

/* Thread Overview Hero */
.thread-hero {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 20, 30, 0.9) 50%, rgba(234, 88, 12, 0.1) 100%);
    border-radius: 16px;
    padding: 32px;
    margin-bottom: 24px;
    border: 1px solid var(--border);
}

.op-claim-box {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
    border-left: 4px solid var(--accent);
}

/* Metrics Grid */
.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
    margin: 24px 0;
}

.metric-card {
    background: var(--bg-card);
    border-radius: 12px;
    padding: 20px;
    text-align: center;
    border: 1px solid var(--border);
    transition: all 0.3s ease;
}

.metric-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
}

.metric-value {
    font-size: 2.5em;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
}

.metric-label {
    font-size: 0.85em;
    color: var(--text-muted);
    margin-top: 8px;
}

/* Win/Loss Bar */
.winloss-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg);
    margin: 12px 0;
}

.winloss-segment {
    transition: width 1s ease-out;
}

/* Argument Thread Card */
.argument-thread-card {
    background: var(--bg-card);
    border-radius: 12px;
    margin-bottom: 16px;
    border: 1px solid var(--border);
    overflow: hidden;
}

.argument-thread-header {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: background 0.3s ease;
}

.argument-thread-header:hover {
    background: rgba(139, 92, 246, 0.1);
}

.thread-meta {
    display: flex;
    gap: 12px;
    align-items: center;
}

.thread-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 600;
}

.badge-winner { background: rgba(34, 197, 94, 0.2); color: var(--green); }
.badge-draw { background: rgba(234, 179, 8, 0.2); color: var(--yellow); }
.badge-ongoing { background: rgba(139, 92, 246, 0.2); color: var(--accent); }

/* Reply Card */
.reply-card {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    border-left: 3px solid var(--border);
    cursor: pointer;
    transition: all 0.3s ease;
}

.reply-card:hover {
    border-left-color: var(--accent);
    background: rgba(139, 92, 246, 0.05);
}

.reply-card.expanded {
    border-left-color: var(--accent);
}

.reply-analysis-panel {
    display: none;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
}

.reply-card.expanded .reply-analysis-panel {
    display: block;
}

/* Fact Check Tags */
.fact-check-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75em;
    font-weight: 600;
}

.fact-verified { background: rgba(34, 197, 94, 0.2); color: var(--green); }
.fact-disputed { background: rgba(239, 68, 68, 0.2); color: var(--red); }
.fact-unverified { background: rgba(234, 179, 8, 0.2); color: var(--yellow); }
.fact-opinion { background: rgba(139, 92, 246, 0.2); color: var(--accent); }

/* Reply Coach Panel */
.reply-coach {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(30, 30, 45, 0.8) 100%);
    border-radius: 8px;
    padding: 16px;
    margin-top: 12px;
    border: 1px solid var(--accent);
}

.strategy-card {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    padding: 12px;
    margin: 8px 0;
}

/* Timeline */
.debate-timeline {
    position: relative;
    padding: 20px 0;
}

.timeline-track {
    height: 4px;
    background: var(--bg);
    border-radius: 2px;
    position: relative;
}

.timeline-marker {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    top: -4px;
    transform: translateX(-50%);
    cursor: pointer;
    transition: all 0.3s ease;
}

.timeline-marker:hover {
    transform: translateX(-50%) scale(1.3);
}

.timeline-marker.momentum-shift { background: var(--accent); }
.timeline-marker.fallacy { background: var(--red); }
.timeline-marker.strong-argument { background: var(--green); }

/* Radar Chart Placeholder */
.radar-placeholder {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
    border: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
}

/* Score Meter */
.score-meter {
    width: 100%;
    height: 8px;
    background: var(--bg);
    border-radius: 4px;
    overflow: hidden;
    margin: 8px 0;
}

.score-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 1s ease-out;
}

.score-fill.green { background: linear-gradient(90deg, var(--green), #4ade80); }
.score-fill.yellow { background: linear-gradient(90deg, var(--yellow), #fde047); }
.score-fill.red { background: linear-gradient(90deg, var(--red), #f87171); }
.score-fill.purple { background: linear-gradient(90deg, var(--accent), var(--accent-light)); }

/* Tabs */
.analysis-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
}

.tab-btn {
    padding: 10px 20px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 8px 8px 0 0;
    transition: all 0.3s ease;
    font-size: 0.95em;
}

.tab-btn:hover {
    color: var(--text);
    background: rgba(139, 92, 246, 0.1);
}

.tab-btn.active {
    color: var(--accent);
    background: rgba(139, 92, 246, 0.15);
    border-bottom: 2px solid var(--accent);
}

.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}
</style>

<!-- LEVEL 1: Thread Overview -->
<div class="analysis-container">

    <!-- Hero Section -->
    <div class="thread-hero">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span class="pill">r/{{ analysis.subreddit }}</span>
                    <span class="text-muted">by u/{{ analysis.op_username }}</span>
                    <span class="text-muted">|</span>
                    <span class="text-muted">{{ analysis.total_comments }} comments analyzed</span>
                </div>
                <h1 style="font-size: 1.8em; margin-bottom: 16px;">{{ analysis.thread_title }}</h1>

                <!-- OP's Original Claim -->
                <div class="op-claim-box">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0; color: var(--accent);">Original Claim</h3>
                        <span class="thread-badge badge-ongoing">OP's Position</span>
                    </div>
                    <p style="font-size: 1.1em; line-height: 1.7;">
                        {% if executive_summary and executive_summary.op_position %}
                            {{ executive_summary.op_position }}
                        {% else %}
                            {{ analysis.thread_title }}
                        {% endif %}
                    </p>
                </div>
            </div>

            <!-- Overall Grade -->
            <div style="text-align: center; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 12px; min-width: 150px;">
                <div style="font-size: 3.5em; font-weight: 700; color: var(--accent);">{{ analysis.quality_grade or 'N/A' }}</div>
                <div class="text-muted">Thread Quality</div>
                <div class="score-meter" style="margin-top: 12px;">
                    <div class="score-fill purple progress-fill" style="width: {{ (analysis.quality_score or 70) }}%;"></div>
                </div>
            </div>
        </div>

        <!-- OP Analysis Metrics -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 24px;">
            <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px;">
                <div class="text-muted" style="font-size: 0.85em;">Evidence Quality</div>
                <div class="score-meter">
                    <div class="score-fill green progress-fill" style="width: {% if executive_summary %}{{ executive_summary.op_evidence_quality | default(65) }}{% else %}65{% endif %}%;"></div>
                </div>
                <div style="font-size: 1.2em; font-weight: 600;">{% if executive_summary %}{{ executive_summary.op_evidence_quality | default(65) }}{% else %}65{% endif %}/100</div>
            </div>
            <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px;">
                <div class="text-muted" style="font-size: 0.85em;">Logical Consistency</div>
                <div class="score-meter">
                    <div class="score-fill purple progress-fill" style="width: {% if executive_summary %}{{ executive_summary.op_logic_score | default(72) }}{% else %}72{% endif %}%;"></div>
                </div>
                <div style="font-size: 1.2em; font-weight: 600;">{% if executive_summary %}{{ executive_summary.op_logic_score | default(72) }}{% else %}72{% endif %}/100</div>
            </div>
            <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px;">
                <div class="text-muted" style="font-size: 0.85em;">Vulnerability Index</div>
                <div class="score-meter">
                    <div class="score-fill yellow progress-fill" style="width: {% if executive_summary %}{{ executive_summary.op_vulnerability | default(45) }}{% else %}45{% endif %}%;"></div>
                </div>
                <div style="font-size: 1.2em; font-weight: 600;">{% if executive_summary %}{{ executive_summary.op_vulnerability | default(45) }}{% else %}45{% endif %}/100</div>
            </div>
        </div>
    </div>

    <!-- Thread-Wide Metrics -->
    <div class="metrics-grid">
        <div class="metric-card animate-in" style="animation-delay: 0.1s;">
            <div class="metric-value" data-count="{{ clashes | length }}">{{ clashes | length }}</div>
            <div class="metric-label">Argument Threads</div>
        </div>
        <div class="metric-card animate-in" style="animation-delay: 0.2s;">
            <div class="metric-value text-green" data-count="{{ verdict.op_wins | default(0) }}">{{ verdict.op_wins | default(0) }}</div>
            <div class="metric-label">OP Wins</div>
        </div>
        <div class="metric-card animate-in" style="animation-delay: 0.3s;">
            <div class="metric-value text-red" data-count="{{ verdict.op_losses | default(0) }}">{{ verdict.op_losses | default(0) }}</div>
            <div class="metric-label">OP Losses</div>
        </div>
        <div class="metric-card animate-in" style="animation-delay: 0.4s;">
            <div class="metric-value text-yellow" data-count="{{ verdict.draws | default(0) }}">{{ verdict.draws | default(0) }}</div>
            <div class="metric-label">Draws</div>
        </div>
        <div class="metric-card animate-in" style="animation-delay: 0.5s;">
            <div class="metric-value" data-count="{{ analysis.total_fallacies }}">{{ analysis.total_fallacies }}</div>
            <div class="metric-label">Fallacies</div>
        </div>
        <div class="metric-card animate-in" style="animation-delay: 0.6s;">
            <div class="metric-value">{{ analysis.overall_civility }}%</div>
            <div class="metric-label">Civility</div>
        </div>
    </div>

    <!-- Win/Loss Summary Bar -->
    <div class="card" style="margin-bottom: 24px;">
        <h3 style="margin-bottom: 16px;">Debate Outcome Summary</h3>
        <div class="winloss-bar">
            <div class="winloss-segment" style="width: {{ (verdict.op_wins | default(3)) * 10 }}%; background: var(--green);"></div>
            <div class="winloss-segment" style="width: {{ (verdict.draws | default(2)) * 10 }}%; background: var(--yellow);"></div>
            <div class="winloss-segment" style="width: {{ (verdict.op_losses | default(5)) * 10 }}%; background: var(--red);"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 8px;">
            <span class="text-green">OP Won: {{ verdict.op_wins | default(3) }}</span>
            <span class="text-yellow">Draws: {{ verdict.draws | default(2) }}</span>
            <span class="text-red">OP Lost: {{ verdict.op_losses | default(5) }}</span>
        </div>

        {% if executive_summary %}
        <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); font-style: italic; color: var(--text-muted);">
            "{{ executive_summary.one_liner }}"
        </p>
        {% endif %}
    </div>

    <!-- Tabs for Different Views -->
    <div class="analysis-tabs">
        <button class="tab-btn active" onclick="switchTab('threads')">Argument Threads</button>
        <button class="tab-btn" onclick="switchTab('timeline')">Timeline View</button>
        <button class="tab-btn" onclick="switchTab('participants')">Participants</button>
        <button class="tab-btn" onclick="switchTab('fallacies')">Fallacies</button>
    </div>

    <!-- Tab: Argument Threads -->
    <div id="tab-threads" class="tab-content active">
        <h2 style="margin-bottom: 16px;">Argument Threads ({{ clashes | length }})</h2>
        <p class="text-muted" style="margin-bottom: 24px;">Click on any argument thread to expand and see detailed analysis. Click on individual replies to see fact checks and reply strategies.</p>

        {% for clash in clashes %}
        <div class="argument-thread-card">
            <div class="argument-thread-header" onclick="toggleThread({{ loop.index }})">
                <div>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <span class="thread-badge {% if clash.winner == analysis.op_username %}badge-winner{% elif clash.winner %}badge-draw{% else %}badge-ongoing{% endif %}">
                            {% if clash.winner == analysis.op_username %}OP Won{% elif clash.winner %}Challenger Won{% else %}Draw{% endif %}
                        </span>
                        <h3 style="margin: 0;">{{ clash.topic }}</h3>
                    </div>
                    <div class="thread-meta">
                        <span class="text-muted">u/{{ clash.side_a.author }} vs u/{{ clash.side_b.author }}</span>
                        <span class="text-muted">|</span>
                        <span class="text-muted">Quality: {{ ((clash.side_a.argument_quality + clash.side_b.argument_quality) / 2) | int }}/100</span>
                    </div>
                </div>
                <span class="expand-icon" id="icon-{{ loop.index }}">&#9660;</span>
            </div>

            <div class="expandable-content" id="thread-{{ loop.index }}">
                <div style="padding: 20px; border-top: 1px solid var(--border);">

                    <!-- Clash Overview -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                        <!-- Side A -->
                        <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; border-left: 3px solid {% if clash.winner == clash.side_a.author %}var(--green){% else %}var(--border){% endif %};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <strong>u/{{ clash.side_a.author }}</strong>
                                {% if clash.winner == clash.side_a.author %}<span class="thread-badge badge-winner">Winner</span>{% endif %}
                            </div>
                            <p class="text-muted" style="font-size: 0.9em;">{{ clash.side_a.position }}</p>
                            <div style="margin-top: 12px;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                                    <span>Argument</span>
                                    <span>{{ clash.side_a.argument_quality }}/100</span>
                                </div>
                                <div class="score-meter">
                                    <div class="score-fill {% if clash.side_a.argument_quality >= 70 %}green{% elif clash.side_a.argument_quality >= 50 %}yellow{% else %}red{% endif %} progress-fill" style="width: {{ clash.side_a.argument_quality }}%;"></div>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 8px;">
                                    <span>Evidence</span>
                                    <span>{{ clash.side_a.evidence_quality }}/100</span>
                                </div>
                                <div class="score-meter">
                                    <div class="score-fill {% if clash.side_a.evidence_quality >= 70 %}green{% elif clash.side_a.evidence_quality >= 50 %}yellow{% else %}red{% endif %} progress-fill" style="width: {{ clash.side_a.evidence_quality }}%;"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Side B -->
                        <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; border-left: 3px solid {% if clash.winner == clash.side_b.author %}var(--green){% else %}var(--border){% endif %};">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <strong>u/{{ clash.side_b.author }}</strong>
                                {% if clash.winner == clash.side_b.author %}<span class="thread-badge badge-winner">Winner</span>{% endif %}
                            </div>
                            <p class="text-muted" style="font-size: 0.9em;">{{ clash.side_b.position }}</p>
                            <div style="margin-top: 12px;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                                    <span>Argument</span>
                                    <span>{{ clash.side_b.argument_quality }}/100</span>
                                </div>
                                <div class="score-meter">
                                    <div class="score-fill {% if clash.side_b.argument_quality >= 70 %}green{% elif clash.side_b.argument_quality >= 50 %}yellow{% else %}red{% endif %} progress-fill" style="width: {{ clash.side_b.argument_quality }}%;"></div>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-top: 8px;">
                                    <span>Evidence</span>
                                    <span>{{ clash.side_b.evidence_quality }}/100</span>
                                </div>
                                <div class="score-meter">
                                    <div class="score-fill {% if clash.side_b.evidence_quality >= 70 %}green{% elif clash.side_b.evidence_quality >= 50 %}yellow{% else %}red{% endif %} progress-fill" style="width: {{ clash.side_b.evidence_quality }}%;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Impact Analysis -->
                    <div style="background: rgba(139, 92, 246, 0.1); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h4 style="margin: 0 0 8px 0; color: var(--accent);">Impact on Debate</h4>
                        <p style="margin: 0;">{{ clash.impact_on_debate }}</p>
                    </div>

                    <!-- Individual Replies (Clickable) -->
                    <h4 style="margin-top: 24px;">Replies in this thread <span class="text-muted">(click to analyze)</span></h4>

                    <div class="reply-card" onclick="toggleReply('reply-{{ loop.index }}-1')">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <strong>u/{{ clash.side_a.author }}</strong>
                                <span class="text-muted" style="margin-left: 8px;">Opening argument</span>
                            </div>
                            <div>
                                <span class="fact-check-tag fact-opinion">Opinion-based</span>
                            </div>
                        </div>
                        <p style="margin: 12px 0 0 0; color: var(--text-muted);">{{ clash.side_a.position[:150] }}...</p>

                        <!-- Hidden Analysis Panel -->
                        <div class="reply-analysis-panel" id="reply-{{ loop.index }}-1">
                            <h5 style="color: var(--accent); margin-bottom: 12px;">Deep Analysis</h5>

                            <!-- Fact Checks -->
                            <div style="margin-bottom: 16px;">
                                <h6 style="margin-bottom: 8px;">Fact Check Results</h6>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    <span class="fact-check-tag fact-opinion">Main claim is opinion-based</span>
                                    <span class="fact-check-tag fact-unverified">Statistics unverified</span>
                                </div>
                            </div>

                            <!-- Reply Coach -->
                            <div class="reply-coach">
                                <h6 style="margin: 0 0 12px 0; color: var(--accent);">Reply Coach - Strategic Angles</h6>
                                <div class="strategy-card">
                                    <strong>Challenge the premise:</strong>
                                    <p class="text-muted" style="margin: 4px 0 0 0; font-size: 0.9em;">Ask for specific evidence supporting the core claim. Request studies, data, or concrete examples.</p>
                                </div>
                                <div class="strategy-card">
                                    <strong>Provide counter-evidence:</strong>
                                    <p class="text-muted" style="margin: 4px 0 0 0; font-size: 0.9em;">Present specific cases that contradict the generalization made in this argument.</p>
                                </div>
                                <div class="strategy-card">
                                    <strong>Acknowledge and redirect:</strong>
                                    <p class="text-muted" style="margin: 4px 0 0 0; font-size: 0.9em;">Accept valid parts of the argument while steering toward the weakest point.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
        {% endfor %}
    </div>

    <!-- Tab: Timeline View -->
    <div id="tab-timeline" class="tab-content">
        <h2 style="margin-bottom: 16px;">Debate Timeline</h2>
        <p class="text-muted" style="margin-bottom: 24px;">Key moments in the debate. Hover over markers to see details.</p>

        <div class="debate-timeline">
            <div class="timeline-track">
                {% for moment in key_moments %}
                <div class="timeline-marker {% if moment.moment_type == 'fallacy' %}fallacy{% elif moment.moment_type == 'strong_argument' %}strong-argument{% else %}momentum-shift{% endif %}"
                     style="left: {{ loop.index * (100 / (key_moments|length + 1)) }}%;"
                     title="{{ moment.description }}">
                </div>
                {% endfor %}
            </div>
        </div>

        <!-- Key Moments List -->
        {% for moment in key_moments %}
        <div class="card" style="margin: 16px 0; border-left: 4px solid {% if moment.moment_type == 'fallacy' %}var(--red){% elif moment.moment_type == 'strong_argument' %}var(--green){% else %}var(--accent){% endif %};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="thread-badge {% if moment.moment_type == 'fallacy' %}badge-red{% elif moment.moment_type == 'strong_argument' %}badge-winner{% else %}badge-ongoing{% endif %}">{{ moment.moment_type | replace('_', ' ') | title }}</span>
                <span class="text-muted">u/{{ moment.participant }}</span>
            </div>
            <p style="margin: 0;">{{ moment.description }}</p>
            {% if moment.quote %}
            <blockquote style="margin: 12px 0 0 0; padding-left: 12px; border-left: 2px solid var(--text-muted); color: var(--text-muted); font-style: italic;">
                "{{ moment.quote[:150] }}{% if moment.quote|length > 150 %}...{% endif %}"
            </blockquote>
            {% endif %}
        </div>
        {% endfor %}
    </div>

    <!-- Tab: Participants -->
    <div id="tab-participants" class="tab-content">
        <h2 style="margin-bottom: 24px;">Participant Rankings</h2>

        {% for p in participants %}
        <div class="card hover-card" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 1.5em; font-weight: 700;">
                        {{ loop.index }}
                    </div>
                    <div>
                        <h3 style="margin: 0;">
                            {% if p.username == verdict.winner %}&#127942;{% endif %}
                            u/{{ p.username }}
                        </h3>
                        <span class="thread-badge badge-ongoing">{{ p.role }}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 2em; font-weight: 700; color: var(--accent);">{{ p.overall_score }}</div>
                    <div class="text-muted">Score</div>
                </div>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                {% for badge in p.badges[:5] %}
                <span class="thread-badge badge-winner">{{ badge }}</span>
                {% endfor %}
            </div>
        </div>
        {% endfor %}
    </div>

    <!-- Tab: Fallacies -->
    <div id="tab-fallacies" class="tab-content">
        <h2 style="margin-bottom: 24px;">Logical Fallacies Detected ({{ fallacies | length }})</h2>

        {% for f in fallacies %}
        <div class="card" style="margin-bottom: 16px; border-left: 4px solid var(--red);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div>
                    <span class="thread-badge" style="background: rgba(239, 68, 68, 0.2); color: var(--red);">{{ f.fallacy_type }}</span>
                    <strong style="margin-left: 8px;">by u/{{ f.committed_by }}</strong>
                </div>
                <span class="thread-badge {% if f.severity == 'severe' %}badge-red{% elif f.severity == 'significant' %}badge-draw{% else %}badge-ongoing{% endif %}">{{ f.severity }}</span>
            </div>
            <blockquote style="margin: 0 0 12px 0; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid var(--red);">
                "{{ f.user_statement[:200] }}{% if f.user_statement|length > 200 %}...{% endif %}"
            </blockquote>
            <p style="margin: 0;">{{ f.explanation }}</p>
            <p class="text-muted" style="margin-top: 8px; font-size: 0.9em;">Impact: {{ f.debate_impact }}</p>
        </div>
        {% endfor %}
    </div>

    <!-- Footer -->
    <p class="text-muted" style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border);">
        Analyzed on {{ analysis.analyzed_at }} using Claude-powered deep analysis<br>
        <a href="{{ analysis.thread_url }}" target="_blank" style="color: var(--accent);">View original thread on Reddit &rarr;</a>
    </p>
</div>

<script>
// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// Toggle argument thread expansion
function toggleThread(index) {
    const content = document.getElementById(`thread-${index}`);
    const icon = document.getElementById(`icon-${index}`);

    content.classList.toggle('expanded');
    icon.classList.toggle('rotated');
}

// Toggle reply analysis panel
function toggleReply(replyId) {
    const card = document.getElementById(replyId).parentElement;
    card.classList.toggle('expanded');
    event.stopPropagation();
}

// Animate counters on load
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count);
        let current = 0;
        const increment = target / 30;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                el.textContent = target;
                clearInterval(timer);
            } else {
                el.textContent = Math.floor(current);
            }
        }, 30);
    });
});
</script>
"""


# =============================================================================
# Routes
# =============================================================================

@app.route('/health')
def health():
    """Health check endpoint for Railway."""
    return jsonify({
        'status': 'healthy',
        'service': 'debate-analytics',
        'thread_analysis_available': HAS_THREAD_ANALYZER and HAS_ANTHROPIC
    })


@app.route('/')
def home():
    conn = get_db()

    # Get stats
    stats = {
        'total_users': conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        'total_analyses': conn.execute("SELECT COUNT(*) FROM analyses").fetchone()[0],
        'total_threads': conn.execute("SELECT COUNT(*) FROM threads").fetchone()[0],
    }

    # Get recent users
    recent = conn.execute("""
        SELECT u.username, u.last_analyzed_at,
               a.total_threads, a.win_count, a.loss_count, a.draw_count
        FROM users u
        LEFT JOIN analyses a ON a.id = (
            SELECT id FROM analyses WHERE user_id = u.id ORDER BY analyzed_at DESC LIMIT 1
        )
        ORDER BY u.last_analyzed_at DESC
        LIMIT 5
    """).fetchall()

    conn.close()

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', HOME_TEMPLATE),
        page_title='Debate Analyzer - Home',
        stats=stats,
        recent_users=recent
    )


@app.route('/users')
def users_list():
    conn = get_db()
    users = conn.execute("""
        SELECT u.username, u.last_analyzed_at,
               COUNT(a.id) as analysis_count,
               MAX(a.total_threads) as total_threads,
               MAX(a.total_comments) as total_comments,
               MAX(a.win_count) as win_count,
               MAX(a.loss_count) as loss_count,
               MAX(a.draw_count) as draw_count,
               MAX(a.fallacy_rate) as fallacy_rate,
               MAX(a.primary_arg_style) as primary_arg_style
        FROM users u
        LEFT JOIN analyses a ON a.user_id = u.id
        GROUP BY u.id
        ORDER BY u.last_analyzed_at DESC
    """).fetchall()
    conn.close()

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', USERS_TEMPLATE),
        page_title='Users - Debate Analyzer',
        users=users
    )


@app.route('/users/<username>')
def user_detail(username):
    conn = get_db()

    user = conn.execute(
        "SELECT * FROM users WHERE username = ?", (username,)
    ).fetchone()

    if not user:
        conn.close()
        return render_template_string(
            BASE_TEMPLATE.replace('{% block content %}{% endblock %}', USER_DETAIL_TEMPLATE),
            page_title=f'u/{username} - Debate Analyzer',
            user={'username': username},
            analysis=None,
            arg_types=[],
            fallacies=[],
            threads=[],
            history=[],
            fallacy_descriptions={}
        )

    # Get latest analysis
    analysis = conn.execute("""
        SELECT * FROM analyses WHERE user_id = ? ORDER BY analyzed_at DESC LIMIT 1
    """, (user['id'],)).fetchone()

    if not analysis:
        conn.close()
        return render_template_string(
            BASE_TEMPLATE.replace('{% block content %}{% endblock %}', USER_DETAIL_TEMPLATE),
            page_title=f'u/{username} - Debate Analyzer',
            user=user,
            analysis=None,
            arg_types=[],
            fallacies=[],
            threads=[],
            history=[],
            fallacy_descriptions={}
        )

    # Get argument types with percentages
    arg_types = conn.execute("""
        SELECT arg_type, count FROM argument_types WHERE analysis_id = ? ORDER BY count DESC
    """, (analysis['id'],)).fetchall()

    total_args = sum(a['count'] for a in arg_types)
    arg_types_with_pct = [
        {'arg_type': a['arg_type'], 'count': a['count'], 'pct': (a['count'] / total_args * 100) if total_args > 0 else 0}
        for a in arg_types
    ]

    # Get fallacies
    fallacies = conn.execute("""
        SELECT fallacy_type, count, examples FROM fallacies
        WHERE analysis_id = ? ORDER BY count DESC
    """, (analysis['id'],)).fetchall()

    # Get threads
    threads = conn.execute("""
        SELECT * FROM threads WHERE analysis_id = ? ORDER BY debate_score DESC
    """, (analysis['id'],)).fetchall()

    # Get history
    history = conn.execute("""
        SELECT * FROM analyses WHERE user_id = ? ORDER BY analyzed_at DESC LIMIT 10
    """, (user['id'],)).fetchall()

    conn.close()

    fallacy_descriptions = {k: v['description'] for k, v in LOGICAL_FALLACIES.items()}

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', USER_DETAIL_TEMPLATE),
        page_title=f'u/{user["username"]} - Debate Analyzer',
        user=user,
        analysis=analysis,
        arg_types=arg_types_with_pct,
        fallacies=fallacies,
        threads=threads,
        history=history,
        fallacy_descriptions=fallacy_descriptions
    )


@app.route('/threads')
def threads_list():
    conn = get_db()
    threads = conn.execute("""
        SELECT t.*, u.username
        FROM threads t
        JOIN analyses a ON t.analysis_id = a.id
        JOIN users u ON a.user_id = u.id
        ORDER BY t.debate_score DESC
        LIMIT 100
    """).fetchall()
    conn.close()

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', THREADS_TEMPLATE),
        page_title='Threads - Debate Analyzer',
        threads=threads
    )


@app.route('/api/analyze/<username>', methods=['POST'])
def api_analyze(username):
    """API endpoint to trigger analysis."""
    try:
        result = run_analysis(username)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/thread-analysis')
def thread_analysis_list():
    """Thread analysis list page."""
    conn = get_db()

    # Get stats
    total = conn.execute("SELECT COUNT(*) FROM thread_analyses").fetchone()[0]
    clear_winners = conn.execute(
        "SELECT COUNT(*) FROM thread_analyses WHERE outcome_type = 'clear_winner'"
    ).fetchone()[0]
    avg_civility = conn.execute(
        "SELECT AVG(overall_civility) FROM thread_analyses WHERE overall_civility > 0"
    ).fetchone()[0] or 0

    stats = {
        'total_analyses': total,
        'clear_winners': clear_winners,
        'avg_civility': int(avg_civility)
    }

    # Get recent analyses
    recent = conn.execute("""
        SELECT * FROM thread_analyses
        ORDER BY analyzed_at DESC
        LIMIT 10
    """).fetchall()

    conn.close()

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', THREAD_ANALYSIS_LIST_TEMPLATE),
        page_title='Thread Analysis - Debate Analyzer',
        stats=stats,
        recent_analyses=recent,
        has_anthropic=HAS_ANTHROPIC
    )


@app.route('/thread-analysis/<int:analysis_id>')
def thread_analysis_detail(analysis_id):
    """Thread analysis detail page."""
    conn = get_db()

    analysis = conn.execute(
        "SELECT * FROM thread_analyses WHERE id = ?", (analysis_id,)
    ).fetchone()

    if not analysis:
        conn.close()
        return "Analysis not found", 404

    # Parse full analysis JSON
    full_data = json.loads(analysis['full_analysis_json']) if analysis['full_analysis_json'] else {}

    # Extract data for template
    verdict = full_data.get('verdict', {})
    participants = full_data.get('participants', [])
    clashes = full_data.get('clashes', [])
    fallacies = full_data.get('fallacies', [])
    key_moments = full_data.get('key_moments', [])
    executive_summary = full_data.get('executive_summary', {})
    unaddressed_arguments = full_data.get('unaddressed_arguments', [])
    unanswered_questions = full_data.get('unanswered_questions', [])

    conn.close()

    return render_template_string(
        BASE_TEMPLATE.replace('{% block content %}{% endblock %}', THREAD_ANALYSIS_DETAIL_TEMPLATE),
        page_title=f'{analysis["thread_title"][:40]} - Thread Analysis',
        analysis=analysis,
        verdict=verdict,
        participants=participants,
        clashes=clashes,
        fallacies=fallacies,
        key_moments=key_moments,
        executive_summary=executive_summary,
        unaddressed_arguments=unaddressed_arguments,
        unanswered_questions=unanswered_questions
    )


@app.route('/api/thread-analysis', methods=['POST'])
def api_thread_analysis():
    """API endpoint to trigger thread analysis."""
    try:
        data = request.get_json()
        url = data.get('url', '')

        if not url:
            return jsonify({'error': 'URL is required'}), 400

        result = run_thread_analysis(url)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =============================================================================
# Main
# =============================================================================

# Initialize database at module load (for gunicorn/production)
init_db()

def main():
    parser = argparse.ArgumentParser(description='Debate Analyzer Web Interface')
    parser.add_argument('--port', type=int, default=5000, help='Port to run on')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()

    # Use PORT env var if set (Railway), otherwise use --port arg
    port = int(os.environ.get('PORT', args.port))

    print(f"\n🎯 Debate Analyzer Web Interface")
    print(f"   Running on http://localhost:{port}")
    print(f"   Database: {DB_PATH}\n")

    app.run(host='0.0.0.0', port=port, debug=args.debug)


if __name__ == '__main__':
    main()
