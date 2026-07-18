'use client'

// Real transfer mechanism for "develop in DesignPipe, dump it into
// GenStock": DesignPipe's Photos components all talk through
// `window.ipc.invoke('channel', ...args)` (Electron IPC to main/db.js,
// main/imageGen.js, etc.). This shim implements the SAME call shape
// against GenStock's real backend (Supabase + credits + Cloudinary +
// operator-owned keys), so ported component code doesn't need its
// data-calling lines rewritten — only this map grows when a new channel
// shows up in something newly ported over.
//
// Two real, structural differences DesignPipe components never have to
// think about, both handled inside this shim:
// - settings:getXKey always resolves truthy — GenStock has no BYOK UI,
//   the operator's own keys back every engine, so nothing ever "locks."
// - images:saveToDisk/exportBatch trigger real browser downloads instead
//   of a native Save dialog — the actual bytes still end up on the
//   user's machine, just via a different OS-level mechanism.

async function api(path, options) {
  const res = await fetch(path, {
    method: options?.method || 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `${path} failed (${res.status})`)
  return data
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const HANDLERS = {
  'projects:list': () => api('/api/projects'),
  'projects:get': (id) => api(`/api/projects/${id}`),
  'projects:create': (name, projectType) => api('/api/projects', { method: 'POST', body: { name, projectType } }),
  'projects:updateData': (id, data) => api(`/api/projects/${id}`, { method: 'PATCH', body: { data } }),
  'projects:rename': (id, name) => api(`/api/projects/${id}`, { method: 'PATCH', body: { name } }),
  'projects:delete': (id) => api(`/api/projects/${id}`, { method: 'DELETE' }),

  // Real counterpart to designpipe-app's always-unlimited stub (that app
  // is BYOK, no ceiling to enforce) — same channel/shape, ported
  // GenerateVariations.jsx code calls this identically in both apps,
  // only the two handler implementations differ.
  'credits:check': (cost) => api(`/api/credits/check?cost=${cost}`),

  // No BYOK in GenStock — every engine is always "unlocked." Real key
  // presence/absence lives entirely server-side in env vars.
  'settings:getBflKey': () => Promise.resolve('operator-managed'),
  'settings:getRecraftKey': () => Promise.resolve('operator-managed'),
  'settings:getAnthropicKey': () => Promise.resolve('operator-managed'),
  'settings:getGeminiKey': () => Promise.resolve('operator-managed'),
  'settings:getCallCounts': () => Promise.resolve({}),

  'images:describePhoto': (dataUrl) => api('/api/describe-photo', { method: 'POST', body: { dataUrl } }).then((r) => r.presets),
  'images:generateBatch': (params) => api('/api/generate', { method: 'POST', body: params }).then((r) => r.results),
  'images:upscale': (dataUrl, mode) => api('/api/upscale', { method: 'POST', body: { dataUrl, mode } }).then((r) => r.dataUrl),
  'images:generateReference': (description) => api('/api/generate-reference', { method: 'POST', body: { description } }).then((r) => r.dataUrl),
  'images:generateStoryBatch': (params) => api('/api/generate-story', { method: 'POST', body: params }).then((r) => r.results),

  'images:saveToDisk': async (dataUrl, suggestedName) => {
    downloadDataUrl(dataUrl, suggestedName || 'genstock-export.png')
    return { saved: true }
  },
  'images:exportBatch': async (images) => {
    for (const { dataUrl, filename } of images) {
      downloadDataUrl(dataUrl, filename)
      await new Promise((r) => setTimeout(r, 150)) // browsers throttle rapid-fire downloads
    }
    return { saved: true, count: images.length }
  },
}

export function installIpcShim() {
  if (typeof window === 'undefined' || window.ipc) return
  window.ipc = {
    invoke: (channel, ...args) => {
      const handler = HANDLERS[channel]
      if (!handler) return Promise.reject(new Error(`ipcShim: no handler for channel "${channel}"`))
      return handler(...args)
    },
    on: () => () => {}, // designpipe-app's live progress events don't apply here — generate() resolves with final results, no streaming
  }
}
