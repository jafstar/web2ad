// Real production bug this fixes: every ffmpeg/ffprobe call site in this
// directory used to spawn the literal command name ('ffmpeg', 'ffprobe'),
// relying on it being present on PATH. That's true on a dev machine but
// not in Vercel's serverless function containers - every export/music call
// failed there with "spawn ffmpeg ENOENT". ffmpeg-static/ffprobe-static
// bundle real platform binaries into node_modules instead; see
// next.config.js's outputFileTracingIncludes for why the binaries survive
// Vercel's function-bundling step (they're referenced only by string path
// here, so its tracer can't auto-detect them the way it does real imports).
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

export const FFMPEG_PATH = ffmpegPath
export const FFPROBE_PATH = ffprobeStatic.path
