# OAuth Authentication Setup Guide

This guide explains how to configure OAuth authentication for Parse with Google, Facebook, and Apple.

---

## Overview

Parse supports multiple OAuth providers for user authentication:
- **Google** - Google OAuth 2.0
- **Facebook** - Facebook OAuth
- **Apple** - Sign in with Apple

Users can sign in using any of these providers or create an account with email/password.

---

## Prerequisites

Before configuring OAuth, you'll need to create OAuth applications with each provider:

1. **Google Cloud Console** - For Google OAuth
2. **Facebook Developer Portal** - For Facebook OAuth
3. **Apple Developer Portal** - For Sign in with Apple

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**

### Step 2: Configure OAuth 2.0 Client

1. Click **Create Credentials** > **OAuth client ID**
2. Application type: **Web application**
3. Name: `Parse Web App`
4. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://parseapp.vercel.app` (production)
5. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://parseapp.vercel.app/api/auth/callback/google` (production)
6. Click **Create**

### Step 3: Get Credentials

Copy the **Client ID** and **Client Secret** from the OAuth client you created.

### Environment Variables

```env
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

---

## Facebook OAuth Setup

### Step 1: Create Facebook App

1. Go to [Facebook Developer Portal](https://developers.facebook.com/)
2. Create a new app: **Website** or **Consumer**
3. Name: `Parse`
4. Click **Create App**

### Step 2: Configure Facebook Login

1. In your app dashboard, add **Facebook Login** product
2. Navigate to **Settings** > **Basic**
3. Copy your **App ID** and **App Secret**

### Step 3: Configure OAuth Redirect URIs

1. Go to **Facebook Login** > **Settings**
2. Valid OAuth Redirect URIs:
   - `http://localhost:3000/api/auth/callback/facebook` (development)
   - `https://parseapp.vercel.app/api/auth/callback/facebook` (production)

### Environment Variables

```env
FACEBOOK_CLIENT_ID="your-facebook-app-id"
FACEBOOK_CLIENT_SECRET="your-facebook-app-secret"
```

---

## Apple OAuth Setup

### Step 1: Create Apple Developer Account

You'll need an [Apple Developer Program](https://developer.apple.com/) membership ($99/year).

### Step 2: Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Create a new **App ID** with **Sign in with Apple** capability
4. Bundle ID: Use your domain or app identifier
5. Copy your **Team ID** and **Bundle ID**

### Step 3: Create Services ID

1. Create a new **Services ID**
2. Description: `Parse`
3. Bundle ID: Same as your App ID
4. Return URLs:
   - `http://localhost:3000/api/auth/callback/apple` (development)
   - `https://parseapp.vercel.app/api/auth/callback/apple` (production)

### Step 4: Generate Client Secret

1. Go to **Keys** > **Sign in with Apple**
2. Create a new key with **Sign in with Apple** capability
3. Copy the **Key ID**
4. Download the `.p8` file (you can only download it once!)
5. Note your **Team ID** from the developer portal

### Environment Variables

```env
APPLE_ID="your-services-id"
APPLE_SECRET="your-apple-secret-key"
APPLE_KEY_ID="your-key-id"
APPLE_TEAM_ID="your-team-id"
```

**Note:** For Apple OAuth in production, you'll need to generate a client secret. NextAuth handles this automatically when you provide the credentials.

---

## Environment Configuration

### Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your OAuth credentials:
   ```env
   # Google OAuth
   GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"

   # Facebook OAuth
   FACEBOOK_CLIENT_ID="your-facebook-app-id"
   FACEBOOK_CLIENT_SECRET="your-facebook-app-secret"

   # Apple OAuth
   APPLE_ID="your-services-id"
   APPLE_SECRET="your-apple-secret-key"
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

### Production (Vercel)

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add the same variables as above
4. Redeploy your application

**Important:** Never commit `.env.local` to version control!

---

## Testing OAuth Locally

### Test Google OAuth

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3000/auth/signin`
3. Click **Continue with Google**
4. Sign in with your Google account
5. You should be redirected to `/dashboard`

### Test Facebook OAuth

