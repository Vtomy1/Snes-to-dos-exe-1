/**
 * SNES ROM Parser and Demo ROM Generator
 * Parses real .smc, .sfc binaries, strips copier headers, extracts vectors & header fields,
 * and provides built-in pre-baked demos.
 */

import { SNESHeader, SNESRomData, SNESMapping, SNESSpeed } from '../types/rom';

// Countries table according to Nintendo SNES spec
const SNES_COUNTRIES: Record<number, string> = {
  0x00: 'Japan (NTSC)',
  0x01: 'North America (NTSC)',
  0x02: 'Europe (PAL)',
  0x03: 'Scandinavia (PAL)',
  0x04: 'Finland (PAL)',
  0x05: 'Denmark (PAL)',
  0x06: 'France (SECAM/PAL)',
  0x07: 'Holland (PAL)',
  0x08: 'Spain (PAL)',
  0x09: 'Germany, Austria, Switzerland (PAL)',
  0x0A: 'Italy (PAL)',
  0x0B: 'Hong Kong, China (PAL)',
  0x0C: 'Indonesia (PAL)',
  0x0D: 'South Korea (NTSC)',
  0x0E: 'Common',
  0x0F: 'Canada (NTSC)',
  0x10: 'Brazil (PAL-M)',
  0x11: 'Australia (PAL)',
};

const CARTRIDGE_TYPES: Record<number, string> = {
  0x00: 'ROM Only',
  0x01: 'ROM + RAM',
  0x02: 'ROM + RAM + Battery',
  0x03: 'ROM + DSP-1',
  0x04: 'ROM + DSP-1 + RAM',
  0x05: 'ROM + DSP-1 + RAM + Battery',
  0x13: 'ROM + SuperFX',
  0x14: 'ROM + SuperFX + RAM',
  0x15: 'ROM + SuperFX + RAM + Battery',
  0x25: 'ROM + OBC1 + RAM + Battery',
  0x34: 'ROM + SA-1 + RAM',
  0x35: 'ROM + SA-1 + RAM + Battery',
  0x43: 'ROM + S-DD1',
  0x45: 'ROM + S-DD1 + RAM + Battery',
  0xE3: 'ROM + GameBoy Super Connector',
  0xF6: 'ROM + DSP-2',
};

// Converts 15-bit SNES BGR555 to standard 24-bit RGB [R, G, B]
export function snesColorToRgb(bgr555: number): [number, number, number] {
  const r5 = bgr555 & 0x1F;
  const g5 = (bgr555 >> 5) & 0x1F;
  const b5 = (bgr555 >> 10) & 0x1F;

  // Scale 5-bit (0..31) to 8-bit (0..255)
  const r8 = Math.round((r5 * 255) / 31);
  const g8 = Math.round((g5 * 255) / 31);
  const b8 = Math.round((b5 * 255) / 31);
  return [r8, g8, b8];
}

// Convert RGB [0..255] to 6-bit VGA DAC [0..63]
export function rgbToVgaDac(r: number, g: number, b: number): [number, number, number] {
  return [
    Math.min(63, Math.max(0, Math.floor(r / 4))),
    Math.min(63, Math.max(0, Math.floor(g / 4))),
    Math.min(63, Math.max(0, Math.floor(b / 4)))
  ];
}

/**
 * Parses an SNES ROM buffer
 */
