# Quick Deployment Guide

Follow these steps to deploy OSKILIFTS:

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `oskilifts` (or any name you want)
3. Make it **Public** (or Private, your choice)
4. **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

## Step 2: Push to GitHub

After creating the repo, GitHub will show you commands. Run these in your terminal:

```bash
cd /Users/ramjhawar/Downloads/OSKI_LIFTS/OSKILIFTS
git remote add origin https://github.com/YOUR_USERNAME/oskilifts.git
git branch -M main
git push -u origin main
```

(Replace `YOUR_USERNAME` with your GitHub username)

## Step 3: Deploy API to Railway

1. Go to https://railway.app and sign up/login (use GitHub to sign in)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `oskilifts` repository
5. Railway will auto-detect and deploy
6. Once deployed, click on your service → Settings → Generate Domain
7. Copy the domain (e.g., `oskilifts-production.up.railway.app`)
8. This is your API URL! Save it for Step 4.

**Note:** Railway will automatically use the `Procfile` we created.

## Step 4: Deploy Web App to Vercel

Run this command (it will guide you through login):

```bash
cd /Users/ramjhawar/Downloads/OSKI_LIFTS/OSKILIFTS
npx vercel
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No
- **Project name?** → `oskilifts` (or press Enter)
- **Directory?** → `./` (press Enter)
- **Override settings?** → No

After deployment, Vercel will give you a URL. But we need to set the API URL first!

1. Go to https://vercel.com/dashboard
2. Click on your `oskilifts` project
3. Go to Settings → Environment Variables
4. Add new variable:
   - **Name:** `EXPO_PUBLIC_OSKILIFTS_API_URL`
   - **Value:** Your Railway API URL from Step 3 (e.g., `https://oskilifts-production.up.railway.app`)
5. Go to Deployments tab
6. Click the three dots on the latest deployment → Redeploy

## Step 5: Share Your App!

Your Vercel URL (e.g., `https://oskilifts.vercel.app`) is now live and shareable! 🎉

---

## Step 6: Deploy to Custom Domain (Optional)

If you want a custom domain like `oskilifts.com` instead of `oskilifts.vercel.app`:

### 6.1: Purchase Domain Name

1. Buy a domain from a registrar:
   - **Namecheap** (https://www.namecheap.com) - Popular choice
   - **Google Domains** (https://domains.google) - Simple interface
   - **Cloudflare** (https://www.cloudflare.com/products/registrar) - At-cost pricing
   - **GoDaddy** (https://www.godaddy.com) - Widely used
2. Common domain choices: `oskilifts.com`, `oskilifts.app`, `oskilifts.dev`
3. Cost: Typically $10-15/year for `.com` domains

### 6.2: Configure Custom Domain on Vercel

1. Go to https://vercel.com/dashboard
2. Click on your `oskilifts` project
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter your domain (e.g., `oskilifts.com`)
6. Vercel will show you DNS records to configure:
   - **A Record**: Point `@` to Vercel's IP addresses, OR
   - **CNAME Record**: Point `@` to `cname.vercel-dns.com`
   - Follow Vercel's instructions (they'll show exact values)

### 6.3: Configure Custom Domain on Railway (Optional - for API)

If you want a subdomain like `api.oskilifts.com` for your API:

1. Go to https://railway.app/dashboard
2. Click on your project
3. Go to **Settings** → **Domains**
4. Click **Add Custom Domain**
5. Enter `api.oskilifts.com` (or your preferred subdomain)
6. Railway will provide a CNAME record to configure

### 6.4: Configure DNS Records at Your Domain Registrar

1. Log into your domain registrar (where you bought the domain)
2. Go to DNS Management / DNS Settings
3. Add the DNS records provided by Vercel and Railway:

   **For Vercel (main website):**
   - Type: **A** or **CNAME** (Vercel will tell you which)
   - Name: `@` or leave blank (for root domain)
   - Value: Vercel's provided value
   - TTL: 3600 (or default)

   **For Railway (API - optional):**
   - Type: **CNAME**
   - Name: `api` (for api.oskilifts.com)
   - Value: Railway's provided CNAME value
   - TTL: 3600 (or default)

4. Save the DNS records

### 6.5: Update Environment Variables

**In Vercel:**
1. Go to **Settings** → **Environment Variables**
2. Update `EXPO_PUBLIC_OSKILIFTS_API_URL`:
   - If using Railway subdomain: `https://api.oskilifts.com`
   - Or keep Railway's default: `https://oskilifts-production.up.railway.app`
3. Go to **Deployments** → Click **Redeploy** on latest deployment

**In Railway:**
- Ensure all environment variables are set (they should already be configured from Step 3)

### 6.6: Wait for DNS Propagation

- DNS changes can take 24-48 hours to propagate globally
- Usually works within 1-2 hours
- You can check propagation status at https://www.whatsmydns.net

### 6.7: Verify SSL Certificates

- Vercel automatically provisions SSL certificates (HTTPS)
- Railway automatically provisions SSL certificates (HTTPS)
- Both should be active within minutes of DNS propagation

### 6.8: Test Your Custom Domain

1. Visit `https://oskilifts.com` (or your domain)
2. Check browser console for any errors
3. Verify API calls work (test weight room, classes, hoopers features)
4. Test on mobile devices

**Troubleshooting:**
- If domain shows "Not Found": DNS hasn't propagated yet, wait longer
- If SSL error: Wait for SSL certificate provisioning (usually automatic)
- If API calls fail: Check `EXPO_PUBLIC_OSKILIFTS_API_URL` is set correctly in Vercel

---

## Alternative: Quick Local Testing with ngrok

If you just want to test with friends quickly:

1. Install ngrok: `brew install ngrok` or download from https://ngrok.com
2. Start your API: `npm run server`
3. In another terminal: `ngrok http 4000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Add to `.env`: `EXPO_PUBLIC_OSKILIFTS_API_URL=https://abc123.ngrok.io`
6. Start Expo: `npm start`
7. Share the QR code with friends (they need Expo Go app)

