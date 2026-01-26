# Alt Text Editor

A browser-based tool for batch-editing image metadata (alt text). Upload images and an Excel file with filename-to-alt-text mappings, and download images with embedded metadata.

## Features

- **Batch import** – Upload multiple images at once
- **Excel/CSV mapping** – Automatically match filenames to alt texts
- **Multiple metadata formats** – Writes to EXIF, IPTC, and XMP
- **100% client-side** – No data leaves your browser
- **JPEG & PNG support**

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

The app auto-detects columns. Also recognizes: `file`, `name`, `image`, `description`, `caption`, `kuva`, `tiedosto`, `kuvaus`, `teksti`

## Metadata Written

**JPEG files:**
- IPTC Caption/Abstract
- EXIF ImageDescription
- XPComment / XPSubject (Windows)

**PNG files:**
- iTXt Description chunk
- XMP dc:description

## Privacy & Security

- All processing happens in your browser
- Images are never uploaded to any server
- When you close the tab, all data is gone
- No analytics or tracking

## Deployment to GitHub Pages

1. Fork or clone this repository
2. Go to Settings → Pages
3. Set source to `main` branch, `/ (root)`
4. Access at `https://USERNAME.github.io/REPO-NAME/`

## Local Development

Just open `index.html` in a browser. No build step required.

## Dependencies

All loaded from CDN (cdnjs.cloudflare.com):
- React 18.2.0
- Babel Standalone 7.23.5
- piexif.js 1.0.6
- SheetJS 0.18.5

## License

MIT