export function parseSnesRom(fileBuffer: Uint8Array, fileName: string): SNESRomData {
  let hasCopierHeader = false;
  let rawBuffer = fileBuffer;

  // Check for 512-byte copier header (SMC, FIG, SWC)
  if (fileBuffer.length % 1024 === 512) {
    hasCopierHeader = true;
    rawBuffer = fileBuffer.slice(512);
  }

  // Potential header locations in the cleaned buffer
  // LoROM: 0x7FC0, HiROM: 0xFFC0, ExHiROM: 0x40FFC0
  const candidateOffsets = [0x7FC0, 0xFFC0, 0x40FFC0, 0x7FB0, 0xFFB0];
  let bestHeader: SNESHeader | null = null;
  let bestScore = -1;

  for (const offset of candidateOffsets) {
    if (offset + 64 <= rawBuffer.length) {
      const header = tryParseHeaderAt(rawBuffer, offset, hasCopierHeader);
      let score = 0;
      if (header.isValidChecksum) score += 100;
      if (header.title.trim().length > 3) score += 30;
      if (header.romSizeKb > 0 && header.romSizeKb <= 8192) score += 20;

      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    }
  }

  if (!bestHeader) {
    // Fallback: Construct generic header
    bestHeader = tryParseHeaderAt(rawBuffer, Math.min(0x7FC0, Math.max(0, rawBuffer.length - 64)), hasCopierHeader);
  }

  // Extract or synthesize a 256-color palette
  const extractedPalette = extractOrGeneratePalette(rawBuffer, bestHeader);

  return {
    fileName,
    fileSize: fileBuffer.length,
    header: bestHeader,
    rawBuffer: fileBuffer,
    romPayload: rawBuffer,
    extractedPalette,
  };
}

function tryParseHeaderAt(buffer: Uint8Array, offset: number, hasCopierHeader: boolean): SNESHeader {
  // Title is 21 bytes at offset
  let title = '';
  for (let i = 0; i < 21; i++) {
    const byte = buffer[offset + i];
    if (byte >= 32 && byte <= 126) {
      title += String.fromCharCode(byte);
    } else {
      title += ' ';
    }
  }
  title = title.trim() || 'UNTITLED SNES ROM';

  // Map mode & ROM speed at offset + 0x15
  const mapByte = buffer[offset + 0x15] || 0x20;
  const isHiRom = (mapByte & 0x01) === 1;
  const isFastRom = (mapByte & 0x10) === 0x10;
  const mapping: SNESMapping = isHiRom ? 'HiROM' : 'LoROM';
  const speed: SNESSpeed = isFastRom ? 'FastROM (3.58 MHz)' : 'SlowROM (2.68 MHz)';

  // Cartridge type at offset + 0x16
  const cartByte = buffer[offset + 0x16] || 0;
  const romType = CARTRIDGE_TYPES[cartByte] || `Custom Cartridge (0x${cartByte.toString(16).toUpperCase()})`;

  // ROM Size at offset + 0x17 (1 << n KB)
  const romSizeByte = buffer[offset + 0x17] || 9; // 9 = 512KB
  const romSizeKb = Math.pow(2, romSizeByte);

  // RAM Size at offset + 0x18 (1 << n KB)
  const ramSizeByte = buffer[offset + 0x18] || 0;
  const ramSizeKb = ramSizeByte > 0 ? Math.pow(2, ramSizeByte) : 0;

  // Country at offset + 0x19
  const countryByte = buffer[offset + 0x19] || 1;
  const country = SNES_COUNTRIES[countryByte] || 'North America (NTSC)';

  // Developer ID at offset + 0x1A
  const devId = buffer[offset + 0x1A] || 0x01; // 0x01 = Nintendo

  // Version at offset + 0x1B
  const version = buffer[offset + 0x1B] || 0;

  // Complement at offset + 0x1C (16-bit)
  const complement = (buffer[offset + 0x1C] || 0) | ((buffer[offset + 0x1D] || 0) << 8);

  // Checksum at offset + 0x1E (16-bit)
  const checksum = (buffer[offset + 0x1E] || 0) | ((buffer[offset + 0x1F] || 0) << 8);
  const isValidChecksum = ((checksum + complement) & 0xFFFF) === 0xFFFF;

  // Interrupt Vectors (Native mode at offset + 0x20 .. 0x3F)
  const cop = readWord(buffer, offset + 0x24);
  const brk = readWord(buffer, offset + 0x26);
  const abort = readWord(buffer, offset + 0x28);
  const nmi = readWord(buffer, offset + 0x2A);
  const reset = readWord(buffer, offset + 0x3C);
  const irq = readWord(buffer, offset + 0x3E);

  return {
    title,
    mapping,
    speed,
    romType,
    romSizeKb: isNaN(romSizeKb) ? 512 : Math.min(32768, romSizeKb),
    ramSizeKb: isNaN(ramSizeKb) ? 0 : Math.min(2048, ramSizeKb),
    country,
    developerId: devId,
    version,
    checksum,
    complement,
    isValidChecksum,
    vectors: {
      reset: reset || 0x8000,
      nmi: nmi || 0x8000,
      irq: irq || 0x8000,
      cop: cop || 0x8000,
      brk: brk || 0x8000,
      abort: abort || 0x8000,
    },
    hasCopierHeader,
    headerOffset: offset,
  };
}

