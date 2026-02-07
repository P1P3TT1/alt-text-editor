const { useState, useRef, useCallback } = React;

// ============================================
// Translations
// ============================================

const translations = {
  fi: {
    title: 'Alt-tekstin muokkain',
    subtitle: 'Tuo kuvia ja Excel-tiedosto lisätäksesi alt-tekstejä metatietoina',
    imagesDropZone: 'Kuvat',
    excelDropZone: 'Excel / CSV',
    clickToUpload: 'Klikkaa ladataksesi',
    dragAndDrop: 'tai vedä ja pudota',
    jpegPngSupported: 'JPEG, PNG ja SVG tuettu (max 100MB)',
    imagesLoaded: 'kuvaa ladattu',
    columnsHint: 'Sarakkeet: filename, alt_text ·',
    downloadTemplate: 'Lataa pohja',
    entries: 'merkintää',
    images: 'Kuvat',
    matched: 'Täsmätty',
    missingAltText: 'Puuttuva alt-teksti',
    clearAll: 'Tyhjennä kaikki',
    preview: 'Esikatselu',
    filename: 'Tiedostonimi',
    altText: 'Alt-teksti',
    status: 'Tila',
    enterAltText: 'Kirjoita alt-teksti...',
    statusMatched: 'Täsmätty',
    statusManual: 'Manuaalinen',
    statusNoMatch: 'Ei täsmää',
    haveAltText: 'kuvasta on alt-teksti',
    downloadAll: 'Lataa kaikki',
    uploadToStart: 'Lataa kuvia ja Excel-tiedosto aloittaaksesi.',
    processingImages: 'Käsitellään kuvia...',
    loadedEntries: 'Ladattu {count} merkintää Excelistä',
    noImagesToProcess: 'Ei kuvia alt-tekstillä käsiteltäväksi',
    downloadedImages: 'Ladattu {count} kuvaa metatiedoilla',
    errorParsingExcel: 'Virhe Excel-tiedoston jäsentämisessä',
    errorProcessing: 'Virhe kuvien käsittelyssä',
    language: 'Kieli',
    darkMode: 'Tumma tila',
    lightMode: 'Vaalea tila',
    fileTooLarge: '{filename} on liian suuri ({size}MB). Maksimikoko on {maxSize}MB.',
    someFilesSkipped: '{count} tiedostoa ohitettiin (liian suuret)'
  },
  sv: {
    title: 'Alternativ textredigerare',
    subtitle: 'Importera bilder och Excel-mappning för att batchredigera alt-textmetadata',
    imagesDropZone: 'Bilder',
    excelDropZone: 'Excel / CSV',
    clickToUpload: 'Klicka för att ladda upp',
    dragAndDrop: 'eller dra och släpp',
    jpegPngSupported: 'JPEG, PNG och SVG stöds (max 100MB)',
    imagesLoaded: 'bilder laddade',
    columnsHint: 'Kolumner: filename, alt_text ·',
    downloadTemplate: 'Ladda ner mall',
    entries: 'poster',
    images: 'Bilder',
    matched: 'Matchade',
    missingAltText: 'Saknar alt-text',
    clearAll: 'Rensa alla',
    preview: 'Förhandsvisning',
    filename: 'Filnamn',
    altText: 'Alt-text',
    status: 'Status',
    enterAltText: 'Ange alt-text...',
    statusMatched: 'Matchad',
    statusManual: 'Manuell',
    statusNoMatch: 'Ingen matchning',
    haveAltText: 'av bilder har alt-text',
    downloadAll: 'Ladda ner alla',
    uploadToStart: 'Ladda upp bilder och en Excel-fil för att komma igång.',
    processingImages: 'Bearbetar bilder...',
    loadedEntries: 'Laddat {count} poster från Excel',
    noImagesToProcess: 'Inga bilder med alt-text att bearbeta',
    downloadedImages: 'Laddat ner {count} bilder med metadata',
    errorParsingExcel: 'Fel vid tolkning av Excel-fil',
    errorProcessing: 'Fel vid bearbetning av bilder',
    language: 'Språk',
    darkMode: 'Mörkt läge',
    lightMode: 'Ljust läge',
    fileTooLarge: '{filename} är för stor ({size}MB). Maximal storlek är {maxSize}MB.',
    someFilesSkipped: '{count} filer hoppades över (för stora)'
  }
};

