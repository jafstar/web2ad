// Real product moat, not just prompt polish: AI-generated human faces
// destroy trust for certain businesses (a fake doctor, a fake lawyer's
// handshake) in a way that just doesn't apply to others (a cheesesteak
// shop). Rather than leaving that judgment to chance per-generation, the
// business's industry gets classified once during ingest and drives
// concrete, precise defaults downstream - shot framing (shots.js) and how
// broadly tone is allowed to swing (story.js). This is a STRONG DEFAULT,
// not a hard wall - explicit options passed by a caller always win, so a
// user can still knowingly pick people-framing for a medical clinic if
// they want to. See project memory for the "why this is the real moat"
// framing (2026-07-26).
export const VERTICALS = ['high-trust', 'food', 'tech', 'home-services', 'general']

export const VERTICAL_CONSTRAINTS = {
  'high-trust': {
    label: 'High-Trust Professional (medical / legal / financial)',
    suggestedFraming: 'objects',
    // Real, live-caught failure this tightens: the softer first version
    // ("never depend on a face carrying the shot") still let a shot
    // through describing "a doctor sits attentively, watching" - no face
    // was explicitly mentioned, but a doctor was written in as a present,
    // attentive character, which risks Flux rendering one anyway. AI video
    // needs enforceable direction, not a vibe - see the bear-spray
    // spokesperson result (precise model/delivery choices measured a real
    // 8.5-9/10 vs 6.5/10 quality gap). This version bans the CHARACTER
    // outright, with a concrete substitution move instead of a soft
    // preference, and explicitly guards against collapsing into a static
    // slideshow (narration over one repeated object) in the process of
    // avoiding faces - real camera/scene variety is still required.
    visualGuidance: `This is a high-trust professional business (medical, legal, financial, or similar). AI-generated human faces destroy credibility here - this is a hard rule, not a preference. NEVER describe a doctor, lawyer, patient, client, or any other person as a character present in a shot, even off to the side, even "attentive," even without naming a face - if a moment seems to need a professional's presence, substitute a real object/environment stand-in instead (a stethoscope on a desk instead of a doctor holding it, a closing exam-room door instead of a doctor entering, a pen signing a document instead of a lawyer at a desk). A bodiless hand or footsteps is the one allowed exception, and only when it's clearly the AD'S OWN protagonist, never a professional. This overrides any earlier instruction about showing a face "when the beat genuinely cannot work without one" - for this business, no beat needs one; find the object substitute instead. Do not solve this by making every shot a static single object either - that reads as a narrated slideshow, which defeats the point. Vary camera distance and movement (macro close-up, slow push-in, a pan across a room, a rack focus) and vary the SUBJECT across shots (different objects, different rooms, different times of day within the locked atmosphere) so the sequence still feels like real cinematography, just one with zero people in it.`,
    toneRegisterNote: `This is a high-trust professional business - even in a lighter tone, keep the register understated, dry, and dignified rather than broad or slapstick. Any humor should come from restrained wit, not exaggerated performance - a business that sells invisible expertise loses credibility if the ad looks like it's trying too hard to be funny.`,
  },
  food: {
    label: 'Food & Beverage / Hospitality',
    suggestedFraming: 'objects',
    visualGuidance: `Favor macro, tactile, high-contrast shots - steam, dripping sauce, glistening surfaces, close-ups on the food and its preparation - over wide shots of people eating or crowded dining rooms, which AI video renders awkwardly (chewing, crowd physics).`,
    toneRegisterNote: null,
  },
  tech: {
    label: 'Software / B2B',
    suggestedFraming: 'objects',
    visualGuidance: `Favor abstract mechanics, kinetic typography, and clean geometric/isometric visuals over literal shots of people at laptops or on-screen code, which AI video renders unconvincingly. Represent speed, security, or scale through abstract motion rather than literal office imagery.`,
    toneRegisterNote: null,
  },
  'home-services': {
    label: 'Home Services (pest control / HVAC / roofing / etc.)',
    suggestedFraming: 'objects',
    visualGuidance: `Show the fix, not a generic worker - frost forming on a vent, a wrench catching light, a clean bead of caulk being applied, a pest disappearing. Object/tool-centric macro shots read as more credible than a generated technician's face or an unnatural pose.`,
    toneRegisterNote: null,
  },
  general: {
    label: 'General / Other',
    suggestedFraming: 'balanced',
    visualGuidance: null,
    toneRegisterNote: null,
  },
}

export function verticalConstraints(vertical) {
  return VERTICAL_CONSTRAINTS[vertical] || VERTICAL_CONSTRAINTS.general
}
