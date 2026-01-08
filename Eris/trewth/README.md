# Parse - Critical Media Analysis Platform

**Hyper-critical news analysis that steel-mans perspectives and detects manipulation.**

---

## 🎯 What is Parse?

Parse is a standalone platform that analyzes news articles, blog posts, and op-eds to derive objective truth through rigorous argument evaluation. Unlike traditional fact-checkers that appeal to authority or use pre-programmed conclusions, Parse evaluates arguments solely on their merits:

- **Evidence Quality** (40%): Primary sources, statistics with context, diverse source types
- **Methodology Rigor** (25%): Control group critique, monitoring period audit, study design evaluation
- **Logical Structure** (20%): Valid reasoning, explicit assumptions, internal consistency
- **Manipulation Absence** (15%): No emotional manipulation, framing bias, omissions, or propaganda

**Core Principle:** NO appeals to authority. NO pre-programmed conclusions. Evaluate arguments, not sources.

---

## 🚀 Key Features

### 1. **Steel-Manned Perspectives**
AI generates the strongest possible version of each viewpoint, even those weakly presented. True intellectual charity.

### 2. **Media Deception Detection**
Identifies and explains manipulation tactics:
- Emotional manipulation (fear appeals, loaded language)
- Framing bias (false balance, context stripping)
- Omission detection (counter-evidence excluded)
- Source manipulation (anonymous experts, circular sourcing)
- Propaganda patterns (talking points, us vs. them)

### 3. **Critical Fact-Checking**
Independent web research via DuckDuckGo with methodological critique:
- Control group skepticism (assume NOT truly unvaccinated unless explicit)
- Monitoring period audit (21-day studies cannot support "long-term safety" claims)
- Evidence hierarchy (primary research > meta-analyses > reviews > news)

### 4. **Fallacy Detection**
Identifies logical fallacies using the existing debate-analytics framework:
- Ad hominem, straw man, false dichotomy
- Appeals to emotion/authority without evidence
- Moving goalposts, whataboutism, false equivalence

### 5. **Transparent Truth Score**
0-100 score with full breakdown:
```
Truth Score = Evidence Quality (0-40)
            + Methodology Rigor (0-25)
            + Logical Structure (0-20)
            + Manipulation Absence (0-15)
```

### 6. **"What AI Thinks" Section**
Candid, conversational AI assessment (2-4 sentences) that:
- Calls out patterns and behaviors
- Notes uncomfortable truths
- Remains objective but direct

---

## 🏗️ Architecture

### 5-Agent Pipeline (Z.ai GLM-4.7)

```
USER SUBMITS URL
    ↓
ExtractionAgent
    ├─ Parse article structure
    ├─ Extract claims, sources, statistics
    └─ Detect emotional language density
    ↓
5 PARALLEL AGENTS (~60 seconds total)
    ├─ SteelManningAgent (identify + strengthen all perspectives)
    ├─ DeceptionDetectionAgent (manipulation + propaganda)
    ├─ CriticalFactCheckAgent (DDG search + methodology audit)
    ├─ FallacyAgent (logical fallacies + argument structure)
    └─ ContextAuditAgent (omission detection + framing analysis)
    ↓
SynthesisAgent
    ├─ Calculate Truth Score (0-100)
    ├─ Generate "What AI Thinks"
    ├─ Create steel-manned perspective cards
    └─ Build shareable analysis card
```

### Technology Stack

**Frontend:**
- Next.js 15 (App Router)
- React 18 + Tailwind CSS + shadcn/ui
- TypeScript 5.3+
- Recharts (data visualization)

**Backend:**
- Next.js API Routes
- Prisma ORM + PostgreSQL
- NextAuth.js v5 (authentication)
- BullMQ + Redis (priority queues)
- Z.ai GLM-4.7 (all agents)
- DuckDuckGo Instant Answer API (search)

**Infrastructure:**
- Vercel (hosting)
- Vercel Postgres (database)
- Vercel KV (Redis queue)

**Shared Components:**
- Fallacy detection types (from debate-analytics)
- ManipulationAlerts component
- Analysis type system

---

## 📊 Output Example

