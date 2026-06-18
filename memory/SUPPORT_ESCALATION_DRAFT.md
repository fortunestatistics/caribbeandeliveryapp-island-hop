# Escalation Email Draft — IslandHop Production Login Broken (www→apex bundle mismatch)

**To:** support@emergent.sh
**Subject:** URGENT — Deployed app login broken: production frontend bundle hardcoded to www subdomain (needs apex rebuild)

---

Hi Emergent Support,

Following up on my ticket from yesterday — my deployed app at **islandhopapp.com** still cannot log in, register, or send OTPs. All POST requests fail with "Authentication failed."

My developer has isolated the exact root cause with concrete proof:

1. **Apex backend is HEALTHY:** `POST https://islandhopapp.com/api/auth/login` returns a correct HTTP 401 with JSON `{"detail":"Invalid email or password"}`. CORS is correct.

2. **www subdomain 308-redirects:** `POST https://www.islandhopapp.com/api/auth/login` returns **HTTP 308** redirect to the apex. Browsers do not follow 308 on CORS preflight, so every POST from the live site fails.

3. **The deployed frontend bundle is built with the wrong URL:** The production bundle `/static/js/main.756202a2.js` (served from islandhopapp.com) contains **40 references to `https://www.islandhopapp.com`** and **zero** to the apex `https://islandhopapp.com`. So the live frontend was built with `REACT_APP_BACKEND_URL=https://www.islandhopapp.com`.

**The fix I need from the platform team:**
- Set the canonical domain to the **apex `islandhopapp.com` (no www)**.
- Force a **clean frontend rebuild + redeploy** so the bundle's `REACT_APP_BACKEND_URL` points to the apex `https://islandhopapp.com`.

I cannot edit the deployed build's `REACT_APP_BACKEND_URL` myself (platform-managed), and re-linking the domain + redeploy did NOT regenerate the bundle previously.

**Job/Deployment ID:** [PASTE YOUR DEPLOYMENT/JOB ID HERE]
**Custom domain:** islandhopapp.com
**Urgency:** Live customers cannot sign up or order — revenue-blocking.

Thank you for expediting.
