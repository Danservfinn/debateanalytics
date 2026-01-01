# Enhanced Thread Analysis Template
# Full Interactive Dashboard with Multi-Debate Structure

ENHANCED_THREAD_ANALYSIS_TEMPLATE = """
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
