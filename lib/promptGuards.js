// Ported verbatim from designpipe-app/main/promptGuards.js — same real,
// live-found artifacts apply to any of these engines regardless of which
// app calls them: multi-panel/collage tiling on under-constrained prompts,
// Gemini rendering a physical-print white border when the word
// "photograph" is used instead of "image", and (found via genstock's own
// Idea/Critique output) Gemini rendering the whole scene as a 3D canvas
// print mockup on a wall - complete with canvas edge depth and a drop
// shadow - instead of a flat image of the actual scene.
export const SINGLE_IMAGE_SUFFIX = ' — a single image, one continuous scene, no border, no frame, edge-to-edge, not a grid, not a collage, not a diptych, not a contact sheet, not multiple panels, not a canvas print, not a framed print, not wall art, not a product mockup, no drop shadow, no visible canvas or paper edge — the raw scene itself, flat, filling the entire frame'

// Real, live-found problem: Flux and Gemini both get called N times with
// the exact same prompt string when a batch asks for more than one image
// from the same engine, and neither engine has its own per-call diversity
// knob (unlike Recraft's reference strength dial) - whatever seed
// randomness the APIs apply on their own isn't enough to keep repeated
// calls from converging on near-identical compositions. Index 0 stays the
// unmodified "best guess" take; later indices in the same batch get a
// rotating nudge toward a genuinely different interpretation instead.
//
// Real regression, live-caught: the first version of this said "...than a
// typical single shot of this subject would use" - Gemini read "subject"
// as a living subject (portrait-style), not "subject matter," and
// literally invented a cat sitting in an otherwise-empty vineyard path to
// have something to feature at the new angle. Reworded to "scene" (never
// "subject") and added an explicit no-new-elements guard.
const DIVERSITY_HINTS = [
  '',
  ' — try a distinctly different camera angle and framing than a typical single take on this scene, with nothing added to or removed from what is described',
  ' — try a different time of day or lighting mood than a typical single take on this scene, with nothing added to or removed from what is described',
  ' — try a different distance and composition (wide vs. close, centered vs. off-center) than a typical single take on this scene, with nothing added to or removed from what is described',
]

export function diversityHint(index) {
  return DIVERSITY_HINTS[index % DIVERSITY_HINTS.length]
}

// Fx panel's "180 Deg" mode: instead of the generic diversity nudge above,
// index 0 and 1 get an explicit front/back pair of the same subject -
// same guard against inventing new elements, same "scene" (not "subject")
// wording per the cat regression above.
//
// Real regression, live-caught (round 1): the first version only
// constrained camera position, not lighting - front and back came back as
// two different times of day (one dusk/blue-hour, one bright golden)
// since these are separate API calls with no shared context.
//
// Real regression, live-caught (round 2): "same sun position" was itself
// wrong physics - a true 180-degree rotation means the camera now faces
// AWAY from the sun, so if the sun is visible in front, it cannot also be
// visible in back (Recraft and Gemini both kept a visible sun disc in
// both shots). Fixed to the physically correct instruction: same real sun
// (time of day, color temperature, shadow direction all stay consistent),
// but the sun itself is only ever in frame in whichever shot faces toward
// it - the other shot is backlit from the photographer's position instead.
const FRONT_BACK_HINTS = [
  ' — the front view of the scene described, with nothing added to or removed from what is described. Establish the true sun position for this moment (time of day, color, height, and whether the sun disc itself is visible in this framing) — the back view must stay physically consistent with it',
  ' — the exact same scene and moment as the front view, but viewed from directly behind, as if the camera rotated 180 degrees around the scene to face the opposite direction — the back view, with nothing added to or removed from what is described. The camera now faces away from the sun, so if the sun was visible in the front view, it must NOT appear in this shot — it is behind the camera now. Keep the same time of day and warm color temperature, and keep shadows falling in the same real-world direction relative to the ground, but do not show the sun disc if the front view already showed it',
]

export function frontBackHint(index) {
  return FRONT_BACK_HINTS[index % FRONT_BACK_HINTS.length]
}

// Real, live-found problem (web2ad's free-preview ad generator): Flux
// reliably garbles any legible text it's asked to render inside a scene —
// brand names and UI labels come back misspelled ("colony" -> "coloJnny",
// "Cuvver" -> "Cuvvevors"). No text-to-image engine here can be trusted to
// spell a real business's own name correctly, so a scene must never
// depend on legible words, wordmarks, or UI copy to read as intended
// unless a real logo/wordmark image was actually supplied as a reference
// — never invented from a plain text description.
export const NO_TEXT_SUFFIX = ' — no legible text, words, letters, labels, logos, or readable UI anywhere in the image; if a screen, sign, page, or document appears, its content must be abstract/blurred shapes only, never readable words'
