/**
 * Pure TypeScript Audio Metadata & Cover Art Parser + ID3v2.3 Writer
 * Supports reading embedded cover art from MP3 (ID3v2), FLAC, and M4A/MP4,
 * and writing updated cover art (APIC) & tags (TIT2, TPE1, TALB) directly into MP3 buffers.
 */

export interface ParsedAudioTags {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  coverBlob?: Blob;
}

const ID3V1_GENRES: string[] = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae',
  'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks',
  'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion',
  'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip',
  'Gospel', 'Noise', 'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative',
  'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave',
  'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream',
  'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap',
  'Pop/Funk', 'Jungle', 'Native American', 'Cabaret', 'New Wave', 'Psychadelic',
  'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz',
  'Polka', 'Retro', 'Musical', 'Rock & Roll', 'Hard Rock', 'Folk', 'Folk-Rock',
  'National Folk', 'Swing', 'Fast Fusion', 'Bebop', 'Latin', 'Revival', 'Celtic',
  'Bluegrass', 'Avantgarde', 'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock',
  'Symphonic Rock', 'Slow Rock', 'Big Band', 'Chorus', 'Easy Listening', 'Acoustic',
  'Humour', 'Speech', 'Chanson', 'Opera', 'Chamber Music', 'Sonata', 'Symphony',
  'Booty Bass', 'Primus', 'Porn Groove', 'Satire', 'Slow Jam', 'Club', 'Tango',
  'Samba', 'Folklore', 'Ballad', 'Power Ballad', 'Rhythmic Soul', 'Freestyle',
  'Duet', 'Punk Rock', 'Drum Solo', 'A capella', 'Euro-House', 'Dance Hall',
  'Goa', 'Drum & Bass', 'Club-House', 'Hardcore', 'Terror', 'Indie', 'BritPop',
  'Negerpunk', 'Polsk Punk', 'Beat', 'Christian Gangsta Rap', 'Heavy Metal',
  'Black Metal', 'Crossover', 'Contemporary Christian', 'Christian Rock', 'Merengue',
  'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop',
];

function normalizeGenreTag(raw: string): string {
  const cleaned = raw.replace(/\0/g, '').trim();
  if (!cleaned) return '';
  const parenWithText = cleaned.match(/^\((\d+)\)\s*(.+)$/);
  if (parenWithText) {
    const tail = parenWithText[2].trim();
    if (tail && !/^\(\d+\)/.test(tail)) return tail;
    const idx = Number(parenWithText[1]);
    return ID3V1_GENRES[idx] || cleaned;
  }
  const parenOnly = cleaned.match(/^\((\d+)\)$/);
  if (parenOnly) {
    const idx = Number(parenOnly[1]);
    return ID3V1_GENRES[idx] || cleaned;
  }
  if (/^\d{1,3}$/.test(cleaned)) {
    const idx = Number(cleaned);
    return ID3V1_GENRES[idx] || cleaned;
  }
  return cleaned;
}

function syncSafeToInt(b0: number, b1: number, b2: number, b3: number): number {
  return ((b0 & 0x7f) << 21) | ((b1 & 0x7f) << 14) | ((b2 & 0x7f) << 7) | (b3 & 0x7f);
}

function intToSyncSafe(val: number): [number, number, number, number] {
  return [
    (val >> 21) & 0x7f,
    (val >> 14) & 0x7f,
    (val >> 7) & 0x7f,
    val & 0x7f,
  ];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function decodeTextBytes(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      return new TextDecoder('iso-8859-1').decode(bytes).replace(/\0+$/g, '').trim();
    }
    if (encoding === 1) {
      // UTF-16 with BOM
      if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder('utf-16le').decode(bytes.subarray(2)).replace(/\0+$/g, '').trim();
      }
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder('utf-16be').decode(bytes.subarray(2)).replace(/\0+$/g, '').trim();
      }
      return new TextDecoder('utf-16le').decode(bytes).replace(/\0+$/g, '').trim();
    }
    if (encoding === 2) {
      return new TextDecoder('utf-16be').decode(bytes).replace(/\0+$/g, '').trim();
    }
    return new TextDecoder('utf-8').decode(bytes).replace(/\0+$/g, '').trim();
  } catch {
    return '';
  }
}

function findNullTerminator(bytes: Uint8Array, start: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) return i;
    }
    return bytes.length;
  }
  for (let i = start; i < bytes.length; i++) {
    if (bytes[i] === 0) return i;
  }
  return bytes.length;
}

