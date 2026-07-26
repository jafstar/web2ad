import './globals.css'

export const metadata = {
  title: 'Web2Ad — Any business, turned into a real ad overnight',
  description: 'Feed it a logo, a few photos, and what the business actually is. Web2Ad writes the story, generates the video, scores the music, and voices the read — a real Genmercial, no camera or studio required.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* Fraunces (warm display serif) against Inter/JetBrains Mono —
            the real original genstock studio pairing (see
            mailbox/artifacts/gen-stock/genstock-hero.html), site-wide so
            /login and /app share the same identity as the homepage. */}
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
