'use client'

import { useRef, useState } from 'react'
import { Play } from 'lucide-react'

// Four real ads made this week for four real small businesses — two
// direct clients (Chapmans, SNAKZ), one B2B licensing conversation (DMV
// Productions, kept off-camera per their own clients' consent), one
// apparel brand (Silkie Society Co). Click-to-play with sound, not
// autoplay-muted like the hero — this section is meant to be actually
// watched, not just glanced at while scrolling past.
const ADS = [
  { key: 'chapmans', name: 'Chapmans Pest Control', tag: 'Superhero exterminator, live on their Facebook', src: '/marketing/videos/chapmans.mp4', poster: '/marketing/videos/posters/chapmans.jpg' },
  { key: 'snakz', name: 'SNAKZ', tag: 'Built on Passion, Driven by Purpose — WV food truck', src: '/marketing/videos/snakz.mp4', poster: '/marketing/videos/posters/snakz.jpg' },
  { key: 'silkie', name: 'Silkie Society Co.', tag: 'Why did the Silkie cross the road? — apparel brand', src: '/marketing/videos/silkie.mp4', poster: '/marketing/videos/posters/silkie.jpg' },
  { key: 'dmv', name: 'DMV Productions', tag: 'Capabilities reel for a DC production company', src: '/marketing/videos/dmv.mp4', poster: '/marketing/videos/posters/dmv.jpg' },
]

function AdCard({ ad }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  const start = () => {
    setPlaying(true)
    requestAnimationFrame(() => videoRef.current?.play())
  }

  return (
    <div className="card ad-card">
      <div className="ad-card-media" onClick={!playing ? start : undefined}>
        <video
          ref={videoRef}
          src={ad.src}
          poster={ad.poster}
          controls={playing}
          playsInline
          onEnded={() => setPlaying(false)}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
        />
        {!playing && (
          <button type="button" className="ad-card-play" aria-label={`Play ${ad.name} ad`}>
            <Play size={22} fill="currentColor" />
          </button>
        )}
      </div>
      <div style={{ padding: '16px 4px 4px' }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{ad.name}</div>
        <div style={{ color: 'var(--mist)', fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{ad.tag}</div>
      </div>
    </div>
  )
}

export default function ProofGrid() {
  return (
    <section style={{ padding: '10px 56px 80px' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Real Clients, Real Ads</div>
      <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, fontSize: 'clamp(26px, 3vw, 36px)', marginBottom: 40, maxWidth: 640 }}>
        Not demos. These are running.
      </h2>
      <div className="ad-grid">
        {ADS.map((ad) => <AdCard key={ad.key} ad={ad} />)}
      </div>

      <style>{`
        .ad-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 22px;
        }
        .ad-card { padding: 10px; }
        .ad-card-media {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          border-radius: 8px;
          overflow: hidden;
          background: #000;
          cursor: pointer;
        }
        .ad-card-play {
          position: absolute; inset: 0; margin: auto;
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(15,15,15,0.55); backdrop-filter: blur(3px);
          border: 1px solid rgba(255,255,255,0.25);
          color: #fff; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform .15s ease, background .15s ease;
        }
        .ad-card-play:hover { transform: scale(1.08); background: rgba(15,15,15,0.75); }
        @media (max-width: 1100px) {
          .ad-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .ad-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  )
}
