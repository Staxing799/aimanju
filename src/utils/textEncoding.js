const MOJIBAKE_REGEX = /(?:Ã.|Â.|å.|æ.|ç.|ï¼|ï½|â€|â€™|â€œ|â€\x9d|Ã—)/;
const MOJIBAKE_REGEX_GLOBAL = /(?:Ã.|Â.|å.|æ.|ç.|ï¼|ï½|â€|â€™|â€œ|â€\x9d|Ã—)/g;
const CJK_REGEX_GLOBAL = /[\u3400-\u4dbf\u4e00-\u9fff]/g;
const REPLACEMENT_REGEX_GLOBAL = /\uFFFD/g;

const CP1252_EXTENDED_TO_BYTE = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function scoreTextQuality(text) {
  const replacementCount = countMatches(text, REPLACEMENT_REGEX_GLOBAL);
  const mojibakeCount = countMatches(text, MOJIBAKE_REGEX_GLOBAL);
  const cjkCount = countMatches(text, CJK_REGEX_GLOBAL);
  return cjkCount * 2 - mojibakeCount * 8 - replacementCount * 10;
}

function mapCodePointToCp1252Byte(codePoint) {
  if (codePoint <= 0xff) {
    return codePoint;
  }
  return CP1252_EXTENDED_TO_BYTE.get(codePoint);
}

function decodeUtf8FromCp1252(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const byte = mapCodePointToCp1252Byte(text.charCodeAt(index));
    if (byte == null) {
      return null;
    }
    bytes[index] = byte;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function detectBom(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', offset: 3 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: 'utf-16le', offset: 2 };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: 'utf-16be', offset: 2 };
  }
  return null;
}

function decodeWithEncoding(bytes, encoding) {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizePossiblyMojibakeText(value) {
  if (typeof value !== 'string' || !value || !MOJIBAKE_REGEX.test(value)) {
    return value;
  }

  const repaired = decodeUtf8FromCp1252(value);
  if (!repaired) {
    return value;
  }

  return scoreTextQuality(repaired) > scoreTextQuality(value) ? repaired : value;
}

export function normalizePossiblyMojibakeValue(value) {
  if (typeof value === 'string') {
    return normalizePossiblyMojibakeText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizePossiblyMojibakeValue(item));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizePossiblyMojibakeValue(item)]),
    );
  }
  return value;
}

export async function readTextFileWithEncodingFallback(file) {
  const fileBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(fileBuffer);

  const bom = detectBom(bytes);
  if (bom) {
    const decoded = decodeWithEncoding(bytes.slice(bom.offset), bom.encoding);
    return normalizePossiblyMojibakeText(decoded || '');
  }

  const encodings = ['utf-8', 'gb18030', 'gbk', 'utf-16le', 'utf-16be'];
  let bestText = '';
  let bestScore = Number.NEGATIVE_INFINITY;

  encodings.forEach((encoding) => {
    const decoded = decodeWithEncoding(bytes, encoding);
    if (decoded == null) {
      return;
    }
    const score = scoreTextQuality(decoded);
    if (score > bestScore) {
      bestScore = score;
      bestText = decoded;
    }
  });

  return normalizePossiblyMojibakeText(bestText);
}
