import { roundHogFontFaceCss } from "@posthog/brand/fonts/css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { unlockAudioOnFirstGesture } from "./lib/sound.ts"
import "./styles.css"

const fonts = document.createElement("style")
fonts.textContent = roundHogFontFaceCss
document.head.appendChild(fonts)
unlockAudioOnFirstGesture()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
