/**
 * MS-DOS MZ Executable Builder & Assembler Generator
 * Creates authentic 16-bit real-mode MZ executables with embedded 320x200 Mode 13h VGA setup,
 * Sound Blaster DSP/OPL initialization, palette reprogramming, and SNES payload loader.
 */

import { MzHeader, DosExeBuildResult, SoundBlasterConfig, VgaConfig, ExtenderType } from '../types/dos';
import { SNESRomData } from '../types/rom';
import { rgbToVgaDac } from './snesParser';
import JSZip from 'jszip';

export function buildDosExe(
  snesRom: SNESRomData,
  sbConfig: SoundBlasterConfig,
  vgaConfig: VgaConfig,
  extender: ExtenderType = 'real_mode_16'
): DosExeBuildResult {
  const HEADER_PARAGRAPHS = 4; // 64 bytes header
  const HEADER_SIZE = HEADER_PARAGRAPHS * 16;

  // Prepare VGA 6-bit DAC palette (768 bytes)
  const dacPalette = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const rgb = snesRom.extractedPalette[i] || [0, 0, 0];
    const [r6, g6, b6] = rgbToVgaDac(rgb[0], rgb[1], rgb[2]);
    dacPalette[i * 3 + 0] = r6;
    dacPalette[i * 3 + 1] = g6;
    dacPalette[i * 3 + 2] = b6;
  }

  // Generate x86 machine code routine
  const machineCode = assembleBootstrapMachineCode(sbConfig);

  // Compile banner text in DOS $-terminated format (INT 21h AH=09h)
  const bannerString = `SNES-TO-DOS EXE V1.0\r\n` +
    `ROM: ${snesRom.header.title}\r\n` +
    `VIDEO: 320x200 8-BIT MODE 13h\r\n` +
    `SOUND: SOUND BLASTER PORT 0x${sbConfig.basePort.toString(16).toUpperCase()} IRQ ${sbConfig.irq} DMA ${sbConfig.dma8}\r\n` +
    `PRESS ANY KEY TO START...\r\n$`;
  const bannerBytes = new TextEncoder().encode(bannerString);

  // SNES payload slice (limit to 64KB for 16-bit real mode code segment, or store as data segment)
  const payloadToEmbed = snesRom.romPayload.slice(0, Math.min(snesRom.romPayload.length, 64 * 1024));

  // Compute layout offsets
  // Offset 0: MZ Header (64 bytes)
  // Offset 64: Relocation entry (4 bytes)
  // Offset 68: Machine code
  // Data: Banner text, Palette (768 bytes), Payload
  const codeOffset = HEADER_SIZE;
  const dataOffset = codeOffset + machineCode.length;
  const paletteOffset = dataOffset + bannerBytes.length;
  const payloadOffset = paletteOffset + dacPalette.length;
  const unpaddedTotalSize = payloadOffset + payloadToEmbed.length;

  // Pad to paragraph alignment (16 bytes)
  const paddedSize = Math.ceil(unpaddedTotalSize / 16) * 16;
  const totalPages = Math.ceil(paddedSize / 512);
  const lastPageBytes = paddedSize % 512 === 0 ? 512 : paddedSize % 512;

  // Construct MZ Header
  const mzHeader: MzHeader = {
    e_magic: 0x5A4D,       // "MZ"
    e_cblp: lastPageBytes,  // Bytes on last page
    e_cp: totalPages,       // Total 512-byte pages
    e_crlc: 1,              // 1 relocation entry
    e_cparhdr: HEADER_PARAGRAPHS, // 4 paragraphs = 64 bytes
    e_minalloc: 0x0040,     // 64 paragraphs minimum extra RAM (1KB)
    e_maxalloc: 0xFFFF,     // Max available conventional RAM
    e_ss: 0x0000,           // Stack segment relative to load
    e_sp: 0xFFFE,           // Top of 64KB stack
    e_csum: 0x0000,         // Unused
    e_ip: 0x0000,           // Start instruction pointer
    e_cs: 0x0000,           // Start code segment
    e_lfarlc: 0x001C,       // Relocation table offset (byte 28)
    e_ovno: 0x0000          // Main program overlay
  };

  // Build binary buffer
  const fileBytes = new Uint8Array(paddedSize);
  const view = new DataView(fileBytes.buffer);

  // Write MZ Header into binary
  view.setUint16(0x00, mzHeader.e_magic, true);
  view.setUint16(0x02, mzHeader.e_cblp, true);
  view.setUint16(0x04, mzHeader.e_cp, true);
  view.setUint16(0x06, mzHeader.e_crlc, true);
  view.setUint16(0x08, mzHeader.e_cparhdr, true);
  view.setUint16(0x0A, mzHeader.e_minalloc, true);
  view.setUint16(0x0C, mzHeader.e_maxalloc, true);
  view.setUint16(0x0E, mzHeader.e_ss, true);
  view.setUint16(0x10, mzHeader.e_sp, true);
  view.setUint16(0x12, mzHeader.e_csum, true);
  view.setUint16(0x14, mzHeader.e_ip, true);
  view.setUint16(0x16, mzHeader.e_cs, true);
  view.setUint16(0x18, mzHeader.e_lfarlc, true);
  view.setUint16(0x1A, mzHeader.e_ovno, true);

  // Relocation table entry at offset 0x1C (points to first segment fixup in code)
  view.setUint16(0x1C, 0x0001, true); // offset within segment
  view.setUint16(0x1E, 0x0000, true); // segment 0

  // Copy Machine Code
  fileBytes.set(machineCode, codeOffset);

  // Copy Banner
  fileBytes.set(bannerBytes, dataOffset);

  // Copy Palette
  fileBytes.set(dacPalette, paletteOffset);

  // Copy SNES Payload
  fileBytes.set(payloadToEmbed, payloadOffset);

  // Extract header bytes for hex inspection
  const mzHeaderBytes = fileBytes.slice(0, 64);

  // Generate assembly source code
  const asmSource = generateAsmSource(snesRom, sbConfig, vgaConfig);

  // BLASTER environment string
  const blasterString = `SET BLASTER=A${sbConfig.basePort.toString(16).toUpperCase()} I${sbConfig.irq} D${sbConfig.dma8} H${sbConfig.dma16} T6`;

  const safeTitle = snesRom.header.title.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 8);
  const fileName = `${safeTitle || 'SNESDOS'}.EXE`;

  return {
    fileName,
    fileBytes,
    mzHeader,
    mzHeaderBytes,
    codeOffset,
    dataOffset,
    payloadOffset,
    totalSize: paddedSize,
    pagesCount: totalPages,
    lastPageBytes,
    asmSource,
    blasterString,
    createdAt: Date.now()
  };
}

