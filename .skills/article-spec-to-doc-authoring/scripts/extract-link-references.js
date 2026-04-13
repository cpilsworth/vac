#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Extracts all [Link: ...] and [External link: ...] references from a spec
 * markdown file. Outputs a JSON array of { type, label } objects, deduplicated.
 *
 * Usage: extract-link-references.js <spec-file>
 */

const LINK_RE = /\[(Link|External link):\s*(.+?)\]/g;

const main = () => {
  const [, , sourceArg] = process.argv;
  if (!sourceArg) {
    process.stderr.write('Usage: extract-link-references.js <spec-file>\n');
    process.exit(1);
  }

  const sourcePath = path.resolve(sourceArg);
  const text = fs.readFileSync(sourcePath, 'utf8');

  const seen = new Set();
  const refs = [];

  let match = LINK_RE.exec(text);
  while (match) {
    const type = match[1] === 'External link' ? 'external' : 'internal';
    const label = match[2].trim();
    const key = `${type}:${label}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ type, label, href: '' });
    }
    match = LINK_RE.exec(text);
  }

  process.stdout.write(`${JSON.stringify(refs, null, 2)}\n`);
};

main();
