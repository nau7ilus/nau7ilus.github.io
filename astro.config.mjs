import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

// https://astro.build/config
export default defineConfig({
  site: 'https://fzielinski.dev',
  base: '/',
  trailingSlash: 'never',
  integrations: [mdx()],
  markdown: {
    shikiConfig: {
      theme: 'catppuccin-mocha',
      wrap: true,
    },
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['anchor'], 'aria-label': 'permalink' },
          content: { type: 'text', value: ' #' },
        },
      ],
    ],
  },
  build: {
    assets: 'assets',
  },
});
