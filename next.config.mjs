/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  // ffmpeg-static/ffprobe-static binaries are only referenced by string path
  // (lib/adbuilder/ffmpegBin.js), never a real `require`/`import`, so the
  // serverless output tracer can't auto-detect them and silently drops them
  // - the real cause of production's "spawn ffmpeg ENOENT". ffprobe-static
  // ships every platform's binary unconditionally, so this pins just the
  // linux/x64 one Vercel's build actually runs on instead of dragging in
  // ~270MB of darwin/win32 binaries nobody needs at runtime.
  outputFileTracingIncludes: {
    'app/api/adbuilder/**/*': [
      './node_modules/ffmpeg-static/ffmpeg',
      './node_modules/ffprobe-static/bin/linux/x64/ffprobe',
    ],
  },
}

export default nextConfig