1. Click **Continue with Facebook**
2. Sign in with your Facebook account
3. Authorize the Parse app
4. You should be redirected to `/dashboard`

### Test Apple OAuth

1. Click **Continue with Apple**
2. Sign in with your Apple ID
3. You may be asked to share your email
4. You should be redirected to `/dashboard`

---

## Troubleshooting

### Google OAuth Issues

**Problem:** Redirect URI mismatch
- **Solution:** Ensure your redirect URI exactly matches what's in Google Cloud Console, including the trailing slash (or lack thereof)

**Problem:** Origin doesn't match
- **Solution:** Add your domain to the authorized JavaScript origins in Google Cloud Console

### Facebook OAuth Issues

**Problem:** Invalid redirect URI
- **Solution:** Check that the redirect URI is added in Facebook Login settings, not just basic app settings

**Problem:** App in Development Mode
- **Solution:** Add your test email address to the approved test users in Facebook App settings

### Apple OAuth Issues

**Problem:** "invalid_client" error
- **Solution:** Verify that your Services ID, Team ID, and Key ID are all correct

**Problem:** "redirect_uri_mismatch" error
- **Solution:** Ensure the return URL is correctly configured in your Services ID settings

**Problem:** Apple OAuth only works in production
- **Solution:** Apple OAuth requires HTTPS and valid domains. It won't work on `localhost` unless you configure special test mode

### General Issues

**Problem:** OAuth callback not working
- **Solution:** Check that your `NEXTAUTH_URL` environment variable is set correctly:
  ```env
  NEXTAUTH_URL="http://localhost:3000"  # Development
  NEXTAUTH_URL="https://parseapp.vercel.app"  # Production
  ```

**Problem:** Session not persisting
- **Solution:** Verify your database connection is working and the `Account` table is being created

---

## Security Best Practices

### 1. Environment Variables
- Never commit `.env.local` to version control
- Use different OAuth apps for development and production
- Rotate client secrets periodically

### 2. Redirect URIs
- Always use HTTPS in production
- Whitelist only your domains
- Don't use wildcards in redirect URIs

### 3. Scopes
- Only request the permissions you need
- Google: `openid`, `profile`, `email`
- Facebook: `email`, `public_profile`
- Apple: `email`, `name` (optional)

### 4. Data Handling
- OAuth providers give you user data securely
- Store OAuth tokens securely in the database
- Don't expose OAuth secrets in client-side code

---

## Database Schema

NextAuth creates the following tables when OAuth is enabled:

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  credits       Credits?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

---

## Production Deployment

### Vercel Environment Variables

Add these in your Vercel project settings:

```env
NEXTAUTH_URL="https://parseapp.vercel.app"
NEXTAUTH_SECRET="your-nextauth-secret-here"

GOOGLE_CLIENT_ID="your-production-google-client-id"
GOOGLE_CLIENT_SECRET="your-production-google-client-secret"

FACEBOOK_CLIENT_ID="your-production-facebook-app-id"
FACEBOOK_CLIENT_SECRET="your-production-facebook-app-secret"

APPLE_ID="your-production-services-id"
APPLE_SECRET="your-production-apple-secret"
```

### Generate NEXTAUTH_SECRET

Generate a secure secret for NextAuth:

```bash
openssl rand -base64 32
```

---

## Customization

### Change OAuth Button Order

Edit `src/app/auth/signin/page.tsx` to reorder the buttons:

```typescript
<div className="space-y-3 mb-6">
  {/* Reorder these buttons as desired */}
  <Button onClick={() => handleOAuthSignIn("apple")}>Apple</Button>
  <Button onClick={() => handleOAuthSignIn("google")}>Google</Button>
  <Button onClick={() => handleOAuthSignIn("facebook")}>Facebook</Button>
</div>
```

### Customize Scopes

Edit `src/lib/auth.ts` to add custom scopes:

```typescript
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
```

---

## Support

For issues or questions:
- Check [NextAuth.js docs](https://next-auth.js.org/)
- Review provider-specific documentation
- Check Vercel deployment logs
- Verify environment variables are set correctly

---

**Last Updated:** January 8, 2026
**Version:** 0.1.0
