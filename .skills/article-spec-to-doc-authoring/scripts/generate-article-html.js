#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slugify = (value) => value
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-');

const nextNonEmptyIndex = (lines, startIndex) => {
  for (let i = startIndex; i < lines.length; i += 1) {
    if (lines[i].trim()) return i;
  }
  return -1;
};

const splitSections = (lines) => {
  const sections = [];
  let currentSection = null;

  lines.forEach((line, index) => {
    if (line.startsWith('## ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: line.slice(3).trim(),
        line: index + 1,
        guidance: null,
        body: [],
      };
      return;
    }

    if (currentSection) currentSection.body.push(line);
  });

  if (currentSection) sections.push(currentSection);
  return sections;
};

let linkMap = {};

const loadLinkMap = (filePath) => {
  if (!filePath) return;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(data)) {
    data.forEach((entry) => {
      if (entry.label && entry.href) {
        linkMap[entry.label] = entry.href;
      }
    });
  } else {
    linkMap = { ...linkMap, ...data };
  }
};

const parseLinkValue = (raw) => {
  const match = raw.match(/\[(Link|External link):\s*(.+?)\]$/);
  if (!match) {
    return {
      text: raw.trim(),
      href: '#',
      external: false,
    };
  }

  const label = match[2].trim();
  return {
    text: label,
    href: linkMap[label] || '#',
    external: match[1] === 'External link',
  };
};

const createPictureHtml = (label, alt, hero = false) => {
  const width = hero ? 1600 : 1200;
  const height = hero ? 900 : 800;
  const placeholder = `https://placehold.co/${width}x${height}?text=${encodeURIComponent(label)}`;
  const safeAlt = escapeHtml(alt);

  return `<p><picture><source type="image/webp" srcset="${placeholder}"><img src="${placeholder}" alt="${safeAlt}" width="${width}" height="${height}"></picture></p>`;
};

const renderParagraph = (text) => `<p>${escapeHtml(text)}</p>`;

const renderBullets = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;

const renderLinkParagraph = (raw, strong = false) => {
  const link = parseLinkValue(raw);
  const attrs = link.external ? ' target="_blank" rel="noopener noreferrer"' : '';
  const anchor = `<a href="${link.href}"${attrs}>${escapeHtml(link.text)}</a>`;
  return strong ? `<p><strong>${anchor}</strong></p>` : `<p>${anchor}</p>`;
};

const flushParagraph = (state, target) => {
  if (state.currentParagraph.length) {
    target.paragraphs.push(state.currentParagraph.join(' ').trim());
    state.currentParagraph = [];
  }
};

const createContentTarget = () => ({
  paragraphs: [],
  bullets: [],
  fields: [],
  listFields: [],
});

const parseContentLines = (lines) => {
  const target = createContentTarget();
  const state = {
    currentParagraph: [],
    activeListField: null,
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(state, target);
      state.activeListField = null;
      return;
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph(state, target);
      const bullet = trimmed.slice(2).trim();
      if (state.activeListField) state.activeListField.items.push(bullet);
      else target.bullets.push(bullet);
      return;
    }

    const fieldMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (fieldMatch) {
      flushParagraph(state, target);
      const key = fieldMatch[1].trim();
      const value = fieldMatch[2].trim();
      if (value) {
        target.fields.push({ key, value });
        state.activeListField = null;
      } else {
        const listField = { key, items: [] };
        target.listFields.push(listField);
        state.activeListField = listField;
      }
      return;
    }

    state.currentParagraph.push(trimmed);
  });

  flushParagraph(state, target);
  return target;
};

const parseSection = (section) => {
  const lines = section.body;
  const guidanceIndex = nextNonEmptyIndex(lines, 0);
  if (guidanceIndex === -1 || !lines[guidanceIndex].startsWith('Guidance: ')) {
    throw new Error(`Section "${section.title}" is missing an immediate Guidance line`);
  }

  const guidance = lines[guidanceIndex].slice('Guidance: '.length).trim();
  const remaining = lines.slice(guidanceIndex + 1);
  const preItemLines = [];
  const items = [];
  let currentItem = null;

  remaining.forEach((line) => {
    if (line.startsWith('### ')) {
      if (currentItem) items.push(currentItem);
      currentItem = {
        title: line.slice(4).trim(),
        lines: [],
      };
      return;
    }

    if (currentItem) currentItem.lines.push(line);
    else preItemLines.push(line);
  });

  if (currentItem) items.push(currentItem);

  return {
    title: section.title,
    guidance,
    intro: parseContentLines(preItemLines),
    items: items.map((item) => ({
      title: item.title,
      ...parseContentLines(item.lines),
    })),
  };
};

