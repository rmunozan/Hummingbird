#!/usr/bin/env node
import ytdl from 'youtube-dl-exec';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ffmpegPath from 'ffmpeg-static';   // ← NEW
import fs from 'node:fs';
import path from 'node:path';

const base = { ffmpegLocation: ffmpegPath, noWarnings: true };   // ← tell yt-dl-exec

async function getMp4Heights(url) {
  const info = await ytdl(url, { ...base, dumpSingleJson: true });
  return [...new Set(
    info.formats
        .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
        .map(f => f.height)
  )].sort((a, b) => b - a);
}

function safe(name) { return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_'); }

(async () => {
  const { url } = await inquirer.prompt({
    type: 'input',
    name: 'url',
    message: 'YouTube URL:',
    validate: u => /youtu\.?be/.test(u) || 'Paste a valid YouTube link'
  });

  console.log(chalk.gray('\nChecking available MP4 qualities…'));
  const heights = await getMp4Heights(url);
  if (!heights.length) return console.error('No MP4 streams found.');

  const { h } = await inquirer.prompt({
    type: 'list',
    name: 'h',
    message: 'Choose a resolution:',
    choices: heights.map(x => ({ name: `${x}p`, value: x }))
  });

  /* prefer video-only + M4A audio, fall back to progressive MP4 */
  const fmt = `bv*[height=${h}][ext=mp4]+ba[ext=m4a]/b[height=${h}][ext=mp4]`;

  const rawName = (await ytdl(url, { ...base, getFilename: true, o: '%(title)s' })).trim();
  const outFile = path.resolve(`${safe(rawName)}-${h}p.mp4`);

  console.log(chalk.green(`\nDownloading → ${outFile}\n`));
  await ytdl(url, {
    ...base,
    format: fmt,
    output: outFile,
    /** use remux (safe), not force-merge */
    remuxVideo: 'mp4',          // tries MP4; falls back to MKV if codec incompatible
    progress: true
  });
  console.log(chalk.bold.green('\n✅  Finished'));
})();
