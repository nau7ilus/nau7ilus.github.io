import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FONT_DIR = 'node_modules/@fontsource/jetbrains-mono/files';
const fontRegular = readFileSync(
  resolve(process.cwd(), FONT_DIR, 'jetbrains-mono-latin-400-normal.woff'),
);
const fontBold = readFileSync(
  resolve(process.cwd(), FONT_DIR, 'jetbrains-mono-latin-700-normal.woff'),
);

// Catppuccin Mocha
const C = {
  base: '#1e1e2e',
  mantle: '#181825',
  surface1: '#45475a',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  overlay0: '#6c7086',
  mauve: '#cba6f7',
  blue: '#89b4fa',
  green: '#a6e3a1',
  peach: '#fab387',
  yellow: '#f9e2af',
} as const;

interface OgProps {
  title: string;
  category: string;
  date: string;
  slug: string;
  tags: string[];
}

function card({ title, category, date, slug, tags }: OgProps) {
  return {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: C.base,
        padding: '70px 80px',
        fontFamily: 'JetBrains Mono',
        color: C.text,
        borderLeft: `14px solid ${C.mauve}`,
      },
      children: [
        // top: prompt line
        {
          type: 'div',
          props: {
            style: { display: 'flex', fontSize: '26px' },
            children: [
              { type: 'span', props: { style: { color: C.green }, children: 'nau7ilus' } },
              { type: 'span', props: { style: { color: C.mauve }, children: '@' } },
              { type: 'span', props: { style: { color: C.green }, children: 'blog' } },
              { type: 'span', props: { style: { color: C.text }, children: ':' } },
              { type: 'span', props: { style: { color: C.blue }, children: '~/posts' } },
              { type: 'span', props: { style: { color: C.peach, marginLeft: '10px' }, children: '$' } },
              {
                type: 'span',
                props: {
                  style: { color: C.text, marginLeft: '14px' },
                  children: `cat ${slug}.md`,
                },
              },
            ],
          },
        },
        // category badge
        {
          type: 'div',
          props: {
            style: {
              color: C.peach,
              fontSize: '28px',
              marginTop: '60px',
              marginBottom: '20px',
            },
            children: `[${category}]`,
          },
        },
        // title
        {
          type: 'div',
          props: {
            style: {
              color: C.text,
              fontSize: '60px',
              fontWeight: 700,
              lineHeight: 1.18,
              display: 'flex',
            },
            children: title,
          },
        },
        // spacer
        { type: 'div', props: { style: { display: 'flex', flex: 1 } } },
        // tags
        {
          type: 'div',
          props: {
            style: { display: 'flex', color: C.subtext0, fontSize: '22px', gap: '10px' },
            children:
              tags.length > 0
                ? tags.slice(0, 5).map((t) => ({
                  type: 'span',
                  props: {
                    style: {
                      border: `1px solid ${C.surface1}`,
                      borderRadius: '4px',
                      padding: '2px 10px',
                      marginRight: '8px',
                    },
                    children: `#${t}`,
                  },
                }))
                : [],
          },
        },
        // bottom line
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: '24px',
              color: C.overlay0,
              fontSize: '22px',
            },
            children: [
              {
                type: 'span',
                props: { style: { color: C.mauve }, children: 'nau7ilus // cybersec notebook' },
              },
              { type: 'span', props: { children: date } },
            ],
          },
        },
      ],
    },
  };
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.id },
    props: {
      title: post.data.title,
      category: post.data.category,
      date: post.data.date.toISOString().slice(0, 10),
      slug: post.id,
      tags: post.data.tags,
    },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const svg = await satori(card(props as unknown as OgProps), {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'JetBrains Mono', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'JetBrains Mono', data: fontBold, weight: 700, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
    .render()
    .asPng();
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
