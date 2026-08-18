import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://t4diverclub.app",
  vite: { plugins: [tailwindcss()] },
});
