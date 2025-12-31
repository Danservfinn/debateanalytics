# Reddit Debate Analyzer

A suite of tools for analyzing Reddit users' debate activity, argument styles, and logical fallacies.

## Components

### 1. CLI Tool (`reddit_debate_fetcher.py`)

Fetches and analyzes a Reddit user's debate activity from the command line.

```bash
python3 reddit_debate_fetcher.py <username> [--min-score 0.05] [--limit 100]
```

**Features:**
- Fetches user's posts and comments via Reddit's JSON API
- Identifies debate-like threads using weighted heuristics
- Analyzes argument types and logical fallacies
- Calculates win/loss record based on karma, evidence, rebuttals
- Exports results to JSON

**Output:**
- `<username>_debates.json` - Full analysis data

### 2. Web Interface (`debate_analyzer_web.py`)

Flask-based web application for browsing and managing analyses.

```bash
python3 debate_analyzer_web.py --port 5001
# Open http://localhost:5001
```

**Pages:**
| Route | Description |
|-------|-------------|
| `/` | Home - Dashboard with stats and analyze form |
| `/users` | List of all analyzed users |
| `/users/<username>` | User detail with full analysis |
| `/threads` | All debate threads across users |
| `/api/analyze/<username>` | POST endpoint to trigger analysis |

**Features:**
- SQLite database for persistent storage
- Historical tracking (multiple analyses per user)
- Refresh button to re-analyze users
- Dark-themed responsive UI

## Analysis Metrics

### Debate Detection Score (0.0 - 1.0)

Weighted combination of:
- Subreddit type (debate-focused subs score higher)
- Exchange depth (back-and-forth replies)
- Multi-comment engagement
- Response characteristics

### Argument Types (10 categories)

| Type | Description |
|------|-------------|
| `empirical` | Data, statistics, research citations |
| `anecdotal` | Personal experience, stories |
| `authority` | Expert citations, credentials |
| `moral_ethical` | Values-based reasoning |
| `logical_deductive` | If-then reasoning, syllogisms |
| `analogical` | Comparisons, metaphors |
| `consequentialist` | Outcome-focused arguments |
| `definitional` | Meaning/classification arguments |
| `pragmatic` | Practicality-based reasoning |
| `emotional` | Appeals to emotion |

### Logical Fallacies (14 types)

| Fallacy | Description |
|---------|-------------|
| `ad_hominem` | Attacking the person, not the argument |
| `strawman` | Misrepresenting opponent's position |
| `false_dichotomy` | Presenting only two options |
| `appeal_to_nature` | "Natural = good" reasoning |
| `slippery_slope` | Unfounded chain of consequences |
| `appeal_to_popularity` | "Everyone thinks so" |
| `false_equivalence` | Equating unlike things |
| `moving_goalposts` | Changing criteria after rebuttal |
| `no_true_scotsman` | Excluding counterexamples |
| `tu_quoque` | "You do it too" deflection |
| `appeal_to_emotion` | Manipulative emotional language |
| `burden_of_proof` | Shifting proof responsibility |
| `circular_reasoning` | Conclusion assumes premise |
| `hasty_generalization` | Overgeneralizing from few examples |

### Win/Loss Determination

Each debate is scored on:
- Karma differential
- Evidence usage
- Logical structure
- Rebuttal quality
- Engagement depth
- Argument substance

Results: Win (score > 0.55), Loss (< 0.45), Draw (0.45-0.55)

## Database Schema

```
debate_analyses.db
├── users (id, username, created_at, last_analyzed_at)
├── analyses (id, user_id, analyzed_at, total_threads, ...)
├── threads (id, analysis_id, thread_id, title, url, ...)
├── argument_types (id, analysis_id, arg_type, count)
└── fallacies (id, analysis_id, fallacy_type, count, examples)
```

## Dependencies

```bash
pip install flask requests
```

## Examples

### Analyze a user via CLI
```bash
python3 reddit_debate_fetcher.py wabeka
# Output: wabeka_debates.json
```

### Compare two users
```bash
python3 reddit_debate_fetcher.py user1
python3 reddit_debate_fetcher.py user2
# Compare the JSON outputs
```

### Start web interface
```bash
python3 debate_analyzer_web.py --port 5001 --debug
```

### API usage
```bash
# Trigger analysis
curl -X POST http://localhost:5001/api/analyze/username

# Response
{"success": true, "username": "...", "threads": 43, "comments": 87}
```

## Rate Limiting

The tool respects Reddit's rate limits:
- 1 request per second
- Exponential backoff on 429 errors
- No authentication required (uses public JSON API)

## Files

| File | Purpose |
|------|---------|
| `reddit_debate_fetcher.py` | CLI tool and analysis engine |
| `debate_analyzer_web.py` | Flask web interface |
| `debate_analyses.db` | SQLite database (auto-created) |
| `*_debates.json` | Analysis output files |
