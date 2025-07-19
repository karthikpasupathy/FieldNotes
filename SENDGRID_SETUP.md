# SendGrid Setup Guide for Field Notes

## Issue
The magic link emails are failing because SendGrid requires **verified sender email addresses**. You're getting a 401 Unauthorized error because the default email `your-verified-email@your-domain.com` is not verified.

## Quick Fix Options

### Option 1: Use Single Sender Verification (Easiest)
1. Go to SendGrid dashboard → Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Use your **personal email address** (Gmail, etc.) that you control
4. Check your email and click the verification link
5. Set FROM_EMAIL environment variable to your verified email:
   ```
   FROM_EMAIL=your-verified-email@gmail.com
   ```

### Option 2: Use Domain Authentication (Production Ready)
1. Go to SendGrid dashboard → Settings → Sender Authentication  
2. Click "Authenticate Your Domain"
3. Enter a domain you own (like example.com)
4. Follow DNS setup instructions
5. Once verified, you can use any email from that domain

### Option 3: Development Mode (Current Fallback)
The app automatically falls back to console logging when SendGrid fails. Check the server logs for magic link URLs during development.

## Current Status
- ✅ SendGrid API key is configured and working
- ❌ Sender email verification needed
- ✅ Fallback to console logging is implemented

## Quick Test
After setting up sender verification, restart the app and try requesting a magic link. You should see either:
- Email sent successfully (if verification works)
- Magic link URL in console logs (fallback mode)