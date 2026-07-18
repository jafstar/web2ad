import './globals.css'

export const metadata = {
  title: 'genstock — Images galore, chosen not guessed',
  description: 'Generate across multiple AI sources at once, watch the council pick the strongest options, and curate down to the one worth keeping.',
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
