import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-24 md:py-32 relative">
        <div className="max-w-5xl mx-auto text-center space-y-12 animate-fade-in">
          {/* Premium Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-4">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-primary">Premium Analysis</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display-bold text-6xl md:text-8xl lg:text-9xl gold-gradient text-glow leading-tight">
            Parse
          </h1>

          {/* Subtitle with Miller's Law Chunking (3 key points) */}
          <div className="space-y-4 max-w-3xl mx-auto">
            <p className="text-xl md:text-2xl text-foreground/90 leading-relaxed">
              Hyper-critical news analysis that steel-mans perspectives
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-primary/80">
              <span>✓ Detects manipulation</span>
              <span>•</span>
              <span>✓ Steel-mans arguments</span>
              <span>•</span>
              <span>✓ Quantifies truth</span>
            </div>
          </div>

          {/* Premium CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link
              href="/analyze"
              className="group relative px-8 py-4 bg-primary text-primary-foreground rounded-lg font-medium overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary/20"
            >
              <div className="absolute inset-0 gold-shimmer animate-shimmer" />
              <span className="relative flex items-center gap-2">
                Analyze an Article
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 border border-gold-subtle rounded-lg font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              Learn More
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Private & Secure</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Instant Results</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Miller's Law: 3 main features */}
      <section id="features" className="px-4 py-24 relative">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-display text-4xl md:text-5xl text-foreground">
              See Through the Noise
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Three pillars of truth-seeking, built for the discerning mind
            </p>
          </div>

          {/* Feature Cards - Premium Glassmorphism */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group card-luxury p-8 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full group-hover:bg-primary/10 transition-colors" />
              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl mb-4 text-foreground group-hover:text-primary transition-colors">
                  Steel-Manned Perspectives
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  We construct the strongest possible version of each viewpoint, even those weakly presented. No straw men here.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group card-luxury p-8 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full group-hover:bg-primary/10 transition-colors" />
              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl mb-4 text-foreground group-hover:text-primary transition-colors">
                  Manipulation Detection
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Identify emotional manipulation, framing bias, omissions, and propaganda techniques with surgical precision.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group card-luxury p-8 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full group-hover:bg-primary/10 transition-colors" />
              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-display text-2xl mb-4 text-foreground group-hover:text-primary transition-colors">
                  Truth Quantification
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Evidence quality, methodology rigor, logical structure, and manipulation-free scoring. Truth by the numbers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Preview - Miller's Law: 4 steps */}
      <section className="px-4 py-24 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-display text-4xl text-foreground">
              How It Works
            </h2>
            <p className="text-muted-foreground">
              Four steps to clarity, in seconds
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Submit", desc: "Paste any article URL" },
              { step: "02", title: "Extract", desc: "AI parses content" },
              { step: "03", title: "Analyze", desc: "7-agent evaluation" },
              { step: "04", title: "Reveal", desc: "Get truth score" },
            ].map((item, index) => (
              <div key={index} className="text-center space-y-3">
                <div className="font-display-bold text-5xl text-primary/30">{item.step}</div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer - Premium Design */}
      <footer className="px-4 py-12 border-t border-primary/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-2">
              <p className="font-display text-xl text-foreground">Parse</p>
              <p className="text-sm text-muted-foreground">Critical Media Analysis Platform</p>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Version 0.1.0</span>
              <span>•</span>
              <span>Design Phase</span>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-primary/10 text-center text-sm text-muted-foreground">
            <p>© 2026 Parse. Truth through rigorous analysis.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
