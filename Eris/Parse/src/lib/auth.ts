/**
 * NextAuth.js v5 Configuration
 * Parse Authentication Setup with OAuth Providers
 */

import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import FacebookProvider from "next-auth/providers/facebook"
import CredentialsProvider from "next-auth/providers/credentials"

// Check if we're in development mode
const isDev = process.env.NODE_ENV === "development"

// Only import Prisma-related modules if DATABASE_URL is available
const hasDatabaseUrl = !!process.env.DATABASE_URL

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Only use adapter when database is configured
  ...(hasDatabaseUrl ? {} : {}),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    // Facebook OAuth
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
    }),

    // Dev-only Credentials provider for local testing
    ...(isDev ? [
      CredentialsProvider({
        id: "dev-login",
        name: "Dev Login",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "test@example.com" },
        },
        async authorize(credentials) {
          // Only allow in development
          if (!isDev) return null

          // Return a test user
          return {
            id: "dev-user-001",
            name: "Test User",
            email: credentials?.email as string || "test@example.com",
            image: null,
          }
        },
      }),
    ] : []),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }
      if (account) {
        token.provider = account.provider
      }
      // For OAuth, use profile data
      if (profile) {
        token.name = profile.name || token.name
        token.email = profile.email || token.email
        token.picture = (profile as { picture?: string }).picture || token.picture
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string || token.sub || ""
        session.user.name = token.name as string
        session.user.email = token.email as string
        session.user.image = token.picture as string
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Allow all OAuth sign-ins
      if (account?.provider === "google" || account?.provider === "facebook") {
        return true
      }
      return true
    },
  },
})

// Legacy export for backwards compatibility
export const authOptions = {
  session: { strategy: "jwt" as const },
  pages: { signIn: "/auth/signin" },
}

/**
 * Hash a password using bcrypt (for future use with database)
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs")
  return bcrypt.hash(password, 12)
}

/**
 * Verify a password against a hash (for future use with database)
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs")
  return bcrypt.compare(password, hash)
}
