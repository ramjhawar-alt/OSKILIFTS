# Owner checklist (things only you can do)

Tick these off as you go. Claude keeps a copy of this list and will remind you.

## Soon
- [ ] **Turn on auto-renew for `oskilifts.com` at Namecheap.** It expires **Nov 27, 2026**; if it lapses the whole site goes down.
- [ ] **Test the weekly recap email end to end.** Sign up a second account as `ram_jhawar+test@berkeley.edu`, follow your main account from it, turn the recap on in the main account, then GitHub → Actions → "Email jobs" → Run workflow → `weekly-digest`. A recap should arrive in a couple of minutes.
- [ ] **Quick wiring check:** GitHub → Actions → "Email jobs" → Run workflow → `admin-alert`. It should finish green.
- [ ] **Do the full two-account run-through** (checklist below), signed in, on the live site.
- [ ] **Check the Moderation row** shows on your profile (it proves your admin seed worked).
- [ ] **Run `server/tests/security_audit_test.sql` in the Supabase SQL editor after every future migration.** It must finish with no error.

## Before real growth
- [ ] **Have someone read the Terms and Privacy pages** (campus legal clinic or a lawyer friend). They are plain-language drafts, not legal advice.
- [ ] **Decide the support email.** Pages currently use your personal `ram_jhawar@berkeley.edu`; consider `support@oskilifts.com`.
- [ ] **Check Supabase backups** on your plan, and decide whether to upgrade Render so the server doesn't sleep.
- [ ] **Check UC trademark rules** for using "Oski" / "Berkeley" in the app name, icon and marketing (the University licenses its marks).

## Later
- [ ] **Gym-partner finder: do NOT build until the app has 200+ users**, then do a safety review first.
- [ ] Group challenges, routine-from-scratch editor, change a custom exercise's type, CSV export, push notifications (nice-to-haves).

## Two-account run-through (about 15 minutes)
1. Sign up the second account (`ram_jhawar+test@berkeley.edu` works) and confirm the email arrives with a working button.
2. Make your account **Public**; follow it from the second account (instant). Make it **Private** and check "Requested".
3. Log a workout with weights, check the PR badge, tap **Share workout** and download the image.
4. From the second account find your workout in **Explore**, like it and comment. Delete the comment as the owner.
5. Report that comment, then review it under **Moderation** (Dismiss or Delete).
6. Follow each other: check **Heading to the RSF** shows on the other account's Home.
7. **Hoopers:** check in from one account, look for the username on the other, try the Friends toggle.
8. Both accounts join the **leaderboard**; set a **weekly goal**.
9. Turn on **Share when I'm here** at the RSF and check the other account sees you.
10. **Block** the second account and confirm you vanish from each other's feed, lists and search.
11. **Delete** the second account to confirm account deletion works.
