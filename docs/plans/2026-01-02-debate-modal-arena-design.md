# Debate Detail Modal & Arena Design

**Date**: January 2, 2026
**Status**: Approved for Implementation

---

## Overview

This document describes the design for two major features:
1. **Debate Detail Modal** - Click a debate card to open a rich modal with full conversation thread and advanced AI analysis
2. **Debate Arena** - A competitive platform where users submit blind arguments, pay to trigger AI judging, and see comprehensive battle results

---

## Feature 1: Debate Detail Modal

### 1.1 Layout

**Desktop (≥768px)**: Split-view
- Left panel: Full conversation thread (threaded tree with connecting lines)
- Right panel: AI analysis sections (collapsible)
- Modal covers 90% viewport with backdrop blur

**Mobile (<768px)**: Stacked with sticky analysis
- Full-width conversation thread
- Sticky bar at bottom showing key metrics
- Tap sticky bar to expand full analysis as bottom sheet

### 1.2 Conversation Thread (Left Panel)

Threaded tree structure with:
- Visual connecting lines showing parent-child relationships
- Position badges: 🟢 PRO / 🔴 CON / ⚪ Neutral
- Quality scores (X/10)
- Inline tags: Logic type, claim count, fallacy count
- Special markers: Concessions, key moments, burden shifts
- Collapsible deep threads (depth 3+)

