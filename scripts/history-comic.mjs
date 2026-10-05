#!/usr/bin/env node
import { runComic } from './comic-lib.mjs';

try {
  const result = await runComic();
  console.log(`Created six comic pages for issue #${result.issueNumber}: ${result.article.title}`);
  console.log(`Review files in public/history-comics/generated/${result.article.slug}/`);
} catch (error) {
  console.error(`History comic failed: ${error.message}`);
  process.exitCode = 1;
}
