# Deploying Bimah to Vercel (bethchaim.bimah.org)

## Quick Start Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel project created and linked to GitHub repo
- [ ] Environment variable `BIMAH_PASSCODE` set in Vercel
- [ ] Initial deployment successful
- [ ] Custom domain `bethchaim.bimah.org` added in Vercel
- [ ] CNAME record added in Namecheap DNS
- [ ] SSL certificate provisioned (automatic)
- [ ] Site accessible at https://bethchaim.bimah.org

## Detailed Steps

### 1. Push to GitHub

Ensure your latest code is committed and pushed:

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 2. Create Vercel Project

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Select your `bimah-bc` repository
4. Configure settings (defaults are fine):
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

### 3. Set Environment Variable

Before deploying, add the environment variable:

1. In Vercel project settings, go to "Environment Variables"
2. Add:
   - **Name**: `BIMAH_PASSCODE`
   - **Value**: Your secure passcode (same as in `.env.local`)
   - **Environment**: Production, Preview, Development (all three)

### 4. Deploy

Click "Deploy" button. Wait for build to complete (~2-3 minutes).

Your site will be live at: `https://[your-project-name].vercel.app`

### 5. Add Custom Domain

#### In Vercel Dashboard:

1. Go to your project → Settings → Domains
2. Click "Add Domain"
3. Enter: `bethchaim.bimah.org`
4. Vercel will show you DNS configuration needed

You'll see something like:
```
Type: CNAME
Name: bethchaim
Value: cname.vercel-dns.com.
```

#### In Namecheap Dashboard:

1. Log in to https://www.namecheap.com
2. Go to "Domain List"
3. Click "Manage" next to `bimah.org`
4. Go to "Advanced DNS" tab
5. Click "Add New Record"
6. Configure:
   - **Type**: CNAME Record
   - **Host**: `bethchaim`
   - **Value**: `cname.vercel-dns.com.` (exactly as Vercel shows)
   - **TTL**: Automatic (or 1 min for faster propagation during setup)
7. Click the green checkmark to save

### 6. Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours
- Usually propagates within 10-30 minutes
- Check status at: https://dnschecker.org/#CNAME/bethchaim.bimah.org

### 7. SSL Certificate

Vercel automatically provisions a Let's Encrypt SSL certificate once DNS is validated.

You'll see in Vercel dashboard:
- ⏳ "Certificate Pending" → 🔒 "Certificate Valid"

### 8. Test Your Site

Visit: https://bethchaim.bimah.org

1. You should see the passcode entry page
2. Enter your passcode
3. Upload a test CSV/Excel file
4. Verify analytics work correctly
5. Check that data stays local (use browser DevTools → Network tab to verify no pledge data is uploaded)

## Troubleshooting

### Domain not working after 24 hours

Check DNS records:
```bash
dig bethchaim.bimah.org CNAME
```

Should show: `bethchaim.bimah.org. 300 IN CNAME cname.vercel-dns.com.`

### SSL Certificate not provisioning

1. Verify DNS is correct
2. Remove and re-add domain in Vercel
3. Wait another hour

### Build fails on Vercel

Check the build logs in Vercel dashboard. Common issues:
- Missing dependencies: run `npm install` locally first
- TypeScript errors: run `npm run build` locally to catch them
- Environment variables not set

### Passcode not working

1. Verify `BIMAH_PASSCODE` is set in Vercel environment variables
2. Redeploy the project after adding the variable
3. Clear browser cookies and try again

## Security Notes

### What's Sent to Server
- ✅ Passcode during login (encrypted via HTTPS)
- ✅ Standard HTTP headers

### What's NOT Sent to Server
- ❌ Excel/CSV files
- ❌ Pledge amounts or any financial data
- ❌ Names or identifying information
- ❌ Analytics or tracking data

All pledge data processing happens in the browser using client-side JavaScript.

## Monitoring

### Vercel Analytics (Optional)

Vercel provides basic analytics (page views, etc.) that don't violate privacy:
1. Go to project settings → Analytics
2. Enable Web Analytics
3. This only tracks aggregate pageviews, not user data

### Environment Variables

To update the passcode:
1. Go to Vercel project settings → Environment Variables
2. Edit `BIMAH_PASSCODE`
3. Redeploy the project (or wait for next git push)

## Updating the Site

### Automatic Deployments

Every git push to `main` automatically triggers a new deployment:

```bash
git add .
git commit -m "Update feature X"
git push origin main
```

Vercel will:
1. Detect the push
2. Build the new version
3. Deploy to production
4. Keep previous version as backup

### Preview Deployments

Vercel creates preview URLs for:
- Every pull request
- Every branch push

These are useful for testing before merging to main.

## Cost

- Vercel Hobby (Free) tier is sufficient for this use case
- Includes:
  - Unlimited bandwidth for non-commercial projects
  - 100 GB bandwidth/month for commercial
  - Free SSL
  - Automatic deployments
  - Preview deployments

For Beth Chaim, the free tier should be more than adequate.

## Support

- Vercel documentation: https://vercel.com/docs
- DNS help: https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/
- Project issues: https://github.com/tavinathanson/bimah-bc/issues
