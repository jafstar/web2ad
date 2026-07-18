import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import '@astryxdesign/theme-neutral/theme.css'
import '../dp-custom.css'
import ForceDarkTheme from './ForceDarkTheme'
import InstallIpcShim from './InstallIpcShim'

// Real app-interior shell — designpipe-app's actual Astryx/dark-amber
// theme, per "develop in DesignPipe, dump it into GenStock with its
// Stripe shell and credits." Separate from the root layout's black/white
// landing-page identity (globals.css), which stays as its own marketing
// surface.
export default function AppSectionLayout({ children }) {
  return (
    <>
      <ForceDarkTheme />
      <InstallIpcShim />
      {children}
    </>
  )
}
