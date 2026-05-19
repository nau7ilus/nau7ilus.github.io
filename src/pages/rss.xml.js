import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  return rss({
    title: 'Filip Zielinski // nau7ilus // cybersec notebook',
    description: 'CTF writeups, bug bounty notes and side-projects.',
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.description,
      link: `/posts/${p.id}`,
      categories: [p.data.category, ...p.data.tags],
    })),
    customData: '<language>de-de</language>',
  });
}
