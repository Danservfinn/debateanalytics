#!/usr/bin/env python3
"""
Debate Analyzer Web Interface
=============================
A Flask-based web interface for viewing Reddit debate analyses.
Provides historical tracking, user/thread browsing, and refresh capabilities.

Usage:
    python debate_analyzer_web.py [--port 5000] [--debug]
"""

import json
import sqlite3
import threading
import argparse
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template_string, jsonify, request, redirect, url_for
from collections import defaultdict

# Import the fetcher module
from reddit_debate_fetcher import (
    RedditClient, DebateAnalyzer, ARGUMENT_TYPES, LOGICAL_FALLACIES
)

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
