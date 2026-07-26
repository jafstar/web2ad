// Next.js's own compiled ua-parser-js (node_modules/next/dist/compiled/ua-parser-js/ua-parser.js)
// unconditionally does `__nccwpck_require__.ab = __dirname + "/"` at module-load time.
// __dirname doesn't exist in Vercel's edge V8-isolate runtime, so importing next/server
// anywhere reachable from middleware.js throws `ReferenceError: __dirname is not defined`
// on every request in production (confirmed via `vercel build --prod` + inspecting the real
// .vercel/output/functions/middleware.func bundle, then narrowing with a grep sweep of every
// package in that function's node_modules). Not fixed by upgrading to next@15.5.22 (latest
// stable patch as of this writing) - same line, unchanged. Patched post-install since we can't
// edit node_modules directly (wiped on every install, including Vercel's build-time install).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, '..', 'node_modules', 'next', 'dist', 'compiled', 'ua-parser-js', 'ua-parser.js')

const BROKEN = 'if(typeof __nccwpck_require__!=="undefined")__nccwpck_require__.ab=__dirname+"/";'
const FIXED = 'if(typeof __nccwpck_require__!=="undefined"&&typeof __dirname!=="undefined")__nccwpck_require__.ab=__dirname+"/";'

let src
try {
  src = readFileSync(target, 'utf8')
} catch {
  process.exit(0) // next not installed yet / different layout - nothing to patch
}

if (src.includes(BROKEN)) {
  writeFileSync(target, src.replace(BROKEN, FIXED))
  console.log('[patch-edge-dirname] patched next/dist/compiled/ua-parser-js/ua-parser.js')
} else if (src.includes(FIXED)) {
  console.log('[patch-edge-dirname] already patched')
} else {
  console.warn('[patch-edge-dirname] expected __dirname pattern not found - next version may have changed this file, skipping')
}
