import { createClient } from '../../../../../lib/supabase/server'
import { renderTextFrame } from '../../../../../lib/adbuilder/htmlTextRenderer.js'

// Real feasibility smoke test for @sparticuz/chromium + playwright-core
// running in an actual Vercel serverless function - local Windows dev
// can't validate this (the package ships an Amazon-Linux-built binary),
// so this has to be checked against the real deployment. Not wired into
// any real feature yet; proves the mechanism before the outro-card
// feature gets built on top of it.
export const maxDuration = 60

export async function POST(req) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 })

    const start = Date.now()
    const imageDataUrl = await renderTextFrame({
      bodyHtml: `<div style="text-align:center;color:#f4ede1;">
        <div style="font-family:Georgia,serif;font-size:64px;font-weight:700;letter-spacing:2px;text-shadow:0 4px 12px rgba(0,0,0,0.6);">MIDWOOD SMOKEHOUSE</div>
        <div style="font-family:Arial,sans-serif;font-size:28px;margin-top:16px;color:#e8a852;">Call (704) 555-0142</div>
      </div>`,
      width: 1024,
      height: 1024,
    })
    return Response.json({ imageDataUrl, renderMs: Date.now() - start })
  } catch (e) {
    console.error('adbuilder/playground/textrender failed:', e)
    return Response.json({ error: e.message || 'Text render failed', stack: e.stack }, { status: 500 })
  }
}
