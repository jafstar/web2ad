// Real music reference search for the Genmercial music-generation step -
// browse actual existing tracks (iTunes Search API: free, no auth/API
// key needed, real 30s preview clips) to find a concrete reference
// before writing a generation prompt, instead of guessing at adjectives
// from scratch (the real pain point tonight - SNAKZ took 4 music
// iterations, DMV took 3, purely from imprecise word descriptions).
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

export async function searchReferenceTracks(term, { limit = 10, genre } = {}) {
  const params = new URLSearchParams({ term, media: 'music', entity: 'song', limit: String(limit) })
  const res = await fetch(`${ITUNES_SEARCH_URL}?${params}`)
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`)
  const data = await res.json()
  return data.results
    .filter((r) => r.previewUrl)
    .filter((r) => !genre || r.primaryGenreName?.toLowerCase().includes(genre.toLowerCase()))
    .map((r) => ({
      artist: r.artistName,
      track: r.trackName,
      genre: r.primaryGenreName,
      releaseDate: r.releaseDate,
      previewUrl: r.previewUrl, // real 30s m4a preview, no auth needed
      artworkUrl: r.artworkUrl100,
    }))
}

export async function downloadPreview(previewUrl, outPath) {
  const res = await fetch(previewUrl)
  if (!res.ok) throw new Error(`Preview download failed: ${res.status}`)
  const fs = await import('fs')
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()))
  return outPath
}
