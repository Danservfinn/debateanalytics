import Link from "next/link";

export default function HomePage() {
  // Today's date for the edition bar
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Edition Bar - Classic newspaper date line */}
      <div className="edition-bar container mx-auto px-4">
        <span className="uppercase tracking-wider">{today}</span>
        <span className="hidden sm:inline">Digital Edition</span>
        <span className="uppercase tracking-wider">Vol. I, No. 1</span>
      </div>

      {/* Hero Section - The Front Page */}
      <section className="container mx-auto px-4 pt-16 pb-20">
        {/* Section Label */}
        <div className="flex justify-center mb-8">
          <span className="badge-section">Analysis Platform</span>
        </div>

        {/* Main Headline - Masthead Style */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className="font-masthead text-6xl md:text-7xl lg:text-8xl text-foreground mb-6 leading-[0.95]">
            The Truth,<br />
            <span className="text-primary">Quantified</span>
          </h1>

          {/* Deck/Subhead - Italic serif */}
          <p className="font-deck text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Rigorous media analysis that steel-mans every perspective,
            detects manipulation with precision, and delivers truth scores
            backed by evidence.
          </p>
        </div>

        {/* Horizontal Rule */}
        <div className="rule-double max-w-xl mx-auto mb-10" />

        {/* CTA - Editorial buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/analyze"
            className="btn-editorial-primary inline-flex items-center justify-center gap-2"
          >
            Submit Article for Analysis
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link
            href="/methodology"
            className="btn-editorial-outline inline-flex items-center justify-center"
          >
            Our Methodology
          </Link>
        </div>

        {/* Trust Indicators - Miller's Law: 3 items */}
        <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary" />
            <span className="font-byline">8-Agent AI Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-foreground/30" />
            <span className="font-byline">Evidence-Based Scoring</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-foreground/30" />
            <span className="font-byline">Instant Results</span>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="rule-heavy container mx-auto" />

      {/* Core Features - Miller's Law: 3 pillars */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <span className="font-section text-muted-foreground block mb-3">Our Approach</span>
          <h2 className="font-headline text-4xl md:text-5xl text-foreground">
            Three Pillars of Truth-Seeking
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Feature 1 */}
          <article className="card-editorial p-8 group">
            <div className="mb-6">
              <span className="font-masthead text-5xl text-primary/20 group-hover:text-primary/40 transition-colors">I</span>
            </div>
            <h3 className="font-headline text-2xl text-foreground mb-4 rule-accent pb-4">
              Steel-Manned Perspectives
            </h3>
            <p className="font-body text-muted-foreground leading-relaxed">
              We construct the strongest possible version of each viewpoint—even those
              weakly presented in the source material. No straw men. Only honest
              intellectual engagement.
            </p>
          </article>

          {/* Feature 2 */}
          <article className="card-editorial p-8 group">
            <div className="mb-6">
              <span className="font-masthead text-5xl text-primary/20 group-hover:text-primary/40 transition-colors">II</span>
            </div>
            <h3 className="font-headline text-2xl text-foreground mb-4 rule-accent pb-4">
              Manipulation Detection
            </h3>
            <p className="font-body text-muted-foreground leading-relaxed">
              Our system identifies emotional manipulation, framing bias, strategic
              omissions, and propaganda techniques with surgical precision. Nothing
              hidden escapes analysis.
            </p>
          </article>

          {/* Feature 3 */}
          <article className="card-editorial p-8 group">
            <div className="mb-6">
              <span className="font-masthead text-5xl text-primary/20 group-hover:text-primary/40 transition-colors">III</span>
            </div>
            <h3 className="font-headline text-2xl text-foreground mb-4 rule-accent pb-4">
              Truth Quantification
            </h3>
            <p className="font-body text-muted-foreground leading-relaxed">
              Evidence quality, methodology rigor, logical structure, and manipulation
              scores combine into a comprehensive truth metric. Objectivity,
              by the numbers.
            </p>
          </article>
        </div>
      </section>

      {/* Pull Quote Section */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <blockquote className="pull-quote max-w-3xl mx-auto text-foreground">
            In an age of information warfare, the ability to separate
            signal from noise isn't just valuable—it's essential.
          </blockquote>
        </div>
      </section>

      {/* How It Works - Miller's Law: 4 steps */}
      <section id="methodology" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <span className="font-section text-muted-foreground block mb-3">The Process</span>
          <h2 className="font-headline text-4xl md:text-5xl text-foreground">
            From Article to Analysis
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 max-w-5xl mx-auto">
          {[
            {
              step: "01",
              title: "Submit",
              desc: "Paste any article URL or text. Our system accepts news, opinion, and analysis from any source."
            },
            {
              step: "02",
              title: "Extract",
              desc: "AI parses content, identifies claims, sources, and rhetorical structures automatically."
            },
            {
              step: "03",
              title: "Analyze",
              desc: "Eight specialized agents evaluate from multiple angles: logic, evidence, bias, and manipulation."
            },
            {
              step: "04",
              title: "Report",
              desc: "Receive a comprehensive truth score with detailed breakdown and actionable insights."
            },
          ].map((item, index) => (
            <div
              key={index}
              className={`p-8 ${index < 3 ? 'lg:border-r border-border' : ''} ${index < 2 ? 'sm:border-r' : ''}`}
            >
              <div className="font-masthead text-6xl text-muted-foreground/30 mb-4">
                {item.step}
              </div>
              <h3 className="font-headline text-xl text-foreground mb-3">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA After Process */}
        <div className="text-center mt-16">
          <Link
            href="/analyze"
            className="btn-editorial-primary inline-flex items-center gap-2"
          >
            Begin Your First Analysis
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Stats Section - Miller's Law: 4 metrics */}
      <section className="bg-foreground text-background py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="score-editorial text-background/90">8</div>
              <div className="metric-label text-background/60 mt-2">AI Agents</div>
            </div>
            <div>
              <div className="score-editorial text-background/90">12</div>
              <div className="metric-label text-background/60 mt-2">Scoring Dimensions</div>
            </div>
            <div>
              <div className="score-editorial text-background/90">&lt;30s</div>
              <div className="metric-label text-background/60 mt-2">Analysis Time</div>
            </div>
            <div>
              <div className="score-editorial text-background/90">100%</div>
              <div className="metric-label text-background/60 mt-2">Transparent</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Editorial Style */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-12">
          {/* Footer Top */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8 pb-8 rule">
            <div>
              <h3 className="font-masthead text-3xl text-foreground mb-2">Parse</h3>
              <p className="text-sm text-muted-foreground">Critical Media Analysis Platform</p>
            </div>
            <div className="flex flex-wrap gap-6">
              <Link href="/analyze" className="nav-section hover:text-primary transition-colors">
                Analyze
              </Link>
              <Link href="/pricing" className="nav-section hover:text-primary transition-colors">
                Pricing
              </Link>
              <Link href="/about" className="nav-section hover:text-primary transition-colors">
                About
              </Link>
              <Link href="/contact" className="nav-section hover:text-primary transition-colors">
                Contact
              </Link>
            </div>
          </div>

          {/* Footer Bottom */}
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