function parseId3v2(bytes: Uint8Array): ParsedAudioTags {
  const result: ParsedAudioTags = {};
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return result;
  }

  const version = bytes[3];
  const flags = bytes[5];
  const tagSize = syncSafeToInt(bytes[6], bytes[7], bytes[8], bytes[9]);
  const tagEnd = Math.min(bytes.length, 10 + tagSize);

  let offset = 10;
  // Extended header in v2.3 / v2.4
  if ((flags & 0x40) !== 0 && offset + 4 <= tagEnd) {
    const extSize =
      version === 4
        ? syncSafeToInt(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
        : readUint32BE(bytes, offset) + 4;
    offset += extSize;
  }

  if (version === 2) {
    // ID3v2.2 6-byte frame headers
    while (offset + 6 <= tagEnd) {
      const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
      if (frameId === '\0\0\0') break;
      const frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
      offset += 6;
      if (frameSize <= 0 || offset + frameSize > tagEnd) break;
      const data = bytes.subarray(offset, offset + frameSize);
      offset += frameSize;

      if (frameId === 'TT2' && data.length > 1) {
        result.title = decodeTextBytes(data.subarray(1), data[0]);
      } else if (frameId === 'TP1' && data.length > 1) {
        result.artist = decodeTextBytes(data.subarray(1), data[0]);
      } else if (frameId === 'TAL' && data.length > 1) {
        result.album = decodeTextBytes(data.subarray(1), data[0]);
      } else if (frameId === 'TCO' && data.length > 1) {
        const g = normalizeGenreTag(decodeTextBytes(data.subarray(1), data[0]));
        if (g) result.genre = g;
      } else if (frameId === 'PIC' && data.length > 6 && !result.coverBlob) {
        const encoding = data[0];
        const imgFormat = String.fromCharCode(data[1], data[2], data[3]).toLowerCase();
        const mime = imgFormat === 'png' ? 'image/png' : 'image/jpeg';
        const descEnd = findNullTerminator(data, 5, encoding);
        const step = encoding === 1 || encoding === 2 ? 2 : 1;
        const imgStart = Math.min(data.length, descEnd + step);
        if (imgStart < data.length) {
          result.coverBlob = new Blob([data.slice(imgStart)], { type: mime });
        }
      }
    }
    return result;
  }

  // ID3v2.3 & ID3v2.4 10-byte frame headers
  while (offset + 10 <= tagEnd) {
    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    if (frameId === '\0\0\0\0') break;

    const frameSize =
      version === 4
        ? syncSafeToInt(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
        : readUint32BE(bytes, offset + 4);
    offset += 10;

    if (frameSize <= 0 || offset + frameSize > tagEnd) break;
    const data = bytes.subarray(offset, offset + frameSize);
    offset += frameSize;

    if (frameId === 'TIT2' && data.length > 1) {
      result.title = decodeTextBytes(data.subarray(1), data[0]);
    } else if (frameId === 'TPE1' && data.length > 1) {
      result.artist = decodeTextBytes(data.subarray(1), data[0]);
    } else if (frameId === 'TALB' && data.length > 1) {
      result.album = decodeTextBytes(data.subarray(1), data[0]);
    } else if (frameId === 'TCON' && data.length > 1) {
      const g = normalizeGenreTag(decodeTextBytes(data.subarray(1), data[0]));
      if (g) result.genre = g;
    } else if (frameId === 'APIC' && data.length > 4 && !result.coverBlob) {
      const encoding = data[0];
      let mimeEnd = 1;
      while (mimeEnd < data.length && data[mimeEnd] !== 0) mimeEnd++;
      let mime = new TextDecoder('iso-8859-1').decode(data.subarray(1, mimeEnd)).trim();
      if (!mime.includes('/')) {
        mime = mime.toLowerCase().includes('png') ? 'image/png' : 'image/jpeg';
      }
      const descStart = mimeEnd + 2; // skip null + pictureType byte
      if (descStart < data.length) {
        const descEnd = findNullTerminator(data, descStart, encoding);
        const step = encoding === 1 || encoding === 2 ? 2 : 1;
        const imgStart = Math.min(data.length, descEnd + step);
        if (imgStart < data.length) {
          result.coverBlob = new Blob([data.slice(imgStart)], { type: mime });
        }
      }
    }
  }

  return result;
}

function parseFlac(bytes: Uint8Array): ParsedAudioTags {
  const result: ParsedAudioTags = {};
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x66 ||
    bytes[1] !== 0x4c ||
    bytes[2] !== 0x61 ||
    bytes[3] !== 0x43
  ) {
    return result;
  }

  let offset = 4;
  while (offset + 4 <= bytes.length) {
    const header = bytes[offset];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const length = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;
    if (offset + length > bytes.length) break;
    const block = bytes.subarray(offset, offset + length);
    offset += length;

    if (blockType === 4 && block.length >= 8) {
      // VORBIS_COMMENT (little endian lengths)
      const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
      let pos = 0;
      const vendorLen = dv.getUint32(pos, true);
      pos += 4 + vendorLen;
      if (pos + 4 <= block.length) {
        const count = dv.getUint32(pos, true);
        pos += 4;
        for (let i = 0; i < count && pos + 4 <= block.length; i++) {
          const len = dv.getUint32(pos, true);
          pos += 4;
          if (pos + len > block.length) break;
          const comment = new TextDecoder('utf-8').decode(block.subarray(pos, pos + len));
          pos += len;
          const eq = comment.indexOf('=');
          if (eq > 0) {
            const key = comment.slice(0, eq).toUpperCase();
            const val = comment.slice(eq + 1).trim();
            if (key === 'TITLE') result.title = val;
            else if (key === 'ARTIST') result.artist = val;
            else if (key === 'ALBUM') result.album = val;
            else if (key === 'GENRE') {
              const g = normalizeGenreTag(val);
              if (g) result.genre = g;
            }
          }
        }
      }
    } else if (blockType === 6 && block.length >= 32 && !result.coverBlob) {
      // PICTURE block
      const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
      let pos = 4; // skip picture type
      const mimeLen = dv.getUint32(pos, false);
      pos += 4;
      const mime = new TextDecoder('ascii').decode(block.subarray(pos, pos + mimeLen));
      pos += mimeLen;
      const descLen = dv.getUint32(pos, false);
      pos += 4 + descLen + 16; // skip width, height, depth, colors
      if (pos + 4 <= block.length) {
        const dataLen = dv.getUint32(pos, false);
        pos += 4;
        if (pos + dataLen <= block.length) {
          result.coverBlob = new Blob([block.slice(pos, pos + dataLen)], {
            type: mime || 'image/jpeg',
          });
        }
      }
    }

    if (isLast) break;
  }

  return result;
}