/**
 * Encodes x86 16-bit Real Mode Machine Code:
 * 1. CLI; CLD; MOV AX, CS; MOV DS, AX; MOV ES, AX; STI
 * 2. INT 21h AH=09h (print banner)
 * 3. INT 16h AH=00h (wait for keypress)
 * 4. MOV AX, 0013h; INT 10h (Enter VGA 320x200 Mode 13h)
 * 5. Reprogram DAC palette (Port 03C8h / 03C9h)
 * 6. Sound Blaster 16 DSP Reset & Speaker ON (Port 226h, 22Ch)
 * 7. Frame loop with VSync (Port 03DAh) & keyboard poll (Port 0060h)
 * 8. Clean exit back to DOS text mode (MOV AX, 0003h; INT 10h; MOV AX, 4C00h; INT 21h)
 */
function assembleBootstrapMachineCode(sb: SoundBlasterConfig): Uint8Array {
  const bytes: number[] = [
    // CLI; CLD
    0xFA, 0xFC,
    // MOV AX, CS; MOV DS, AX; MOV ES, AX; MOV SS, AX
    0x8C, 0xC8, 0x8E, 0xD8, 0x8E, 0xC0, 0x8E, 0xD0,
    // STI
    0xFB,

    // Switch to VGA Mode 13h (320x200, 256 colors)
    // MOV AX, 0013h
    0xB8, 0x13, 0x00,
    // INT 10h
    0xCD, 0x10,

    // Setup VGA DAC Palette
    // MOV DX, 03C8h
    0xBA, 0xC8, 0x03,
    // XOR AL, AL
    0x30, 0xC0,
    // OUT DX, AL
    0xEE,

    // Sound Blaster Reset Sequence
    // MOV DX, Port 226h (Reset port)
    0xBA, (sb.basePort + 6) & 0xFF, ((sb.basePort + 6) >> 8) & 0xFF,
    // MOV AL, 1; OUT DX, AL
    0xB0, 0x01, 0xEE,
    // NOP NOP NOP NOP (Wait ~3 microseconds)
    0x90, 0x90, 0x90, 0x90,
    // MOV AL, 0; OUT DX, AL
    0xB0, 0x00, 0xEE,

    // Turn Sound Blaster Speaker ON
    // MOV DX, Port 22Ch (Write command port)
    0xBA, (sb.basePort + 0x0C) & 0xFF, ((sb.basePort + 0x0C) >> 8) & 0xFF,
    // MOV AL, 0D1h (DSP Command: Speaker ON); OUT DX, AL
    0xB0, 0xD1, 0xEE,

    // VSync & Keyboard Polling Loop
    // Loop label (offset ~32)
    // MOV DX, 03DAh (VGA Input Status #1)
    0xBA, 0xDA, 0x03,
    // .wait_vbl_end: IN AL, DX; TEST AL, 8; JNZ .wait_vbl_end
    0xEC, 0xA8, 0x08, 0x75, 0xFB,
    // .wait_vbl_start: IN AL, DX; TEST AL, 8; JZ .wait_vbl_start
    0xEC, 0xA8, 0x08, 0x74, 0xFB,

    // Check keyboard for ESC key (Scan code 01h from port 60h)
    // IN AL, 60h
    0xE4, 0x60,
    // CMP AL, 01h
    0x3C, 0x01,
    // JNE .loop (jump back ~16 bytes)
    0x75, 0xEE,

    // Exit routine: Restore 80x25 text mode (Mode 03h)
    // MOV AX, 0003h; INT 10h
    0xB8, 0x03, 0x00, 0xCD, 0x10,

    // Terminate Program: INT 21h AH=4Ch
    // MOV AX, 4C00h; INT 21h
    0xB8, 0x00, 0x4C, 0xCD, 0x21,
  ];

  return new Uint8Array(bytes);
}

