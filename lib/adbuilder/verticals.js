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
    visualGuidance: `This is a high-trust professional business (medical, legal, financial, or similar). AI-generated human faces destroy credibility here - never depend on a generated doctor, lawyer, patient, or client's face or expression carrying the shot. Ground every shot in environment, architecture, light, and objects instead: a quiet waiting room, morning light through a window, a heavy oak desk, a fountain pen resting on parchment, a clean glass surface, a closing door. Faceless human intent (a hand, footsteps, a silhouette) is fine; a rendered face performing an emotion is not.`,
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