// ============================================
// SVG Metadata utilities
// ============================================

const SVG = {
  insertMetadata(svgText, description) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.error('SVG parsing error:', parserError);
        return svgText;
      }

      const svgElement = doc.documentElement;

      // Remove existing title element (desc is not used for accessibility)
      const existingTitle = svgElement.querySelector('title');
      if (existingTitle) existingTitle.remove();

      // Create new title element - the only field that affects browser accessibility
      const titleElement = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
      titleElement.textContent = description;

      // Insert as first child of svg element
      svgElement.insertBefore(titleElement, svgElement.firstChild);

      // Add aria-label for better accessibility
      svgElement.setAttribute('aria-label', description);
      svgElement.setAttribute('role', 'img');

      // Serialize back to string
      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (error) {
      console.error('SVG metadata insertion error:', error);
      return svgText;
    }
  }
};

// ============================================
// PNG Metadata utilities
// ============================================

const PNG = {
  SIGNATURE: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  crcTable: null,

  makeCRCTable() {
    if (this.crcTable) return this.crcTable;
    this.crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      this.crcTable[n] = c;
    }
    return this.crcTable;
  },

  crc32(bytes) {
    const table = this.makeCRCTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  },

  createXMPChunk(description) {
    // XMP dc:description - unified schema with JPEG for cross-format consistency
    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${this.escapeXML(description)}</rdf:li></rdf:Alt></dc:description>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
    // Store as iTXt chunk with XML:com.adobe.xmp keyword
    const keyword = 'XML:com.adobe.xmp';
    const keywordBytes = new TextEncoder().encode(keyword);
    const textBytes = new TextEncoder().encode(xmp);
    const data = [...keywordBytes, 0x00, 0x00, 0x00, 0x00, 0x00, ...textBytes];
    return this.createChunk('iTXt', data);
  },

  escapeXML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  createChunk(type, data) {
    const typeBytes = new TextEncoder().encode(type);
    const length = data.length;
    const lengthBytes = [(length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF];
    const crc = this.crc32([...typeBytes, ...data]);
    const crcBytes = [(crc >> 24) & 0xFF, (crc >> 16) & 0xFF, (crc >> 8) & 0xFF, crc & 0xFF];
    return [...lengthBytes, ...typeBytes, ...data, ...crcBytes];
  },

  insertMetadata(pngDataUrl, description) {
    const base64 = pngDataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    for (let i = 0; i < 8; i++) if (bytes[i] !== this.SIGNATURE[i]) return pngDataUrl;

    // Only use XMP dc:description for PNG - unified schema with JPEG
    const xmpChunk = this.createXMPChunk(description);

    let pos = 8;
    const ihdrLength = (bytes[pos] << 24) | (bytes[pos+1] << 16) | (bytes[pos+2] << 8) | bytes[pos+3];
    const insertPos = pos + 12 + ihdrLength;

    const output = [];
    for (let i = 0; i < insertPos; i++) output.push(bytes[i]);
    output.push(...xmpChunk);

    pos = insertPos;
    while (pos < bytes.length - 12) {
      const length = (bytes[pos] << 24) | (bytes[pos+1] << 16) | (bytes[pos+2] << 8) | bytes[pos+3];
      const type = String.fromCharCode(bytes[pos+4], bytes[pos+5], bytes[pos+6], bytes[pos+7]);
      const chunkEnd = pos + 12 + length;

      // Skip existing XMP chunks to avoid duplicates
      if (type === 'iTXt') {
        const dataStart = pos + 8;
        let keywordEnd = dataStart;
        while (keywordEnd < dataStart + length && bytes[keywordEnd] !== 0) keywordEnd++;
        const keyword = new TextDecoder().decode(bytes.slice(dataStart, keywordEnd));
        if (keyword === 'XML:com.adobe.xmp') { pos = chunkEnd; continue; }
      }

      for (let i = pos; i < chunkEnd; i++) output.push(bytes[i]);
      pos = chunkEnd;
      if (type === 'IEND') break;
    }

    const outputArray = new Uint8Array(output);
    let binary = '';
    for (let i = 0; i < outputArray.length; i++) binary += String.fromCharCode(outputArray[i]);
    return 'data:image/png;base64,' + btoa(binary);
  }
};

