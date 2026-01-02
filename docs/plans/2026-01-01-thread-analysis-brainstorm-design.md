# Thread Analysis Design Plan v4 (Full-Stack)

> **Version 4 Changes**: Full-stack plan with backend, debate detection algorithm, Claude Agent SDK for fingerprinting, Neo4j analytics database, $5/thread with enhanced Reply Coach, dynamic taxonomy, enterprise data collection (platform deferred), free tier includes debate segmentation AI.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Work](#backend-work)
3. [Debate Detection Algorithm](#debate-detection-algorithm)
4. [Argument Fingerprinting with Claude Agent SDK](#argument-fingerprinting-with-claude-agent-sdk)
5. [Analytics Database (Neo4j)](#analytics-database-neo4j)
6. [Enhanced Reply Coach ($5 Feature)](#enhanced-reply-coach-5-feature)
7. [Research Data Collection](#research-data-collection)
8. [Frontend Components](#frontend-components)
9. [Implementation Phases](#implementation-phases)
10. [Cost Model](#cost-model)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   FULL-STACK ARCHITECTURE                                                       │
│   ═══════════════════════                                                       │
│                                                                                  │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │                           FRONTEND (Next.js)                               │ │
│   │                                                                            │ │
│   │   /thread/[id]  →  Thread Analysis Page (6 tabs)                          │ │
│   │   /user/[name]  →  User Profile Page                                      │ │
│   │                                                                            │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                        │
│                                        ▼                                        │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │                         NEXT.JS API ROUTES                                 │ │
│   │                                                                            │ │
│   │   POST /api/analyze-thread        →  Full thread analysis                 │ │
│   │   POST /api/analyze-thread-deep   →  Enhanced analysis ($5)               │ │
│   │   GET  /api/user/[name]/status    →  Lightweight profile check            │ │
│   │   POST /api/users/batch-status    →  Batch participant lookup             │ │
│   │   POST /api/reply-coach           →  Researched reply suggestions ($5)    │ │
│   │   POST /api/fact-check            →  Deep fact verification ($5)          │ │
│   │                                                                            │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                        │
│                    ┌───────────────────┼───────────────────┐                   │
│                    ▼                   ▼                   ▼                   │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐   │
│   │   CLAUDE API        │  │   RAILWAY BACKEND   │  │   NEO4J AURA        │   │
│   │   (Analysis)        │  │   (Python/Flask)    │  │   (Analytics DB)    │   │
│   │                     │  │                     │  │                     │   │
│   │   • Thread analysis │  │   • Reddit scraping │  │   • Argument nodes  │   │
│   │   • Debate detection│  │   • User profiles   │  │   • User nodes      │   │
│   │   • Reply coaching  │  │   • Payment verify  │  │   • Topic nodes     │   │
│   │   • Fact checking   │  │   • Cache layer     │  │   • Relationships   │   │
│   │   • Fingerprinting  │  │                     │  │   • Aggregations    │   │
│   │                     │  │                     │  │                     │   │
│   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Price | **$5/thread** | Covers enhanced AI costs, provides real value |
| Free tier AI | **Yes** (debate segmentation) | Essential for product demo, drives conversion |
| Taxonomy | **Dynamic** (LLM-generated) | More flexible, no maintenance |
| Enterprise | **Data collection only** | Build platform later when data is rich |
| Reply Coach | **Researched + sourced** | Primary value proposition at $5 |
| Analytics DB | **Neo4j** | Graph relationships ideal for debates |
| Fingerprinting | **Claude Agent SDK** | Semantic understanding, tool use |
| Fallbacks | **None** | Real data only, no mockups |

---

## Backend Work

### New API Endpoints Required

#### 1. POST `/api/analyze-thread` (Free Tier)

Returns debate-segmented thread analysis without AI-intensive features.

```typescript
// Request
{
  url: string  // Reddit thread URL
}

// Response
{
  threadId: string
  title: string
  subreddit: string
  author: string
  commentCount: number

  // Free tier analysis
  verdict: {
    overallScore: number        // 0-10
    summary: string
    evidenceQualityPct: number
    civilityScore: number
  }

  // Debate segmentation (AI-generated, included in free tier)
  debates: DebateThread[]

  // Participants with cached profiles
  participants: ParticipantSummary[]

  // Claims (quick verdict only)
  claims: Claim[]

  // Fallacies detected
  fallacies: FallacyInstance[]

  // Rhetorical profiles
  rhetoricalProfiles: RhetoricalProfile[]
}
```

#### 2. POST `/api/analyze-thread-deep` (Paid - $5)

Extends free tier with researched content.

```typescript
// Request
{
  url: string
  paymentProof: string  // Lightning payment hash
}

// Response extends FreeResponse {
  // Enhanced debates with momentum analysis
  debates: EnhancedDebateThread[]

  // OP deep analysis
  opAnalysis: OPAnalysis

  // Research metadata for analytics
  researchMeta: ResearchMetadata
}
```

#### 3. GET `/api/user/[username]/status`

Lightweight check if user profile is cached.

```typescript
// Response
{
  cached: boolean
  cachedAt?: string
  overallScore?: number
  archetype?: {
    primary: string
    secondary?: string
  }
  debatesAnalyzed?: number
}
```

#### 4. POST `/api/users/batch-status`

Batch lookup for thread participants.

```typescript
// Request
{
  usernames: string[]
}

// Response
{
  [username: string]: {
    cached: boolean
    archetype?: DebateArchetype
    overallScore?: number
    signatureMoves?: string[]
  }
}
```

#### 5. POST `/api/reply-coach` (Paid - $5)

**Enhanced Reply Coach with research and sourced replies.**

```typescript
// Request
{
  targetComment: {
    id: string
    author: string
    text: string
    claims: string[]
  }
  threadContext: {
    topic: string
    opPosition: string
    debateHistory: string[]
  }
  paymentProof: string
}

// Response
{
  strategies: ResearchedReplyStrategy[]
  tacticsToAvoid: string[]
  opponentProfile?: {
    archetype: DebaterArchetype
    knownWeaknesses: string[]
    effectiveApproaches: string[]
  }
}

interface ResearchedReplyStrategy {
  type: 'challenge_framing' | 'counter_evidence' | 'partial_agreement' | 'socratic_question' | 'steelman_then_counter'

  // The actual suggested reply (researched, sourced)
  suggestedReply: string

  // Research backing
  sources: Array<{
    title: string
    url: string
    relevantQuote: string
    credibilityScore: number
  }>

  // Logic analysis
  logicalStructure: {
    premise: string
    reasoning: string
    conclusion: string
  }

  // Effectiveness metrics
  strengthScore: number           // 1-10
  riskLevel: 'low' | 'medium' | 'high'
  effectivenessWithArchetype: Record<DebaterArchetype, number>

  // Customization
  editableVersion: string         // User can modify before posting
}
```

#### 6. POST `/api/fact-check` (Paid - $5)

Deep fact verification with sources.

```typescript
// Request
{
  claim: string
  author: string
  context: string
  paymentProof: string
}

// Response
{
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false'
  confidence: number

  // Detailed analysis
  explanation: string
  nuancePoints: string[]

  // Sources
  sources: Array<{
    title: string
    url: string
    relevantQuote: string
    publishDate: string
    credibility: 'high' | 'medium' | 'low'
  }>

  // Related claims
  relatedClaims: Array<{
    claim: string
    verdict: string
    source: string
  }>
}
```

### Backend Implementation Tasks

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   BACKEND IMPLEMENTATION CHECKLIST                                              │
│   ═════════════════════════════════                                             │
│                                                                                  │
│   Railway Python Backend:                                                       │
│   ├── [ ] Add /api/user/{username}/status endpoint                             │
│   ├── [ ] Add /api/users/batch-status endpoint                                 │
│   ├── [ ] Integrate Neo4j connection                                           │
│   ├── [ ] Add research data persistence layer                                  │
│   └── [ ] Payment verification for $5 tier                                     │
│                                                                                  │
│   Next.js API Routes:                                                           │
│   ├── [ ] Refactor analyze-thread for debate segmentation                      │
│   ├── [ ] Create analyze-thread-deep with enhanced features                    │
│   ├── [ ] Create reply-coach with Claude Agent SDK                             │
│   ├── [ ] Create fact-check with web research                                  │
│   ├── [ ] Add Neo4j write operations for analytics                             │
│   └── [ ] Update Lightning payment flow for $5                                 │
│                                                                                  │
│   Claude Prompts:                                                               │
│   ├── [ ] Debate detection system prompt                                       │
│   ├── [ ] Position classification prompt                                       │
│   ├── [ ] Momentum shift detection prompt                                      │
│   ├── [ ] Reply coach research prompt                                          │
│   ├── [ ] Fact-check investigation prompt                                      │
│   └── [ ] Argument fingerprinting agent prompt                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Debate Detection Algorithm

### Overview

The debate detection algorithm segments a flat list of Reddit comments into structured debate threads with PRO/CON positions and quality-based winner determination.

### Algorithm Steps

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   DEBATE DETECTION PIPELINE                                                     │
│   ═════════════════════════                                                     │
│                                                                                  │
│   INPUT: Raw comments from Reddit thread                                        │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 1: BUILD REPLY TREE                                               │   │
│   │                                                                          │   │
│   │  • Parse parent_id relationships                                        │   │
│   │  • Create tree structure                                                │   │
│   │  • Calculate depth for each comment                                     │   │
│   │                                                                          │   │
│   │  Output: Tree<Comment>                                                  │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                  │
│                              ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 2: IDENTIFY DEBATE ROOTS                                          │   │
│   │                                                                          │   │
│   │  A comment is a debate root if:                                         │   │
│   │  • It's a top-level reply to OP (depth == 1)                            │   │
│   │  • OR it has 3+ descendant comments                                     │   │
│   │  • AND it contains a claim or position statement                        │   │
│   │                                                                          │   │
│   │  Output: List<DebateRoot>                                               │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                  │
│                              ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 3: CLASSIFY POSITIONS (LLM)                                        │   │
│   │                                                                          │   │
│   │  For each comment in debate:                                            │   │
│   │  • Determine position relative to OP: PRO | CON | NEUTRAL               │   │
│   │  • Calculate position intensity: 1-10                                   │   │
│   │  • Detect if position changed from previous comment by same author     │   │
│   │                                                                          │   │
│   │  Output: Comment + Position metadata                                    │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                  │
│                              ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 4: SCORE ARGUMENTS (LLM)                                          │   │
│   │                                                                          │   │
│   │  For each comment:                                                      │   │
│   │  • Quality score: 1-10 (evidence, logic, clarity)                       │   │
│   │  • Detect fallacies                                                     │   │
│   │  • Extract claims                                                       │   │
│   │  • Check for concession language                                        │   │
│   │                                                                          │   │
│   │  Output: ScoredComment[]                                                │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                  │
│                              ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 5: DETECT MOMENTUM SHIFTS                                         │   │
│   │                                                                          │   │
│   │  A momentum shift occurs when:                                          │   │
│   │  • A reply has significantly higher quality than the one it responds to │   │
│   │  • AND the replying position is opposite to the previous leader        │   │
│   │  • OR the opponent explicitly concedes                                  │   │
│   │                                                                          │   │
│   │  Threshold: Quality difference > 2.0 points                            │   │
│   │                                                                          │   │
│   │  Output: MomentumShift[]                                                │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                  │
│                              ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 6: DETERMINE WINNER                                               │   │
│   │                                                                          │   │
│   │  Winner determination (quality-based, NOT vote-based):                  │   │
│   │                                                                          │   │
│   │  1. Calculate average quality for PRO comments                          │   │
│   │  2. Calculate average quality for CON comments                          │   │
│   │  3. Compare:                                                            │   │
│   │     • If |proAvg - conAvg| < 0.5 → DRAW                                │   │
│   │     • If proAvg > conAvg + 0.5 → PRO WINS                              │   │
│   │     • If conAvg > proAvg + 0.5 → CON WINS                              │   │
│   │     • If no clear positions → UNRESOLVED                               │   │
│   │                                                                          │   │
│   │  Output: winner, winnerReason                                           │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                  │
│                              ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 7: GENERATE DEBATE TITLE (LLM)                                    │   │
│   │                                                                          │   │
│   │  Based on the key claims and clash points, generate a title like:       │   │
│   │  • "The economic cost-benefit analysis"                                 │   │
│   │  • "Personal freedom vs societal expectations"                          │   │
│   │  • "Whether statistics support the claim"                               │   │
│   │                                                                          │   │
│   │  Output: title, keyClash                                                │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   OUTPUT: DebateThread[]                                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### LLM Prompts

#### Position Classification Prompt

```
You are analyzing a Reddit comment in the context of a debate thread.

ORIGINAL POST (OP) POSITION:
{op_text}

COMMENT TO CLASSIFY:
Author: {author}
Text: {comment_text}
Replying to: {parent_text}

Classify this comment:

1. POSITION relative to OP's stance:
   - PRO: Agrees with or supports OP's position
   - CON: Disagrees with or challenges OP's position
   - NEUTRAL: Neither agrees nor disagrees, asks questions, or provides balanced info

2. POSITION_INTENSITY (1-10):
   - 1-3: Mild agreement/disagreement
   - 4-6: Moderate stance
   - 7-10: Strong, emphatic position

3. IS_CONCESSION (boolean):
   - True if the author admits a point to the other side
   - Look for phrases like "you're right that", "I'll grant", "fair point", "I concede"

Respond in JSON:
{
  "position": "PRO" | "CON" | "NEUTRAL",
  "intensity": 1-10,
  "isConcession": boolean,
  "reasoning": "Brief explanation"
}
```

#### Argument Quality Scoring Prompt

```
Score this argument on a 1-10 scale based on:

ARGUMENT:
{comment_text}

SCORING CRITERIA:
- Evidence (0-3 points): Does it cite sources, statistics, or concrete examples?
- Logic (0-3 points): Is the reasoning sound? Are there logical fallacies?
- Clarity (0-2 points): Is it well-structured and easy to follow?
- Engagement (0-2 points): Does it address the specific points raised?

Detect any logical fallacies from this list:
- Ad Hominem, Strawman, False Dichotomy, Appeal to Authority,
- Slippery Slope, Red Herring, Circular Reasoning, Hasty Generalization,
- Appeal to Emotion, Whataboutism, Moving Goalposts, No True Scotsman

Extract factual claims that can be verified.

Respond in JSON:
{
  "qualityScore": 1-10,
  "breakdown": {
    "evidence": 0-3,
    "logic": 0-3,
    "clarity": 0-2,
    "engagement": 0-2
  },
  "fallacies": [
    { "type": "string", "quote": "string", "severity": "low|medium|high" }
  ],
  "claims": [
    { "text": "string", "verifiable": boolean }
  ],
  "isConcession": boolean
}
```

#### Winner Determination

```typescript
function determineWinner(debate: DebateThread): WinnerResult {
  const proComments = debate.replies.filter(r => r.position === 'pro')
  const conComments = debate.replies.filter(r => r.position === 'con')

  if (proComments.length === 0 && conComments.length === 0) {
    return { winner: 'unresolved', reason: 'No clear positions taken' }
  }

  const proAvg = average(proComments.map(c => c.qualityScore))
  const conAvg = average(conComments.map(c => c.qualityScore))

  const difference = Math.abs(proAvg - conAvg)

  if (difference < 0.5) {
    return {
      winner: 'draw',
      reason: `Close debate (PRO: ${proAvg.toFixed(1)} vs CON: ${conAvg.toFixed(1)})`
    }
  }

  if (proAvg > conAvg) {
    return {
      winner: 'pro',
      reason: `PRO arguments stronger (${proAvg.toFixed(1)} vs ${conAvg.toFixed(1)})`
    }
  }

  return {
    winner: 'con',
    reason: `CON arguments stronger (${conAvg.toFixed(1)} vs ${proAvg.toFixed(1)})`
  }
}
```

---

## Argument Fingerprinting with Claude Agent SDK

### Why Claude Agent SDK?

Traditional fingerprinting (regex, hashing) fails for semantic argument matching. We need:
- Understanding of argument meaning, not just words
- Entity normalization ("$15/hr" = "fifteen dollar minimum wage")
- Core claim extraction (strip hedge words, get essence)
- Similarity scoring for variant detection

The Claude Agent SDK allows us to give Claude tools to:
1. Extract the core claim
2. Normalize entities
3. Generate semantic fingerprint
4. Store in Neo4j for later matching

### Agent Architecture

```typescript
// src/lib/agents/fingerprint-agent.ts

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const FINGERPRINT_TOOLS = [
  {
    name: "extract_core_claim",
    description: "Extract the core claim from an argument, removing hedge words and filler",
    input_schema: {
      type: "object",
      properties: {
        original_text: { type: "string" },
        core_claim: { type: "string" },
        claim_type: {
          type: "string",
          enum: ["factual", "policy", "value", "causal", "definitional"]
        },
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              original: { type: "string" },
              normalized: { type: "string" },
              type: { type: "string" }
            }
          }
        }
      },
      required: ["original_text", "core_claim", "claim_type", "entities"]
    }
  },
  {
    name: "generate_fingerprint",
    description: "Generate a semantic fingerprint for argument matching",
    input_schema: {
      type: "object",
      properties: {
        core_claim: { type: "string" },
        fingerprint_components: {
          type: "object",
          properties: {
            subject: { type: "string" },
            predicate: { type: "string" },
            object: { type: "string" },
            modifiers: { type: "array", items: { type: "string" } }
          }
        },
        semantic_tags: { type: "array", items: { type: "string" } },
        fingerprint_hash: { type: "string" }
      },
      required: ["core_claim", "fingerprint_components", "semantic_tags", "fingerprint_hash"]
    }
  },
  {
    name: "find_similar_arguments",
    description: "Query Neo4j for similar previously-seen arguments",
    input_schema: {
      type: "object",
      properties: {
        fingerprint_hash: { type: "string" },
        semantic_tags: { type: "array", items: { type: "string" } },
        similarity_threshold: { type: "number" }
      },
      required: ["fingerprint_hash", "semantic_tags"]
    }
  },
  {
    name: "store_fingerprint",
    description: "Store the fingerprint in Neo4j for future matching",
    input_schema: {
      type: "object",
      properties: {
        fingerprint_hash: { type: "string" },
        core_claim: { type: "string" },
        original_text: { type: "string" },
        semantic_tags: { type: "array", items: { type: "string" } },
        thread_id: { type: "string" },
        author: { type: "string" },
        timestamp: { type: "string" }
      },
      required: ["fingerprint_hash", "core_claim", "original_text", "semantic_tags", "thread_id", "author", "timestamp"]
    }
  }
]

export async function fingerprintArgument(
  argumentText: string,
  threadId: string,
  author: string
): Promise<ArgumentFingerprint> {

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are an argument analysis agent. Your job is to:
1. Extract the core claim from arguments
2. Normalize entities (e.g., "$15" → "MINIMUM_WAGE_INCREASE")
3. Generate semantic fingerprints for matching similar arguments
4. Store fingerprints for later retrieval

Use the tools provided to complete the analysis. Always extract the core claim first,
then generate the fingerprint, then store it.`,
    tools: FINGERPRINT_TOOLS,
    messages: [
      {
        role: "user",
        content: `Fingerprint this argument from thread ${threadId} by ${author}:

"${argumentText}"

Extract the core claim, generate a fingerprint, and store it for future matching.`
      }
    ]
  })

  // Process tool calls and extract fingerprint
  return processAgentResponse(response)
}
```

### Fingerprint Schema

```typescript
interface ArgumentFingerprint {
  hash: string                    // Deterministic hash of normalized claim
  coreClaim: string              // Extracted core claim
  originalText: string           // Full original text
  claimType: 'factual' | 'policy' | 'value' | 'causal' | 'definitional'

  // Semantic components
  subject: string                // What the claim is about
  predicate: string              // What's being said
  object: string                 // Target of the claim
  modifiers: string[]            // Qualifiers, conditions

  // For matching
  semanticTags: string[]         // Topic tags for clustering

  // Provenance
  threadId: string
  author: string
  timestamp: string

  // Matching results
  similarArguments?: Array<{
    hash: string
    coreClaim: string
    similarity: number
    threadId: string
  }>
}
```

---

## Analytics Database (Neo4j)

### Why Neo4j?

Graph databases are ideal for debate analytics because:

1. **Relationships are first-class**: Replies, agreements, refutations are edges
2. **Pattern matching**: Find "arguments that convinced Lawyers"
3. **Path queries**: "How did this narrative spread?"
4. **Aggregations**: "What's the win rate for Professor archetypes?"
5. **Flexible schema**: Easy to add new node/edge types

### Neo4j Data Model

```cypher
// NODE TYPES
// ===========

// Users
(:User {
  username: String,
  archetype: String,
  archetypeConfidence: Float,
  overallScore: Float,
  debatesAnalyzed: Int,
  createdAt: DateTime,
  updatedAt: DateTime
})

// Arguments (fingerprinted)
(:Argument {
  hash: String,           // Fingerprint hash
  coreClaim: String,
  claimType: String,
  semanticTags: [String],
  firstSeen: DateTime,
  frequency: Int,
  avgEffectiveness: Float
})

// Threads
(:Thread {
  threadId: String,
  subreddit: String,
  title: String,
  opPosition: String,
  analyzedAt: DateTime,
  debateCount: Int,
  overallScore: Float
})

// Debates (sub-threads)
(:Debate {
  debateId: String,
  title: String,
  winner: String,
  proScore: Float,
  conScore: Float,
  replyCount: Int,
  heatLevel: Float
})

// Topics (dynamic, LLM-generated)
(:Topic {
  name: String,           // e.g., "cryptocurrency_regulation"
  parentTopic: String,    // e.g., "economics"
  frequency: Int,
  avgPolarization: Float
})

// Comments
(:Comment {
  commentId: String,
  text: String,
  position: String,
  qualityScore: Float,
  isConcession: Boolean,
  karma: Int,
  createdAt: DateTime
})


// RELATIONSHIPS
// ==============

// User relationships
(:User)-[:AUTHORED]->(:Comment)
(:User)-[:PARTICIPATED_IN]->(:Debate)
(:User)-[:USED_ARGUMENT]->(:Argument)
(:User)-[:CONVINCED]-[:User)  // Persuasion events

// Thread structure
(:Thread)-[:CONTAINS]->(:Debate)
(:Debate)-[:HAS_ROOT]->(:Comment)
(:Comment)-[:REPLIED_TO]->(:Comment)

// Argument relationships
(:Comment)-[:CONTAINS_ARGUMENT]->(:Argument)
(:Argument)-[:SIMILAR_TO {similarity: Float}]->(:Argument)
(:Argument)-[:COUNTERS]->(:Argument)

// Topic relationships
(:Thread)-[:ABOUT]->(:Topic)
(:Argument)-[:RELATES_TO]->(:Topic)
(:Topic)-[:CHILD_OF]->(:Topic)

// Effectiveness tracking
(:Argument)-[:LED_TO_CONCESSION {count: Int}]->(:User)
(:Argument)-[:EFFECTIVE_AGAINST {rate: Float}]->(:Archetype)
```

### Key Queries for Research

```cypher
// 1. Most effective arguments on a topic
MATCH (a:Argument)-[:RELATES_TO]->(:Topic {name: 'climate_policy'})
MATCH (a)<-[:CONTAINS_ARGUMENT]-(c:Comment)
WHERE c.position = 'pro'
OPTIONAL MATCH (a)-[led:LED_TO_CONCESSION]->()
RETURN a.coreClaim,
       COUNT(DISTINCT c) as usageCount,
       SUM(led.count) as concessions,
       AVG(c.qualityScore) as avgQuality
ORDER BY concessions DESC
LIMIT 20

// 2. Archetype persuadability
MATCH (u:User)-[:CONVINCED]->(target:User)
WHERE target.archetype = 'the_lawyer'
MATCH (u)-[:USED_ARGUMENT]->(a:Argument)
RETURN a.coreClaim, COUNT(*) as convincedCount
ORDER BY convincedCount DESC

// 3. Argument spread (narrative tracking)
MATCH path = (a:Argument)-[:SIMILAR_TO*1..5]-(related:Argument)
WHERE a.hash = $startingHash
MATCH (related)<-[:CONTAINS_ARGUMENT]-(c:Comment)<-[:CONTAINS]-(t:Thread)
RETURN related.coreClaim, t.subreddit, c.createdAt
ORDER BY c.createdAt

// 4. Echo chamber detection
MATCH (u:User)-[:PARTICIPATED_IN]->(d:Debate)<-[:PARTICIPATED_IN]-(other:User)
WHERE u.username = $username
MATCH (u)-[:AUTHORED]->(c1:Comment)
MATCH (other)-[:AUTHORED]->(c2:Comment)
WHERE c1.position = c2.position
RETURN other.username, COUNT(*) as agreementCount
ORDER BY agreementCount DESC

// 5. Topic polarization over time
MATCH (t:Thread)-[:ABOUT]->(topic:Topic {name: 'ubi'})
MATCH (t)-[:CONTAINS]->(d:Debate)
WITH t.analyzedAt as date,
     d.proScore as proScore,
     d.conScore as conScore
RETURN date(date) as day,
       AVG(ABS(proScore - conScore)) as polarization
ORDER BY day
```

### Neo4j Setup

```typescript
// src/lib/neo4j.ts

import neo4j from 'neo4j-driver'

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
)

export async function storeThreadAnalysis(analysis: ThreadAnalysis) {
  const session = driver.session()

  try {
    await session.executeWrite(async tx => {
      // Create Thread node
      await tx.run(`
        MERGE (t:Thread {threadId: $threadId})
        SET t.subreddit = $subreddit,
            t.title = $title,
            t.opPosition = $opPosition,
            t.analyzedAt = datetime(),
            t.debateCount = $debateCount,
            t.overallScore = $overallScore
      `, {
        threadId: analysis.threadId,
        subreddit: analysis.subreddit,
        title: analysis.title,
        opPosition: analysis.verdict.summary,
        debateCount: analysis.debates.length,
        overallScore: analysis.verdict.overallScore
      })

      // Create Topic relationships (dynamic)
      for (const topic of analysis.topics) {
        await tx.run(`
          MERGE (topic:Topic {name: $topicName})
          ON CREATE SET topic.frequency = 1
          ON MATCH SET topic.frequency = topic.frequency + 1
          WITH topic
          MATCH (t:Thread {threadId: $threadId})
          MERGE (t)-[:ABOUT]->(topic)
        `, { topicName: topic, threadId: analysis.threadId })
      }

      // Store debates, comments, arguments...
      for (const debate of analysis.debates) {
        await storeDebate(tx, analysis.threadId, debate)
      }
    })
  } finally {
    await session.close()
  }
}
```

---

## Enhanced Reply Coach ($5 Feature)

### Value Proposition

At $5/thread, the Reply Coach must provide exceptional value:

1. **Researched replies** — Not just templates, actual sourced content
2. **Opponent profiling** — Use cached archetype to tailor approach
3. **Logic structure** — Show the premise → reasoning → conclusion
4. **Source verification** — Every claim backed by credible sources
5. **Effectiveness prediction** — How well this works against their archetype

### Reply Coach UI (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  💬 REPLY COACH                                                        [×]      │
│  ═══════════════                                                                │
│                                                                                  │
│  Responding to u/skeptic_dad's argument:                                        │
│  "The economic argument against children is straightforward: the USDA           │
│   estimates $310,000 to raise a child to 18..."                                 │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  OPPONENT PROFILE                                                       │    │
│  │                                                                          │    │
│  │  🎓 The Professor (87% confidence)                                      │    │
│  │                                                                          │    │
│  │  ┌─ EFFECTIVE APPROACHES ──────────────────────────────────────────┐   │    │
│  │  │  ✓ Counter with academic sources                                 │   │    │
│  │  │  ✓ Acknowledge their data before countering                     │   │    │
│  │  │  ✓ Use structured, evidence-based arguments                     │   │    │
│  │  └──────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                          │    │
│  │  ┌─ KNOWN WEAKNESSES ──────────────────────────────────────────────┐   │    │
│  │  │  ⚠️ Tends to dismiss non-quantifiable value                     │   │    │
│  │  │  ⚠️ May over-rely on authority of sources                       │   │    │
│  │  └──────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                          │    │
│  │  STRATEGY 1: COUNTER WITH EVIDENCE                         [Best Match] │    │
│  │  ════════════════════════════════                                       │    │
│  │                                                                          │    │
│  │  ┌─ SUGGESTED REPLY ───────────────────────────────────────────────┐   │    │
│  │  │                                                                  │   │    │
│  │  │  Your USDA figure is accurate, but your cost-benefit analysis   │   │    │
│  │  │  is incomplete. The CBO's 2023 report on intergenerational      │   │    │
│  │  │  fiscal analysis shows that each child generates approximately   │   │    │
│  │  │  $1.1M in net fiscal contributions over their lifetime through  │   │    │
│  │  │  taxes, Social Security contributions, and economic             │   │    │
│  │  │  productivity.                                                   │   │    │
│  │  │                                                                  │   │    │
│  │  │  Additionally, the Federal Reserve's 2022 study on family       │   │    │
│  │  │  network effects quantifies the economic value of informal      │   │    │
│  │  │  care networks at $470B annually.                               │   │    │
│  │  │                                                                  │   │    │
│  │  │  Your framing treats children purely as consumption when        │   │    │
│  │  │  economic literature treats them as both consumption AND        │   │    │
│  │  │  investment with significant positive externalities.            │   │    │
│  │  │                                                                  │   │    │
│  │  └──────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                          │    │
│  │  ┌─ LOGIC STRUCTURE ───────────────────────────────────────────────┐   │    │
│  │  │                                                                  │   │    │
│  │  │  Premise: Your cost analysis only counts expenses               │   │    │
│  │  │     ↓                                                            │   │    │
│  │  │  Reasoning: Economic analysis requires both costs AND benefits  │   │    │
│  │  │     ↓                                                            │   │    │
│  │  │  Conclusion: Your conclusion is based on incomplete data        │   │    │
│  │  │                                                                  │   │    │
│  │  └──────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                          │    │
│  │  ┌─ SOURCES ───────────────────────────────────────────────────────┐   │    │
│  │  │                                                                  │   │    │
│  │  │  📚 CBO Report on Fiscal Impacts (2023)                         │   │    │
│  │  │     "Net lifetime fiscal contribution per child..."              │   │    │
│  │  │     Credibility: ████████████ HIGH                               │   │    │
│  │  │     [View Source →]                                              │   │    │
│  │  │                                                                  │   │    │
│  │  │  📚 Federal Reserve Study on Care Networks (2022)               │   │    │
│  │  │     "Informal care provided by family members..."                │   │    │
│  │  │     Credibility: ████████████ HIGH                               │   │    │
│  │  │     [View Source →]                                              │   │    │
│  │  │                                                                  │   │    │
│  │  │  📚 Journal of Economic Perspectives (2021)                     │   │    │
│  │  │     "Children as consumption vs investment..."                   │   │    │
│  │  │     Credibility: ████████████ HIGH                               │   │    │
│  │  │     [View Source →]                                              │   │    │
│  │  │                                                                  │   │    │
│  │  └──────────────────────────────────────────────────────────────────┘   │    │
│  │                                                                          │    │
│  │  Effectiveness: █████████░  9/10                                        │    │
│  │  Risk: LOW                                                               │    │
│  │  Works best with: Professors (92%), Lawyers (88%), Socratic (85%)       │    │
│  │                                                                          │    │
│  │  [📋 Copy Reply]  [✏️ Edit Before Copying]  [🔄 Generate Alternative]   │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                          │    │
│  │  STRATEGY 2: CHALLENGE THE FRAMING                           [Expand ▼] │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                          │    │
│  │  STRATEGY 3: SOCRATIC QUESTION                               [Expand ▼] │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  ⚠️ TACTICS TO AVOID                                                           │
│                                                                                  │
│  • Ad hominem attacks (they value logic, this backfires badly)                 │
│  • Unsourced emotional appeals (Professors dismiss these)                      │
│  • Whataboutism (they'll call it out as fallacy)                               │
│  • Overstating your claims (they'll fact-check you)                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Reply Coach Agent

```typescript
// src/lib/agents/reply-coach-agent.ts

const REPLY_COACH_TOOLS = [
  {
    name: "web_search",
    description: "Search for academic sources, studies, and credible evidence",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        source_type: {
          type: "string",
          enum: ["academic", "government", "news", "any"]
        }
      },
      required: ["query"]
    }
  },
  {
    name: "verify_source",
    description: "Verify credibility of a source",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        claim_to_verify: { type: "string" }
      },
      required: ["url", "claim_to_verify"]
    }
  },
  {
    name: "get_opponent_profile",
    description: "Get cached profile of the opponent user",
    input_schema: {
      type: "object",
      properties: {
        username: { type: "string" }
      },
      required: ["username"]
    }
  },
  {
    name: "generate_reply",
    description: "Generate a researched reply with sources",
    input_schema: {
      type: "object",
      properties: {
        strategy: { type: "string" },
        main_argument: { type: "string" },
        sources: { type: "array", items: { type: "object" } },
        logic_structure: { type: "object" },
        effectiveness_score: { type: "number" }
      },
      required: ["strategy", "main_argument", "sources", "logic_structure"]
    }
  }
]

export async function generateReplyStrategies(
  targetComment: TargetComment,
  threadContext: ThreadContext
): Promise<ReplyCoachResult> {

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: `You are an expert debate coach helping someone respond effectively to an argument.

Your job is to:
1. Analyze the opponent's argument for weaknesses and strengths
2. Look up the opponent's profile to understand their debate style
3. Research credible sources that support counter-arguments
4. Generate 3-4 different strategic responses, each with:
   - A complete, ready-to-use reply text
   - Sources with citations
   - Logical structure breakdown
   - Effectiveness rating based on opponent's archetype

Prioritize:
- Academic and government sources
- Sound logical structure
- Acknowledging valid points before countering
- Tailoring approach to opponent's archetype

Do NOT generate generic templates. Each reply should be substantive and well-researched.`,
    tools: REPLY_COACH_TOOLS,
    messages: [
      {
        role: "user",
        content: `Generate strategic responses to this argument:

OPPONENT: ${targetComment.author}
ARGUMENT: "${targetComment.text}"
THEIR CLAIMS: ${JSON.stringify(targetComment.claims)}

THREAD CONTEXT:
Topic: ${threadContext.topic}
OP's Position: ${threadContext.opPosition}

Research sources and generate 3-4 strategic responses.`
      }
    ]
  })

  return processAgentResponse(response)
}
```

---

## Research Data Collection

### What We Collect (Enterprise Data for Future)

We're not building the enterprise platform yet, but we collect all data needed:

```typescript
interface ResearchDataPoint {
  // Core identifiers
  threadId: string
  commentId: string
  timestamp: string

