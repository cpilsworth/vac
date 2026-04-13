# EDS Page Rules

Use these rules when turning a specification document into an EDS page source.

## Source Format

- BYOM expects semantic HTML built from sections, blocks, and default content.
- Extra presentational markup such as `span`, inline styles, and ad hoc data attributes should not drive the structure.
- Images must be reachable through relative or absolute URLs that the platform can ingest.

Reference:
- https://www.aem.live/developer/byom#what-format-should-the-source-bring-to-the-table

## Default Content First

Prefer native document semantics whenever possible:
- `h1` through `h6`
- paragraphs
- ordered and unordered lists
- links
- images
- emphasis and strong text

Only introduce blocks when the content is a real component or repeated structured pattern.

Reference:
- https://www.aem.live/developer/markup-sections-blocks

## Sections

- Use sections to group content with a clear semantic or presentation boundary.
- Do not create extra sections for every minor layout change.
- `section-metadata` is appropriate when the section needs an author-visible style or grouping hint.

## Blocks

- Blocks are table-authored structures rendered as nested `div` rows and columns.
- Do not nest blocks.
- Keep block names lowercase with single dashes only.
- Use block options only when a small variant is needed.

## Block Selection

Prefer:
1. Default content
2. Boilerplate or repo-local equivalents of standard collection blocks
3. Standard collection blocks not present locally only with explicit user intent

The value of the block collection is mostly the content structure, not the shipped styling.

References:
- https://www.aem.live/docs/exploring-blocks
- https://www.aem.live/developer/block-collection

## DA Upload Paths

When uploading a page source to DA:
- Put the page at the requested `.html` path, for example `drafts/nyc-break.html`
- Put related images in a sibling dot-folder, for example `drafts/.nyc-break/hero.jpg`
- Reference those images from the page as `./.nyc-break/hero.jpg`

Keep the source focused on page content. Do not add site-wide header or footer markup.