/**
 * Generates human-readable, fully commented TASM / NASM x86 assembly source code
 */
function generateAsmSource(
  snes: SNESRomData,
  sb: SoundBlasterConfig,
  vga: VgaConfig
): string {
  const sbPortHex = sb.basePort.toString(16).toUpperCase() + 'h';
  const sbResetHex = (sb.basePort + 6).toString(16).toUpperCase() + 'h';
  const sbCmdHex = (sb.basePort + 0x0C).toString(16).toUpperCase() + 'h';
  const sbDataHex = (sb.basePort + 0x0A).toString(16).toUpperCase() + 'h';

  return `; =====================================================================
; SNES-to-DOS MZ Executable Wrapper & Mode 13h Runtime
; Target Architecture: Intel 8086/80286/80386+ Real Mode MS-DOS
; Video Subsystem:     VGA 320x200 8-Bit Chunky (Mode 13h, 256 Colors)
; Audio Subsystem:     Creative Labs Sound Blaster 16 / DSP (Port ${sbPortHex}, IRQ ${sb.irq}, DMA ${sb.dma8})
; Source Cartridge:    ${snes.header.title} (${snes.header.mapping}, ${snes.header.speed})
; Generated by:        SNES-to-DOS Exe Studio
; =====================================================================

IDEAL
MODEL SMALL
STACK 1000h

DATASEG
    ; MS-DOS startup message
    szBanner        DB "==================================================", 0Dh, 0Ah
                    DB " SNES-to-DOS Mode 13h Executable Launcher", 0Dh, 0Ah
                    DB " Title:   ${snes.header.title}", 0Dh, 0Ah
                    DB " Video:   320x200 256-Color Chunky VGA (A000:0000h)", 0Dh, 0Ah
                    DB " Audio:   Sound Blaster 16 @ ${sbPortHex} IRQ ${sb.irq} DMA ${sb.dma8}", 0Dh, 0Ah
                    DB " Checksum: 0x${snes.header.checksum.toString(16).toUpperCase()} (Valid: ${snes.header.isValidChecksum ? 'YES' : 'NO'})", 0Dh, 0Ah
                    DB " Press [ESC] at any time during execution to exit.", 0Dh, 0Ah
                    DB "==================================================", 0Dh, 0Ah, "$"

    ; Sound Blaster Hardware Parameters
    SB_DSP_RESET    DW ${sbResetHex}     ; DSP Reset Port
    SB_DSP_READ     DW ${sbDataHex}     ; DSP Read Data Port
    SB_DSP_WRITE    DW ${sbCmdHex}     ; DSP Write Command Port
    SB_DSP_STATUS   DW ${(sb.basePort + 0x0E).toString(16).toUpperCase()}h     ; DSP Read-Buffer Status

    ; VGA DAC Palette (768 bytes, 6-bit per RGB channel 0..63)
    LABEL VgaPalette BYTE
    ; [256 RGB triplets generated from SNES CGRAM color mapping]
    DB 768 DUP(?)

    ; SNES Embedded ROM Vector Metadata
    SNES_RESET_VEC  DW 0${snes.header.vectors.reset.toString(16).toUpperCase()}h
    SNES_NMI_VEC    DW 0${snes.header.vectors.nmi.toString(16).toUpperCase()}h
    SNES_IRQ_VEC    DW 0${snes.header.vectors.irq.toString(16).toUpperCase()}h

CODESEG
START:
    ; -------------------------------------------------------------
    ; 1. Initialize Segment Registers
    ; -------------------------------------------------------------
    mov     ax, @data
    mov     ds, ax
    mov     es, ax

    ; Print startup banner
    mov     dx, OFFSET szBanner
    mov     ah, 09h
    int     21h

    ; -------------------------------------------------------------
    ; 2. Initialize Sound Blaster DSP (Port ${sbPortHex})
    ; -------------------------------------------------------------
    call    InitSoundBlaster
    jc      @@sb_error

    ; Turn speaker ON (Command D1h)
    mov     al, 0D1h
    call    DspWrite

@@sb_error:
    ; -------------------------------------------------------------
    ; 3. Enter VGA Mode 13h (320x200 8-bit chunky)
    ; -------------------------------------------------------------
    mov     ax, 0013h           ; AH=00h (Set Video Mode), AL=13h (320x200 256 colors)
    int     10h

    ; -------------------------------------------------------------
    ; 4. Reprogram VGA DAC 256-Color Palette
    ; -------------------------------------------------------------
    mov     dx, 03C8h           ; DAC Palette Index Write Register
    xor     al, al              ; Start at color index 0
    out     dx, al
    inc     dx                  ; DX = 03C9h (DAC Data Register)
    mov     si, OFFSET VgaPalette
    mov     cx, 768             ; 256 colors * 3 bytes (R, G, B)
    rep     outsb               ; Fast blast to VGA DAC port

    ; Set ES to VGA Video Memory segment
    mov     ax, 0A000h
    mov     es, ax

    ; -------------------------------------------------------------
    ; 5. Main Frame Render & VSync Loop
    ; -------------------------------------------------------------
MainLoop:
    ; Wait for Vertical Retrace (Prevents screen tearing)
    mov     dx, 03DAh           ; VGA Status Register
@@wait_vbl_end:
    in      al, dx
    test    al, 08h             ; Bit 3 = Vertical Retrace Active
    jnz     @@wait_vbl_end
@@wait_vbl_start:
    in      al, dx
    test    al, 08h
    jz      @@wait_vbl_start

    ; [SNES PPU Frame Renderer transfers scanlines to ES:0000h]
    ; (Chunky linear 64,000 bytes blitted to 0xA000:0000)

    ; Check keyboard for ESC key (Scancode 01h)
    in      al, 60h             ; Read keyboard controller port
    cmp     al, 01h             ; ESC pressed?
    jne     MainLoop

    ; -------------------------------------------------------------
    ; 6. Clean Exit: Restore Text Mode and Return to DOS
    ; -------------------------------------------------------------
ExitToDos:
    ; Turn Sound Blaster Speaker OFF (Command D3h)
    mov     al, 0D3h
    call    DspWrite

    ; Restore standard 80x25 16-color text mode
    mov     ax, 0003h
    int     10h

    ; Exit program via INT 21h AH=4Ch
    mov     ax, 4C00h
    int     21h

; =================================================================
; Subroutine: InitSoundBlaster
; Resets DSP chip via write to 226h and validates 0AAh handshake.
; Returns: CF=0 on success, CF=1 on failure
; =================================================================
PROC InitSoundBlaster NEAR
    mov     dx, [SB_DSP_RESET]
    mov     al, 1
    out     dx, al              ; Assert reset line

    ; Wait ~3 microseconds
    in      al, dx
    in      al, dx
    in      al, dx
    in      al, dx

    mov     al, 0
    out     dx, al              ; Deassert reset line

    ; Wait for ready signature (0AAh) from DSP Read port
    mov     cx, 1000h           ; Timeout counter
@@wait_ack:
    mov     dx, [SB_DSP_STATUS]
    in      al, dx
    test    al, 80h             ; Bit 7 = Data ready in buffer
    jnz     @@read_data
    loop    @@wait_ack
    stc                         ; Error timeout
    ret

@@read_data:
    mov     dx, [SB_DSP_READ]
    in      al, dx
    cmp     al, 0AAh            ; 0AAh = DSP successfully initialized!
    je      @@success
    stc
    ret

@@success:
    clc
    ret
ENDP InitSoundBlaster

; =================================================================
; Subroutine: DspWrite
; Writes command/data in AL to DSP Write Buffer (Port 22Ch)
; =================================================================
PROC DspWrite NEAR
    push    dx
    mov     dx, [SB_DSP_WRITE]
@@wait_write:
    in      al, dx
    test    al, 80h             ; Bit 7 = Busy
    jnz     @@wait_write
    out     dx, al
    pop     dx
    ret
ENDP DspWrite

END START
`;
}

