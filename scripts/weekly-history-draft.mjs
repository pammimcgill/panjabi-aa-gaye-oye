#!/usr/bin/env node
// Usage:
//   node scripts/weekly-history-draft.mjs                      draft the next topic and open a draft issue
//   node scripts/weekly-history-draft.mjs --dry-run            print the draft, create nothing
//   node scripts/weekly-history-draft.mjs --topic <id>         draft a specific topic from editorial/calendar.json
//   node scripts/weekly-history-draft.mjs --file <path>        open a prepared article (editorial/ready/*.md) as a draft
import { readFile } from 'node:fs/promises';
import { runWeekly } from './draft-lib.mjs';

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const value = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };

const root = new URL('../', import.meta.url);
try {
  const file = value('file') || process.env.READY_FILE || '';
  const topicId = value('topic') || process.env.TOPIC_ID || '';
  const calendar = JSON.parse(await readFile(new URL('editorial/calendar.json', root), 'utf8')).topics;
  const styleGuide = await readFile(new URL('editorial/STYLE_GUIDE.md', root), 'utf8');
  const readyText = file ? await readFile(file, 'utf8') : null;
  const result = await runWeekly({ env: process.env, calendar, styleGuide, dryRun: flag('dry-run'), topicId, readyText });
  if (process.env.GITHUB_STEP_SUMMARY && result.url) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `Draft created: ${result.url}\n`);
  }
} catch (error) {
  console.error(`Weekly history draft failed: ${error.message}`);
  process.exit(1);
}