const pullSharedFieldsFromLastItem = (section) => {
  if (section.guidance !== 'columns' || section.items.length < 2) return { sharedFields: [], sharedListFields: [] };
  const lastItem = section.items[section.items.length - 1];
  const sharedFields = [];
  const sharedListFields = [];
  const sharedKeys = new Set(['Official link', 'Primary CTA', 'Secondary CTA', 'Image']);

  lastItem.fields = lastItem.fields.filter((field) => {
    if (sharedKeys.has(field.key)) {
      sharedFields.push(field);
      return false;
    }
    return true;
  });

  lastItem.listFields = lastItem.listFields.filter((field) => {
    if (sharedKeys.has(field.key)) {
      sharedListFields.push(field);
      return false;
    }
    return true;
  });

  return { sharedFields, sharedListFields };
};

const fieldValue = (target, key) => target.fields.find((field) => field.key === key)?.value || '';

const renderField = (field) => {
  if (field.key === 'Primary CTA' || field.key === 'Secondary CTA') {
    return renderLinkParagraph(field.value, true);
  }
  if (field.key === 'Official link') {
    return renderLinkParagraph(field.value, false);
  }
  if (field.key === 'Image') {
    return createPictureHtml(field.value, field.value);
  }
  return `<p><strong>${escapeHtml(field.key)}:</strong> ${escapeHtml(field.value)}</p>`;
};

const renderListField = (field, headingLevel = 4) => {
  const safeKey = escapeHtml(field.key);
  return `<h${headingLevel}>${safeKey}</h${headingLevel}>${renderBullets(field.items)}`;
};

const renderContentTarget = (target, options = {}) => {
  const {
    omitKeys = [],
    imageLabel = '',
    heroImage = false,
    headingLevel = 4,
  } = options;
  const omitSet = new Set(omitKeys);
  const html = [];

  target.paragraphs.forEach((paragraph) => {
    html.push(renderParagraph(paragraph));
  });

  if (target.bullets.length) {
    html.push(renderBullets(target.bullets));
  }

  target.fields.forEach((field) => {
    if (omitSet.has(field.key)) return;
    if (field.key === 'Image') {
      const label = imageLabel || field.value;
      html.push(createPictureHtml(label, field.value, heroImage));
      return;
    }
    html.push(renderField(field));
  });

  target.listFields.forEach((field) => {
    if (!omitSet.has(field.key)) html.push(renderListField(field, headingLevel));
  });

  return html.join('');
};

const renderCardBody = (item) => {
  const html = [`<h3>${escapeHtml(item.title)}</h3>`];
  const deferredFields = [];

  item.paragraphs.forEach((paragraph) => {
    html.push(renderParagraph(paragraph));
  });

  if (item.bullets.length) html.push(renderBullets(item.bullets));

  item.fields.forEach((field) => {
    if (field.key === 'Image') return;
    if (field.key === 'Primary CTA' || field.key === 'Secondary CTA' || field.key === 'Official link') deferredFields.push(field);
    else html.push(`<p><strong>${escapeHtml(field.key)}:</strong> ${escapeHtml(field.value)}</p>`);
  });

  item.listFields.forEach((field) => {
    html.push(renderListField(field, 4));
  });

  deferredFields.forEach((field) => {
    if (field.key === 'Official link') html.push(renderLinkParagraph(field.value, false));
    else html.push(renderLinkParagraph(field.value, true));
  });

  return html.join('');
};

const renderCardsSection = (section) => {
  const html = [`<div><h2>${escapeHtml(section.title)}</h2>`];
  if (section.items.length) {
    html.push(renderContentTarget(section.intro, { omitKeys: ['Image'] }));
  }
  html.push('<div class="cards">');

  if (section.items.length) {
    section.items.forEach((item) => {
      const image = fieldValue(item, 'Image');
      html.push('<div>');
      if (image) html.push(`<div>${createPictureHtml(item.title, image)}</div>`);
      html.push(`<div>${renderCardBody(item)}</div>`);
      html.push('</div>');
    });
  } else {
    section.intro.bullets.forEach((bullet) => {
      const parts = bullet.split(':');
      const label = parts.shift() || bullet;
      const value = parts.join(':').trim();
      html.push('<div><div>');
      html.push(`<h3>${escapeHtml(label.trim())}</h3>`);
      if (value) html.push(renderParagraph(value));
      html.push('</div></div>');
    });
  }

  html.push('</div></div>');
  return html.join('');
};

const renderCarouselSection = (section) => {
  const html = [`<div><h2>${escapeHtml(section.title)}</h2>`];
  html.push(renderContentTarget(section.intro, { omitKeys: ['Image'] }));
  html.push('<div class="carousel-attractions">');

  section.items.forEach((item) => {
    const image = fieldValue(item, 'Image') || item.title;
    html.push('<div>');
    html.push(`<div>${createPictureHtml(item.title, image)}</div>`);
    html.push(`<div>${renderCardBody(item)}</div>`);
    html.push('</div>');
  });

  html.push('</div></div>');
  return html.join('');
};

const renderSingleColumnsItem = (item) => {
  const image = fieldValue(item, 'Image');
  const textHtml = renderCardBody(item);

  if (image) {
    return `<div class="columns"><div><div>${createPictureHtml(item.title, image)}</div><div>${textHtml}</div></div></div>`;
  }

  return `<div class="columns"><div><div>${textHtml}</div></div></div>`;
};

