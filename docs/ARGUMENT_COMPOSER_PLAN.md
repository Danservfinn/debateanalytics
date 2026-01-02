# Argument Composer: AI Debate Coaching Feature

## Overview

Allow users to write their own argument/reply within a debate analysis context, receive AI-powered scoring using traditional debate criteria, and get actionable suggestions for improvement.

## User Value Proposition

- **Learn debate skills** by getting instant feedback on argument quality
- **Improve persuasiveness** with specific, actionable suggestions
- **Understand weaknesses** before posting to Reddit
- **Practice argumentation** in a low-stakes environment

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Thread Analysis Page                                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  HeroVerdictCard                                              │  │
│  │  Central Question: "Are vaccines safe and effective?"         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [✏️ Write My Argument]  ← Primary Entry Point                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Tabs: Overview | Debates | Participants | Fact-Check               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Argument Composer Modal                                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Context Panel                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Central Question: Are vaccines safe and effective?      │  │  │
│  │  │ PRO = Supports vaccine safety/efficacy                  │  │  │
│  │  │ CON = Challenges vaccine safety/efficacy                │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  Your Position: [PRO ▼] [CON] [NEUTRAL]                      │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │                                                         │  │  │
│  │  │  Write your argument here...                            │  │  │
│  │  │                                                         │  │  │
│  │  │                                                         │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  Character count: 0/2000                                      │  │
│  │                                                               │  │
│  │  [Cancel]                        [🔍 Analyze My Argument]    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Analysis Results (replaces or slides over composer)                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Overall Score: B+ (82/100)                                   │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │         [Radar Chart of 6 Criteria]                     │  │  │
│  │  │                                                         │  │  │
│  │  │    Claim Clarity ████████░░ 8/10                        │  │  │
│  │  │    Evidence      ██████░░░░ 6/10                        │  │  │
│  │  │    Logic         █████████░ 9/10                        │  │  │
│  │  │    Engagement    ███████░░░ 7/10                        │  │  │
│  │  │    Persuasion    ████████░░ 8/10                        │  │  │
│  │  │    Civility      ██████████ 10/10                       │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Issues Found (3)                                             │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ ⚠️ Weak Evidence                                        │  │  │
│  │  │ "Studies show..." lacks specific citation               │  │  │
│  │  │ Suggestion: Add specific study name, author, year       │  │  │
│  │  │ [Apply Fix]                                             │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ ⚠️ Missing Counterargument                              │  │  │
│  │  │ Does not address the opposing view that...              │  │  │
│  │  │ Suggestion: Acknowledge and rebut the concern about...  │  │  │
│  │  │ [Apply Fix]                                             │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Improved Version                                             │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │ Your enhanced argument with improvements highlighted... │  │  │
│  │  │ +Added citation: "According to the 2023 Cochrane..."    │  │  │
│  │  │ +Added rebuttal: "While some argue..., this overlooks"  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │  [📋 Copy Improved Version]  [✏️ Edit & Reanalyze]           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Traditional Debate Scoring Criteria

Based on formal debate frameworks (Lincoln-Douglas, Policy Debate, Parliamentary):

### 1. Claim Clarity (0-10)
- Is the main thesis/claim clearly stated?
- Does it directly address the central question?
- Is the position unambiguous?

**Scoring Guide:**
- 9-10: Crystal clear thesis, directly responsive
- 7-8: Clear but could be more specific
- 5-6: Somewhat unclear or tangential
- 3-4: Vague or off-topic
- 0-2: No discernible claim

### 2. Evidence Quality (0-10)
- Are claims backed by evidence?
- Is evidence specific (names, dates, statistics)?
- Are sources cited or citable?
- Is evidence relevant to the claim?

**Scoring Guide:**
- 9-10: Multiple specific, credible sources cited
- 7-8: Some evidence, could use more specificity
- 5-6: Anecdotal or vague references
- 3-4: Claims without support
- 0-2: No evidence attempted

### 3. Logical Structure (0-10)
- Do premises logically lead to conclusion?
- Is reasoning sound and valid?
- Are there logical fallacies?
- Is cause-and-effect properly established?

**Scoring Guide:**
- 9-10: Flawless logical chain
- 7-8: Sound logic with minor gaps
- 5-6: Some logical leaps or weak connections
- 3-4: Contains fallacies or broken logic
- 0-2: Incoherent reasoning

### 4. Engagement/Refutation (0-10)
- Does it engage with opposing arguments?
- Are counterpoints acknowledged?
- Is it responsive to the specific debate?
- Does it advance the conversation?

**Scoring Guide:**
- 9-10: Directly addresses and rebuts opposition
- 7-8: Acknowledges opposition, partial rebuttal
- 5-6: Tangentially related to debate
- 3-4: Ignores existing arguments
- 0-2: Completely disconnected

