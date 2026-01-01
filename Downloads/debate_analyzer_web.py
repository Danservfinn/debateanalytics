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
        analyzer = ThreadDeepAnalyzer()
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
    <title>{{ page_title | default('Debate Analyzer') }}</title>
    <style>
        :root {
            --bg: #0d1117;
            --bg-secondary: #161b22;
            --border: #30363d;
            --text: #c9d1d9;
            --text-muted: #8b949e;
            --accent: #58a6ff;
            --green: #3fb950;
            --red: #f85149;
            --yellow: #d29922;
            --purple: #a371f7;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        nav {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
            padding: 16px 0;
            margin-bottom: 30px;
        }
        nav .container { display: flex; align-items: center; gap: 30px; }
        nav a { color: var(--text); text-decoration: none; }
        nav a:hover { color: var(--accent); }
        nav .logo { font-size: 1.3em; font-weight: 600; color: var(--accent); }
        h1, h2, h3 { margin-bottom: 16px; }
        .card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
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
        th { color: var(--text-muted); font-weight: 500; }
        tr:hover { background: rgba(88, 166, 255, 0.05); }
        .btn {
            display: inline-block;
            padding: 8px 16px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            font-size: 14px;
        }
        .btn:hover { opacity: 0.9; }
        .btn-sm { padding: 4px 12px; font-size: 12px; }
        .btn-outline {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text);
        }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
        .stat-card {
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }
        .stat-value { font-size: 2em; font-weight: 600; color: var(--accent); }
        .stat-label { color: var(--text-muted); font-size: 0.9em; }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-green { background: rgba(63, 185, 80, 0.2); color: var(--green); }
        .badge-red { background: rgba(248, 81, 73, 0.2); color: var(--red); }
        .badge-yellow { background: rgba(210, 153, 34, 0.2); color: var(--yellow); }
        .badge-purple { background: rgba(163, 113, 247, 0.2); color: var(--purple); }
        .progress-bar {
            height: 8px;
            background: var(--bg);
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-fill { height: 100%; background: var(--accent); }
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
            background: var(--accent);
            border-radius: 4px;
            min-width: 4px;
        }
        input[type="text"] {
            padding: 10px 14px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text);
            font-size: 14px;
            width: 250px;
        }
        input[type="text"]:focus { outline: none; border-color: var(--accent); }
        .form-inline { display: flex; gap: 10px; align-items: center; }
        .loading { opacity: 0.6; pointer-events: none; }
        .alert {
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 16px;
        }
        .alert-success { background: rgba(63, 185, 80, 0.1); border: 1px solid var(--green); }
        .alert-error { background: rgba(248, 81, 73, 0.1); border: 1px solid var(--red); }
        .text-muted { color: var(--text-muted); }
        .text-green { color: var(--green); }
        .text-red { color: var(--red); }
        .mt-4 { margin-top: 24px; }
        .mb-4 { margin-bottom: 24px; }
    </style>
</head>
<body>
    <nav>
        <div class="container">
            <a href="/" class="logo">🎯 Debate Analyzer</a>
            <a href="/users">Users</a>
            <a href="/threads">Threads</a>
            <a href="/thread-analysis">Thread Analysis</a>
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
<h1>Reddit Debate Analyzer</h1>
<p class="text-muted mb-4">Analyze any Reddit user's debate style, argument types, and logical fallacies.</p>

<div class="card">
    <h3>Analyze a User</h3>
    <div class="form-inline mt-4">
        <input type="text" id="username" placeholder="Enter Reddit username..." />
        <button class="btn" onclick="analyzeUser()">Analyze</button>
    </div>
</div>

<div class="stat-grid mt-4">
    <div class="stat-card">
        <div class="stat-value">{{ stats.total_users }}</div>
        <div class="stat-label">Users Analyzed</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ stats.total_analyses }}</div>
        <div class="stat-label">Total Analyses</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ stats.total_threads }}</div>
        <div class="stat-label">Threads Tracked</div>
    </div>
</div>

{% if recent_users %}
<div class="card mt-4">
    <h3>Recently Analyzed</h3>
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
                <td><a href="/users/{{ user.username }}">u/{{ user.username }}</a></td>
                <td class="text-muted">{{ user.last_analyzed_at }}</td>
                <td>{{ user.total_threads or 0 }}</td>
                <td>
                    {% if user.total_threads %}
                    {{ "%.1f"|format(user.win_count / (user.win_count + user.loss_count + user.draw_count) * 100 if (user.win_count + user.loss_count + user.draw_count) > 0 else 0) }}%
                    {% else %}-{% endif %}
                </td>
                <td><a href="/users/{{ user.username }}" class="btn btn-sm btn-outline">View</a></td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
{% endif %}
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
<div class="card-header">
    <h1>🎯 Thread Deep Analysis</h1>
