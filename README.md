# web2ad

Forked from `genstock-web` 2026-07-21 - real auth (Supabase), real billing (Stripe), real hosting/image storage (Cloudinary), and the Flux/Recraft reference-conditioning engines all inherited as-is, working. Verified booting clean (`npm run dev`, real 200 response) same night as the fork.

Remote: `https://github.com/jafstar/web2ad.git` (origin set, not yet pushed).

## The real thesis (see memory: project_web2ad_architecture_thesis.md)

Creatify and AdCreate (real competitors, both confirmed ~$40/mo subscription-only, no low-commitment option) are both "one giant prompt to a black-box agent" - you get what the agent decides, no real lever to correct a specific piece. Web2Ad's job is the opposite: expose pieces of the already-built, separately-controllable stack as real tunable controls, not a prompt box.

- **genstock's existing "Stories" mode-switcher** becomes the UI toggle between Photo Editor (genstock's current capability - keep, hide, or upcharge for it) and a new Ad Builder mode.
- **Ad Builder pulls in pieces of `../rescript-studio`** (multi-engine video dispatch: Hailuo default, Veo, Kling) **and `../story-glue`** (script precision, Character/Brand Fixation, the Council pattern) - not full ports, pieces, wired as real configurable controls (persona, setting, cadence, shot type).

## Two real gaps to fix before this is a real product (found live testing the same night)

1. **Atmosphere Fixation (not built yet).** A 3-shot test ad (exterior/interior/product close-up) came out visually inconsistent - each shot generated independently with no shared lighting/weather/mood state. Same category of problem as Character Fixation, different axis. Needs a real constraint/check, likely in whatever script-staging layer Ad Builder uses.
2. **Ad cadence rule (not built yet).** "fixating on one shot for more than 5 sec is stale" - real, ad-specific pacing rule, distinct from the movie pipeline's 10s-per-scene default. A commercial script layer needs its own cadence constraint, not a shared constant with story-glue's movie Council.

## Real, tested unit economics (same night)

A finished ad (keyframe + render + TTS + lip-sync) costs roughly $1-2 in real API spend, confirmed across four real test ads. Target price landed around $10-12/ad, one-time, no subscription - the actual point of difference from Creatify/AdCreate's $39-40/mo floor.

## Not done yet - real work, not scaffolding

- The actual Ad Builder UI/pages don't exist yet - this fork is plumbing only.
- Atmosphere Fixation and the cadence rule (above).
- Wiring rescript-studio/story-glue pieces in as real, callable functions from this app (currently separate local projects, not integrated).
- Payment flow for the new $10-12/ad offering specifically (Stripe is present and working for genstock's existing billing, not yet configured for this new price point).