// ============================================
// JPEG XMP utilities
// ============================================

const JPEG_XMP = {
  createXMPSegment(description) {
    // XMP dc:description for multilingual and structured metadata
    const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${this.escapeXML(description)}</rdf:li></rdf:Alt></dc:description>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

    // XMP namespace identifier for APP1
    const namespace = 'http://ns.adobe.com/xap/1.0/\0';
    const namespaceBytes = Array.from(new TextEncoder().encode(namespace));
    const xmpBytes = Array.from(new TextEncoder().encode(xmp));
    const content = [...namespaceBytes, ...xmpBytes];
    const length = content.length + 2;

    // APP1 marker (0xFFE1) + length + content
    return [0xFF, 0xE1, (length >> 8) & 0xFF, length & 0xFF, ...content];
  },

  escapeXML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};

// ============================================
// IPTC utilities
// ============================================

const IPTC = {
  MARKER: 0x1C,
  RECORD_APP: 2,
  CAPTION: 120,

  stringToBytes(str) {
    return Array.from(new TextEncoder().encode(str));
  },

  createDataset(record, dataset, value) {
    const valueBytes = this.stringToBytes(value);
    const length = valueBytes.length;
    const result = [this.MARKER, record, dataset, (length >> 8) & 0xFF, length & 0xFF, ...valueBytes];
    return result;
  },

  createIPTCBlock(caption) {
    return caption ? this.createDataset(this.RECORD_APP, this.CAPTION, caption) : [];
  },

  createPhotoshopIPTCResource(iptcData) {
    const signature = [0x38, 0x42, 0x49, 0x4D];
    const resourceId = [0x04, 0x04];
    const name = [0x00, 0x00];
    const size = iptcData.length;
    const sizeBytes = [(size >> 24) & 0xFF, (size >> 16) & 0xFF, (size >> 8) & 0xFF, size & 0xFF];
    const resource = [...signature, ...resourceId, ...name, ...sizeBytes, ...iptcData];
    if (resource.length % 2 !== 0) resource.push(0x00);
    return resource;
  },

  createAPP13Segment(caption) {
    const iptcData = this.createIPTCBlock(caption);
    if (iptcData.length === 0) return null;
    const photoshopResource = this.createPhotoshopIPTCResource(iptcData);
    const identifier = [0x50, 0x68, 0x6F, 0x74, 0x6F, 0x73, 0x68, 0x6F, 0x70, 0x20, 0x33, 0x2E, 0x30, 0x00];
    const content = [...identifier, ...photoshopResource];
    const length = content.length + 2;
    return [0xFF, 0xED, (length >> 8) & 0xFF, length & 0xFF, ...content];
  }
};