### 5. Persuasiveness (0-10)
- Is the language compelling?
- Does it use effective rhetorical techniques?
- Would this convince a neutral observer?
- Is the framing strategic?

**Scoring Guide:**
- 9-10: Highly compelling, excellent rhetoric
- 7-8: Persuasive with room to improve
- 5-6: Makes a case but not compelling
- 3-4: Weak persuasion, unconvincing
- 0-2: Actively off-putting

### 6. Civility/Tone (0-10)
- Is the tone respectful?
- Avoids personal attacks?
- Professional discourse?
- Charitable interpretation of opponents?

**Scoring Guide:**
- 9-10: Exemplary civil discourse
- 7-8: Respectful with minor issues
- 5-6: Some dismissiveness or snark
- 3-4: Hostile or condescending
- 0-2: Ad hominem or abusive

---

## Technical Architecture

### Type Definitions

```typescript
// src/types/argument.ts

export interface ArgumentSubmission {
  text: string;
  position: 'pro' | 'con' | 'neutral';
  threadContext: {
    centralQuestion: string;
    proDefinition: string;
    conDefinition: string;
    threadTitle: string;
    keyArguments?: string[]; // Top arguments from the thread
  };
}

export interface ArgumentScore {
  criterion:
    | 'claim_clarity'
    | 'evidence_quality'
    | 'logical_structure'
    | 'engagement'
    | 'persuasiveness'
    | 'civility';
  score: number; // 0-10
  label: string; // Human-readable criterion name
  feedback: string; // Specific feedback for this criterion
}

export interface ArgumentIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  type:
    | 'weak_evidence'
    | 'logical_fallacy'
    | 'missing_rebuttal'
    | 'unclear_claim'
    | 'tone_issue'
    | 'off_topic'
    | 'unsupported_claim';
  quote: string; // The problematic text
  explanation: string;
  suggestion: string;
  fixedText?: string; // Optional auto-fix
}

export interface ArgumentAnalysisResult {
  overallScore: number; // 0-100
  letterGrade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  scores: ArgumentScore[];
  issues: ArgumentIssue[];
  strengths: string[]; // What the argument does well
  improvedVersion: string;
  improvementSummary: string; // Brief description of changes
  debateReadiness: 'ready' | 'needs_work' | 'not_ready';
}
```

### API Endpoint

```typescript
// POST /api/analyze-argument

// Request
{
  argument: string;
  position: 'pro' | 'con' | 'neutral';
  context: {
    centralQuestion: string;
    proDefinition: string;
    conDefinition: string;
    threadTitle: string;
    keyArguments?: string[];
  }
}

// Response
{
  success: boolean;
  data?: ArgumentAnalysisResult;
  error?: string;
}
```

### Component Structure

```
src/components/argument/
├── index.ts                    # Barrel exports
├── ArgumentComposer.tsx        # Main modal with input form
├── ArgumentAnalysisResults.tsx # Results display after analysis
├── ScoreRadarChart.tsx         # Visual radar chart of 6 criteria
├── ScoreBar.tsx                # Individual score bar component
├── IssueCard.tsx               # Individual issue with fix suggestion
├── ImprovedVersionPanel.tsx    # Shows improved version with diff
└── DebateContextPanel.tsx      # Shows debate context in composer
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)
**Goal:** Basic working feature end-to-end

**Files to create:**
1. `src/types/argument.ts` - Type definitions
2. `src/app/api/analyze-argument/route.ts` - API endpoint with Claude integration
3. `src/components/argument/ArgumentComposer.tsx` - Modal with form
4. `src/components/argument/ArgumentAnalysisResults.tsx` - Results display
5. `src/components/argument/index.ts` - Exports

**Files to modify:**
1. `src/app/thread/[threadId]/page.tsx` - Add entry point button
2. `src/components/analysis/index.ts` - Add exports

**Features:**
- Text input with position selector
- Context display (central question, PRO/CON definitions)
- API integration with Claude for analysis
- Basic score display (6 criteria bars)
- List of issues with explanations
- Improved version display
- Copy improved version button

### Phase 2: Enhanced UI/UX
**Goal:** Polish the experience

**Features:**
- Radar chart visualization for scores
- Animated transitions between states
- "Apply Fix" functionality for individual issues
- Side-by-side diff view for improvements
- Character count and limits
- Loading states with progress indicators
- Keyboard shortcuts (Cmd+Enter to submit)

### Phase 3: Advanced Features
**Goal:** Power user capabilities

**Features:**
- Reply to specific comment (pre-populate context)
- "Help me start" AI kickstarter
- Save drafts locally
- Analysis history
- Iterate on analysis (edit and re-analyze)
- Export analysis as image/PDF

### Phase 4: Gamification & Learning
**Goal:** Encourage skill development

**Features:**
- Track scores over time
- Achievement badges
- "Practice Mode" with sample debates
- Tips and tutorials
- Weekly challenges

---

## AI Prompt Strategy

### System Prompt Structure

```
You are an expert debate coach analyzing arguments using traditional debate scoring criteria.