Each comment card shows:
```
┌─────────────────────────────────────────────────────────────────┐
│ 🟢 u/BigMax                                    PRO │ 5.0/10    │
│ ─────────────────────────────────────────────────────────────── │
│ "Tallow and fat are the same thing..."                         │
│                                                                 │
│ 🧠 Deductive  │  📝 2 claims  │  ⚠️ 1 fallacy                  │
│                                                                 │
│ [🔍 AI Analysis]  ← Click to analyze this comment              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 AI Analysis Panel (Right Panel)

Collapsible sections:

**1.3.1 Interactive Verdict**
- Winner badge with confidence score
- Summary statement
- Expandable reasoning chain with "Jump to comment" links

**1.3.2 Logic Types Used**
- Bar chart: Deductive, Inductive, Analogical, Abductive
- Tooltip explanations

**1.3.3 Fallacies Detected**
- List with severity indicators (🔴 major, 🟡 minor)
- Clickable to jump to source comment

**1.3.4 Rhetorical Analysis**
- Logos/Ethos/Pathos balance bars
- Per-side breakdown

**1.3.5 Burden of Proof Tracker**
- Initial burden holder
- Shift timeline with triggers
- Final assessment

**1.3.6 Steel-Manning Quality**
- Per-side scores (0-10)
- Explanation of assessment

### 1.4 Interactions

- ESC key or backdrop click closes modal
- Hover fallacy tag → tooltip with details
- Click comment → highlights in analysis panel
- Click "Jump to comment" → smooth scroll + pulse animation

---

## Feature 2: Per-Comment Deep Analysis (Premium)

### 2.1 Trigger

Click any comment → "AI Analysis" button appears
- Shows "⚡ Premium" badge
- Brief description of what analysis includes

### 2.2 Analysis Process

Loading state with progress indicators:
1. ✓ Extracting claims...
2. ✓ Researching sources...
3. ● Evaluating argument structure...
4. ○ Checking logical soundness...
5. ○ Generating report...

Estimated time: 15-30 seconds

### 2.3 Analysis Result

Expanded in-place showing:

**Claims Extracted & Verified**
- Each claim with verdict (TRUE/MOSTLY TRUE/MIXED/MOSTLY FALSE/FALSE)
- Confidence percentage
- Sources with credibility ratings and links
- Nuance notes where applicable

**Argument Structure**
- Type: Deductive/Inductive/Analogical/Abductive
- Premises listed
- Conclusion stated
- Implied assumptions
- Validity assessment

**Soundness Evaluation**
- Overall score (0-10) with visual bar
- Strengths list
- Weaknesses list
- Potential rebuttals

**Rhetorical Techniques**
- Technique name
- Quote from comment
- Effect description

### 2.4 Persistence

All analyses are stored server-side:
- Future visitors see "AI Analysis Available" badge
- Can view full report without re-analyzing
- Shows who paid for analysis and when

---

## Feature 3: Debate Arena

### 3.1 Entry Point

Button on debate detail modal: "⚔️ DEBATE ARENA"

### 3.2 Arena Page - Pre-Battle

Shows:
- Topic/question being debated
- PRO side: X arguments sealed
- CON side: Y arguments sealed
- "Submit PRO" and "Submit CON" buttons
- Battle requirements (minimum 2 per side)
- Battle cost ($2 Lightning)

### 3.3 Argument Submission

Modal for submitting:
- Position selection (PRO/CON)
- Argument text (2000 char limit)
- Sources (required, at least 1)
  - Title, URL, relevant quote
- Display preference: Anonymous or username
- "Seal Argument" button (free to submit)

Arguments are encrypted until battle reveal.

### 3.4 Battle Trigger

When requirements met (2+ per side):
- "Start Battle" button becomes active
- Shows Lightning payment QR code
- $2 USD (converted to sats)
- Invoice expires in 15 minutes
- Anyone can pay to trigger

### 3.5 Battle Results Page

**Verdict Section**
- Winner (PRO/CON/DRAW)
- Score comparison
- Confidence percentage
- Summary statement
- Expandable reasoning chain

**Head-to-Head Metrics**
- Arguments count per side
- Average score per side
- Source quality percentage
- Logic validity percentage
- Claim accuracy percentage

**Argument Rankings**
- All arguments ranked by score
- Shows: Position, author, score, preview
- Badges for claims verified, fallacies, structure
- "View Full Analysis" link

**Detailed Analysis Tabs**
- Claim Verification: All claims with verdicts
- Logic Analysis: Structure breakdowns
- Source Audit: All sources with credibility

### 3.6 Continuous Arena (Living Debates)

Arenas never close. After a battle:
- New arguments can still be submitted
- "X NEW arguments since last battle" indicator
- New battle analyzes ALL arguments (previous + new)
- Battle history shows all rounds

**Score Evolution**
- Graph showing PRO vs CON scores over rounds
- Per-argument score history
- Trend indicators (improving/declining/stable)
- Delta explanations ("New evidence strengthened claim")

**Re-Analysis Logic**
When new battle triggered:
1. Retrieve all arguments (previous + new)
2. Re-evaluate everything holistically
3. Scores may shift based on new evidence/arguments
4. Generate evolution narrative
5. Compare to previous round

---

## Data Models

### PersistedAnalysis
```typescript
interface PersistedAnalysis {
  id: string
  commentId: string
  threadId: string
  analysis: DeepAnalysisResult
  analyzedBy: string
  analyzedAt: string
  viewCount: number
}
```

### DeepAnalysisResult
```typescript
interface DeepAnalysisResult {
  claims: Array<{
    text: string
    verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false'
    confidence: number
    sources: Array<{
      title: string
      url: string
      quote: string
      credibility: 'high' | 'medium' | 'low'
    }>
    nuance?: string
  }>

  argumentStructure: {
    type: 'deductive' | 'inductive' | 'analogical' | 'abductive'
    premises: string[]
    conclusion: string
    impliedAssumptions: string[]
    validity: 'valid' | 'invalid' | 'uncertain'
  }

  soundness: {
    score: number
    strengths: string[]
    weaknesses: string[]
    potentialRebuttals: string[]
  }

  rhetoricalTechniques: Array<{
    technique: string
    quote: string
    effect: string
  }>

  analyzedAt: string
}
```

### DebateArena
```typescript
interface DebateArena {
  id: string
  threadId: string
  topic: string
  description: string
  createdAt: string
  createdBy: string
  status: 'active'

  submissions: ArenaSubmission[]
  battles: BattleRound[]

