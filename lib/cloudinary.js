// Images live as Cloudinary URLs, never as base64 blobs in the database —
// the exact lesson from last night's PGlite incident (designpipe-app):
// embedding image bytes directly in a row causes MVCC bloat on every
// unrelated edit. Genstock never had that problem to begin with since
// this is the very first thing wired in, not a retrofit.
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function uploadToCloudinary(dataUrl, folder = 'genstock') {
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: 'image',
  })
  return { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height }
}

// Buffer-based upload for the adbuilder pipeline's video/audio artifacts
// (keyframe renders, narration, music, final exports) - real media files
// too large to round-trip as base64 data URIs the way the image helper
// above does. resource_type 'video' also covers audio-only files
// (mp3/wav) in Cloudinary's own resource typing - there's no separate
// 'audio' type.
export async function uploadBufferToCloudinary(buffer, folder, resourceType = 'video') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) return reject(err)
        resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    stream.end(buffer)
  })
}
