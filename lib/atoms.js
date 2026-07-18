import { atom } from 'jotai'

// Ported from designpipe-app/renderer/lib/atoms.js — genstock is
// Photos-only (no Web pipeline), so showMoodControlsAtom's
// color/typography/grid gating doesn't apply here and was dropped.
export const activeProjectIdAtom = atom(null)
export const sectionAtom = atom('overview')

// Generation state lives here, not component-local — a generation
// kicked off from Intake needs to stream into Critique after navigating
// away. generationProjectIdAtom is the real fix for a live-caught
// cross-project bleed bug: an in-flight generation keeps landing results
// after the user switches projects, and this tag is what lets Critique's
// save effect refuse to attribute late results to the wrong project.
export const generationResultsAtom = atom([])
export const generationProgressAtom = atom(null)
export const generationBusyAtom = atom(false)
export const generationErrorAtom = atom(null)
export const generationProjectIdAtom = atom(null)

// Fx panel (Intake) and GenerateVariations (Intake's right panel) are
// siblings, not parent/child - this is the shared toggle state for the
// "180 Deg" front/back mode, read by both.
export const fx180Atom = atom(false)
