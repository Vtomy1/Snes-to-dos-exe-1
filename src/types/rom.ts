/**
 * SNES Cartridge and ROM metadata types
 */

export type SNESMapping = 'LoROM' | 'HiROM' | 'ExHiROM';
export type SNESSpeed = 'SlowROM (2.68 MHz)' | 'FastROM (3.58 MHz)';

export interface SNESHeader {
  title: string;
  mapping: SNESMapping;
  speed: SNESSpeed;
  romType: string;
  romSizeKb: number;
  ramSizeKb: number;
  country: string;
  developerId: number;
  version: number;
  checksum: number;
  complement: number;
  isValidChecksum: boolean;
  vectors: {
    reset: number;
    nmi: number;
    irq: number;
    cop: number;
    brk: number;
    abort: number;
  };
  hasCopierHeader: boolean;
  headerOffset: number;
}

export interface SNESRomData {
  fileName: string;
  fileSize: number;
  header: SNESHeader;
  rawBuffer: Uint8Array;
  romPayload: Uint8Array;
  extractedPalette: Array<[number, number, number]>; // 256 RGB colors (0-255)
  demoType?: 'racer' | 'platformer' | 'shmup';
}
