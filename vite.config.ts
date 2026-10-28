import { cloudflare } from "@cloudflare/vite-plugin"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), cloudflare()],
  // The 3D world is one lazily loaded three.js chunk; it never blocks the game UI.
  build: { chunkSizeWarningLimit: 1000 },
})
