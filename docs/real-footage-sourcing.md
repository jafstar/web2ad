# Real footage sourcing — Google Reviews investigation

Follow-up to the 2026-07-26 conversation: after seeing the beat pipeline's
AI-generated imagery ("isn't usable... gives the idea of what they could or
should do"), the idea was raised to pull real photos of a business (e.g.
from their Google reviews) and use those as reference/transformation input
instead of pure text-to-image generation.

**Bottom line up front: don't pull Google review photos, via the API or by
scraping. It's a real ToS violation on top of a separate copyright/consent
problem. Use business-uploaded photos instead — see "Recommended path."**

## What's technically available

Google's Places API (New) has a Place Photos endpoint that returns photo
references for a place, including some user-submitted (reviewer) photos
alongside owner-uploaded ones. You request a `photo_reference` and Google
serves the image live — there's no bulk-download endpoint, and the
reference itself can expire.

## Why this is a real blocker, not just red tape

1. **No caching / no storing.** The Google Maps Platform Terms of Service
   (Service Specific Terms, "No Caching" clause) prohibit storing Places
   API content — photos included — beyond narrow, short-lived display
   exceptions. Place IDs are explicitly exempted from this; photos are not.
   Feeding a fetched photo into a generation pipeline and persisting the
   result (or even holding the source image in memory for a Flux
   reference-conditioning call) is exactly the kind of reuse this clause
   exists to block.
2. **No scraping.** Separately, the ToS prohibits scraping Google Maps
   Content outright. Pulling review photos off the rendered Maps/reviews
   page (rather than the official API) is unambiguously against the rules,
   with real enforcement risk (Google actively detects and blocks scraping
   traffic, and terminates API keys/accounts for ToS violations).
3. **Mandatory attribution.** Any permitted display of Places photos
   requires visible author attribution (avatar, name, profile link) and a
   link back to the source on Google Maps — attribution that has no
   natural place in a generated video ad, which is itself a sign this
   content isn't meant to be repurposed this way.
4. **A separate problem underneath Google's rules: whose photo is it?**
   Reviewer-submitted photos are taken and owned by the reviewer, not the
   business and not Google. Google's API terms only govern *our* right to
   fetch/display them via the API — they don't grant *us*, or the
   business, any license to reuse a stranger's photo as source material for
   a paid commercial. Reviewer photos also often include bystanders' faces,
   which raises its own right-of-publicity/privacy exposure independent of
   copyright. This problem exists even if Google's ToS didn't.

Put together: this isn't a "find a clever workaround" situation. Both the
platform-terms layer and the underlying ownership layer say no.

## Recommended path: business-uploaded photos

This is the version of the idea that's actually clean, and it's already
partially adjacent to what this codebase does today:

- `generateFlux(prompt, w, h, referenceImageDataUrl, mode)` in
  `lib/engines/flux.js` already supports reference-conditioned generation
  (`'exact'` / `'similar'` / `'category'` modes) — used today for keyframe
  continuity in `lib/adbuilder/shots.js`. The missing piece isn't the
  generation call, it's a real upload flow that lets a business owner
  supply their OWN photos (their food, their space, their staff) as that
  reference input, with unambiguous ownership.
- Still photos are the tractable version of this. Video-to-video AI
  restyling of an uploaded clip is a real, separate R&D problem — image
  reference-conditioning is mature, video restyling much less so (flagged
  already in this session's earlier discussion).

## If someone still wants Google review photos for pure human inspiration

A narrower pattern that's arguably closer to compliant — live-fetch a
place's photos via the official API purely for a human (the business
owner, during onboarding) to glance at as creative reference, never stored,
never passed to a generation model, always shown with real attribution —
might be defensible, but it still needs real legal review before building
anything, not just this doc's read of public ToS summaries. Not recommended
as a starting point given the recommended path above is both simpler and
has no such open question.

## Next step

Scope a real "upload your own photos" step into the v2 flow (where in the
3-step funnel it'd live, what business-side UI it needs, how it feeds
`generateFlux`'s existing reference modes) — this is the one worth
building.

---
*Research done 2026-07-26 via Google's own developer docs and the Google
Maps Platform Service Specific Terms; not a substitute for actual legal
review before shipping anything that touches this.*
