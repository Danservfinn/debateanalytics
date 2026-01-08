/**
 * Navigation Bar - The Newsroom
 * Editorial masthead-style navigation
 */

'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useSession, signOut } from "next-auth/react"
import { Menu, X } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="masthead sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        {/* Main Navigation Row */}
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Masthead Style */}
          <Link href="/" className="flex items-center group">
            <span className="font-masthead text-2xl md:text-3xl text-foreground group-hover:text-primary transition-colors">
              Parse
            </span>
          </Link>

          {/* Desktop Navigation - Section Style */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className={`nav-section transition-colors ${
                pathname === "/" ? "active" : ""
              }`}
            >
              Home
            </Link>
            <Link
              href="/analyze"
              className={`nav-section transition-colors ${
                pathname === "/analyze" || pathname?.startsWith("/analyze") ? "active" : ""
              }`}
            >
              Analyze
            </Link>
            <Link
              href="/pricing"
              className={`nav-section transition-colors ${
                pathname === "/pricing" ? "active" : ""
              }`}
            >
              Pricing
            </Link>
            {session && (
              <Link
                href="/dashboard"
                className={`nav-section transition-colors ${
                  pathname === "/dashboard" ? "active" : ""
                }`}
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* Desktop Auth - Editorial Style */}
          <div className="hidden md:flex items-center gap-4">
            {status === "loading" ? (
              <div className="h-8 w-20 bg-muted animate-pulse" />
            ) : session ? (
              <div className="flex items-center gap-4">
                {/* User Info */}
                <div className="flex items-center gap-3 px-3 py-1.5 border border-border">
                  <div className="w-7 h-7 bg-foreground text-background flex items-center justify-center">
                    <span className="text-xs font-bold">
                      {session.user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-byline text-foreground">
                    {session.user?.name?.split(' ')[0].toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="nav-section hover:text-primary transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/auth/signin"
                  className="nav-section hover:text-primary transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="btn-editorial-primary text-xs"
                >
                  Subscribe
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            {session && (
              <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center">
                <span className="text-xs font-bold">
                  {session.user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-foreground hover:text-primary transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-6 border-t border-border animate-slide-down">
            <nav className="flex flex-col gap-1">
              <Link
                href="/"
                className={`py-3 px-2 font-byline transition-colors ${
                  pathname === "/" ? "text-primary bg-muted/50" : "text-foreground hover:bg-muted/30"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                HOME
              </Link>
              <Link
                href="/analyze"
                className={`py-3 px-2 font-byline transition-colors ${
                  pathname === "/analyze" ? "text-primary bg-muted/50" : "text-foreground hover:bg-muted/30"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                ANALYZE
              </Link>
              <Link
                href="/pricing"
                className={`py-3 px-2 font-byline transition-colors ${
                  pathname === "/pricing" ? "text-primary bg-muted/50" : "text-foreground hover:bg-muted/30"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                PRICING
              </Link>
              {session && (
                <Link
                  href="/dashboard"
                  className={`py-3 px-2 font-byline transition-colors ${
                    pathname === "/dashboard" ? "text-primary bg-muted/50" : "text-foreground hover:bg-muted/30"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  DASHBOARD
                </Link>
              )}

              {/* Mobile Auth Section */}
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
                {!session ? (
                  <>
                    <Link
                      href="/auth/signin"
                      className="py-3 px-2 font-byline text-foreground hover:bg-muted/30 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      SIGN IN
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="btn-editorial-primary text-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      SUBSCRIBE
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      signOut({ callbackUrl: "/" })
                      setMobileMenuOpen(false)
                    }}
                    className="py-3 px-2 font-byline text-left text-foreground hover:bg-muted/30 transition-colors"
                  >
                    SIGN OUT
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