  // Position data
  position: 'pro' | 'con' | 'neutral'
  positionIntensity: number

  // Argument data
  argumentFingerprint: string
  argumentCoreClaim: string
  argumentSemanticTags: string[]

  // Quality metrics
  qualityScore: number
  evidenceScore: number
  logicScore: number

  // Debate outcome
  debateId: string
  debateWinner: string
  isWinningPosition: boolean

  // Persuasion events
  isConcession: boolean
  causedConcession: boolean
  isDelta: boolean

  // User data
  author: string
  authorArchetype: string | null
  targetArchetype: string | null

  // Topic (dynamic, LLM-generated)
  topics: string[]

  // Subreddit context
  subreddit: string
}
```

### Collection Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   DATA COLLECTION FLOW (Every Thread Analysis)                                  │
│   ═════════════════════════════════════════════                                 │
│                                                                                  │
│   1. User submits thread URL                                                    │
│      │                                                                           │
│      ▼                                                                           │
│   2. Free tier analysis runs (includes debate segmentation)                     │
│      │                                                                           │
│      ├──────────────────────────────────────────────────────────────────────┐   │
│      │                                                                       │   │
│      ▼                                                                       │   │
│   3. COLLECT & STORE IN NEO4J:                                               │   │
│      │                                                                       │   │
│      │  ┌───────────────────────────────────────────────────────────────┐   │   │
│      │  │                                                                │   │   │
│      │  │  • Thread node with metadata                                  │   │   │
│      │  │  • All comment nodes with positions                           │   │   │
│      │  │  • User nodes (create if new)                                 │   │   │
│      │  │  • Debate nodes with winner data                              │   │   │
│      │  │  • Topic nodes (dynamic, LLM-generated)                       │   │   │
│      │  │  • Argument fingerprints (via Claude Agent SDK)               │   │   │
│      │  │  • REPLIED_TO relationships                                   │   │   │
│      │  │  • ABOUT topic relationships                                  │   │   │
│      │  │                                                                │   │   │
│      │  └───────────────────────────────────────────────────────────────┘   │   │
│      │                                                                       │   │
│      └───────────────────────────────────────────────────────────────────────┘   │
│      │                                                                           │
│      ▼                                                                           │
│   4. Return analysis to user (free tier features)                               │
│      │                                                                           │
│      ▼                                                                           │
│   5. If user pays $5:                                                           │
│      │                                                                           │
│      ├──────────────────────────────────────────────────────────────────────┐   │
│      │                                                                       │   │
│      ▼                                                                       │   │
│   6. COLLECT ADDITIONAL DATA:                                                │   │
│      │                                                                       │   │
│      │  ┌───────────────────────────────────────────────────────────────┐   │   │
│      │  │                                                                │   │   │
│      │  │  • OP deep analysis                                           │   │   │
│      │  │  • Momentum shift events                                      │   │   │
│      │  │  • Detailed argument effectiveness scores                     │   │   │
│      │  │  • Reply Coach usage (which strategies generated)            │   │   │
│      │  │  • Fact-check results and source credibility                 │   │   │
│      │  │                                                                │   │   │
│      │  └───────────────────────────────────────────────────────────────┘   │   │
│      │                                                                       │   │
│      └───────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ALL DATA STORED IN NEO4J → READY FOR FUTURE ENTERPRISE ANALYTICS              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Topics (Dynamic, No Fixed Taxonomy)

```typescript
// Topic extraction prompt
const TOPIC_EXTRACTION_PROMPT = `
Analyze this Reddit thread and extract 2-5 topics it discusses.

Topics should be:
- Lowercase, snake_case format
- Specific enough to be useful (not just "politics")
- Hierarchical where natural (e.g., "cryptocurrency_regulation" under "economics")

THREAD:
Title: {title}
Subreddit: r/{subreddit}
Key debates: {debate_summaries}

Return JSON array of topics, most specific first:
["topic_1", "topic_2", "parent_topic"]
`