export async function parseAudioFileTags(file: File): Promise<ParsedAudioTags> {
  try {
    // Read up to first 1.5MB which holds ID3/FLAC artwork headers on virtually all songs
    const slice = file.slice(0, Math.min(file.size, 1536 * 1024));
    const buf = await slice.arrayBuffer();
    const bytes = new Uint8Array(buf);

    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      // Check if full ID3 header exceeds 1.5MB
      const declaredTagSize = syncSafeToInt(bytes[6], bytes[7], bytes[8], bytes[9]) + 10;
      if (declaredTagSize > bytes.length && declaredTagSize <= file.size && declaredTagSize <= 16 * 1024 * 1024) {
        const fullSlice = await file.slice(0, declaredTagSize).arrayBuffer();
        return parseId3v2(new Uint8Array(fullSlice));
      }
      return parseId3v2(bytes);
    }

    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return parseFlac(bytes);
    }

    return {};
  } catch {
    return {};
  }
}

function buildTextFrame(id: string, value: string): Uint8Array {
  const idBytes = new TextEncoder().encode(id);
  const textBytes = new TextEncoder().encode(value);
  // ID3v2.3 UTF-8 isn't standard in v2.3, so use UTF-16LE with BOM (encoding byte 0x01) for full unicode/emoji support!
  const utf16 = new Uint8Array(2 + value.length * 2);
  utf16[0] = 0xff;
  utf16[1] = 0xfe;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    utf16[2 + i * 2] = code & 0xff;
    utf16[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }

  // Fallback check: ASCII-only fits cleanly in encoding 0x00 (ISO-8859-1) if no high chars
  const isAscii = /^[\x20-\x7e]*$/.test(value);
  const payload = isAscii ? new Uint8Array(1 + textBytes.length) : new Uint8Array(1 + utf16.length);
  if (isAscii) {
    payload[0] = 0x00;
    payload.set(textBytes, 1);
  } else {
    payload[0] = 0x01;
    payload.set(utf16, 1);
  }

  const frame = new Uint8Array(10 + payload.length);
  frame.set(idBytes, 0);
  const size = payload.length;
  frame[4] = (size >> 24) & 0xff;
  frame[5] = (size >> 16) & 0xff;
  frame[6] = (size >> 8) & 0xff;
  frame[7] = size & 0xff;
  frame[8] = 0;
  frame[9] = 0;
  frame.set(payload, 10);
  return frame;
}