function readWord(buffer: Uint8Array, offset: number): number {
  if (offset + 1 >= buffer.length) return 0;
  return buffer[offset] | (buffer[offset + 1] << 8);
}

export function getStandardVga16Palette(): Array<[number, number, number]> {
  return [
    [0, 0, 0],         // 0: Black
    [0, 0, 170],       // 1: Blue
    [0, 170, 0],       // 2: Green
    [0, 170, 170],     // 3: Cyan
    [170, 0, 0],       // 4: Red
    [170, 0, 170],     // 5: Magenta
    [170, 85, 0],      // 6: Brown
    [170, 170, 170],   // 7: Light Gray
    [85, 85, 85],      // 8: Dark Gray
    [85, 85, 255],     // 9: Bright Blue
    [85, 255, 85],     // 10: Bright Green
    [85, 255, 255],    // 11: Bright Cyan
    [255, 85, 85],     // 12: Bright Red
    [255, 85, 255],    // 13: Bright Magenta
    [255, 255, 85],    // 14: Bright Yellow
    [255, 255, 255],   // 15: Bright White
  ];
}

export function generateVga256Palette(): Array<[number, number, number]> {
  const pal: Array<[number, number, number]> = [...getStandardVga16Palette()];

  // 16..31: 16-shade grayscale ramp
  for (let g = 0; g < 16; g++) {
    const v = Math.round((g / 15) * 255);
    pal.push([v, v, v]);
  }

  // 32..247: Classic 6x6x6 RGB color cube (216 colors)
  const levels = [0, 51, 102, 153, 204, 255];
  for (const r of levels) {
    for (const g of levels) {
      for (const b of levels) {
        if (pal.length < 248) {
          pal.push([r, g, b]);
        }
      }
    }
  }

  // 248..255: Vibrant arcade highlights
  const highlights: Array<[number, number, number]> = [
    [255, 128, 0],   // Orange
    [255, 0, 128],   // Hot pink
    [128, 255, 0],   // Lime
    [0, 255, 128],   // Spring green
    [0, 128, 255],   // Sky
    [128, 0, 255],   // Purple
    [255, 215, 0],   // Gold
    [255, 255, 255], // Pure white
  ];
  for (const h of highlights) {
    if (pal.length < 256) pal.push(h);
  }

  while (pal.length < 256) {
    pal.push([255, 255, 255]);
  }

  return pal;
}

export function generateArcadePalette(): Array<[number, number, number]> {
  const pal: Array<[number, number, number]> = [...getStandardVga16Palette()];

  // High saturation neon arcade ramps
  for (let i = 16; i < 256; i++) {
    const hue = (i * 1.41) % 360;
    const sat = 0.95;
    const light = 0.35 + 0.35 * Math.sin(i * 0.1);
    pal.push(hslToRgb(hue, sat, light));
  }

  return pal.slice(0, 256);
}

/**
 * Extracts a palette or generates the classic 256-color DOS/SNES palette table
 */
