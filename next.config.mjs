/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  // ffmpeg-static/ffprobe-static's own JS resolves their binary path via
  // `__dirname` internally. Left to webpack, Next bundles that tiny JS file
  // into a .next/server/chunks/*.js chunk, which rewrites/inlines __dirname
  // to the CHUNK's location - so the resolved path became
  // /var/task/.next/server/chunks/ffmpeg instead of the real binary under
  // node_modules/ffmpeg-static/. serverExternalPackages tells Next to leave
  // these as real runtime `require()`s against node_modules instead of
  // bundling them, so their internal path math stays correct.
  // @sparticuz/chromium (lib/adbuilder/htmlTextRenderer.js) resolves its
  // own bundled binaries via `import.meta.url`-relative paths internally -
  // the exact same pattern that broke ffmpeg-static's `__dirname`
  // resolution once webpack bundled it into a chunk (see the ENOENT saga
  // this session already lived through). Same fix, same reason: leave it
  // as a real runtime require/import against node_modules instead.
  serverExternalPackages: ['ffmpeg-static', 'ffprobe-static', '@sparticuz/chromium'],
  // The binaries themselves are only ever referenced by string path, never
  // a real `require`/`import` target, so the serverless output tracer
  // can't auto-detect them and silently drops them from the deployed
  // function - ffprobe-static ships every platform's binary unconditionally,
  // so this pins just the linux/x64 one Vercel's build actually runs on
  // instead of dragging in ~270MB of unused ones. @sparticuz/chromium's
  // .br files are its actual compressed Chromium/fonts/swiftshader payload.
  outputFileTracingIncludes: {
    'app/api/adbuilder/**/*': [
      './node_modules/ffmpeg-static/ffmpeg',
      './node_modules/ffprobe-static/bin/linux/x64/ffprobe',
      './node_modules/@sparticuz/chromium/bin/*.br',
    ],
  },
}

export default nextConfig
