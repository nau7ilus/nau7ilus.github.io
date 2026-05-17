import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(['ctf', 'bug-bounty', 'project', 'writeup', 'misc']),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lesenswert: z.boolean().default(false),
    disclosure: z.enum(['public', 'permission-granted', 'redacted']).optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    repo: z.string().url().optional(),
    post: z.string().optional(),         // relativer Link zum Blog-Post, z.B. "/posts/2026-05-abimania"
    stack: z.array(z.string()).default([]),
    status: z.enum(['active', 'archived', 'wip']).default('active'),
    date: z.coerce.date(),
    featured: z.boolean().default(false), // wenn true: erscheint auch im CV
  }),
});

export const collections = { posts, projects };
