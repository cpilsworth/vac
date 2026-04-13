---
name: article-spec-to-doc-authoring
description: Convert a validated inspiration-article-spec markdown file into Edge Delivery Services HTML and push it to Document Authoring via the AEM DA MCP tool. Use when the user has a clean spec ready for DA upload.
---

# Article Spec To Doc Authoring

Use this skill when a user has a validated markdown spec (produced by `inspiration-article-spec`) and wants it converted to EDS HTML and uploaded to DA.

If the spec is not yet normalized (missing `Guidance:` lines, mixed content and layout hints), use `inspiration-article-spec` first.

Do not use this skill for:
- Migrating an existing public webpage. Use `page-import`.
- Building a new block. Use `content-driven-development`.
- Styling work or design polish. This skill focuses on semantic structure.

## Inputs

Collect these before starting:
- **Source spec path.** Required. A `.md` file that passes the `inspiration-article-spec` validator.
- **Org and repo.** Optional. Default: `cpilsworth/vac`.
- **Destination path in DA.** Optional. Default: `drafts/{slug}.html`.
- **Slug override.** Optional. Derived from the H1 title if not given.

## Workflow

### 1. Validate the spec

Read the spec file and confirm it is well-formed:

- Has exactly one `# H1` title.
- Every `## H2` section has a `Guidance:` line as its first non-empty body line.
- Valid guidance values: `hero`, `cards`, `columns`, `carousel`, `tabs`, `default-content`.
- `### H3` sub-items appear only inside sections, not at the top level.
- `Key: value` fields and `Key:` + bullet list fields are syntactically correct.
- Link references use `[Link: Label]` or `[External link: Label — Description]` format.

If the spec has structural problems, fix them before continuing. Warnings (e.g. missing images) are acceptable.

### 2. Parse the spec

Read the markdown and extract:
- **Page title**: the single `# H1` line.
- **Sections**: each `## H2` with its `Guidance:` value and body content.
- **Items**: `### H3` sub-items within sections.
- **Fields**: `Key: value` pairs such as `Summary:`, `Best neighbourhoods:`, `Image:`, `Primary CTA:`, etc.
- **List fields**: `Key:` followed by `- bullet` lines (e.g. `Details:`, `Why it works:`).

### 3. Resolve link references

The spec contains link references in two forms:
- `[Link: Label]` — internal site links (e.g. product pages, booking flows).
- `[External link: Label — Description]` — external links (e.g. official third-party sites).

Extract all references, suggest URLs, and confirm with the user before generating HTML.

#### 3a. Extract references

Scan the spec for every occurrence of `[Link: Label]` and `[External link: Label]`. Deduplicate by label. Classify each as:
- **internal** — `[Link: ...]` references (site pages, booking flows, product pages).
- **external** — `[External link: ...]` references (third-party official sites).

#### 3b. Suggest URLs

For each reference, suggest a URL:

- **Internal links**: Search the site content in DA using `da_list_sources` to find matching pages under the org/repo (e.g. hotel pages, flight search pages, destination pages). Build URLs as relative paths (e.g. `/hotels/virgin-hotels-new-york`). If no matching page is found, suggest a plausible path and flag it as **unverified**.
- **External links**: Use the label to identify the official website. For example, "Central Park Conservancy — Official site" → `https://www.centralparknyc.org`. Search the web if needed to find the correct URL.

#### 3c. Confirm with the user

Present the full link map as a table for the user to review:

| # | Type | Label | Suggested URL |
|---|------|-------|---------------|
| 1 | internal | Flight + Hotel to New York | /holidays/new-york |
| 2 | external | Central Park Conservancy — Official site | https://www.centralparknyc.org |

Ask the user to confirm, correct, or remove any links. **Wait for confirmation before proceeding.**

#### 3d. Keep the confirmed link map

Hold the confirmed link map in context. Use it in step 4 when rendering `href` attributes — any link reference whose label matches a confirmed entry gets the confirmed URL; unmatched labels fall back to `#`.

### 4. Convert each section to EDS HTML

Apply the guidance value to choose the HTML pattern. All patterns below produce content for inside `<main>`.

#### hero

```html
<div>
  <p><picture><source type="image/webp" srcset="URL"><img src="URL" alt="description" width="1600" height="900"></picture></p>
  <h1>Page Title</h1>
  <p>Intro paragraph.</p>
  <p><strong><a href="#">Primary CTA</a></strong></p>
  <p><strong><a href="#">Secondary CTA</a></strong></p>
</div>
```

- The `Image:` field becomes the picture element.
- The H1 comes from the page title, not the section heading.
- CTAs render as strong-wrapped anchors.

#### cards (with `### Item` headings)

```html
<div>
  <h2>Section Title</h2>
  <div class="cards">
    <div>
      <div><p><picture>...</picture></p></div>
      <div>
        <h3>Item Title</h3>
        <p>Summary text.</p>
        <p><strong>Field:</strong> value</p>
        <h4>List Field Label</h4>
        <ul><li>...</li></ul>
        <p><a href="#" target="_blank" rel="noopener noreferrer">Official link</a></p>
        <p><strong><a href="#">CTA</a></strong></p>
      </div>
    </div>
  </div>
</div>
```

- Each `### Item` becomes a `<div>` row with image column and text column.
- `Image:` goes in the first `<div>`, all other content in the second.
- `Details:` and similar list fields become `<h4>` + `<ul>`.
- Official links and CTAs are deferred to the end of the text column.

