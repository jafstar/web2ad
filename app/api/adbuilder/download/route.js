import { proxyDownload } from '../../../../lib/adbuilder/downloadProxy.js'

// Streaming pass-through, not CPU-bound - 60s is generous headroom for
// even a slow client connection on a real ad-length video.
export const maxDuration = 60

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const name = searchParams.get('name') || 'ad.mp4'
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 })
  return proxyDownload(url, name)
}
