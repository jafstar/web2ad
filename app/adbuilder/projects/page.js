'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import SiteHeader from '../../../components/SiteHeader'

// The "My Ads" list — the account-side home for everything the funnel
// (URL -> script -> preview -> signup) hands off into. Each row is a real
// projects table entry (see /api/adbuilder/run's insert); opening one
// reopens the exact same ShotReview editor via /adbuilder/finish?run=.
export default function AdProjectsPage() {
  const [projects, setProjects] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/adbuilder/projects')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load your ads')
        if (!cancelled) setProjects(data.projects)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px 100px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Your account</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 28 }}>My Ads</h1>
          <Link href="/adbuilder" className="btn-gradient" style={{ padding: '10px 20px', fontSize: 14 }}>Create New</Link>
        </div>

        {error && (
          <div className="card" style={{ padding: 20, borderColor: 'var(--danger)' }}>
            <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>
          </div>
        )}

        {!error && projects === null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--mist)', fontSize: 14 }}>
            <div className="dp-spinner" style={{ width: 16, height: 16 }} />
            Loading…
          </div>
        )}

        {!error && projects?.length === 0 && (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <p style={{ color: 'var(--mist)', fontSize: 14.5, marginBottom: 18 }}>No ads yet — start with a business URL or description.</p>
            <Link href="/adbuilder" className="btn-gradient" style={{ display: 'inline-block', padding: '11px 22px' }}>Start Free Preview</Link>
          </div>
        )}

        {!error && projects?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.map((p) => {
              const runId = p.data?.runId
              const editHref = p.status === 'pending'
                ? `/adbuilder/finish?stash=${encodeURIComponent(p.data?.stashId)}`
                : `/adbuilder/finish?run=${encodeURIComponent(runId)}`
              const thumbUrl = runId && p.thumbnailShotId
                ? `/api/adbuilder/run/${runId}/media?type=keyframe&shotId=${p.thumbnailShotId}`
                : null
              const badge = p.status === 'pending'
                ? { label: 'Continue', bg: 'rgba(56,189,248,0.15)', color: 'var(--blue-glow)' }
                : p.status === 'done'
                ? { label: 'Done', bg: 'rgba(74,222,128,0.15)', color: '#4ade80' }
                : { label: 'Incomplete', bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' }

              return (
                <div key={p.id} className="card" style={{ padding: 20, display: 'flex', gap: 16 }}>
                  {thumbUrl ? (
                    <img src={thumbUrl} alt={p.name} style={{ width: 88, height: 88, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 88, height: 88, borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} />
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      {p.data?.take > 1 && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(124,58,237,0.15)', color: 'var(--accent-solid)' }}>Take {p.data.take}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--mist)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8 }}>
                      {new Date(p.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                    {p.data?.whatTheyDo && <div style={{ fontSize: 13.5, color: 'var(--mist)', marginBottom: 12 }}>{p.data.whatTheyDo}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Link href={editHref} className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', fontSize: 12.5, textDecoration: 'none' }}>
                        <Pencil size={12} />
                        {p.status === 'pending' ? 'Continue' : 'Edit'}
                      </Link>
                      {p.status === 'done' && (
                        <a href={`/api/adbuilder/run/${runId}/export`} download="ad.mp4" className="btn-gradient" style={{ padding: '7px 16px', fontSize: 13, textDecoration: 'none' }}>
                          Download
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
