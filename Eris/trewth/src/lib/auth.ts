/**
 * NextAuth.js Configuration
 * Trewth Authentication Setup
 */

import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required")
        }

        // TODO: Implement proper password hashing verification
        // For now, this is a placeholder - you'll need to add password hashing

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            credits: true,
            subscription: true,
          },
        })

        if (!user) {
          throw new Error("No user found with this email")
        }

        // TODO: Verify password hash here
        // const isValidPassword = await verifyPassword(credentials.password, user.password)
        // if (!isValidPassword) {
        //   throw new Error("Invalid password")
        // }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
