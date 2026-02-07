# (a work in progress) Alt Text Editor

A browser-based tool for batch-editing image metadata (alt text). Upload images and an Excel file with filename-to-alt-text mappings, and download images with embedded metadata.

## Features

- **Batch import** – Upload multiple images at once (max 100MB per file)
- **Excel/CSV mapping** – Automatically match filenames to alt texts
- **Multiple metadata formats** – Writes to XMP, IPTC, and SVG accessibility tags
- **Smart downloads** – Single file downloads directly, multiple files bundle into a ZIP
- **100% client-side** – No data leaves your browser
- **JPEG, PNG & SVG support** – Full metadata embedding for all three formats
- **Bilingual interface** – Finnish and Swedish languages with persistent preference
- **Dark mode** – Automatic theme detection with manual toggle (Ctrl+Shift+T)

## Quick Start

1. Open the app URL
2. Drop images into the left upload zone
3. Drop Excel/CSV file into the right upload zone
4. Review matches in the table
5. Click "Download All" to get processed images

## Excel Format

| filename | alt_text |
|----------|----------|
| photo1.jpg | Description of photo 1 |
| image2.png | Description of image 2 |
| illustration.svg | Description of illustration |

The app auto-detects columns. Recognizes English, Finnish, and Swedish headers:
- **Filename columns:** `file`, `name`, `image`, `filename`, `kuva`, `tiedosto`, `bild`, `filnamn`
- **Alt text columns:** `alt`, `alt_text`, `description`, `caption`, `kuvaus`, `teksti`, `beskrivning`, `bildtext`

## Metadata Written

**JPEG files:**
- XMP `dc:description` – Multilingual and structured metadata
- IPTC Caption/Abstract – Broadest tool compatibility

**PNG files:**
- XMP `dc:description` – Unified schema with JPEG for cross-format consistency

**SVG files:**
- `<title>` element – The only field that affects browser accessibility (WCAG)
- `aria-label` attribute
- `role="img"` attribute

## User Interface

**Language Selection:**
- Toggle between Finnish (Suomi) and Swedish (Svenska)
- Preference saved to localStorage
- All UI text and messages translated

**Dark Mode:**
- Automatic detection of system color scheme preference
- Manual toggle button in header
- Keyboard shortcut: `Ctrl+Shift+T` (or `Cmd+Shift+T` on Mac)
- Theme preference persists across sessions

**File Validation:**
- Maximum file size: 100MB per image
- Clear error messages for oversized files
- Automatic filtering with user notifications

## Privacy & Security

- All processing happens in your browser
- Images are never uploaded to any server
- When you close the tab, all data is gone
- No analytics or tracking

## Dependencies

All loaded from CDN (cdnjs.cloudflare.com):
- React 18.2.0
- Babel Standalone 7.23.5
- SheetJS 0.18.5
- JSZip 3.10.1

## License

MIT
