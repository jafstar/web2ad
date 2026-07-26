// Shared between the client wizard (tag picker UI) and the server-side
// Council writer (lib/adbuilder/story.js) - kept in its own file with no
// server-only imports so the client bundle doesn't pull in fetch/API-key
// code it'll never call.
export const STYLE_TAGS = [
  { key: 'funny', label: 'Funny' },
  { key: 'dramatic', label: 'Dramatic' },
  { key: 'animals', label: 'Animals' },
  { key: 'superhero', label: 'Superhero' },
  { key: 'heartwarming', label: 'Heartwarming' },
  { key: 'nostalgic', label: 'Nostalgic' },
  { key: 'absurd', label: 'Absurd' },
  { key: 'prestige', label: 'Prestige' },
]
