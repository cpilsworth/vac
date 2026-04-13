#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeFile = (filePath, contents) => {
  fs.writeFileSync(filePath, contents, 'utf8');
};

const extractTextLike = (inputPath, outputDir, manifest, kind) => {
  const textPath = path.join(outputDir, 'source.txt');
  const htmlPath = path.join(outputDir, 'source.html');
  const markdownPath = path.join(outputDir, 'source.md');
  const contents = fs.readFileSync(inputPath, 'utf8');

  if (kind === 'html') {
    writeFile(htmlPath, contents);
    const textOnly = contents
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    writeFile(textPath, `${textOnly}\n`);
  } else {
    writeFile(textPath, contents);
    if (kind === 'md') {
      writeFile(markdownPath, contents);
    }
  }

  manifest.extractor = 'direct-read';
  manifest.outputs = {
    html: fs.existsSync(htmlPath) ? htmlPath : null,
    markdown: fs.existsSync(markdownPath) ? markdownPath : null,
    text: textPath,
    xml: null,
    mediaDir: null,
  };
};

const main = () => {
  const [, , sourceArg, outDirArg] = process.argv;

  if (!sourceArg || !outDirArg) {
    process.stderr.write('Usage: extract-document-spec.js <source-file> <output-dir>\n');
    process.exit(1);
  }

  const inputPath = path.resolve(sourceArg);
  const outputDir = path.resolve(outDirArg);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Source file not found: ${inputPath}`);
  }

  ensureDir(outputDir);

  const ext = path.extname(inputPath).toLowerCase();
  const manifest = {
    sourcePath: inputPath,
    sourceName: path.basename(inputPath),
    sourceType: ext || 'unknown',
    extractedAt: new Date().toISOString(),
    extractor: null,
    outputs: {},
  };

  if (ext === '.html' || ext === '.htm') {
    extractTextLike(inputPath, outputDir, manifest, 'html');
  } else if (ext === '.md' || ext === '.txt') {
    extractTextLike(inputPath, outputDir, manifest, ext === '.md' ? 'md' : 'txt');
  } else {
    throw new Error(`Unsupported source type: ${ext || '(no extension)'}`);
  }

  writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
};

main();