</div>

<p class="text-muted mb-4">
    Analyze any Reddit thread for sophisticated debate insights: participant rankings,
    argument clashes, fallacy detection, key moments, and verdict determination.
    {% if not has_anthropic %}
    <br><span class="text-red">⚠️ Claude API not available. Set ANTHROPIC_API_KEY environment variable.</span>
    {% endif %}
</p>

<div class="card">
    <h3>Analyze a Thread</h3>
    <div class="form-inline mt-4">
        <input type="text" id="thread_url" placeholder="Paste Reddit thread URL..." style="width: 400px;" />
        <button class="btn" onclick="analyzeThread()" {% if not has_anthropic %}disabled{% endif %}>
            🔬 Deep Analyze
        </button>
    </div>
    <p class="text-muted" style="margin-top: 10px; font-size: 12px;">
        Example: https://reddit.com/r/changemyview/comments/abc123/cmv_topic/
    </p>
</div>

<div class="stat-grid mt-4">
    <div class="stat-card">
        <div class="stat-value">{{ stats.total_analyses }}</div>
        <div class="stat-label">Threads Analyzed</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ stats.clear_winners }}</div>
        <div class="stat-label">Clear Winners</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ stats.avg_civility }}%</div>
        <div class="stat-label">Avg Civility</div>
    </div>
</div>

{% if recent_analyses %}
<div class="card mt-4">
    <h3>Recent Analyses</h3>
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
                <td>{{ a.thread_title[:40] }}{% if a.thread_title|length > 40 %}...{% endif %}</td>
                <td>r/{{ a.subreddit }}</td>
                <td>
                    <span class="badge {% if a.outcome_type == 'clear_winner' %}badge-green{% elif a.outcome_type == 'draw' %}badge-yellow{% else %}badge-purple{% endif %}">
                        {{ a.outcome_type }}
                    </span>
                </td>
                <td>{% if a.winner %}u/{{ a.winner }}{% else %}-{% endif %}</td>
                <td><span class="badge badge-purple">{{ a.quality_grade or 'N/A' }}</span></td>
                <td class="text-muted">{{ a.analyzed_at[:16] }}</td>
                <td><a href="/thread-analysis/{{ a.id }}" class="btn btn-sm btn-outline">View</a></td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
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
<div class="card-header">
    <div>
        <h1>{{ analysis.thread_title[:60] }}{% if analysis.thread_title|length > 60 %}...{% endif %}</h1>
        <p class="text-muted">r/{{ analysis.subreddit }} • u/{{ analysis.op_username }}</p>
    </div>
    <a href="{{ analysis.thread_url }}" target="_blank" class="btn btn-outline">View on Reddit</a>
</div>

<!-- Verdict Card -->
<div class="card" style="background: linear-gradient(135deg, #1a1f35 0%, #161b22 100%); border: 2px solid {% if verdict.winner %}var(--green){% else %}var(--yellow){% endif %};">
    <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
            <h2 style="margin: 0; color: {% if verdict.winner %}var(--green){% else %}var(--yellow){% endif %};">
                ⚖️ VERDICT: {{ verdict.outcome_type | upper | replace('_', ' ') }}
            </h2>
            {% if verdict.winner %}
            <p style="font-size: 1.5em; margin: 10px 0;">
                🏆 Winner: <strong>u/{{ verdict.winner }}</strong>
                <span class="text-muted">({{ "%.0f"|format(verdict.confidence * 100) }}% confidence)</span>
            </p>
            {% endif %}
        </div>
        <div class="stat-card" style="background: transparent; border: none;">
            <div class="stat-value">{{ analysis.quality_grade }}</div>
            <div class="stat-label">Thread Quality</div>
        </div>
    </div>
    {% if executive_summary %}
    <p style="font-style: italic; margin-top: 16px; color: var(--text);">
        "{{ executive_summary.one_liner }}"
    </p>
    {% endif %}
</div>

<!-- Stats Grid -->
<div class="stat-grid mt-4">
    <div class="stat-card">
        <div class="stat-value">{{ analysis.participant_count }}</div>
        <div class="stat-label">Participants</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ analysis.total_comments }}</div>
        <div class="stat-label">Comments</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ analysis.total_clashes }}</div>
        <div class="stat-label">Clashes</div>
    </div>
    <div class="stat-card">
        <div class="stat-value text-{% if analysis.total_fallacies > 5 %}red{% elif analysis.total_fallacies > 2 %}yellow{% else %}green{% endif %}">
            {{ analysis.total_fallacies }}
        </div>
        <div class="stat-label">Fallacies</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{{ analysis.overall_civility }}%</div>
        <div class="stat-label">Civility</div>
    </div>
