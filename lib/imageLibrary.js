// Real counterpart to designpipe-app's renderer/lib/imageLibrary.js —
// same two function names/signatures so RoundThumbGrid.jsx/
// LightboxSection.jsx/ExportSection.jsx port with identical import
// lines. Simpler here than DesignPipe's version: gallery items carry a
// real Cloudinary `url` directly (no dp-img:// protocol/local file path
// concept needed), so imageSrc is just a straight passthrough.
export function imageSrc(item) {
  return item?.url || item?.dataUrl || ''
}

// The few spots (export upscale, send-to-Intake) that need actual bytes
// rather than just a displayable src — fetches the Cloudinary URL and
// converts to a data URL client-side.
export async function resolveDataUrl(item) {
  if (item?.dataUrl) return item.dataUrl
  if (!item?.url) throw new Error('resolveDataUrl: item has neither dataUrl nor url')

  const res = await fetch(item.url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