function insertXMPIntoJPEG(jpegDataUrl, description) {
  const base64 = jpegDataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const xmpSegment = JPEG_XMP.createXMPSegment(description);

  const outputParts = [[bytes[0], bytes[1]]];
  let i = 2;
  let xmpInserted = false;

  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xFF) { outputParts.push(Array.from(bytes.slice(i))); break; }
    const marker = bytes[i + 1];
    if (marker === 0xD8) { i += 2; continue; }
    if (marker === 0xD9 || marker === 0xDA) {
      if (!xmpInserted) { outputParts.push(xmpSegment); xmpInserted = true; }
      outputParts.push(Array.from(bytes.slice(i)));
      break;
    }

    if ((marker >= 0xE0 && marker <= 0xEF) || marker === 0xFE || marker === 0xDB || marker === 0xC0 || marker === 0xC2 || marker === 0xC4) {
      const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3];

      // Skip existing XMP APP1 segments (check for XMP namespace)
      if (marker === 0xE1) {
        const segmentData = bytes.slice(i + 4, i + 4 + Math.min(29, segmentLength - 2));
        const segmentStr = new TextDecoder().decode(segmentData);
        if (segmentStr.startsWith('http://ns.adobe.com/xap/1.0/')) {
          i += 2 + segmentLength;
          continue;
        }
      }

      // Insert XMP after APP0 (JFIF) or first APP1 (EXIF)
      if ((marker === 0xE0 || marker === 0xE1) && !xmpInserted) {
        outputParts.push(Array.from(bytes.slice(i, i + 2 + segmentLength)));
        i += 2 + segmentLength;
        outputParts.push(xmpSegment);
        xmpInserted = true;
        continue;
      }

      outputParts.push(Array.from(bytes.slice(i, i + 2 + segmentLength)));
      i += 2 + segmentLength;
    } else { i++; }
  }

  if (!xmpInserted) outputParts.splice(1, 0, xmpSegment);

  const output = outputParts.flat();
  const outputArray = new Uint8Array(output);
  let binary = '';
  for (let j = 0; j < outputArray.length; j++) binary += String.fromCharCode(outputArray[j]);
  return 'data:image/jpeg;base64,' + btoa(binary);
}

function insertIPTCIntoJPEG(jpegDataUrl, caption) {
  const base64 = jpegDataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

  const app13 = IPTC.createAPP13Segment(caption);
  if (!app13) return jpegDataUrl;

  const outputParts = [[bytes[0], bytes[1]]];
  let i = 2;

  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xFF) { outputParts.push(Array.from(bytes.slice(i))); break; }
    const marker = bytes[i + 1];
    if (marker === 0xD8) { i += 2; continue; }
    if (marker === 0xD9 || marker === 0xDA) { outputParts.push(app13); outputParts.push(Array.from(bytes.slice(i))); break; }

    if ((marker >= 0xE0 && marker <= 0xEF) || marker === 0xFE || marker === 0xDB || marker === 0xC0 || marker === 0xC2 || marker === 0xC4) {
      const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker === 0xED) { i += 2 + segmentLength; continue; }
      if (marker === 0xE0 || marker === 0xE1) {
        outputParts.push(Array.from(bytes.slice(i, i + 2 + segmentLength)));
        i += 2 + segmentLength;
        continue;
      }
      if (!outputParts.some(p => p.length > 2 && p[0] === 0xFF && p[1] === 0xED)) outputParts.push(app13);
      outputParts.push(Array.from(bytes.slice(i, i + 2 + segmentLength)));
      i += 2 + segmentLength;
    } else { i++; }
  }

  if (!outputParts.some(p => p.length > 2 && p[0] === 0xFF && p[1] === 0xED)) outputParts.splice(1, 0, app13);

  const output = outputParts.flat();
  const outputArray = new Uint8Array(output);
  let binary = '';
  for (let i = 0; i < outputArray.length; i++) binary += String.fromCharCode(outputArray[i]);
  return 'data:image/jpeg;base64,' + btoa(binary);
}

// ============================================
// Excel utilities
// ============================================

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // Find header row and column indices
        const headers = jsonData[0]?.map(h => String(h).toLowerCase().trim()) || [];

        // Look for filename column
        const filenameIdx = headers.findIndex(h =>
          h.includes('filename') || h.includes('file') || h.includes('name') ||
          h.includes('kuva') || h.includes('tiedosto') || h === 'image'
        );

        // Look for alt text column
        const altTextIdx = headers.findIndex(h =>
          h.includes('alt') || h.includes('description') || h.includes('kuvaus') ||
          h.includes('caption') || h.includes('teksti') || h.includes('text')
        );

        if (filenameIdx === -1) {
          // Try to auto-detect: first column = filename, second = alt text
          if (jsonData.length > 1 && jsonData[0].length >= 2) {
            const mapping = {};
            for (let i = 0; i < jsonData.length; i++) {
              const row = jsonData[i];
              if (row[0] && row[1]) {
                const filename = String(row[0]).trim();
                const altText = String(row[1]).trim();
                if (filename && altText) mapping[filename] = altText;
              }
            }
            resolve({ mapping, rowCount: Object.keys(mapping).length });
            return;
          }
          reject(new Error('Could not find filename column'));
          return;
        }

        const altIdx = altTextIdx !== -1 ? altTextIdx : (filenameIdx === 0 ? 1 : 0);

        const mapping = {};
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row[filenameIdx] && row[altIdx]) {
            const filename = String(row[filenameIdx]).trim();
            const altText = String(row[altIdx]).trim();
            if (filename && altText) mapping[filename] = altText;
          }
        }

        resolve({ mapping, rowCount: Object.keys(mapping).length, headers: jsonData[0] });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeFilename(filename) {
  // Remove path, lowercase, trim
  return filename.split(/[/\\]/).pop().toLowerCase().trim();
}

