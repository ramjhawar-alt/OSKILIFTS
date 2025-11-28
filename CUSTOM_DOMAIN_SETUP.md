# Custom Domain Setup Guide

Follow these steps to connect your purchased domain to your Vercel deployment.

## Step 1: Add Domain in Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your **OSKILIFTS** project
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter your domain (e.g., `oskilifts.com` or `www.oskilifts.com`)
6. Click **Add**

## Step 2: Configure DNS Records

Vercel will show you the DNS records you need to add. You'll need to add these at your domain registrar (where you bought the domain - Namecheap, Google Domains, Cloudflare, etc.).

### For Root Domain (e.g., oskilifts.com):

**Option A: A Record (Recommended)**
- **Type:** A
- **Name:** @ (or leave blank, depending on your registrar)
- **Value:** Vercel's IP address (Vercel will show you this, usually `76.76.21.21`)
- **TTL:** 3600 (or default)

**Option B: CNAME Record**
- **Type:** CNAME
- **Name:** @ (or leave blank)
- **Value:** `cname.vercel-dns.com`
- **TTL:** 3600 (or default)

### For WWW Subdomain (e.g., www.oskilifts.com):

- **Type:** CNAME
- **Name:** www
- **Value:** `cname.vercel-dns.com`
- **TTL:** 3600 (or default)

**Note:** Some registrars don't support CNAME for root domains. If that's the case, use Option A (A Record) for the root domain.

## Step 3: Wait for DNS Propagation

- DNS changes can take **5 minutes to 48 hours** to propagate
- Usually it's much faster (5-30 minutes)
- You can check propagation status at: https://www.whatsmydns.net

## Step 4: Verify Domain in Vercel

1. Go back to Vercel → Your Project → Settings → Domains
2. Wait for the domain status to show **Valid Configuration**
3. Vercel will automatically issue an SSL certificate (this may take a few minutes)

## Step 5: Update Environment Variables (Optional)

If you want to use a custom API subdomain (e.g., `api.oskilifts.com`), you can:

1. Set up a subdomain in Render for your API
2. Update the `EXPO_PUBLIC_OSKILIFTS_API_URL` in Vercel to point to your custom API domain

Otherwise, the app will continue using `https://oskilifts.onrender.com` for the API, which is fine.

## Step 6: Test Your Domain

Once DNS has propagated and Vercel shows the domain as active:

1. Visit your custom domain (e.g., `https://oskilifts.com`)
2. The site should load exactly like your Vercel deployment
3. All API calls should work (they'll go to Render)

## Troubleshooting

**Domain not working?**
- Check DNS propagation: https://www.whatsmydns.net
- Make sure DNS records are correct (check for typos)
- Wait a bit longer - DNS can be slow sometimes
- Check Vercel dashboard for any error messages

**SSL Certificate issues?**
- Vercel automatically provisions SSL certificates
- Wait 5-10 minutes after domain is verified
- If issues persist, check Vercel's domain status page

**API calls failing?**
- The Render API server already allows all HTTPS domains (including your custom domain)
- Make sure your Render API is running
- Check browser console for specific errors

## Common Domain Registrars

### Namecheap
1. Go to Domain List → Manage → Advanced DNS
2. Add the records shown in Vercel

### Google Domains / Squarespace Domains
1. Go to DNS Settings
2. Add the records shown in Vercel

### Cloudflare
1. Go to DNS → Records
2. Add the records shown in Vercel
3. Make sure proxy is OFF (gray cloud) for initial setup

### GoDaddy
1. Go to DNS Management
2. Add the records shown in Vercel

---

**That's it!** Once DNS propagates, your custom domain will be live and working with your OSKILIFTS app.

