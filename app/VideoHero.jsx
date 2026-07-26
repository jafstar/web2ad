'use client'

// The real Chapmans Pest Control ad, generated end-to-end by this pipeline
// and now actually posted to a real business's real Facebook page (the
// owner's own comment: "thanks brother!"). Autoplaying muted loop so the
// hero *is* the proof, not a screenshot of a proof — the same instinct
// that made the old genstock hero use real app screenshots instead of an
// abstract animated console.
export default function VideoHero() {
  return (
    <div style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
      <div className="card video-hero-card" style={{ padding: 8, position: 'relative' }}>
        <video
          src="/marketing/videos/chapmans.mp4"
          poster="/marketing/videos/posters/chapmans.jpg"
          autoPlay
          muted
          loop
          playsInline
          style={{ width: '100%', display: 'block', borderRadius: 8, aspectRatio: '4 / 3', objectFit: 'cover' }}
        />
        <div className="video-hero-badge">
          <span className="video-hero-dot" />
          Live on the client's own Facebook page
        </div>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--mist)', fontSize: 13, marginTop: 14 }}>
        Chapmans Pest Control — 17 years in business, zero video ads. This one shipped in a night.
      </p>

      <style>{`
        .video-hero-card { box-shadow: 0 30px 70px -20px rgba(0,0,0,0.6); }
        .video-hero-badge {
          position: absolute; left: 18px; bottom: 18px; right: 18px;
          display: flex; align-items: center; gap: 8px;
          background: rgba(15,15,15,0.72); backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px; padding: 9px 12px;
          font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
          letter-spacing: 0.02em; color: var(--fg);
        }
        .video-hero-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #4ADE80; flex: none;
          box-shadow: 0 0 8px 1px rgba(74,222,128,0.7);
        }
        @media (prefers-reduced-motion: reduce) {
          .video-hero-card video { animation: none; }
        }
      `}</style>
    </div>
  )
}
