/**
 * MS-DOS MZ Executable and Hardware Configuration Types
 */

export interface MzHeader {
  e_magic: number;      // 0x00: 0x5A4D ("MZ" in Little Endian)
  e_cblp: number;       // 0x02: Bytes on last 512-byte page of file
  e_cp: number;         // 0x04: Total 512-byte pages in file
  e_crlc: number;       // 0x06: Relocations count
  e_cparhdr: number;    // 0x08: Size of header in 16-byte paragraphs
  e_minalloc: number;   // 0x0A: Minimum extra paragraphs needed
  e_maxalloc: number;   // 0x0C: Maximum extra paragraphs needed
  e_ss: number;         // 0x0E: Initial (relative) SS value
  e_sp: number;         // 0x10: Initial SP value
  e_csum: number;       // 0x12: Checksum (usually 0)
  e_ip: number;         // 0x14: Initial IP value
  e_cs: number;         // 0x16: Initial (relative) CS value
  e_lfarlc: number;     // 0x18: File address of relocation table
  e_ovno: number;       // 0x1A: Overlay number
}

export type ExtenderType = 'real_mode_16' | 'pmode_32' | 'dos4gw_stub';
export type PaletteQuantMode = 'adaptive_snes' | 'standard_vga' | 'retro_arcade';

export interface SoundBlasterConfig {
  basePort: number;       // 0x220 (default), 0x240, 0x260, 0x280
  irq: number;            // 7 (default), 5, 2, 10
  dma8: number;           // 1 (default), 0, 3
  dma16: number;          // 5 (default), 6, 7
  dspVersion: string;     // '4.05 (SB16)', '3.02 (SB Pro)', '2.01 (SB 2.0)'
  oplEnabled: boolean;    // Yamaha YM3812 / OPL2 / OPL3 enabled
  sampleRate: number;     // 11025, 22050, 44100 Hz
  volumeMaster: number;   // 0 to 100
  volumeOpl: number;      // 0 to 100
  volumeDac: number;      // 0 to 100
}

export interface VgaConfig {
  mode: '13h';            // 320x200 8-bit chunky (64,000 bytes linear at 0xA000:0000)
  resolutionWidth: 320;
  resolutionHeight: 200;
  colorDepth: 8;          // 8-bit, 256 colors
  dacBits: 6;             // 6-bit per channel (0..63) standard VGA DAC registers
  paletteMode: PaletteQuantMode;
  vsyncWait: boolean;     // Wait for vertical retrace via port 0x03DA bit 3
  doubleBuffer: boolean;  // Allocate 64,000 bytes offscreen buffer before blitting
  crtFilter: 'pixel' | 'scanline' | 'amber' | 'green';
}

export interface DosExeBuildResult {
  fileName: string;
  fileBytes: Uint8Array;
  mzHeader: MzHeader;
  mzHeaderBytes: Uint8Array;
  codeOffset: number;
  dataOffset: number;
  payloadOffset: number;
  totalSize: number;
  pagesCount: number;
  lastPageBytes: number;
  asmSource: string;
  blasterString: string; // e.g. "SET BLASTER=A220 I7 D1 H5 T6"
  createdAt: number;
}