export function extractOrGeneratePalette(buffer: Uint8Array, header: SNESHeader): Array<[number, number, number]> {
  const palette = generateVga256Palette();

  // Try to search for valid non-empty SNES CGRAM color tables (pairs of 15-bit words)
  let foundValidBlocks = 0;
  for (let i = 0x200; i < Math.min(buffer.length - 32, 0x8000); i += 32) {
    let looksLikePalette = true;
    let nonZeroCount = 0;
    const blockColors: Array<[number, number, number]> = [];

    for (let c = 0; c < 16; c++) {
      const w = readWord(buffer, i + c * 2);
      if ((w & 0x8000) !== 0) { // Bit 15 is unused in SNES CGRAM
        looksLikePalette = false;
        break;
      }
      if (w !== 0) nonZeroCount++;
      blockColors.push(snesColorToRgb(w));
    }

    // Require at least 4 distinct non-zero colors so we never treat zeroed buffer as a palette!
    if (looksLikePalette && nonZeroCount >= 4) {
      const targetStart = 32 + foundValidBlocks * 16;
      if (targetStart + 16 <= 256) {
        for (let c = 0; c < 16; c++) {
          palette[targetStart + c] = blockColors[c];
        }
        foundValidBlocks++;
      }
    }
  }

  return palette;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/**
 * Built-in Demo ROMs
 */
export function getDemoRoms(): Record<'racer' | 'platformer' | 'shmup', SNESRomData> {
  return {
    racer: createBuiltinDemo(
      'CHRONO RACER 320',
      'racer',
      'LoROM',
      'FastROM (3.58 MHz)',
      'ROM + RAM',
      1024,
      8,
      0x4F1A
    ),
    platformer: createBuiltinDemo(
      'SUPER DOS MARIO TECH',
      'platformer',
      'LoROM',
      'SlowROM (2.68 MHz)',
      'ROM + RAM + Battery',
      2048,
      32,
      0x9B2C
    ),
    shmup: createBuiltinDemo(
      'SPACE HORIZON 1993',
      'shmup',
      'HiROM',
      'FastROM (3.58 MHz)',
      'ROM + DSP-1',
      1024,
      0,
      0xC7E2
    )
  };
}

function createBuiltinDemo(
  title: string,
  demoType: 'racer' | 'platformer' | 'shmup',
  mapping: SNESMapping,
  speed: SNESSpeed,
  romType: string,
  romSizeKb: number,
  ramSizeKb: number,
  checksum: number
): SNESRomData {
  const bufferSize = 512 * 1024; // 512 KB virtual binary
  const buffer = new Uint8Array(bufferSize);

  // Write header at 0x7FC0 or 0xFFC0
  const headerOffset = mapping === 'HiROM' ? 0xFFC0 : 0x7FC0;

  // Title 21 bytes
  const paddedTitle = (title + '                     ').slice(0, 21);
  for (let i = 0; i < 21; i++) {
    buffer[headerOffset + i] = paddedTitle.charCodeAt(i);
  }

  // Map mode
  buffer[headerOffset + 0x15] = (mapping === 'HiROM' ? 0x01 : 0x00) | (speed.startsWith('Fast') ? 0x10 : 0x00);
  buffer[headerOffset + 0x16] = 0x01; // Cartridge type
  buffer[headerOffset + 0x17] = 0x09; // 512KB
  buffer[headerOffset + 0x18] = 0x03; // 8KB RAM
  buffer[headerOffset + 0x19] = 0x01; // North America (NTSC)
  buffer[headerOffset + 0x1A] = 0x01; // Developer Nintendo
  buffer[headerOffset + 0x1B] = 0x00; // v1.0

  // Complement and Checksum
  const complement = (~checksum) & 0xFFFF;
  buffer[headerOffset + 0x1C] = complement & 0xFF;
  buffer[headerOffset + 0x1D] = (complement >> 8) & 0xFF;
  buffer[headerOffset + 0x1E] = checksum & 0xFF;
  buffer[headerOffset + 0x1F] = (checksum >> 8) & 0xFF;

  // Vectors
  buffer[headerOffset + 0x3C] = 0x00; // Reset vector = 0x8000
  buffer[headerOffset + 0x3D] = 0x80;
  buffer[headerOffset + 0x2A] = 0x10; // NMI vector = 0x8010
  buffer[headerOffset + 0x2B] = 0x80;

  const header: SNESHeader = {
    title,
    mapping,
    speed,
    romType,
    romSizeKb,
    ramSizeKb,
    country: 'North America (NTSC)',
    developerId: 0x01,
    version: 0,
    checksum,
    complement,
    isValidChecksum: true,
    vectors: {
      reset: 0x8000,
      nmi: 0x8010,
      irq: 0x8020,
      cop: 0x8030,
      brk: 0x8040,
      abort: 0x8050,
    },
    hasCopierHeader: false,
    headerOffset,
  };

  const extractedPalette = extractOrGeneratePalette(buffer, header);

  return {
    fileName: `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.smc`,
    fileSize: bufferSize,
    header,
    rawBuffer: buffer,
    romPayload: buffer,
    extractedPalette,
    demoType,
  };
}
