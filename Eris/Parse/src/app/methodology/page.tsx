import Link from "next/link";

// Agent data structure
const agents = [
  {
    number: "01",
    name: "Extraction Engine",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    whatItDoes: "Deconstructs the article into analyzable components—separating claims from rhetoric, identifying sources, and categorizing content type.",
    lookingFor: [
      "Article metadata (title, publication, author, date)",
      "Individual claims and assertions made",
      "Sources cited (named, anonymous, or none)",
      "Article type (news, opinion, analysis, editorial)",
      "Narrative structure and flow"
    ],
    sampleOutput: {
      "Claims Identified": "12",
      "Sources Cited": "3 named, 2 anonymous",
      "Article Type": "Opinion/Analysis",
      "Primary Topic": "Economic Policy"
    },
    whyItMatters: "You can't analyze what you can't see. Extraction separates the article's building blocks so each can be examined independently."
  },
  {
    number: "02",
    name: "Steel-Manning Analysis",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    whatItDoes: "Constructs the strongest possible version of every perspective presented—including viewpoints the article opposes.",
    lookingFor: [
      "Core arguments from each side",
      "Legitimate concerns being raised",
      "Valid points that may be poorly expressed",
      "Common ground between positions",
      "Nuances being glossed over"
    ],
    sampleOutput: {
      "Perspective A": "At its strongest, this argument suggests...",
      "Perspective B": "A fair critic would argue that...",
      "Common Ground": "Both sides agree on..."
    },
    whyItMatters: "Before critiquing any position, we ensure we understand it at its best. This prevents straw-manning and reveals when articles attack weak versions of opposing views."
  },
  {
    number: "03",
    name: "Deception Detection",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    whatItDoes: "Identifies manipulation tactics across three categories: emotional manipulation, logical deception, and propaganda techniques.",
    lookingFor: [
      "Emotional triggers (fear, outrage, tribal identity)",
      "Loaded language and framing devices",
      "Cherry-picked data or misleading statistics",
      "Appeal to authority without evidence",
      "Propaganda patterns (bandwagon, false urgency, enemy creation)"
    ],
    sampleOutput: {
      "HIGH Severity": "Emotional manipulation detected",
      "Quote": "\"...threatens everything we hold dear\"",
      "Technique": "Fear appeal / tribal framing"
    },
    whyItMatters: "These techniques bypass rational evaluation. Identifying them lets you separate the message from the manipulation."
  },
  {
    number: "04",
    name: "Critical Fact-Check",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    whatItDoes: "Verifies factual claims against available evidence, distinguishing between verifiable facts and unfalsifiable assertions.",
    lookingFor: [
      "Statistical claims and data accuracy",
      "Quoted statements and attribution",
      "Historical references",
      "Scientific consensus alignment",
      "Source credibility and track record"
    ],
    sampleOutput: {
      "Claim": "\"Unemployment fell 40% last quarter\"",
      "Status": "Misleading",
      "Finding": "Actual figure was 4%, not 40%"
    },
    whyItMatters: "Factual accuracy is the foundation. Even well-framed articles fail if built on false claims."
  },
  {
    number: "05",
    name: "Fallacy Detection",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    whatItDoes: "Identifies logical errors and invalid reasoning patterns that undermine the article's arguments.",
    lookingFor: [
      "Ad Hominem (attacking the person, not the argument)",
      "Straw Man (misrepresenting opposing views)",
      "False Dichotomy (artificial either/or framing)",
      "Slippery Slope (unsupported chain of consequences)",
      "Hasty Generalization (insufficient evidence for broad claims)"
    ],
    sampleOutput: {
      "Fallacy": "False Dichotomy",
      "Quote": "\"You either support this policy or you want people to suffer\"",
      "Issue": "Presents only two options when many positions exist"
    },
    whyItMatters: "A compelling argument built on flawed logic is still wrong. Fallacy detection reveals when you're being persuaded by invalid reasoning."
  },
  {
    number: "06",
    name: "Context Audit",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    whatItDoes: "Identifies what's MISSING—the omissions, alternative explanations, and perspectives the article doesn't address.",
    lookingFor: [
      "Key context omitted",
      "Alternative explanations not considered",
      "Stakeholders whose perspective is absent",
      "Timeframe manipulation (selective date ranges)",
      "Framing that guides interpretation"
    ],
    sampleOutput: {
      "Omission": "Counter-evidence",
      "Detail": "Article cites 3 studies supporting thesis",
      "Missing": "7 peer-reviewed studies with contradicting findings"
    },
    whyItMatters: "The most effective manipulation isn't lying—it's controlling what you don't see. Context audit reveals the invisible frame around the narrative."
  },
  {
    number: "07",
    name: "Synthesis Engine",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    whatItDoes: "Combines all findings into a final Truth Score using a weighted formula that balances evidence, logic, and integrity.",
    lookingFor: [
      "Evidence quality across all claims",
      "Methodology rigor of sources",
      "Logical structure validity",
      "Manipulation technique presence",
      "Overall credibility indicators"
    ],
    sampleOutput: {
      "Evidence Quality": "32/40",
      "Methodology Rigor": "18/25",
      "Logical Structure": "15/20",
      "Manipulation Absence": "8/15"
    },
    whyItMatters: "A single number is easy to game. Our multi-factor scoring means an article can't hide weak evidence behind strong rhetoric."
  },
  {
    number: "08",
    name: "AI Assessment",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    whatItDoes: "Synthesizes all findings into a human-readable assessment from the perspective of an impartial, all-knowing analyst.",
    lookingFor: [
      "Overall credibility verdict",
      "Author/publication intent",
      "Blind spots and omissions",
      "Uncomfortable truths for all sides",
      "Actionable reader guidance"
    ],
    sampleOutput: {
      "Verdict": "Direct statement on credibility",
      "Intent": "What the publication aims to achieve",
      "Blind Spots": "What the article avoids",
      "Guidance": "What readers should do next"
    },
    whyItMatters: "Numbers and flags aren't enough. The AI Assessment translates findings into actionable intelligence—telling you not just WHAT is wrong, but WHAT TO DO about it."
  }
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="masthead py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link href="/" className="font-masthead text-2xl text-foreground hover:text-primary transition-colors">
            Parse
          </Link>
          <div className="flex gap-6">
            <Link href="/analyze" className="nav-section hover:text-primary transition-colors">
              Analyze
            </Link>
            <Link href="/methodology" className="nav-section active">
              Methodology
            </Link>
            <Link href="/pricing" className="nav-section hover:text-primary transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-16 pb-12">
        <div className="flex justify-center mb-6">
          <span className="badge-section">Our Methodology</span>
        </div>

        <div className="text-center max-w-4xl mx-auto mb-8">
          <h1 className="font-masthead text-5xl md:text-6xl lg:text-7xl text-foreground mb-6 leading-[0.95]">
            How Parse Separates<br />
            <span className="text-primary">Truth from Narrative</span>
          </h1>

          <p className="font-deck text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Traditional fact-checking asks: "Is this true or false?"
            Parse asks: "What is this article trying to make you believe,
            and what techniques is it using to get you there?"
          </p>
        </div>

        <div className="rule-double max-w-xl mx-auto" />
      </section>

      {/* The Problem Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <span className="font-section text-muted-foreground block mb-4">The Problem We Solve</span>

          <div className="font-body text-lg text-foreground/90 space-y-4">
            <p className="drop-cap">
              Most misinformation isn't outright lies—it's framing, omission, and manipulation.
              A factually accurate article can still be deeply misleading. Headlines can be technically
              true while conveying a false impression. Sources can be real but cherry-picked.
              Statistics can be accurate but presented without crucial context.
            </p>

            <p>
              Human bias makes us vulnerable to content that confirms what we already believe.
              We're more likely to share emotionally triggering content without verification.
              We struggle to notice what's missing from a narrative because we can only evaluate
              what's in front of us.
            </p>

            <p>
              Parse provides the <strong>adversarial analysis</strong> your mind can't do alone—systematically
              examining every claim, technique, and omission to reveal how an article is trying to
              shape your beliefs.
            </p>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="rule-heavy container mx-auto" />

      {/* The Pipeline Header */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-4">
          <span className="font-section text-muted-foreground block mb-3">The Analysis Pipeline</span>
          <h2 className="font-headline text-4xl md:text-5xl text-foreground mb-4">
            Eight Specialized Agents
          </h2>
          <p className="font-body text-muted-foreground max-w-2xl mx-auto">
            Each article passes through eight independent analysis stages. Every agent
            examines the content from a different angle, ensuring comprehensive coverage
            of potential issues.
          </p>
        </div>
      </section>

      {/* Agent Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-5xl mx-auto space-y-8">
          {agents.map((agent, index) => (
            <article
              key={agent.number}
              className="card-editorial p-8 md:p-10"
            >
              {/* Agent Header */}
              <div className="flex items-start gap-6 mb-8">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 flex items-center justify-center border border-border bg-muted/30 text-primary">
                    {agent.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-4 mb-2">
                    <span className="font-masthead text-3xl text-muted-foreground/40">{agent.number}</span>
                    <h3 className="font-headline text-2xl md:text-3xl text-foreground">{agent.name}</h3>
                  </div>
                  <p className="font-body text-lg text-foreground/80">
                    {agent.whatItDoes}
                  </p>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* What It Looks For */}
                <div>
                  <h4 className="font-byline text-muted-foreground mb-4">What It Looks For</h4>
                  <ul className="space-y-2">
                    {agent.lookingFor.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 font-body text-sm text-foreground/80">
                        <span className="w-1.5 h-1.5 bg-primary mt-2 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sample Output */}
                <div>
                  <h4 className="font-byline text-muted-foreground mb-4">Sample Output</h4>
                  <div className="bg-muted/30 border border-border p-4 font-mono text-sm">
                    {Object.entries(agent.sampleOutput).map(([key, value], i) => (
                      <div key={i} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="text-foreground text-right max-w-[60%]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Why It Matters */}
              <div className="mt-8 pt-6 border-t border-border">
                <h4 className="font-byline text-primary mb-2">Why It Matters</h4>
                <p className="font-deck text-foreground/90">
                  {agent.whyItMatters}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Truth Score Formula Section */}
      <section className="bg-foreground text-background py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="font-section text-background/60 block mb-3">The Formula</span>
              <h2 className="font-headline text-4xl md:text-5xl text-background">
                Truth Score Calculation
              </h2>
            </div>

            {/* Formula Display */}
            <div className="bg-background/10 border border-background/20 p-8 mb-12">
              <div className="text-center mb-8">
                <code className="font-masthead text-3xl md:text-4xl text-background">
                  TRUTH SCORE = E + M + L + A
                </code>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <span className="font-masthead text-4xl text-primary">E</span>
                  <div>
                    <h4 className="font-headline text-lg text-background mb-1">Evidence Quality</h4>
                    <p className="text-sm text-background/70">0-40 points — How well are claims supported by credible evidence?</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <span className="font-masthead text-4xl text-primary">M</span>
                  <div>
                    <h4 className="font-headline text-lg text-background mb-1">Methodology Rigor</h4>
                    <p className="text-sm text-background/70">0-25 points — Are sources credible and diverse?</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <span className="font-masthead text-4xl text-primary">L</span>
                  <div>
                    <h4 className="font-headline text-lg text-background mb-1">Logical Structure</h4>
                    <p className="text-sm text-background/70">0-20 points — Is the reasoning valid and coherent?</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <span className="font-masthead text-4xl text-primary">A</span>
                  <div>
                    <h4 className="font-headline text-lg text-background mb-1">Manipulation Absence</h4>
                    <p className="text-sm text-background/70">0-15 points — Is the article free from deception tactics?</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Credibility Ratings */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-background/5 border border-background/10">
                <div className="font-masthead text-2xl text-green-400 mb-2">70-100</div>
                <div className="font-byline text-background/60">HIGH</div>
                <p className="text-xs text-background/50 mt-2">Trustworthy with minor caveats</p>
              </div>
              <div className="text-center p-4 bg-background/5 border border-background/10">
                <div className="font-masthead text-2xl text-yellow-400 mb-2">40-69</div>
                <div className="font-byline text-background/60">MODERATE</div>
                <p className="text-xs text-background/50 mt-2">Significant issues, read critically</p>
              </div>
              <div className="text-center p-4 bg-background/5 border border-background/10">
                <div className="font-masthead text-2xl text-orange-400 mb-2">20-39</div>
                <div className="font-byline text-background/60">LOW</div>
                <p className="text-xs text-background/50 mt-2">Major problems, seek alternatives</p>
              </div>
              <div className="text-center p-4 bg-background/5 border border-background/10">
                <div className="font-masthead text-2xl text-red-400 mb-2">0-19</div>
                <div className="font-byline text-background/60">VERY LOW</div>
                <p className="text-xs text-background/50 mt-2">Not reliable for forming opinions</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Assessment Deep Dive */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="font-section text-muted-foreground block mb-3">The Final Analysis</span>
            <h2 className="font-headline text-4xl md:text-5xl text-foreground mb-4">
              What AI Thinks
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto">
              Beyond scores and flags, Parse delivers a comprehensive assessment
              structured into six distinct perspectives.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Verdict",
                desc: "Direct statement about this specific article's credibility and the reasoning behind it.",
                color: "border-l-red-500"
              },
              {
                title: "Intent",
                desc: "What the author and publication are trying to accomplish with this particular piece.",
                color: "border-l-blue-500"
              },
              {
                title: "Blind Spots",
                desc: "What this article specifically omits, avoids discussing, or fails to consider.",
                color: "border-l-yellow-500"
              },
              {
                title: "Uncomfortable Truth",
                desc: "The nuance that challenges both supporters and critics of the article's position.",
                color: "border-l-purple-500"
              },
              {
                title: "Kernel of Truth",
                desc: "The legitimate concern or valid point buried in the piece, even if poorly argued.",
                color: "border-l-green-500"
              },
              {
                title: "What You Should Do",
                desc: "Specific, actionable guidance for readers of this article.",
                color: "border-l-orange-500"
              }
            ].map((item, i) => (
              <div key={i} className={`card-editorial p-6 border-l-4 ${item.color}`}>
                <h4 className="font-headline text-xl text-foreground mb-2">{item.title}</h4>
                <p className="font-body text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pull Quote */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <blockquote className="pull-quote max-w-3xl mx-auto text-foreground">
            The goal isn't to tell you what to think—it's to show you
            how the article is trying to make you think.
          </blockquote>
        </div>
      </section>

      {/* Trust & Limitations */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="font-section text-muted-foreground block mb-3">Transparency</span>
            <h2 className="font-headline text-4xl md:text-5xl text-foreground">
              What Parse Can & Cannot Do
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Can Do */}
            <div className="card-editorial p-8">
              <h3 className="font-headline text-2xl text-foreground mb-6 rule-accent pb-4">
                What We Can Do
              </h3>
              <ul className="space-y-4">
                {[
                  "Identify manipulation tactics and logical fallacies",
                  "Detect omissions and framing bias",
                  "Provide a structured framework for critical evaluation",
                  "Surface questions you should be asking",
                  "Reveal the techniques being used to persuade you"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 font-body text-foreground/80">
                    <span className="text-green-500 mt-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Cannot Do */}
            <div className="card-editorial p-8">
              <h3 className="font-headline text-2xl text-foreground mb-6 rule-accent pb-4">
                What We Cannot Do
              </h3>
              <ul className="space-y-4">
                {[
                  "Determine absolute truth (we provide analysis, not verdicts)",
                  "Replace human judgment (use findings as input, not gospel)",
                  "Detect novel manipulation techniques we haven't seen",
                  "Account for information we don't have access to",
                  "Guarantee accuracy for highly specialized topics"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 font-body text-foreground/80">
                    <span className="text-red-500 mt-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Our Commitment */}
          <div className="mt-12 p-8 bg-muted/30 border border-border">
            <h3 className="font-headline text-xl text-foreground mb-4">Our Commitment</h3>
            <p className="font-body text-foreground/80">
              Parse analyzes the article as presented. We don't know what the author knows,
              what pressures shaped the piece, or what context exists outside the text.
              Use our analysis as one input among many. The best defense against manipulation
              is not a tool—it's a habit of critical thinking that Parse aims to cultivate.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="font-headline text-3xl md:text-4xl text-foreground mb-6">
            Ready to See It in Action?
          </h2>
          <p className="font-body text-muted-foreground mb-8 max-w-xl mx-auto">
            Submit any article and watch our eight-agent pipeline dissect it
            in real-time. Your first analysis is free.
          </p>
          <Link
            href="/analyze"
            className="btn-editorial-primary inline-flex items-center gap-2"
          >
            Analyze an Article
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8 pb-8 rule">
            <div>
              <h3 className="font-masthead text-3xl text-foreground mb-2">Parse</h3>
              <p className="text-sm text-muted-foreground">Critical Media Analysis Platform</p>
            </div>
            <div className="flex flex-wrap gap-6">
              <Link href="/analyze" className="nav-section hover:text-primary transition-colors">
                Analyze
              </Link>
              <Link href="/methodology" className="nav-section text-primary">
                Methodology
              </Link>
              <Link href="/pricing" className="nav-section hover:text-primary transition-colors">
                Pricing
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <p>© 2026 Parse. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full" />
              Truth through rigorous analysis
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
