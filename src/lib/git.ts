import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Returns the most recent author-date for a file from `git log`,
 * or null if the file isn't tracked, git isn't available, or any error occurs.
 */
export function gitLastModified(filePath: string): Date | null {
  try {
    if (!existsSync(filePath)) return null;
    const stdout = execSync(`git log -1 --format=%aI -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!stdout) return null;
    const d = new Date(stdout);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Reconstructs the source file path for a posts-collection entry id.
 * Tries .md then .mdx.
 */
export function postSourcePath(id: string): string {
  const md = `src/content/posts/${id}.md`;
  const mdx = `src/content/posts/${id}.mdx`;
  return existsSync(md) ? md : mdx;
}
