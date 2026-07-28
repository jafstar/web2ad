'use client'

import { useEffect, useRef, useState } from 'react'

// The "fake video player" - real stills + real narration + real music,
// scheduled client-side to play back in sync, no actual video file
// involved. Uses the EXACT same cumulative-timing math composeBeatAd
// uses server-side for the real compositor (each beat's shot begins at
// the running total of prior beats' targetDuration; its narration
// starts LEAD_IN_SECONDS after that) so what plays here is genuinely the
// real ad's pacing, not an approximation of it.
const LEAD_IN_SECONDS = 0.15

export default function StoryboardPlayer({ beats, musicDataUrl, totalDuration }) {
  const [playing, setPlaying] = useState(false)
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0)
  const [progress, setProgress] = useState(0) // 0-1
  const musicRef = useRef(null)
  const narrationRefs = useRef({})
  const timersRef = useRef([])
  const rafRef = useRef(null)
  const startedAtRef = useRef(null)

  function clearAllTimers() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  function stop() {
    clearAllTimers()
    setPlaying(false)
    setProgress(0)
    setCurrentBeatIndex(0)
    if (musicRef.current) { musicRef.current.pause(); musicRef.current.currentTime = 0; musicRef.current.volume = 0.3 }
    Object.values(narrationRefs.current).forEach((a) => { if (a) { a.pause(); a.currentTime = 0 } })
  }

  function play() {
    clearAllTimers()
    setPlaying(true)
    setCurrentBeatIndex(0)
    setProgress(0)
    startedAtRef.current = performance.now()

    // Music starts immediately - this call, inside the click handler,
    // is what satisfies the browser's autoplay-needs-a-user-gesture
    // requirement for every later scheduled play() call in this cycle.
    if (musicRef.current) {
      musicRef.current.currentTime = 0
      musicRef.current.volume = 0.3
      musicRef.current.play().catch(() => {})
    }

    let cursor = 0
    beats.forEach((beat, i) => {
      const shotStart = cursor
      const narrationStart = cursor + LEAD_IN_SECONDS
      timersRef.current.push(setTimeout(() => setCurrentBeatIndex(i), shotStart * 1000))
      timersRef.current.push(setTimeout(() => {
        const audio = narrationRefs.current[beat.id]
        if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
      }, narrationStart * 1000))
      cursor += beat.targetDuration
    })

    // Real fade-out over the last second, matching the real mix's own
    // "end it with the narrator" fade timing.
    const fadeStart = Math.max(totalDuration - 1, 0)
    timersRef.current.push(setTimeout(() => {
      if (!musicRef.current) return
      const steps = 20
      let i = 0
      const fade = setInterval(() => {
        i++
        if (!musicRef.current) return clearInterval(fade)
        musicRef.current.volume = Math.max(0.3 * (1 - i / steps), 0)
        if (i >= steps) clearInterval(fade)
      }, 1000 / steps)
    }, fadeStart * 1000))

    timersRef.current.push(setTimeout(() => {
      clearAllTimers()
      setPlaying(false)
      setProgress(1)
      if (musicRef.current) musicRef.current.pause()
    }, totalDuration * 1000))

    const tick = () => {
      const elapsed = (performance.now() - startedAtRef.current) / 1000
      setProgress(Math.min(elapsed / totalDuration, 1))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => clearAllTimers(), [])

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
        {beats.map((beat, i) => (
          <img
            key={beat.id} src={beat.keyframeUrl} alt={`Scene ${i + 1}`}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === currentBeatIndex ? 1 : 0, transition: 'opacity 0.4s ease',
            }}
          />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.15)' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent-gradient)', transition: playing ? 'none' : 'width 0.2s' }} />
        </div>
        {!playing && (
          <button
            onClick={play}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.35)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{
              width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#111',
            }}>▶</span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Scene {currentBeatIndex + 1} of {beats.length}</span>
        {playing && <button onClick={stop} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}>Stop</button>}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--mist)', marginBottom: 4 }}>"{beats[currentBeatIndex]?.phrase}"</div>

      <audio ref={musicRef} src={musicDataUrl} />
      {beats.map((beat) => (
        <audio key={beat.id} ref={(el) => { narrationRefs.current[beat.id] = el }} src={beat.audioDataUrl} />
      ))}
    </div>
  )
}
