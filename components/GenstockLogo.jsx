'use client'

// Web2Ad's real mark, made in Gemini 2026-07-25 — a "<" code bracket into
// a "▷" play triangle into a ">" bracket: code becomes video. Replaces the
// leftover genstock shutter/aperture icon this fork was still showing on
// both the marketing header and the /app dashboard. Component name kept
// as-is (not renamed) since app/app/HomeShell.jsx also imports it.
export default function GenstockLogo({ size = 40 }) {
  return (
    <img
      src="/logo-web2ad.png"
      alt="Web2Ad"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  )
}