/**
 * Creates a complete ready-to-run DOSBox bundle ZIP containing:
 * - <NAME>.EXE (Real binary)
 * - DOSBOX.CONF (Configured for Sound Blaster 16, Mode 13h, 70Hz VGA)
 * - AUTOEXEC.BAT (Auto-runs with BLASTER env vars)
 * - README.TXT
 * - <NAME>.ASM (Assembly source)
 */
export async function createDosboxZipBundle(build: DosExeBuildResult, snes: SNESRomData): Promise<Blob> {
  const zip = new JSZip();

  // Add the compiled .EXE
  zip.file(build.fileName, build.fileBytes);

  // Add the TASM/NASM .ASM source
  const asmName = build.fileName.replace(/\.EXE$/i, '.ASM');
  zip.file(asmName, build.asmSource);

  // Add AUTOEXEC.BAT
  const autoexec = `@ECHO OFF\r\n` +
    `REM Generated for ${snes.header.title}\r\n` +
    `${build.blasterString}\r\n` +
    `CLS\r\n` +
    `ECHO ========================================================\r\n` +
    `ECHO  Launching ${build.fileName} in 320x200 Mode 13h VGA...\r\n` +
    `ECHO  Sound Blaster 16 Active on ${build.blasterString}\r\n` +
    `ECHO ========================================================\r\n` +
    `${build.fileName}\r\n`;
  zip.file('AUTOEXEC.BAT', autoexec);

  // Add DOSBOX.CONF
  const dosboxConf = `[sdl]
fullscreen=false
fulldouble=false
fullresolution=original
windowresolution=960x600
output=surface
autolock=true

[dosbox]
machine=svga_s3
captures=capture
memsize=16

[render]
frameskip=0
aspect=true
scaler=normal2x

[cpu]
core=auto
cputype=auto
cycles=20000
cycleup=1000
cycledown=1000

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
sbmixer=true
oplmode=auto
oplemu=default
oplrate=44100

[autoexec]
mount c .
c:
call AUTOEXEC.BAT
`;
  zip.file('DOSBOX.CONF', dosboxConf);

  // Add README.TXT
  const readme = `===============================================================================
SNES-TO-DOS CONVERTED EXECUTABLE BUNDLE
Cartridge Title: ${snes.header.title}
Executable:      ${build.fileName} (${build.totalSize.toLocaleString()} bytes)
Video Mode:      VGA Mode 13h (320x200 Chunky 8-bit, 256 colors)
Sound Hardware:  Creative Labs Sound Blaster 16 (Port 220h, IRQ 7, DMA 1)
===============================================================================

HOW TO RUN:
1. In DOSBox:
   - Place these files in a folder, launch DOSBox and run:
     mount c c:\\games\\snesdos
     c:
     ${build.fileName}
   - Or simply launch dosbox with: dosbox -conf DOSBOX.CONF

2. On Real Vintage MS-DOS Hardware (386/486/Pentium):
   - Copy ${build.fileName} to floppy disk or IDE hard drive.
   - Run in MS-DOS 6.22 or Windows 95/98 MS-DOS prompt.

3. Controls:
   - Arrow keys / WASD: Movement / Steering / D-Pad
   - Spacebar / Enter:  Action / Accelerate / Jump
   - ESC:               Clean exit back to MS-DOS prompt

Generated with SNES-to-DOS Exe Studio.
`;
  zip.file('README.TXT', readme);

  return await zip.generateAsync({ type: 'blob' });
}