</div>

<!-- Narrative Summary -->
{% if analysis.narrative_summary %}
<div class="card mt-4">
    <h3>📝 Narrative Summary</h3>
    <p style="line-height: 1.8;">{{ analysis.narrative_summary }}</p>
</div>
{% endif %}

<!-- Victory Factors -->
{% if verdict.victory_factors %}
<div class="card mt-4">
    <h3>🎯 Victory Factors</h3>
    {% for factor in verdict.victory_factors %}
    <div class="chart-bar">
        <div class="chart-label">{{ factor.factor }}</div>
        <div class="chart-fill" style="width: {{ factor.weight * 100 }}%;"></div>
        <div class="chart-value">{{ "%.0f"|format(factor.weight * 100) }}%</div>
    </div>
    <p class="text-muted" style="margin-left: 160px; margin-bottom: 12px; font-size: 13px;">
        {{ factor.explanation[:100] }}{% if factor.explanation|length > 100 %}...{% endif %}
    </p>
    {% endfor %}
</div>
{% endif %}

<!-- Decisive Moment -->
{% if verdict.decisive_moment and verdict.decisive_moment.description %}
<div class="card mt-4" style="border-left: 4px solid var(--accent);">
    <h3>⚡ Decisive Moment</h3>
    <p><strong>{{ verdict.decisive_moment.participant }}</strong></p>
    <p>{{ verdict.decisive_moment.description }}</p>
    {% if verdict.decisive_moment.why_decisive %}
    <p class="text-muted">Why decisive: {{ verdict.decisive_moment.why_decisive }}</p>
    {% endif %}
</div>
{% endif %}

<!-- Participant Rankings -->
{% if participants %}
<div class="card mt-4">
    <h3>👥 Participant Rankings</h3>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Participant</th>
                <th>Role</th>
                <th>Score</th>
                <th>Comments</th>
                <th>Badges</th>
            </tr>
        </thead>
        <tbody>
            {% for p in participants %}
            <tr>
                <td>{{ loop.index }}</td>
                <td>
                    {% if p.username == verdict.winner %}🏆{% endif %}
                    u/{{ p.username }}
                </td>
                <td><span class="badge badge-purple">{{ p.role }}</span></td>
                <td>{{ p.overall_score }}</td>
                <td>{{ p.comment_count }}</td>
                <td>
                    {% for badge in p.badges[:3] %}
                    <span class="badge badge-green">{{ badge }}</span>
                    {% endfor %}
                </td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
</div>
{% endif %}

<!-- Clashes -->
{% if clashes %}
<div class="card mt-4">
    <h3>⚔️ Major Clashes ({{ clashes|length }})</h3>
    {% for clash in clashes %}
    <div style="background: var(--bg); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0;">{{ clash.topic }}</h4>
            <span class="badge {% if clash.winner %}badge-green{% else %}badge-yellow{% endif %}">
                {% if clash.winner %}Winner: u/{{ clash.winner }}{% else %}Draw{% endif %}
            </span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
            <div>
                <p><strong>u/{{ clash.side_a.author }}</strong></p>
                <p class="text-muted">{{ clash.side_a.position[:100] }}{% if clash.side_a.position|length > 100 %}...{% endif %}</p>
                <p>Argument: {{ clash.side_a.argument_quality }}/100 | Evidence: {{ clash.side_a.evidence_quality }}/100</p>
            </div>
            <div>
                <p><strong>u/{{ clash.side_b.author }}</strong></p>
                <p class="text-muted">{{ clash.side_b.position[:100] }}{% if clash.side_b.position|length > 100 %}...{% endif %}</p>
                <p>Argument: {{ clash.side_b.argument_quality }}/100 | Evidence: {{ clash.side_b.evidence_quality }}/100</p>
            </div>
        </div>
        <p class="text-muted" style="margin-top: 8px;">{{ clash.impact_on_debate }}</p>
    </div>
    {% endfor %}
</div>
{% endif %}

