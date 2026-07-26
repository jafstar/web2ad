// Serverless adaptation of story-glue's htmlTextRenderer.js - same real
// approach (actual HTML/CSS, real fonts, Animate.css kinetic effects,
// frame-by-frame transparent capture via deterministic Web Animations API
// scrubbing so there's no timing drift from screenshot I/O), just launched
// via @sparticuz/chromium's serverless-packaged Chromium + playwright-core
// instead of story-glue's locally-installed `playwright` browser (which
// has no binary at all inside a Vercel function).
import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'

async function launchServerlessBrowser() {
  return playwrightChromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}

function buildPage(bodyHtml, extraCss, width, height) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${width}px;height:${height}px;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;}
${extraCss || ''}
</style></head><body>${bodyHtml}</body></html>`
}

// Renders a single transparent-background PNG of the given HTML at a
// specific animation timestamp (or the settled end state if omitted) -
// the real feasibility/smoke-test shape; renderTextFrames below is the
// full multi-frame version for actually compositing an animated outro.
export async function renderTextFrame({ bodyHtml, extraCss = '', width = 1024, height = 1024, atMs = null, omitBackground = true }) {
  const browser = await launchServerlessBrowser()
  try {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.setContent(buildPage(bodyHtml, extraCss, width, height))
    if (atMs !== null) {
      await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()))
      await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t }), atMs)
    }
    const buf = await page.screenshot({ omitBackground })
    return `data:image/png;base64,${buf.toString('base64')}`
  } finally {
    await browser.close()
  }
}

// Full version - renders `durationSeconds` of the page at `fps`, one PNG
// per frame, for real video compositing. omitBackground=true (default)
// captures a transparent PNG for overlaying onto other footage;
// omitBackground=false bakes in whatever CSS background the page itself
// sets (extraCss's own html/body background rule wins by source order),
// producing a fully opaque, self-contained frame - what a standalone
// outro/end card needs, since it isn't overlaid onto anything.
export async function renderTextFrames({ bodyHtml, extraCss = '', width = 1024, height = 1024, durationSeconds, fps = 25, omitBackground = true }) {
  const browser = await launchServerlessBrowser()
  try {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.setContent(buildPage(bodyHtml, extraCss, width, height))
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()))

    const frameCount = Math.round(durationSeconds * fps)
    const frameMs = 1000 / fps
    const frames = []
    for (let i = 0; i < frameCount; i++) {
      const targetMs = i * frameMs
      await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t }), targetMs)
      const buf = await page.screenshot({ omitBackground })
      frames.push(buf)
    }
    return frames
  } finally {
    await browser.close()
  }
}
