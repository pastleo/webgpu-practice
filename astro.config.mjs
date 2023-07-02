import { defineConfig } from 'astro/config';

import tailwind from "@astrojs/tailwind";

export const basePath = process.env.CI ? '/webgpu-practice' : '/';

export default defineConfig({
  integrations: [tailwind()],
  site: 'https://pastleo.github.io',
  base: basePath,
  trailingSlash: 'never',
});