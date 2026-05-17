import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE = "https://fzielinski.dev";
const STATIC_PATHS = ["", "/posts", "/projects", "/cv"];

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!
  );

export const GET: APIRoute = async () => {
  const posts = await getCollection("posts", ({ data }) => !data.draft);

  const tags = new Set<string>();
  for (const p of posts) for (const t of p.data.tags) tags.add(t);

  type Entry = { path: string; lastmod?: Date };
  const entries: Entry[] = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...posts.map((p) => ({ path: `/posts/${p.id}`, lastmod: p.data.date })),
    ...[...tags].sort().map((t) => ({ path: `/tags/${t}` })),
  ];

  const urls = entries
    .map(({ path, lastmod }) => {
      const loc = escapeXml(`${SITE}${path}`);
      const mod = lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : "";
      return `<url><loc>${loc}</loc>${mod}</url>`;
    })
    .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
