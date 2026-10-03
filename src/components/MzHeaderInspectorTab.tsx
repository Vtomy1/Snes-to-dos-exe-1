import React, { useState } from 'react';
import { Binary, FileCode, Info, Check, Copy } from 'lucide-react';
import { DosExeBuildResult } from '../types/dos';
import { SNESRomData } from '../types/rom';

interface MzHeaderInspectorTabProps {
  buildResult: DosExeBuildResult;
  snesRom: SNESRomData;
}

export const MzHeaderInspectorTab: React.FC<MzHeaderInspectorTabProps> = ({
  buildResult,
  snesRom,
}) => {
  const [hoveredByte, setHoveredByte] = useState<{ offset: number; val: number; desc: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const mz = buildResult.mzHeader;

  // Header field definitions according to MS-DOS Programmer's Reference
  const headerFields = [
    {
      name: 'e_magic',
      offset: '0x00',
      size: '2 bytes',
      valHex: `0x${mz.e_magic.toString(16).toUpperCase()}`,
      valDec: mz.e_magic,
      meaning: 'MZ Signature ("Mark Zbikowski" Executable Marker)',
      detail: 'Required 0x5A4D ("MZ" in Little Endian). Identifies this binary to MS-DOS COMMAND.COM as a relocatable executable.',
      color: 'text-amber-400',
    },
    {
      name: 'e_cblp',
      offset: '0x02',
      size: '2 bytes',
      valHex: `0x${mz.e_cblp.toString(16).toUpperCase()}`,
      valDec: mz.e_cblp,
      meaning: 'Bytes on last 512-byte page',
      detail: 'Length of the executable remainder modulo 512. Tells DOS loader exactly where binary ends.',
      color: 'text-cyan-400',
    },
    {
      name: 'e_cp',
      offset: '0x04',
      size: '2 bytes',
      valHex: `0x${mz.e_cp.toString(16).toUpperCase()}`,
      valDec: mz.e_cp,
      meaning: 'Total 512-byte pages in file',
      detail: `File occupies ${mz.e_cp} pages (${mz.e_cp * 512} bytes gross allocated size).`,
      color: 'text-cyan-400',
    },
    {
      name: 'e_crlc',
      offset: '0x06',
      size: '2 bytes',
      valHex: `0x${mz.e_crlc.toString(16).toUpperCase()}`,
      valDec: mz.e_crlc,
      meaning: 'Relocation items count',
      detail: '1 relocation item (points to segment fixup table for DS/ES segment setup).',
      color: 'text-emerald-400',
    },
    {
      name: 'e_cparhdr',
      offset: '0x08',
      size: '2 bytes',
      valHex: `0x${mz.e_cparhdr.toString(16).toUpperCase()}`,
      valDec: mz.e_cparhdr,
      meaning: 'Header size in 16-byte paragraphs',
      detail: '4 paragraphs = 64 bytes (0x40). The executable image begins immediately at byte 64.',
      color: 'text-purple-400',
    },
    {
      name: 'e_minalloc',
      offset: '0x0A',
      size: '2 bytes',
      valHex: `0x${mz.e_minalloc.toString(16).toUpperCase()}`,
      valDec: mz.e_minalloc,
      meaning: 'Minimum extra paragraphs needed',
      detail: 'Extra conventional memory required by program beyond image size (64 paragraphs = 1024 bytes).',
      color: 'text-neutral-300',
    },
    {
      name: 'e_maxalloc',
      offset: '0x0C',
      size: '2 bytes',
      valHex: `0x${mz.e_maxalloc.toString(16).toUpperCase()}`,
      valDec: mz.e_maxalloc,
      meaning: 'Maximum extra paragraphs needed',
      detail: '0xFFFF requests all remaining conventional RAM from DOS memory allocation pool.',
      color: 'text-neutral-300',
    },
    {
      name: 'e_ss',
      offset: '0x0E',
      size: '2 bytes',
      valHex: `0x${mz.e_ss.toString(16).toUpperCase()}`,
      valDec: mz.e_ss,
      meaning: 'Initial SS relative stack segment',
      detail: '0x0000: Stack segment shares the main code/data relocatable segment base.',
      color: 'text-pink-400',
    },
    {
      name: 'e_sp',
      offset: '0x10',
      size: '2 bytes',
      valHex: `0x${mz.e_sp.toString(16).toUpperCase()}`,
      valDec: mz.e_sp,
      meaning: 'Initial SP stack pointer',
      detail: '0xFFFE: Sets stack to highest word in 64KB stack segment (grows downward).',
      color: 'text-pink-400',
    },
    {
      name: 'e_csum',
      offset: '0x12',
      size: '2 bytes',
      valHex: `0x${mz.e_csum.toString(16).toUpperCase()}`,
      valDec: mz.e_csum,
      meaning: 'Header Checksum',
      detail: '0x0000 (Ignored by MS-DOS loader).',
      color: 'text-neutral-500',
    },
    {
      name: 'e_ip',
      offset: '0x14',
      size: '2 bytes',
      valHex: `0x${mz.e_ip.toString(16).toUpperCase()}`,
      valDec: mz.e_ip,
      meaning: 'Initial IP instruction pointer',
      detail: '0x0000: Execution starts at byte 0 of Code Segment (the x86 Mode 13h bootstrap).',
      color: 'text-amber-400',
    },
    {
      name: 'e_cs',
      offset: '0x16',
      size: '2 bytes',
      valHex: `0x${mz.e_cs.toString(16).toUpperCase()}`,
      valDec: mz.e_cs,
      meaning: 'Initial CS code segment',
      detail: '0x0000: Relative to load segment determined at runtime by DOS EXEC function.',
      color: 'text-amber-400',
    },
    {
      name: 'e_lfarlc',
      offset: '0x18',
      size: '2 bytes',
      valHex: `0x${mz.e_lfarlc.toString(16).toUpperCase()}`,
      valDec: mz.e_lfarlc,
      meaning: 'Relocation table file offset',
      detail: '0x001C (byte 28). Table of DWORD segment fixup pointers begins here.',
      color: 'text-emerald-400',
    },
    {
      name: 'e_ovno',
      offset: '0x1A',
      size: '2 bytes',
      valHex: `0x${mz.e_ovno.toString(16).toUpperCase()}`,
      valDec: mz.e_ovno,
      meaning: 'Overlay number',
      detail: '0x0000: Main program module (not an overlay).',
      color: 'text-neutral-500',
    },
  ];

  // Prepare first 256 bytes for interactive Hex Dump
  const hexBytesToShow = buildResult.fileBytes.slice(0, 256);
  const rows: Array<{ offset: number; bytes: number[]; ascii: string }> = [];

  for (let i = 0; i < hexBytesToShow.length; i += 16) {
    const chunk = Array.from(hexBytesToShow.slice(i, i + 16));
    let ascii = '';
    for (const b of chunk) {
      ascii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
    }
    rows.push({
      offset: i,
      bytes: chunk,
      ascii,
    });
  }

  const getByteDescription = (offset: number) => {
    if (offset < 2) return 'MZ Signature (0x5A4D)';
    if (offset < 4) return 'e_cblp: Last page bytes';
    if (offset < 6) return 'e_cp: Total 512-byte pages';
    if (offset < 8) return 'e_crlc: Relocation count';
    if (offset < 10) return 'e_cparhdr: Header paragraphs';
    if (offset < 14) return 'e_minalloc / e_maxalloc RAM requests';
    if (offset < 18) return 'e_ss:e_sp Stack pointer';
    if (offset < 24) return 'e_ip:e_cs Execution entry';
    if (offset < 28) return 'e_lfarlc: Relocation table offset';
    if (offset < 32) return 'Relocation Table Entry #0 (Segment fixup)';
    if (offset < 64) return 'MZ Header Padding to paragraph alignment';
    if (offset < 64 + 40) return 'x86 Real-Mode Bootstrap (Mode 13h & Sound Blaster setup)';
    return 'Data segment: Banner, VGA DAC Palette & SNES ROM Payload';
  };

  const copyHeaderSummary = () => {
    const text = headerFields.map(f => `${f.offset} | ${f.name.padEnd(12)}: ${f.valHex.padEnd(8)} (${f.valDec}) - ${f.meaning}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <Binary className="w-4 h-4 text-amber-400" />
            <span>MS-DOS MZ Executable Header Inspector</span>
            <span className="text-xs font-mono-code bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
              64-Byte Header Table
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Exact binary header decoded directly from the generated MS-DOS executable image ({buildResult.fileName}).
          </p>
        </div>

        <button
          onClick={copyHeaderSummary}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 rounded transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Header Table'}</span>
        </button>
      </div>

      {/* Header Fields Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
            Standard MS-DOS 16-Bit MZ Header Map (IMAGE_DOS_HEADER)
          </span>
          <span className="text-xs font-mono-code text-neutral-400">Total: 14 Structural Fields</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-code">
            <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-4 font-medium">Offset</th>
                <th className="py-2.5 px-4 font-medium">Field Identifier</th>
                <th className="py-2.5 px-4 font-medium">Size</th>
                <th className="py-2.5 px-4 font-medium">Hex Value</th>
                <th className="py-2.5 px-4 font-medium">Decimal</th>
                <th className="py-2.5 px-4 font-medium">Architectural Function</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {headerFields.map((field) => (
                <tr key={field.name} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="py-2.5 px-4 text-neutral-500">{field.offset}</td>
                  <td className={`py-2.5 px-4 font-semibold ${field.color}`}>{field.name}</td>
                  <td className="py-2.5 px-4 text-neutral-400">{field.size}</td>
                  <td className="py-2.5 px-4 text-neutral-100 font-bold">{field.valHex}</td>
                  <td className="py-2.5 px-4 text-neutral-300">{field.valDec}</td>
                  <td className="py-2.5 px-4 text-neutral-400 max-w-md font-sans">
                    <span className="font-semibold text-neutral-200">{field.meaning}</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5">{field.detail}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Hex Viewer */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>Interactive Executable Hex Dump (First 256 Bytes)</span>
          </h3>

          <div className="flex items-center gap-3 text-[11px] font-mono-code text-neutral-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> MZ Header (0x00-0x3F)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> x86 Code (0x40+)
            </span>
          </div>
        </div>

        {/* Hover info banner */}
        <div className="min-h-[32px] px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded flex items-center justify-between text-xs font-mono-code">
          {hoveredByte ? (
            <div className="flex items-center gap-3">
              <span className="text-neutral-400">
                Offset: <span className="text-amber-400 font-bold">0x{hoveredByte.offset.toString(16).toUpperCase().padStart(4, '0')}</span>
              </span>
              <span className="text-neutral-400">
                Value: <span className="text-neutral-100 font-bold">0x{hoveredByte.val.toString(16).toUpperCase().padStart(2, '0')}</span> ({hoveredByte.val})
              </span>
              <span className="text-neutral-500">|</span>
              <span className="text-neutral-300 font-sans">{hoveredByte.desc}</span>
            </div>
          ) : (
            <span className="text-neutral-500 italic font-sans">
              Hover over any hexadecimal byte to inspect its exact offset and DOS execution role.
            </span>
          )}
        </div>

        {/* Hex Editor Grid */}
        <div className="bg-neutral-950 p-4 rounded border border-neutral-800 overflow-x-auto">
          <div className="font-mono-code text-xs space-y-1 select-text">
            {/* Column header */}
            <div className="flex text-neutral-500 pb-1 border-b border-neutral-800 text-[11px]">
              <span className="w-16 shrink-0">OFFSET</span>
              <div className="flex gap-2 w-96 shrink-0">
                {Array.from({ length: 16 }).map((_, idx) => (
                  <span key={idx} className="w-5 text-center">
                    {idx.toString(16).toUpperCase()}
                  </span>
                ))}
              </div>
              <span className="pl-4 text-neutral-500">ASCII DECODE</span>
            </div>

            {/* Rows */}
            {rows.map((row) => (
              <div key={row.offset} className="flex hover:bg-neutral-900/60 py-0.5">
                <span className="w-16 shrink-0 text-neutral-500">
                  {row.offset.toString(16).toUpperCase().padStart(4, '0')}:
                </span>
                <div className="flex gap-2 w-96 shrink-0">
                  {row.bytes.map((b, byteIdx) => {
                    const absOffset = row.offset + byteIdx;
                    const isMzHeader = absOffset < 64;
                    const isSignature = absOffset < 2;

                    return (
                      <span
                        key={byteIdx}
                        onMouseEnter={() =>
                          setHoveredByte({
                            offset: absOffset,
                            val: b,
                            desc: getByteDescription(absOffset),
                          })
                        }
                        onMouseLeave={() => setHoveredByte(null)}
                        className={`w-5 text-center cursor-pointer transition-colors rounded ${
                          isSignature
                            ? 'text-amber-400 font-bold bg-amber-500/10'
                            : isMzHeader
                            ? 'text-cyan-300 hover:bg-neutral-800'
                            : 'text-emerald-400 hover:bg-neutral-800'
                        }`}
                      >
                        {b.toString(16).toUpperCase().padStart(2, '0')}
                      </span>
                    );
                  })}
                </div>
                <span className="pl-4 text-neutral-400 tracking-wider">
                  {row.ascii}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