#### cards (quick-facts — bullets only, no `### Item` headings)

```html
<div>
  <h2>At a glance</h2>
  <div class="cards">
    <div><div>
      <h3>Label</h3>
      <p>Value text.</p>
    </div></div>
  </div>
</div>
```

- Each `- Label: value` bullet becomes a card row.
- Split on the first `:` to separate label from value.

#### columns (spotlight — one `### Item`)

```html
<div>
  <h2>Section Title</h2>
  <p>Intro paragraph.</p>
  <div class="columns">
    <div>
      <div><p><picture>...</picture></p></div>
      <div>
        <h3>Featured Item</h3>
        <p>Summary.</p>
        <h4>Why it works</h4>
        <ul><li>...</li></ul>
        <p><strong><a href="#">CTA</a></strong></p>
      </div>
    </div>
  </div>
</div>
```

- Intro paragraphs before the `### Item` render as default content.
- The single item renders as a two-column row (image + text).

#### columns (peer — two or more `### Items`)

```html
<div>
  <h2>Section Title</h2>
  <p>Intro paragraph.</p>
  <div class="columns">
    <div>
      <div>
        <h3>Sub-item A</h3>
        <ul><li>...</li></ul>
      </div>
      <div>
        <h3>Sub-item B</h3>
        <ul><li>...</li></ul>
      </div>
    </div>
  </div>
  <p><a href="#" target="_blank" rel="noopener noreferrer">Official link</a></p>
  <p><picture>...</picture></p>
</div>
```

- Each `### Item` becomes a column `<div>`.
- Shared fields (`Official link:`, `Image:`) from the last item are pulled out and rendered after the columns block.

#### carousel

```html
<div>
  <h2>Section Title</h2>
  <div class="carousel-attractions">
    <div>
      <div><p><picture>...</picture></p></div>
      <div>
        <h3>Attraction Name</h3>
        <p>Summary text.</p>
        <p><strong>Best time / how long:</strong> value</p>
        <p><a href="#" target="_blank" rel="noopener noreferrer">Official site</a></p>
      </div>
    </div>
  </div>
</div>
```

- Same row structure as cards: image column + text column.
- Uses `carousel-attractions` as the block class.

#### tabs

```html
<div>
  <h2>Section Title</h2>
  <div class="tabs-info">
    <div>
      <div><p>Tab Label</p></div>
      <div>
        <p>Paragraph content.</p>
        <ul><li>Bullet content.</li></ul>
      </div>
    </div>
  </div>
</div>
```

- Each `### Tab Label` becomes a row.
- First column holds the tab label as a `<p>`.
- Second column holds the tab body content.

#### default-content

```html
<div>
  <h2>Section Title</h2>
  <p>Body copy.</p>
  <ul><li>Bullet.</li></ul>
  <p><strong><a href="#">Primary CTA</a></strong></p>
  <p><strong><a href="#">Secondary CTA</a></strong></p>
</div>
```

- Pure semantic HTML, no block wrapper.

### 5. Assemble the full page

Wrap all section HTML from step 4 in the page shell:

```html
<html>
<head>
  <meta charset="UTF-8">
</head>
<body>
  <header></header>
  <main>
    <!-- section divs here -->
  </main>
  <footer></footer>
</body>
</html>
```

### 6. Confirm org, repo, and path

Before uploading, confirm with the user:
- Org/repo: `cpilsworth/vac` (or override).
- Path: `drafts/{slug}.html` (or override).
- Whether to create or update (check if the path already exists with `da_list_sources` or `da_get_source`).

### 7. Push to DA

Call the AEM DA MCP tools:

1. **`da_create_source`** — Create the page at the confirmed path. Pass the full HTML as the source body. If the page already exists, use **`da_update_source`** instead.
2. **`da_upload_media`** — Upload any images to the sibling dot-folder `drafts/.{slug}/`. Skip this step if using placeholder URLs.

### 8. Report URLs

After successful upload, report:

| Environment | URL |
|---|---|
| DA edit | `https://da.live/edit#/{org}/{repo}/drafts/{slug}` |
| Preview | `https://main--{repo}--{org}.aem.page/drafts/{slug}` |
| Live | `https://main--{repo}--{org}.aem.live/drafts/{slug}` |

## Conversion Notes

- Use placeholder image URLs (`https://placehold.co/WxH?text=...`) until real assets are available.
- `Primary CTA` and `Secondary CTA` render as `<p><strong><a href="...">Label</a></strong></p>`. Resolve the `href` from the confirmed link map (step 3). Fall back to `#` when no entry exists.
- `Official link` renders as `<p><a href="..." target="_blank" rel="noopener noreferrer">Label</a></p>`. Same resolution applies.
- All `[Link: Label]` and `[External link: Label]` references in the spec must be resolved through the link map before rendering.
- `Image:` field value becomes the `alt` text. Use the item title as the placeholder label.
- Hero images use 1600x900, all other images use 1200x800.
- Never nest blocks inside other blocks.
- Keep block names lowercase with single dashes.

## Success Criteria

This skill is complete when:
- The spec has been validated with zero errors.
- All link references have been resolved and confirmed by the user.
- Each guidance section has been converted to the correct EDS HTML pattern.
- The HTML has been pushed to DA via `da_create_source` or `da_update_source`.
- The DA edit, preview, and live URLs have been reported to the user.
