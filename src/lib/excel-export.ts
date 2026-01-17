/**
 * Native Excel Export Utility
 * Creates XLSX files without vulnerable dependencies
 * Uses the Office Open XML format specification
 */

interface SheetData {
  name: string;
  data: (string | number | null | undefined)[][];
  columnWidths?: number[];
}

interface WorkbookOptions {
  sheets: SheetData[];
  fileName: string;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert column index to Excel column letter (0 = A, 26 = AA, etc.)
 */
function getColumnLetter(index: number): string {
  let letter = '';
  let num = index;
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26) - 1;
  }
  return letter;
}

/**
 * Generate the content types XML
 */
function generateContentTypes(sheetCount: number): string {
  let sheetOverrides = '';
  for (let i = 1; i <= sheetCount; i++) {
    sheetOverrides += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetOverrides}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
}

/**
 * Generate the root relationships XML
 */
function generateRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

/**
 * Generate the workbook relationships XML
 */
function generateWorkbookRels(sheetCount: number): string {
  let sheetRels = '';
  for (let i = 1; i <= sheetCount; i++) {
    sheetRels += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId${sheetCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
}

/**
 * Generate the workbook XML
 */
function generateWorkbook(sheets: SheetData[]): string {
  let sheetNodes = '';
  sheets.forEach((sheet, index) => {
    const safeName = escapeXml(sheet.name.substring(0, 31)); // Excel sheet name limit
    sheetNodes += `<sheet name="${safeName}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`;
  });
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetNodes}
  </sheets>
</workbook>`;
}

/**
 * Generate styles XML (basic styling)
 */
function generateStyles(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;
}

/**
 * Build shared strings table and return the XML plus a mapping
 */
function buildSharedStrings(sheets: SheetData[]): { xml: string; stringMap: Map<string, number> } {
  const strings: string[] = [];
  const stringMap = new Map<string, number>();
  
  sheets.forEach(sheet => {
    sheet.data.forEach(row => {
      row.forEach(cell => {
        if (typeof cell === 'string' && !stringMap.has(cell)) {
          stringMap.set(cell, strings.length);
          strings.push(cell);
        }
      });
    });
  });
  
  let siNodes = '';
  strings.forEach(str => {
    siNodes += `<si><t>${escapeXml(str)}</t></si>`;
  });
  
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
  ${siNodes}
</sst>`;
  
  return { xml, stringMap };
}

/**
 * Generate a worksheet XML
 */
function generateWorksheet(sheet: SheetData, stringMap: Map<string, number>): string {
  let sheetDataXml = '';
  
  sheet.data.forEach((row, rowIndex) => {
    let rowXml = `<row r="${rowIndex + 1}">`;
    
    row.forEach((cell, colIndex) => {
      const cellRef = `${getColumnLetter(colIndex)}${rowIndex + 1}`;
      
      if (cell === null || cell === undefined || cell === '') {
        // Empty cell - skip
      } else if (typeof cell === 'number') {
        rowXml += `<c r="${cellRef}"><v>${cell}</v></c>`;
      } else {
        const stringIndex = stringMap.get(String(cell));
        if (stringIndex !== undefined) {
          rowXml += `<c r="${cellRef}" t="s"><v>${stringIndex}</v></c>`;
        }
      }
    });
    
    rowXml += '</row>';
    sheetDataXml += rowXml;
  });
  
  // Column widths
  let colsXml = '';
  if (sheet.columnWidths && sheet.columnWidths.length > 0) {
    colsXml = '<cols>';
    sheet.columnWidths.forEach((width, index) => {
      colsXml += `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    });
    colsXml += '</cols>';
  }
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  <sheetData>
    ${sheetDataXml}
  </sheetData>
</worksheet>`;
}

/**
 * Create a ZIP file structure as a Uint8Array
 * Simple ZIP implementation for XLSX files
 */
function createZip(files: { path: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const centralDirectory: Uint8Array[] = [];
  const fileData: Uint8Array[] = [];
  let offset = 0;
  
  files.forEach(file => {
    const content = encoder.encode(file.content);
    const path = encoder.encode(file.path);
    
    // Local file header
    const localHeader = new Uint8Array(30 + path.length);
    const view = new DataView(localHeader.buffer);
    
    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed to extract
    view.setUint16(6, 0, true); // General purpose bit flag
    view.setUint16(8, 0, true); // Compression method (stored)
    view.setUint16(10, 0, true); // File last modification time
    view.setUint16(12, 0, true); // File last modification date
    view.setUint32(14, crc32(content), true); // CRC-32
    view.setUint32(18, content.length, true); // Compressed size
    view.setUint32(22, content.length, true); // Uncompressed size
    view.setUint16(26, path.length, true); // File name length
    view.setUint16(28, 0, true); // Extra field length
    localHeader.set(path, 30);
    
    // Central directory entry
    const centralEntry = new Uint8Array(46 + path.length);
    const centralView = new DataView(centralEntry.buffer);
    
    centralView.setUint32(0, 0x02014b50, true); // Central directory signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 20, true); // Version needed to extract
    centralView.setUint16(8, 0, true); // General purpose bit flag
    centralView.setUint16(10, 0, true); // Compression method
    centralView.setUint16(12, 0, true); // File last modification time
    centralView.setUint16(14, 0, true); // File last modification date
    centralView.setUint32(16, crc32(content), true); // CRC-32
    centralView.setUint32(20, content.length, true); // Compressed size
    centralView.setUint32(24, content.length, true); // Uncompressed size
    centralView.setUint16(28, path.length, true); // File name length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // File comment length
    centralView.setUint16(34, 0, true); // Disk number start
    centralView.setUint16(36, 0, true); // Internal file attributes
    centralView.setUint32(38, 0, true); // External file attributes
    centralView.setUint32(42, offset, true); // Relative offset of local header
    centralEntry.set(path, 46);
    
    fileData.push(localHeader);
    fileData.push(content);
    centralDirectory.push(centralEntry);
    
    offset += localHeader.length + content.length;
  });
  
  // End of central directory record
  const centralDirSize = centralDirectory.reduce((sum, entry) => sum + entry.length, 0);
  const endOfCentralDir = new Uint8Array(22);
  const endView = new DataView(endOfCentralDir.buffer);
  
  endView.setUint32(0, 0x06054b50, true); // End of central directory signature
  endView.setUint16(4, 0, true); // Number of this disk
  endView.setUint16(6, 0, true); // Disk where central directory starts
  endView.setUint16(8, files.length, true); // Number of central directory records on this disk
  endView.setUint16(10, files.length, true); // Total number of central directory records
  endView.setUint32(12, centralDirSize, true); // Size of central directory
  endView.setUint32(16, offset, true); // Offset of start of central directory
  endView.setUint16(20, 0, true); // Comment length
  
  // Combine all parts
  const totalLength = offset + centralDirSize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  
  fileData.forEach(data => {
    result.set(data, pos);
    pos += data.length;
  });
  
  centralDirectory.forEach(entry => {
    result.set(entry, pos);
    pos += entry.length;
  });
  
  result.set(endOfCentralDir, pos);
  
  return result;
}

/**
 * CRC-32 implementation for ZIP files
 */
function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Export data to an XLSX file and trigger download
 */
export function exportToXlsx(options: WorkbookOptions): void {
  const { sheets, fileName } = options;
  
  // Build shared strings
  const { xml: sharedStringsXml, stringMap } = buildSharedStrings(sheets);
  
  // Generate all XML files
  const files: { path: string; content: string }[] = [
    { path: '[Content_Types].xml', content: generateContentTypes(sheets.length) },
    { path: '_rels/.rels', content: generateRootRels() },
    { path: 'xl/_rels/workbook.xml.rels', content: generateWorkbookRels(sheets.length) },
    { path: 'xl/workbook.xml', content: generateWorkbook(sheets) },
    { path: 'xl/styles.xml', content: generateStyles() },
    { path: 'xl/sharedStrings.xml', content: sharedStringsXml },
  ];
  
  // Add worksheets
  sheets.forEach((sheet, index) => {
    files.push({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: generateWorksheet(sheet, stringMap),
    });
  });
  
  // Create ZIP
  const zipData = createZip(files);
  
  // Download - create ArrayBuffer copy for Blob compatibility
  const arrayBuffer = new ArrayBuffer(zipData.length);
  const view = new Uint8Array(arrayBuffer);
  view.set(zipData);
  
  const blob = new Blob([arrayBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper: Convert array of objects to array of arrays (with headers)
 */
export function jsonToSheet<T extends Record<string, unknown>>(
  data: T[],
  headers?: { key: keyof T; label: string }[]
): (string | number | null)[][] {
  if (data.length === 0) return [];
  
  const keys = headers 
    ? headers.map(h => h.key) 
    : (Object.keys(data[0]) as (keyof T)[]);
  
  const headerLabels = headers 
    ? headers.map(h => h.label) 
    : keys.map(k => String(k));
  
  const rows: (string | number | null)[][] = [headerLabels];
  
  data.forEach(item => {
    const row = keys.map(key => {
      const value = item[key];
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      return String(value);
    });
    rows.push(row);
  });
  
  return rows;
}

/**
 * Helper: Convert array of arrays to sheet format (already in correct format)
 */
export function aoaToSheet(data: (string | number | null | undefined)[][]): (string | number | null | undefined)[][] {
  return data;
}
