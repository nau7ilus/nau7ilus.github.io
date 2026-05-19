import type { APIRoute } from 'astro';
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
  surface1: '#45475a',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  overlay0: '#6c7086',
  mauve: '#cba6f7',
  blue: '#89b4fa',
  green: '#a6e3a1',
  peach: '#fab387',
} as const;

const TITLE = 'Filip Zielinski // cybersec notebook';
const TAGLINE = 'CTF writeups, bug bounty notes and side-projects';
const SECTIONS = ['posts', 'projects', 'cv'];

const card = {
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
      {
        type: 'div',
        props: {
          style: { display: 'flex', fontSize: '26px' },
          children: [
            { type: 'span', props: { style: { color: C.green }, children: 'nau7ilus' } },
            { type: 'span', props: { style: { color: C.mauve }, children: '@' } },
            { type: 'span', props: { style: { color: C.green }, children: 'blog' } },
            { type: 'span', props: { style: { color: C.text }, children: ':' } },
            { type: 'span', props: { style: { color: C.blue }, children: '~' } },
            { type: 'span', props: { style: { color: C.peach, marginLeft: '10px' }, children: '$' } },
            {
              type: 'span',
              props: {
                style: { color: C.text, marginLeft: '14px' },
                children: 'whoami',
              },
            },
          ],
        },
      },
      {
        type: 'div',
        props: {
          style: {
            color: C.text,
            fontSize: '64px',
            fontWeight: 700,
            lineHeight: 1.18,
            marginTop: '60px',
            display: 'flex',
          },
          children: TITLE,
        },
      },
      {
        type: 'div',
        props: {
          style: {
            color: C.subtext0,
            fontSize: '30px',
            marginTop: '20px',
            display: 'flex',
          },
          children: TAGLINE,
        },
      },
      { type: 'div', props: { style: { display: 'flex', flex: 1 } } },
      {
        type: 'div',
        props: {
          style: { display: 'flex', color: C.subtext0, fontSize: '22px' },
          children: SECTIONS.map((s) => ({
            type: 'span',
            props: {
              style: {
                border: `1px solid ${C.surface1}`,
                borderRadius: '4px',
                padding: '2px 10px',
                marginRight: '8px',
              },
              children: `[${s}]`,
            },
          })),
        },
      },
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
              props: { style: { color: C.mauve }, children: 'fzielinski.dev' },
            },
            { type: 'span', props: { children: 'github.com/nau7ilus' } },
          ],
        },
      },
    ],
  },
};

export const GET: APIRoute = async () => {
  const svg = await satori(card, {
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