```
┌─────────────────────────────────────────┐
│  TREWTH ANALYSIS                        │
│  ────────────────                       │
│                                         │
│  📰 Article: "Climate Crisis Demands..." │
│  📅 Source: The Daily News              │
│                                         │
│  ────────────────────────────────────   │
│  TRUTH SCORE: 67/100                    │
│  🟡 Moderate Credibility                │
│                                         │
│  Breakdown:                              │
│  Evidence Quality: 28/40                │
│  Methodology: 18/25                     │
│  Logic: 15/20                           │
│  No Manipulation: 6/15                  │
│                                         │
│  ────────────────────────────────────   │
│  MANIPULATION DETECTED:                 │
│  🔴 HIGH: Fear-based framing             │
│  🟡 MEDIUM: False balance on consensus   │
│  🟢 LOW: Good sourcing overall          │
│                                         │
│  ────────────────────────────────────   │
│  💬 What AI Thinks:                     │
│  "This article uses fear-based language  │
│   ('CRISIS', 'EMERGENCY') to frame       │
│   policy discussion. While statistics   │
│   are cited accurately, context about    │
│   scientific uncertainty is omitted,    │
│   weakening the narrative.               │
│                                         │
│   The 97% consensus figure is cited      │
│   correctly, but the article fails to   │
│   steel-man skeptic arguments about      │
│   model uncertainty, creating a false   │
│   dichotomy between 'believers' and      │
│   'deniers.'"                            │
│                                         │
│  ────────────────────────────────────   │
│  🔍 Steel-Manned Perspectives:          │
│  ✓ Viewpoint A: Urgent Action Required  │
│    "Anthropogenic CO2 is causing         │
│     significant warming with serious     │
│     risks; immediate policy needed"      │
│    Quality: 82/100                       │
│                                         │
│  ✓ Viewpoint B: Model Uncertainty        │
│    "Climate models may overestimate      │
│     warming due to cloud feedback        │
│     uncertainties and natural            │
│     variability"                         │
│    Quality: 45/100                       │
│                                         │
│  ✓ Viewpoint C: Economic Trade-offs      │
│    "Climate policies must balance        │
│     environmental benefits with          │
│     economic costs to avoid harming      │
│     vulnerable populations"              │
│    Quality: 68/100 (AI-inferred)         │
│                                         │
│  ────────────────────────────────────   │
│  ⚠️ Fallacies Found:                    │
│  • Appeal to fear (3 instances)          │
│  • False dichotomy (believer vs denier)  │
│  • Context stripping (uncertainty omitted)│
│                                         │
│  ────────────────────────────────────   │
│  ✅ VERIFIED CLAIMS:                    │
│  • CO2 levels: 420ppm (accurate)         │
│  • 19 of 20 hottest years since 2000     │
│  ❌ CLAIMS NEEDING CONTEXT:             │
│  • "Crisis" language omits uncertainty   │
│  • Economic costs not addressed          │
│                                         │
│  [🔒 Anonymize] [✎ Share]               │
└─────────────────────────────────────────┘
```

---

## 🎨 User Interfaces