function matchFilenames(imageFilename, excelFilenames) {
  const normalizedImage = normalizeFilename(imageFilename);

  // Exact match
  for (const excelName of excelFilenames) {
    if (normalizeFilename(excelName) === normalizedImage) return excelName;
  }

  // Match without extension
  const imageBase = normalizedImage.replace(/\.[^.]+$/, '');
  for (const excelName of excelFilenames) {
    const excelBase = normalizeFilename(excelName).replace(/\.[^.]+$/, '');
    if (excelBase === imageBase) return excelName;
  }

  return null;
}

// ============================================
// React App
// ============================================

// Maximum file size in bytes (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

function App() {
  const [images, setImages] = useState([]);
  const [excelData, setExcelData] = useState(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('altTextEditorLanguage') || 'fi';
  });
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('altTextEditorTheme');
    if (saved) return saved;

    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const imageInputRef = useRef(null);
  const excelInputRef = useRef(null);

  // Apply theme to document
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const color = theme === 'dark' ? '#0f172a' : '#f8fafc';
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', color);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    }
  }, [theme]);

  // Apply language to document
  React.useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('altTextEditorLanguage', lang);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('altTextEditorTheme', newTheme);
  };

  const t = (key, replacements = {}) => {
    let text = translations[language][key] || key;
    Object.keys(replacements).forEach(placeholder => {
      text = text.replace(`{${placeholder}}`, replacements[placeholder]);
    });
    return text;
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Match images with Excel data when either changes
  const matchImagesWithExcel = useCallback((imageList, excel) => {
    if (!excel?.mapping) return imageList;

    const excelFilenames = Object.keys(excel.mapping);

    return imageList.map(img => {
      const matchedKey = matchFilenames(img.name, excelFilenames);
      if (matchedKey) {
        return {
          ...img,
          altText: excel.mapping[matchedKey],
          matchStatus: 'matched',
          matchedFrom: matchedKey
        };
      }
      return { ...img, matchStatus: img.altText ? 'manual' : 'unmatched' };
    });
  }, []);

  const handleImageFiles = useCallback((files) => {
    const imageFiles = Array.from(files).filter(file =>
      file.type.startsWith('image/')
    );

    const validFiles = [];
    const oversizedFiles = [];

    imageFiles.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file);
      } else {
        validFiles.push(file);
      }
    });

    // Show error for oversized files
    if (oversizedFiles.length > 0) {
      const maxSizeMB = Math.floor(MAX_FILE_SIZE / (1024 * 1024));

      if (oversizedFiles.length === 1) {
        const file = oversizedFiles[0];
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        showToast(t('fileTooLarge', {
          filename: file.name,
          size: sizeMB,
          maxSize: maxSizeMB
        }), 'warning');
      } else {
        showToast(t('someFilesSkipped', { count: oversizedFiles.length }), 'warning');
      }
    }

    const newImages = validFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
      altText: '',
      matchStatus: 'unmatched',
      isJpeg: file.type === 'image/jpeg' || file.name.toLowerCase().match(/\.jpe?g$/),
      isPng: file.type === 'image/png' || file.name.toLowerCase().endsWith('.png'),
      isSvg: file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
    }));

    setImages(prev => {
      const combined = [...prev, ...newImages];
      return excelData ? matchImagesWithExcel(combined, excelData) : combined;
    });
  }, [excelData, matchImagesWithExcel, language]);

  const handleExcelFile = useCallback(async (file) => {
    try {
      const result = await parseExcelFile(file);
      setExcelData(result);
      setExcelFileName(file.name);
      setImages(prev => matchImagesWithExcel(prev, result));
      showToast(t('loadedEntries', { count: result.rowCount }));
    } catch (err) {
      console.error('Excel parse error:', err);
      showToast(t('errorParsingExcel'));
    }
  }, [matchImagesWithExcel, language]);

  const handleImageDrop = useCallback((e) => {
    e.preventDefault();
    setIsDraggingImages(false);
    handleImageFiles(e.dataTransfer.files);
  }, [handleImageFiles]);

  const handleExcelDrop = useCallback((e) => {
    e.preventDefault();
    setIsDraggingExcel(false);
    const file = Array.from(e.dataTransfer.files).find(f =>
      f.name.match(/\.(xlsx?|csv)$/i)
    );
    if (file) handleExcelFile(file);
  }, [handleExcelFile]);

  const updateAltText = (id, altText) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, altText, matchStatus: altText ? 'manual' : 'unmatched' } : img
    ));
  };

  const removeImage = (id) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setExcelData(null);
    setExcelFileName('');
  };

  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const dataUrlToBlob = (dataUrl) => {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  };

  const processImage = async (img) => {
    if (img.isSvg) {
      const svgText = await readFileAsText(img.file);
      const modifiedSvg = SVG.insertMetadata(svgText, img.altText);
      return { name: img.name, blob: new Blob([modifiedSvg], { type: 'image/svg+xml' }) };
    }

    let dataUrl = await readFileAsDataURL(img.file);
    let outputDataUrl = dataUrl;

    if (img.isJpeg) {
      outputDataUrl = insertXMPIntoJPEG(dataUrl, img.altText);
      outputDataUrl = insertIPTCIntoJPEG(outputDataUrl, img.altText);
    }

    if (img.isPng) {
      outputDataUrl = PNG.insertMetadata(dataUrl, img.altText);
    }

    return { name: img.name, blob: dataUrlToBlob(outputDataUrl) };
  };

  const processAndDownload = async () => {
    const imagesToProcess = images.filter(img => img.altText && (img.isJpeg || img.isPng || img.isSvg));
    if (imagesToProcess.length === 0) {
      showToast(t('noImagesToProcess'));
      return;
    }

    setIsProcessing(true);

    try {
      const processedImages = [];
      for (const img of imagesToProcess) {
        try {
          const result = await processImage(img);
          processedImages.push(result);
        } catch (error) {
          console.error(`Error processing ${img.name}:`, error);
        }
      }

      if (processedImages.length === 0) {
        showToast(t('errorProcessing'));
        return;
      }

      if (processedImages.length === 1) {
        // Single file: download directly
        const { name, blob } = processedImages[0];
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Multiple files: create ZIP
        const zip = new JSZip();
        for (const { name, blob } of processedImages) {
          zip.file(name, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'images-with-alt-text.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      showToast(t('downloadedImages', { count: processedImages.length }));
    } catch (error) {
      console.error('Processing error:', error);
      showToast(t('errorProcessing'));
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['filename', 'alt_text'],
      ['example.jpg', 'Description of the image'],
      ['photo.png', 'Another image description']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alt Texts');
    XLSX.writeFile(wb, 'alt-text-template.xlsx');
  };

  const matchedCount = images.filter(img => img.matchStatus === 'matched').length;
  const withAltTextCount = images.filter(img => img.altText).length;

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <h1>{t('title')}</h1>
          <p className="subtitle">{t('subtitle')}</p>
        </div>
        <div className="header-controls">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? t('darkMode') : t('lightMode')}
            aria-label={theme === 'light' ? t('darkMode') : t('lightMode')}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'light' ? (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <div className="language-selector">
            <button
              className={`language-btn ${language === 'fi' ? 'active' : ''}`}
              onClick={() => changeLanguage('fi')}
            >
              Suomi
            </button>
            <button
              className={`language-btn ${language === 'sv' ? 'active' : ''}`}
              onClick={() => changeLanguage('sv')}
            >
              Svenska
            </button>
          </div>
        </div>
      </header>

      <div className="upload-section">
        <div
          className={`drop-zone ${isDraggingImages ? 'dragging' : ''} ${images.length > 0 ? 'has-content' : ''}`}
          onDrop={handleImageDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingImages(true); }}
          onDragLeave={() => setIsDraggingImages(false)}
          onClick={() => imageInputRef.current?.click()}
        >
          <svg className="drop-zone-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="drop-zone-title">{t('imagesDropZone')}</div>
          <p className="drop-zone-text"><strong>{t('clickToUpload')}</strong> {t('dragAndDrop')}</p>
          <p className="drop-zone-hint">{t('jpegPngSupported')}</p>
          {images.length > 0 && (
            <div className="drop-zone-status success">{images.length} {t('imagesLoaded')}</div>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/svg+xml,.jpg,.jpeg,.png,.svg"
            multiple
            onChange={(e) => { handleImageFiles(e.target.files); e.target.value = ''; }}
            style={{ display: 'none' }}
          />
        </div>

        <div
          className={`drop-zone ${isDraggingExcel ? 'dragging' : ''} ${excelData ? 'has-content' : ''}`}
          onDrop={handleExcelDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingExcel(true); }}
          onDragLeave={() => setIsDraggingExcel(false)}
          onClick={() => excelInputRef.current?.click()}
        >
          <svg className="drop-zone-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="drop-zone-title">{t('excelDropZone')}</div>
          <p className="drop-zone-text"><strong>{t('clickToUpload')}</strong> {t('dragAndDrop')}</p>
          <p className="drop-zone-hint">
            {t('columnsHint')} <span className="template-link" onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}>{t('downloadTemplate')}</span>
          </p>
          {excelData && (
            <div className="drop-zone-status success">{excelFileName} ({excelData.rowCount} {t('entries')})</div>
          )}
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => { if (e.target.files[0]) handleExcelFile(e.target.files[0]); e.target.value = ''; }}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {images.length > 0 && (
        <>
          <div className="match-summary">
            <div className="match-stats">
              <div className="stat-item">
                <div className="stat-value total">{images.length}</div>
                <div className="stat-label">{t('images')}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value matched">{matchedCount}</div>
                <div className="stat-label">{t('matched')}</div>
              </div>
              <div className="stat-item">
                <div className="stat-value unmatched">{images.length - withAltTextCount}</div>
                <div className="stat-label">{t('missingAltText')}</div>
              </div>
            </div>
            <div className="btn-group">
              <button className="btn btn-secondary btn-sm" onClick={clearAll}>{t('clearAll')}</button>
            </div>
          </div>

          <div className="images-table">
            <div className="table-header">
              <div>{t('preview')}</div>
              <div>{t('filename')}</div>
              <div>{t('altText')}</div>
              <div>{t('status')}</div>
            </div>
            {images.map(img => (
              <div className="table-row" key={img.id}>
                <img className="row-thumbnail" src={img.preview} alt="" />
                <div className="row-filename">{img.name}</div>
                <div>
                  <textarea
                    className="row-alttext-input"
                    value={img.altText}
                    onChange={(e) => updateAltText(img.id, e.target.value)}
                    placeholder={t('enterAltText')}
                    rows={2}
                  />
                </div>
                <div className="row-status">
                  <span className={`status-badge ${img.matchStatus}`}>
                    {img.matchStatus === 'matched' ? t('statusMatched') :
                     img.matchStatus === 'manual' ? t('statusManual') : t('statusNoMatch')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="actions-bar">
            <div className="info-text">
              {withAltTextCount} / {images.length} {t('haveAltText')}
            </div>
            <button
              className="btn btn-primary"
              onClick={processAndDownload}
              disabled={withAltTextCount === 0}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('downloadAll')} ({withAltTextCount})
            </button>
          </div>
        </>
      )}

      {images.length === 0 && (
        <div className="empty-state">
          <p>{t('uploadToStart')}</p>
        </div>
      )}

      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-content">
            <div className="spinner"></div>
            <p>{t('processingImages')}</p>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type || 'success'}`}>
          {toast.type === 'warning' ? (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : toast.type === 'error' ? (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