// Example outputs:
// r/changemyview: ["marriage_economics", "childfree_lifestyle", "life_philosophy", "personal_finance"]
// r/cryptocurrency: ["bitcoin_regulation", "sec_enforcement", "financial_regulation", "cryptocurrency"]
// r/politics: ["immigration_policy", "border_security", "executive_action", "us_politics"]
```

---

## Free vs Paid Features

### Updated Feature Matrix

| Feature | Free | Paid ($5) |
|---------|------|-----------|
| Thread verdict & score | ✓ | ✓ |
| Basic metrics (7 stats) | ✓ | ✓ |
| **Debate segmentation (AI)** | ✓ | ✓ |
| Debate thread list | ✓ | ✓ |
| Debate battle cards | ✓ | ✓ |
| Reply thread reading | ✓ | ✓ |
| Participant list | ✓ | ✓ |
| Archetype badges (if cached) | ✓ | ✓ |
| Quick claim verdicts | ✓ | ✓ |
| **OP deep analysis** | ❌ | ✓ |
| **Momentum analysis** | ❌ | ✓ |
| **Deep Fact Check (sourced)** | ❌ | ✓ |
| **Reply Coach (researched)** | ❌ | ✓ |
| **Source verification** | ❌ | ✓ |

### Free Tier Cost Model

Free tier includes AI for debate segmentation:

| Operation | Cost | Notes |
|-----------|------|-------|
| Reddit scraping | $0 | Via backend |
| Debate detection | ~$0.05 | 1 LLM call |
| Position classification | ~$0.20 | Per-comment batch |
| Basic scoring | ~$0.10 | Included in above |
| Neo4j storage | ~$0.01 | Write operations |
| **Total Free Tier** | **~$0.36/thread** | |

### Paid Tier Additional Costs

| Operation | Cost | Notes |
|-----------|------|-------|
| OP deep analysis | ~$0.15 | 1 LLM call |
| Momentum analysis | ~$0.10 | Part of deep analysis |
| Reply Coach (researched) | ~$0.80 | Multiple searches + generation |
| Fact Check (per claim) | ~$0.30 | Web search + verification |
| Fingerprinting | ~$0.20 | Claude Agent SDK |
| **Total Paid Tier** | **~$1.55 additional** | |
| **Gross margin at $5** | **$3.09 (62%)** | |

---

## Frontend Components

### Component List (Unchanged)

| Component | Priority | Description |
|-----------|----------|-------------|
| `HeroVerdictCard` | P0 | Animated gradient border verdict |
| `DebateThreadCard` | P0 | Expandable debate summary |
| `BattleCard` | P0 | Pro vs Con comparison |
| `MomentumTimeline` | P0 | Animated shift visualization |
| `ReplyNode` | P0 | Single reply with actions |
| `ReplyThread` | P0 | Nested reply container |
| `OPAnalysisCard` | P1 | OP deep-dive card |
| `PositionEvolution` | P1 | Before/after comparison |
| `EngagementScorecard` | P1 | OP metrics bars |
| `FactCheckModal` | P1 | Deep fact verification |
| `ReplyCoachSheet` | P1 | Enhanced researched responses |
| `ArchetypeBadge` | P2 | Debater style indicator |
| `ThreadHealthRadar` | P2 | 5-axis thread quality |
| `ParticipantCard` | P2 | Enhanced participant row |
| `PaywallGate` | P2 | $5 feature unlock UI |

---

## Implementation Phases

### Phase 1: Backend Infrastructure (Days 1-3)

1. Set up Neo4j Aura instance
2. Create Neo4j connection layer in Next.js
3. Implement `/api/user/[username]/status` endpoint
4. Implement `/api/users/batch-status` endpoint
5. Add Neo4j write operations to existing analyze endpoints

### Phase 2: Debate Detection (Days 4-6)

1. Implement reply tree builder
2. Create debate root identification logic
3. Build position classification prompt
4. Implement quality scoring prompt
5. Create winner determination function
6. Generate debate titles

### Phase 3: Core Frontend (Days 7-9)

1. Add new types to `analysis.ts`
2. Create `HeroVerdictCard` with animated gradient
3. Refactor thread page with 6-tab structure
4. Create `DebateThreadCard` component
5. Create `BattleCard` component

### Phase 4: Debate Drill-Down (Days 10-12)

1. Create `ReplyNode` component
2. Create `ReplyThread` container
3. Create `MomentumTimeline` visualization
4. Implement debate detail view
5. Add archetype badges with cached profiles

### Phase 5: Claude Agent SDK Integration (Days 13-15)

1. Set up Claude Agent SDK
2. Implement argument fingerprinting agent
3. Build tool handlers for Neo4j operations
4. Test fingerprint storage and retrieval

### Phase 6: Enhanced Reply Coach (Days 16-18)

1. Implement web search tool for agent
2. Build source verification tool
3. Create opponent profiling integration
4. Implement reply generation with sources
5. Build Reply Coach UI

### Phase 7: Fact Check & Polish (Days 19-21)

1. Implement deep fact-check with sources
2. Update payment flow for $5
3. Create paywall gate component
4. Mobile responsive views
5. Performance optimization

---

## Removed from MVP

| Feature | Status | Reason |
|---------|--------|--------|
| External event correlation | **Deferred** | Requires news API, complex matching |
| Enterprise dashboard | **Deferred** | Build when data is rich |
| Fixed topic taxonomy | **Removed** | Dynamic topics more flexible |
| Fallback/mock states | **Removed** | Real data only |
| Narrative database UI | **Deferred** | Collecting data, UI later |

---

## Success Metrics

### Consumer Product Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first insight | < 3s | Verdict card load |
| Debates tab engagement | > 40% | Click-through rate |
| Reply coach usage | > 25% | Of paid users |
| Fact-check usage | > 20% | Of paid users |
| Payment conversion | > 8% | Free → $5 |
| Mobile bounce rate | < 30% | Analytics |
| Session duration | > 5 min | Average |

### Research Data Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Threads analyzed/month | > 5,000 | Neo4j count |
| Arguments fingerprinted | > 50,000 | Neo4j count |
| Unique users profiled | > 20,000 | Neo4j count |
| Topics discovered | > 500 | Neo4j count |
| Persuasion events logged | > 2,000 | Concessions + deltas |

---

## Ready for Implementation

All decisions locked:
- ✅ Full-stack plan (frontend + backend)
- ✅ Debate detection algorithm defined
- ✅ Claude Agent SDK for fingerprinting
- ✅ Neo4j for analytics database
- ✅ $5/thread with enhanced Reply Coach
- ✅ Dynamic topic taxonomy (no fixed list)
- ✅ Enterprise data collection (platform deferred)
- ✅ Free tier includes debate segmentation AI
- ✅ No fallbacks or mockups (real data only)
- ✅ External event correlation removed from MVP

**Awaiting your approval to proceed.**