function buildApicFrame(imageBytes: Uint8Array, mime: string): Uint8Array {
  const safeMime = mime || 'image/jpeg';
  const mimeBytes = new TextEncoder().encode(safeMime);
  // [encoding 0x00][mime][0x00][pictureType 0x03 (front cover)][desc 0x00][imageBytes]
  const payloadLen = 1 + mimeBytes.length + 1 + 1 + 1 + imageBytes.length;
  const frame = new Uint8Array(10 + payloadLen);
  frame.set(new TextEncoder().encode('APIC'), 0);
  frame[4] = (payloadLen >> 24) & 0xff;
  frame[5] = (payloadLen >> 16) & 0xff;
  frame[6] = (payloadLen >> 8) & 0xff;
  frame[7] = payloadLen & 0xff;
  frame[8] = 0;
  frame[9] = 0;

  let p = 10;
  frame[p++] = 0x00;
  frame.set(mimeBytes, p);
  p += mimeBytes.length;
  frame[p++] = 0x00; // mime null
  frame[p++] = 0x03; // Cover (front)
  frame[p++] = 0x00; // empty description null
  frame.set(imageBytes, p);
  return frame;
}

/**
 * Rewrites ID3v2.3 header on an MP3 ArrayBuffer with updated Title, Artist, Album, and APIC cover art,
 * preserving the exact original audio frames.
 */
export function buildUpdatedMp3Buffer(
  originalBuffer: ArrayBuffer,
  updates: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    coverBytes?: Uint8Array;
    coverMime?: string;
  }
): Uint8Array {
  const origBytes = new Uint8Array(originalBuffer);
  let audioStart = 0;
  let existingTags: ParsedAudioTags = {};

  if (
    origBytes.length >= 10 &&
    origBytes[0] === 0x49 &&
    origBytes[1] === 0x44 &&
    origBytes[2] === 0x33
  ) {
    const tagSize = syncSafeToInt(origBytes[6], origBytes[7], origBytes[8], origBytes[9]);
    audioStart = Math.min(origBytes.length, 10 + tagSize);
    existingTags = parseId3v2(origBytes);
  }

  const frames: Uint8Array[] = [];
  const finalTitle = updates.title ?? existingTags.title;
  const finalArtist = updates.artist ?? existingTags.artist;
  const finalAlbum = updates.album ?? existingTags.album;
  const finalGenre = updates.genre ?? existingTags.genre;

  if (finalTitle) frames.push(buildTextFrame('TIT2', finalTitle));
  if (finalArtist) frames.push(buildTextFrame('TPE1', finalArtist));
  if (finalAlbum) frames.push(buildTextFrame('TALB', finalAlbum));
  if (finalGenre) frames.push(buildTextFrame('TCON', finalGenre));
  if (updates.coverBytes && updates.coverBytes.length > 0) {
    frames.push(buildApicFrame(updates.coverBytes, updates.coverMime || 'image/jpeg'));
  }

  const totalFramesSize = frames.reduce((acc, f) => acc + f.length, 0);
  const padding = 256;
  const id3Size = totalFramesSize + padding;
  const [s0, s1, s2, s3] = intToSyncSafe(id3Size);

  const header = new Uint8Array(10);
  header[0] = 0x49; // I
  header[1] = 0x44; // D
  header[2] = 0x33; // 3
  header[3] = 0x03; // v2.3
  header[4] = 0x00;
  header[5] = 0x00;
  header[6] = s0;
  header[7] = s1;
  header[8] = s2;
  header[9] = s3;

  const audioBody = origBytes.subarray(audioStart);
  const out = new Uint8Array(10 + id3Size + audioBody.length);
  out.set(header, 0);
  let pos = 10;
  for (const f of frames) {
    out.set(f, pos);
    pos += f.length;
  }
  // padding bytes remain 0
  out.set(audioBody, 10 + id3Size);
  return out;
}