CONTEXT:
- Central Question: {centralQuestion}
- PRO position means: {proDefinition}
- CON position means: {conDefinition}
- User's position: {position}
- Thread title: {threadTitle}
- Key existing arguments: {keyArguments}

ARGUMENT TO ANALYZE:
{userArgument}

SCORING CRITERIA (0-10 each):
1. Claim Clarity: Is the thesis clear and directly addresses the question?
2. Evidence Quality: Are claims supported with specific, credible evidence?
3. Logical Structure: Does reasoning flow logically without fallacies?
4. Engagement: Does it address opposing arguments and advance the debate?
5. Persuasiveness: Is it compelling to a neutral observer?
6. Civility: Is the tone respectful and professional?

ANALYSIS REQUIREMENTS:
1. Score each criterion 0-10 with specific feedback
2. Identify specific issues with exact quotes
3. Provide actionable suggestions for each issue
4. Generate an improved version incorporating fixes
5. List 2-3 strengths of the argument
6. Assess overall debate readiness

OUTPUT FORMAT:
{structured JSON matching ArgumentAnalysisResult type}
```

### Response Parsing

The API should:
1. Send context + argument to Claude
2. Request structured JSON output
3. Validate response against types
4. Handle edge cases (too short, off-topic, etc.)
5. Cache results briefly to avoid re-analysis

---

## Entry Points

### Primary: Thread Overview Tab
Button below HeroVerdictCard or in a dedicated section:
```tsx
<Button onClick={() => setShowComposer(true)}>
  <PenSquare className="w-4 h-4 mr-2" />
  Write My Argument
</Button>
```

### Secondary: Debate Cards
Each debate card could have a "Reply" button:
```tsx
<Button variant="ghost" size="sm" onClick={() => openComposerWithContext(debate)}>
  <Reply className="w-3 h-3 mr-1" />
  Draft Reply
</Button>
```

### Tertiary: Floating Action Button
Fixed position button visible throughout thread analysis:
```tsx
<FloatingActionButton
  icon={PenSquare}
  label="Write Argument"
  onClick={() => setShowComposer(true)}
/>
```

---

## Cost Considerations

### API Costs
- Each analysis requires ~1500 input tokens (context + argument)
- Output ~1000 tokens (analysis result)
- Estimated cost: ~$0.05-0.10 per analysis with Claude Sonnet

### Mitigation Strategies
1. **Rate limiting:** Max 5 analyses per hour per session
2. **Caching:** Cache identical arguments briefly
3. **Credit system:** Integrate with existing credit system
4. **Tiered analysis:** Basic (free) vs Deep (credits)

---

## Success Metrics

1. **Engagement:** % of thread viewers who use composer
2. **Completion:** % who complete analysis after starting
3. **Iteration:** % who edit and re-analyze
4. **Improvement:** Average score increase on re-analysis
5. **Copy rate:** % who copy improved version

---

## Open Questions

1. **Should we allow saving/sharing analyzed arguments?**
   - Pro: Social proof, learning from others
   - Con: Privacy, potential misuse

2. **Should improved version be automatically copyable to Reddit?**
   - Pro: Seamless workflow
   - Con: Could flood Reddit with AI-assisted content

3. **Should we show how argument compares to others in thread?**
   - Pro: Context, gamification
   - Con: May discourage users with lower scores

4. **Should analysis cost credits or be free?**
   - Pro (free): Encourages use, learning tool
   - Con (credits): Sustainability, prevents abuse

---

## File Checklist

### New Files
- [ ] `src/types/argument.ts`
- [ ] `src/app/api/analyze-argument/route.ts`
- [ ] `src/components/argument/ArgumentComposer.tsx`
- [ ] `src/components/argument/ArgumentAnalysisResults.tsx`
- [ ] `src/components/argument/ScoreRadarChart.tsx`
- [ ] `src/components/argument/ScoreBar.tsx`
- [ ] `src/components/argument/IssueCard.tsx`
- [ ] `src/components/argument/ImprovedVersionPanel.tsx`
- [ ] `src/components/argument/DebateContextPanel.tsx`
- [ ] `src/components/argument/index.ts`

### Modified Files
- [ ] `src/app/thread/[threadId]/page.tsx`
- [ ] `src/components/analysis/index.ts`

---

## Next Steps

1. Review and approve plan
2. Implement Phase 1 (MVP)
3. User testing and feedback
4. Iterate based on feedback
5. Implement Phase 2-4 based on usage data
