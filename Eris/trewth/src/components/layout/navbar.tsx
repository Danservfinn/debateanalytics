/**
 * Navigation Bar - Luxury Dark Mode
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
    <nav className="sticky top-0 z-50 glass border-b border-primary/10">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          {/* Logo - Gold Gradient */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
              <span className="font-display-bold text-xl text-background">P</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-display text-2xl gold-gradient font-semibold">
                Parse
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className={`text-sm font-medium transition-all relative ${
                pathname === "/"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Home
              {pathname === "/" && (
                <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}
            </Link>
            <Link
              href="/analyze"
              className={`text-sm font-medium transition-all relative ${
                pathname === "/analyze"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Analyze
              {pathname === "/analyze" && (
                <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}
            </Link>
            <Link
              href="/pricing"
              className={`text-sm font-medium transition-all relative ${
                pathname === "/pricing"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pricing
              {pathname === "/pricing" && (
                <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
              )}
            </Link>
            {session && (
              <Link
                href="/dashboard"
                className={`text-sm font-medium transition-all relative ${
                  pathname === "/dashboard"
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Dashboard
                {pathname === "/dashboard" && (
                  <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
              </Link>
            )}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {status === "loading" ? (
              <div className="h-9 w-24 bg-primary/10 animate-pulse rounded" />
            ) : session ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <span className="text-xs font-bold text-background">
                      {session.user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-foreground">
                    {session.user?.name?.split(' ')[0]}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Link href="/auth/signin">Sign in</Link>
                </Button>
                <Button
                  size="sm"
                  asChild
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                >
                  <Link href="/auth/signup">Sign up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-3">
            {status === "loading" ? (
              <div className="h-9 w-20 bg-primary/10 animate-pulse rounded" />
            ) : session ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-xs font-bold text-background">
                  {session.user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-foreground hover:text-primary"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-6 space-y-4 border-t border-primary/10 animate-slide-up">
            <Link
              href="/"
              className={`block text-sm font-medium transition-colors py-2 ${
                pathname === "/" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/analyze"
              className={`block text-sm font-medium transition-colors py-2 ${
                pathname === "/analyze" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Analyze
            </Link>
            <Link
              href="/pricing"
              className={`block text-sm font-medium transition-colors py-2 ${
                pathname === "/pricing" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            {session && (
              <Link
                href="/dashboard"
                className={`block text-sm font-medium transition-colors py-2 ${
                  pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
            )}
            <div className="pt-4 border-t border-primary/10 flex flex-col gap-3">
              {!session ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                  >
                    <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>Sign up</Link>
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    signOut({ callbackUrl: "/" })
                    setMobileMenuOpen(false)
                  }}
                  className="w-full border-primary/30"
                >
                  Sign out
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
