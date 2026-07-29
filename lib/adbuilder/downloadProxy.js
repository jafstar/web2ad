// Real fix for "Download" buttons navigating the current tab to the raw
// video instead of saving it: the `download` attribute on an <a> tag is
// silently ignored by every browser once the href is cross-origin (our
// videos live on Cloudinary, not this site) - there is no way to force a
// cross-origin download from a plain anchor tag. Streaming the file back
// through our own origin with a real Content-Disposition: attachment
// header is the only way that actually works.
//
// Only ever fetches Cloudinary's own hosting domain - this function
// fetches whatever URL it's handed, so anything looser here would be a
// real open-proxy/SSRF hole.
const ALLOWED_HOST_SUFFIX = '.cloudinary.com'

export function isAllowedDownloadUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)
  } catch {
    return false
  }
}

export async function proxyDownload(url, filename) {
  if (!isAllowedDownloadUrl(url)) {
    return Response.json({ error: 'URL not allowed' }, { status: 400 })
  }
  const upstream = await fetch(url)
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: 'Could not fetch that file' }, { status: 502 })
  }
  const safeName = (filename || 'ad.mp4').replace(/[^a-zA-Z0-9._-]/g, '_')
  const headers = {
    'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
    'Content-Disposition': `attachment; filename="${safeName}"`,
  }
  const len = upstream.headers.get('content-length')
  if (len) headers['Content-Length'] = len
  return new Response(upstream.body, { headers })
}
