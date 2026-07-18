'use client'

// Genstock's real mark — a Recraft-generated shutter/aperture icon
// (blue-to-purple gradient, dissolving into pixel fragments), replacing
// the placeholder "GS" monogram. Background-removed via Recraft's
// removeBackground API for a true alpha channel (public/logo-icon.png).
export default function GenstockLogo({ size = 40 }) {
  return (
    <img
      src="/logo-icon.png"
      alt="genstock"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  )
}