const renderMultiColumnsItems = (section, sharedFields) => {
  const columns = section.items.map((item) => `<div>${renderCardBody(item)}</div>`).join('');
  const html = [`<div class="columns"><div>${columns}</div></div>`];

  sharedFields.forEach((field) => {
    if (field.key === 'Image') html.push(createPictureHtml(section.title, field.value));
    else html.push(renderField(field));
  });

  return html.join('');
};

const renderColumnsSection = (section) => {
  const html = [`<div><h2>${escapeHtml(section.title)}</h2>`];
  html.push(renderContentTarget(section.intro, { omitKeys: ['Image'] }));

  if (section.items.length <= 1) {
    if (section.items[0]) html.push(renderSingleColumnsItem(section.items[0]));
  } else {
    const shared = pullSharedFieldsFromLastItem(section);
    html.push(renderMultiColumnsItems(section, shared.sharedFields));
  }

  html.push('</div>');
  return html.join('');
};

const renderTabsSection = (section) => {
  const html = [`<div><h2>${escapeHtml(section.title)}</h2>`];
  html.push(renderContentTarget(section.intro, { omitKeys: ['Image'] }));
  html.push('<div class="tabs-info">');

  section.items.forEach((item) => {
    html.push('<div>');
    html.push(`<div><p>${escapeHtml(item.title)}</p></div>`);
    html.push('<div>');
    item.paragraphs.forEach((paragraph) => html.push(renderParagraph(paragraph)));
    if (item.bullets.length) html.push(renderBullets(item.bullets));
    item.fields.forEach((field) => {
      if (field.key !== 'Image') html.push(`<p><strong>${escapeHtml(field.key)}:</strong> ${escapeHtml(field.value)}</p>`);
    });
    item.listFields.forEach((field) => html.push(renderListField(field, 4)));
    html.push('</div>');
    html.push('</div>');
  });

  html.push('</div></div>');
  return html.join('');
};

const renderDefaultSection = (section) => {
  const html = [`<div><h2>${escapeHtml(section.title)}</h2>`];
  html.push(renderContentTarget(section.intro, { omitKeys: ['Image'] }));

  section.items.forEach((item) => {
    html.push(`<h3>${escapeHtml(item.title)}</h3>`);
    html.push(renderContentTarget(item, { imageLabel: item.title }));
  });

  html.push('</div>');
  return html.join('');
};

const renderHeroSection = (pageTitle, section) => {
  const html = ['<div>'];
  const image = fieldValue(section.intro, 'Image') || pageTitle;
  html.push(createPictureHtml(pageTitle, image, true));
  html.push(`<h1>${escapeHtml(pageTitle)}</h1>`);
  html.push(renderContentTarget(section.intro, {
    omitKeys: ['Image'],
    heroImage: true,
  }));
  html.push('</div>');
  return html.join('');
};

const renderSection = (pageTitle, section) => {
  switch (section.guidance) {
    case 'hero':
      return renderHeroSection(pageTitle, section);
    case 'cards':
      return renderCardsSection(section);
    case 'carousel':
      return renderCarouselSection(section);
    case 'columns':
      return renderColumnsSection(section);
    case 'tabs':
      return renderTabsSection(section);
    case 'default-content':
    default:
      return renderDefaultSection(section);
  }
};

const parseDocument = (sourceText) => {
  const lines = sourceText.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith('# '));
  if (!titleLine) throw new Error('Document is missing an H1 title');

  const sections = splitSections(lines).map(parseSection);
  return {
    title: titleLine.slice(2).trim(),
    sections,
  };
};

const renderDocument = (doc) => {
  const sectionsHtml = doc.sections.map((section) => renderSection(doc.title, section)).join('');
  return `<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  <header></header>
  <main>${sectionsHtml}</main>
  <footer></footer>
</body>
</html>
`;
};

const writeFile = (filePath, contents) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
};

const main = () => {
  const args = process.argv.slice(2);
  let linkMapArg = null;
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--link-map' && i + 1 < args.length) {
      i += 1;
      linkMapArg = args[i];
    } else {
      positional.push(args[i]);
    }
  }

  const [sourceArg, outputArg] = positional;
  if (!sourceArg || !outputArg) {
    process.stderr.write('Usage: generate-article-html.js <source-md> <output-html> [--link-map <links.json>]\n');
    process.exit(1);
  }

  if (linkMapArg) loadLinkMap(path.resolve(linkMapArg));

  const sourcePath = path.resolve(sourceArg);
  const outputPath = path.resolve(outputArg);
  const text = fs.readFileSync(sourcePath, 'utf8');
  const doc = parseDocument(text);
  const html = renderDocument(doc);
  writeFile(outputPath, html);

  process.stdout.write(`${JSON.stringify({
    source: sourcePath,
    output: outputPath,
    slug: slugify(path.basename(outputPath, path.extname(outputPath))),
    title: doc.title,
    sections: doc.sections.length,
  }, null, 2)}\n`);
};

main();