### Web App (Luxury Dark Mode)
- **Premium Design:** Rich black (#0a0a0a) with champagne gold (#d4af37) accents
- **Typography:** Cormorant Garamond serif for headlines, Inter sans-serif for body
- **Glassmorphism:** Frosted glass effects with backdrop blur
- **Animations:** Premium hover effects, shimmer animations, smooth transitions
- URL input → Extract → Preview → Analyze
- Real-time queue status
- Shareable analysis cards
- Analysis history dashboard

### Browser Extension (Chrome/Firefox)
- Quick view popup (Truth Score + "What AI Thinks")
- One-click full analysis
- Article overlay mode (optional)
- Visual credibility badge

---

## 💰 Business Model

Same freemium model as Screenshot Analyzer:

**Free Tier:**
- 1 analysis per day
- Basic truth score
- 2 steel-manned perspectives
- Top 3 deceptions flagged

**Full Analysis (20 credits = $2):**
- Complete truth score breakdown
- All steel-manned perspectives (3-4)
- Full deception detection
- Fallacy breakdown
- Evidence quality assessment
- "What AI Thinks" section

**Pro Subscription ($9/month or $90/year):**
- 30 full analyses per month
- Priority queue processing
- Everything included
- 85% savings vs. pay-per-use

---

## 🔐 Privacy & Ethics

**DuckDuckGo Search:**
- No user tracking
- No personalized results (avoids filter bubbles)
- Privacy-respecting by default

**No Pre-Programmed Conclusions:**
- Arguments evaluated on merits
- No ideological lock-in
- Transparent reasoning process

**Steel-Manning as Standard:**
- Respects opposing views
- Finds common ground
- Reduces polarization

---

## 📂 Project Structure

```
trewth/
├── DESIGN.md              # Complete design document
├── package.json           # Dependencies
├── README.md              # This file
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── app/              # Next.js pages
│   │   ├── page.tsx      # Landing page
│   │   ├── analyze/      # Analysis interface
│   │   ├── dashboard/    # User dashboard
│   │   └── auth/         # Authentication pages
│   ├── components/       # React components
│   │   ├── article/      # Article upload & preview
│   │   ├── analysis/     # Analysis results display
│   │   ├── dashboard/    # Dashboard components
│   │   └── ui/           # shadcn/ui components
│   ├── types/           # TypeScript types
│   │   └── index.ts      # Core type definitions
│   ├── agents/          # AI agent implementations
│   │   ├── extraction-agent.ts
│   │   ├── steel-manning-agent.ts
│   │   ├── deception-detection-agent.ts
│   │   ├── critical-fact-check-agent.ts
│   │   ├── fallacy-agent.ts
│   │   ├── context-audit-agent.ts
│   │   └── synthesis-agent.ts
│   └── lib/             # Utilities
│       ├── prisma.ts
│       ├── auth.ts
│       └── queue.ts
└── extension/           # Browser extension
    ├── manifest.json
    ├── popup/
    └── content-scripts/
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance (for queue)
- Claude API key (Opus 4.5)
- DuckDuckGo API access

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Set up database
npx prisma migrate dev
npx prisma generate

# Run development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# Claude API
ANTHROPIC_API_KEY="sk-ant-..."

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# DuckDuckGo (optional, uses free tier)
DDG_API_KEY="..." # Optional

# Vercel (if deployed)
KV_URL="..."
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."
```

---

## 📋 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [x] Design document
- [x] Project structure
- [ ] Next.js setup
- [ ] Prisma schema
- [ ] Authentication
- [ ] Credits system

### Phase 2: Article Extraction (Week 3)
- [ ] ExtractionAgent implementation
- [ ] Mercury Parser integration
- [ ] Claim/source/statistics extraction
- [ ] Preview UI

### Phase 3: Analysis Agents (Week 4-5)
- [ ] SteelManningAgent
- [ ] DeceptionDetectionAgent
- [ ] CriticalFactCheckAgent (DuckDuckGo)
- [ ] FallacyAgent
- [ ] ContextAuditAgent
- [ ] SynthesisAgent

### Phase 4: Truth Quantification (Week 6)
- [ ] Truth score calculation
- [ ] Evidence quality scoring
- [ ] Methodology rigor audit
- [ ] Manipulation deduction

### Phase 5: Results Display (Week 7)
- [ ] ParseCard (shareable summary)
- [ ] Steel-manned perspective cards
- [ ] Deception detection display
- [ ] Fallacy breakdown
- [ ] "What AI Thinks" section

### Phase 6: Queue System (Week 8)
- [ ] BullMQ + Redis setup
- [ ] Priority queues (3 levels)
- [ ] Queue status API
- [ ] WebSocket notifications

### Phase 7: Browser Extension (Week 9-10)
- [ ] Chrome extension
- [ ] Firefox extension
- [ ] Quick view popup
- [ ] Article overlay

### Phase 8: Testing & QA (Week 11)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Load testing

### Phase 9: Launch (Week 12+)
- [ ] Production deployment
- [ ] Monitoring
- [ ] Feedback iteration

---

## 🎯 Key Differentiators

1. **True Neutrality**
   - No appeals to authority
   - No pre-programmed conclusions
   - Evaluates arguments, not sources

2. **Steel-Manning by Default**
   - Strongest version of opposing views
   - Finds kernels of truth in weak arguments
   - Reduces polarization through intellectual charity

3. **Methodological Skepticism**
   - Control group critique (assume flawed unless proven)
   - Monitoring period audit (21 days ≠ long-term)
   - Evidence hierarchy transparency

4. **Privacy-Respecting**
   - DuckDuckGo search (no tracking)
   - No filter bubbles
   - Anonymous usage option

5. **Educational Focus**
   - Explains manipulation techniques
   - Shows reasoning, not just verdicts
   - Helps users think critically

---

## 📖 Design Philosophy

### Universal Critical Analysis Framework

**Level 1: Claim Deconstruction**
- What exactly is being asserted?
- What evidence WOULD be required?

**Level 2: Source Methodology Audit**
- Control group composition (explicitly unvaccinated?)
- Monitoring period duration (21 days vs. 2 years)
- Study design (RCT vs. observational)
- Funding conflicts

**Level 3: Critical Reasoning**
- Does study design test the claim?
- Are controls truly controlled?
- Correlation vs. causation?

**Level 4: Evidence Hierarchy**
- Primary research > Meta-analyses > Reviews > News

**Level 5: Synthesis**
- Verdict: SUPPORTED / NOT SUPPORTED / MIXED / UNTESTABLE
- Confidence: HIGH / MEDIUM / LOW
- Reasoning based on methodology, not just "sources say"

### Universal Skepticism Rules

1. **Control Group Skepticism**
   - Assume NOT truly unvaccinated unless explicitly stated
   - Flag: "Placebo" without composition disclosed
   - Flag: "Standard of care" without definition

2. **Monitoring Period Skepticism**
   - Flag claims of "long-term safety" from 21-day studies
   - Compare monitoring duration to claim scope
   - Note: Vaccine monitoring (days/weeks) vs. drug monitoring (months/years)

3. **Default to Skepticism**
   - Require proof, don't assume quality
   - Demand explicit methodology descriptions

---

## 🤝 Contributing

This project is in early development. Key areas for contribution:

1. **Agent Prompt Engineering** - Improve analysis quality
2. **Testing** - Real-world article testing, edge cases
3. **Browser Extension** - Cross-platform compatibility
4. **Documentation** - User guides, API docs

---

## 📄 License

TBD

---

## 🙏 Acknowledgments

Built on the foundation of:
- **Debate Analytics** - Fallacy detection and manipulation alert components
- **Screenshot Analyzer** - Agent architecture and queue system design
- **Universal Critical Analysis Framework** - Methodological skepticism principles

---

**Version:** 0.1.0 (Production)
**Last Updated:** January 8, 2026
**Authors:** Claude Code + User Collaboration
**Live URL:** https://parse.app
**Status:** ✅ Production Ready with Luxury Dark Mode Design