<!-- Key Moments -->
{% if key_moments %}
<div class="card mt-4">
    <h3>🎬 Key Moments</h3>
    <div style="position: relative; padding-left: 20px; border-left: 2px solid var(--accent);">
        {% for moment in key_moments %}
        <div style="position: relative; margin-bottom: 20px;">
            <div style="position: absolute; left: -26px; width: 12px; height: 12px; background: var(--accent); border-radius: 50%;"></div>
            <span class="badge badge-purple">{{ moment.moment_type }}</span>
            <strong>u/{{ moment.participant }}</strong>
            <p style="margin: 8px 0;">{{ moment.description }}</p>
            {% if moment.quote %}
            <blockquote style="border-left: 2px solid var(--text-muted); padding-left: 12px; color: var(--text-muted); font-style: italic;">
                "{{ moment.quote[:150] }}{% if moment.quote|length > 150 %}...{% endif %}"
            </blockquote>
            {% endif %}
            <p class="text-muted" style="font-size: 12px;">{{ moment.significance }}</p>
        </div>
        {% endfor %}
    </div>
</div>
{% endif %}

<!-- Fallacies -->
{% if fallacies %}
<div class="card mt-4">
    <h3>⚠️ Logical Fallacies Detected ({{ fallacies|length }})</h3>
    {% for f in fallacies %}
    <div style="background: var(--bg); border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid var(--red);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span class="badge badge-red">{{ f.fallacy_type }}</span>
                <strong>by u/{{ f.committed_by }}</strong>
                {% if f.victim %}<span class="text-muted">→ u/{{ f.victim }}</span>{% endif %}
            </div>
            <span class="badge {% if f.severity == 'severe' %}badge-red{% elif f.severity == 'significant' %}badge-yellow{% else %}badge-purple{% endif %}">
                {{ f.severity }}
            </span>
        </div>
        <blockquote style="margin: 12px 0; border-left: 2px solid var(--red); padding-left: 12px; color: var(--text-muted);">
            "{{ f.user_statement[:200] }}{% if f.user_statement|length > 200 %}...{% endif %}"
        </blockquote>
        <p>{{ f.explanation }}</p>
        <p class="text-muted" style="font-size: 12px;">Impact: {{ f.debate_impact }}</p>
    </div>
    {% endfor %}
</div>
{% endif %}

<!-- Loser Postmortem -->
{% if verdict.loser and verdict.loser_what_went_wrong %}
<div class="card mt-4">
    <h3>📉 Postmortem: u/{{ verdict.loser }}</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
        <div>
            <h4 class="text-red">What Went Wrong</h4>
            <ul>
                {% for item in verdict.loser_what_went_wrong %}
                <li>{{ item }}</li>
                {% endfor %}
            </ul>
        </div>
        <div>
            <h4 class="text-green">What They Did Well</h4>
            <ul>
                {% for item in verdict.loser_what_they_did_well %}
                <li>{{ item }}</li>
                {% endfor %}
            </ul>
        </div>
        <div>
            <h4 style="color: var(--accent);">Could Have Won If...</h4>
            <ul>
                {% for item in verdict.loser_could_have_won_if %}
                <li>{{ item }}</li>
                {% endfor %}
            </ul>
        </div>
    </div>
</div>
{% endif %}

<!-- Unfinished Business -->
{% if unaddressed_arguments or unanswered_questions %}
<div class="card mt-4">
    <h3>🔮 Unfinished Business</h3>
    {% if unaddressed_arguments %}
    <h4>Unaddressed Arguments</h4>
    <ul>
        {% for arg in unaddressed_arguments %}
        <li>
            <strong>u/{{ arg.raised_by }}</strong>: {{ arg.argument }}
            <span class="text-muted">(should have been addressed by u/{{ arg.should_have_been_addressed_by }})</span>
        </li>
        {% endfor %}
    </ul>
    {% endif %}
    {% if unanswered_questions %}
    <h4>Unanswered Questions</h4>
    <ul>
        {% for q in unanswered_questions %}
        <li>{{ q }}</li>
        {% endfor %}
    </ul>
    {% endif %}
</div>
{% endif %}

<p class="text-muted mt-4" style="text-align: center;">
    Analyzed on {{ analysis.analyzed_at }} using Claude-powered deep analysis
</p>
"""


# =============================================================================
# Routes
# =============================================================================

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

def main():
    parser = argparse.ArgumentParser(description='Debate Analyzer Web Interface')
    parser.add_argument('--port', type=int, default=5000, help='Port to run on')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    args = parser.parse_args()

    init_db()
    print(f"\n🎯 Debate Analyzer Web Interface")
    print(f"   Running on http://localhost:{args.port}")
    print(f"   Database: {DB_PATH}\n")

    app.run(host='0.0.0.0', port=args.port, debug=args.debug)


if __name__ == '__main__':
    main()