  totalBattles: number
  latestBattleId?: string
  pendingNewArguments: number
}
```

### ArenaSubmission
```typescript
interface ArenaSubmission {
  id: string
  arenaId: string
  position: 'pro' | 'con'
  author: string
  authorId: string

  argumentText: string
  sources: Array<{
    title: string
    url: string
    quote: string
  }>

  submittedAt: string

  battleAppearances: Array<{
    battleId: string
    round: number
    score: number
    rank: number
    analysis: DeepAnalysisResult
  }>

  firstRevealedInRound: number
  currentScore: number
  scoreHistory: number[]
  trend: 'improving' | 'declining' | 'stable'
}
```

### BattleRound
```typescript
interface BattleRound {
  id: string
  arenaId: string
  round: number

  triggeredBy: string
  triggeredAt: string
  paymentTxId: string

  includedSubmissionIds: string[]
  newSubmissionIds: string[]

  result: BattleResult

  previousRoundId?: string
  scoreDeltas: Array<{
    submissionId: string
    previousScore: number
    newScore: number
    delta: number
    reason: string
  }>
}
```

### BattleResult
```typescript
interface BattleResult {
  winner: 'pro' | 'con' | 'draw'
  proScore: number
  conScore: number
  confidence: number

  verdictSummary: string
  reasoningChain: string[]

  argumentRankings: Array<{
    submissionId: string
    rank: number
    score: number
    analysis: DeepAnalysisResult
  }>

  metrics: {
    proAvgScore: number
    conAvgScore: number
    proSourceQuality: number
    conSourceQuality: number
    proLogicValidity: number
    conLogicValidity: number
    proClaimAccuracy: number
    conClaimAccuracy: number
  }

  claimBreakdown: Array<{
    claim: string
    source: 'pro' | 'con'
    verdict: string
    confidence: number
  }>

  generatedAt: string
}
```

---

## API Endpoints

### Per-Comment Analysis
- `POST /api/analyze-comment` - Trigger deep analysis
- `GET /api/analysis/:commentId` - Get persisted analysis

### Debate Arena
- `POST /api/arena/create` - Create new arena
- `GET /api/arena/:id` - Get arena state
- `POST /api/arena/:id/submit` - Submit argument
- `POST /api/arena/:id/create-invoice` - Create Lightning invoice
- `GET /api/arena/:id/check-payment` - Poll payment status
- `POST /api/arena/:id/trigger-battle` - Execute battle (after payment)
- `GET /api/arena/:id/battle/:round` - Get battle results

---

## Implementation Phases

### Phase 1: Debate Detail Modal
1. Create DebateDetailModal component
2. Create ConversationThread component (threaded tree)
3. Create AnalysisPanel component with all sections
4. Wire up to DebateThreadCard click handler
5. Implement mobile responsive behavior

### Phase 2: Per-Comment Deep Analysis
1. Create API endpoint with Claude Agent SDK
2. Create CommentAnalysisButton component
3. Create AnalysisResultPanel component
4. Implement persistence layer
5. Add "Analysis Available" badges

### Phase 3: Debate Arena Core
1. Create arena data models and API
2. Create ArenaPage component
3. Create SubmitArgumentModal component
4. Implement argument encryption/sealing
5. Create ArenaStatusPanel component

### Phase 4: Battle System
1. Integrate Lightning payment
2. Create battle trigger flow
3. Implement Claude Agent SDK battle analysis
4. Create BattleResultsPage component
5. Implement score evolution tracking

### Phase 5: Polish & Optimization
1. Add animations and transitions
2. Optimize mobile experience
3. Add loading states and error handling
4. Performance optimization
5. Testing

---

## Design Decisions

1. **Modal vs Page**: Modal chosen for debate details to maintain context
2. **Split-view**: Best balance of conversation flow and analysis visibility
3. **Stacked mobile**: Natural reading flow with accessible analysis
4. **Continuous arena**: Allows ongoing participation, more engaging
5. **$2 battle cost**: Low barrier but prevents spam, covers API costs
6. **Cumulative re-analysis**: Ensures fair comparison as debate evolves
