import React, { useState } from 'react';
import { Code, Download, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { DosExeBuildResult } from '../types/dos';
import { SNESRomData } from '../types/rom';

interface DisassemblyTabProps {
  buildResult: DosExeBuildResult;
  snesRom: SNESRomData;
}

export const DisassemblyTab: React.FC<DisassemblyTabProps> = ({
  buildResult,
  snesRom,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'x86' | 'vectors'>('x86');

  const copyCode = () => {
    navigator.clipboard.writeText(buildResult.asmSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsm = () => {
    const blob = new Blob([buildResult.asmSource], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildResult.fileName.replace(/\.EXE$/i, '.ASM');
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = buildResult.asmSource.split('\n');

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <Code className="w-4 h-4 text-emerald-400" />
            <span>x86 Real-Mode Assembly & SNES 65816 Translation</span>
            <span className="text-xs font-mono-code bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
              TASM / NASM Target
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Mode 13h VGA setup, 768-byte DAC palette port blasting, Sound Blaster 16 DSP reset handshake, and SNES payload loader.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded border border-neutral-800 text-xs">
            <button
              onClick={() => setViewMode('x86')}
              className={`px-3 py-1 rounded transition-colors ${
                viewMode === 'x86' ? 'bg-neutral-800 text-amber-400 font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              x86 Assembly (.ASM)
            </button>
            <button
              onClick={() => setViewMode('vectors')}
              className={`px-3 py-1 rounded transition-colors ${
                viewMode === 'vectors' ? 'bg-neutral-800 text-amber-400 font-medium' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              65816 Vector Bridge
            </button>
          </div>

          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={downloadAsm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .ASM</span>
          </button>
        </div>
      </div>

      {viewMode === 'x86' ? (
        /* Assembly Code Box */
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between text-xs font-mono-code text-neutral-400">
            <span>{buildResult.fileName.replace(/\.EXE$/i, '.ASM')} - {lines.length} lines</span>
            <span>Architecture: Intel 8086/80286/80386+ Real Mode</span>
          </div>

          <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto font-mono-code text-xs leading-relaxed">
            {lines.map((line, idx) => {
              const isComment = line.trim().startsWith(';');
              const isLabel = line.trim().endsWith(':') || line.includes('PROC ') || line.includes('ENDP ');
              const isDirective = line.trim().startsWith('IDEAL') || line.trim().startsWith('MODEL') || line.trim().startsWith('STACK') || line.trim().startsWith('DATASEG') || line.trim().startsWith('CODESEG') || line.trim().startsWith('END');

              return (
                <div key={idx} className="flex hover:bg-neutral-900/40">
                  <span className="w-12 shrink-0 text-neutral-600 text-right pr-4 select-none">
                    {idx + 1}
                  </span>
                  <span
                    className={`whitespace-pre ${
                      isComment
                        ? 'text-neutral-500 italic'
                        : isDirective
                        ? 'text-purple-400 font-semibold'
                        : isLabel
                        ? 'text-amber-400 font-bold'
                        : line.includes('mov') || line.includes('int') || line.includes('out') || line.includes('in ') || line.includes('call')
                        ? 'text-emerald-300'
                        : 'text-neutral-200'
                    }`}
                  >
                    {line}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 65816 Vector Bridge Information */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>SNES 65816 Hardware Vectors</span>
            </h3>
            <p className="text-xs text-neutral-400">
              In a native SNES cartridge, the Ricoh 5A22 CPU initiates code execution from the 16-bit Reset Vector located at ROM address $00:FFFC ($8000).
            </p>
            <div className="space-y-2 text-xs font-mono-code">
              <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 flex justify-between">
                <span className="text-neutral-400">RESET Vector ($FFFC):</span>
                <span className="text-amber-400 font-bold">0x{snesRom.header.vectors.reset.toString(16).toUpperCase()}</span>
              </div>
              <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 flex justify-between">
                <span className="text-neutral-400">NMI Vector ($FFEA):</span>
                <span className="text-neutral-200 font-bold">0x{snesRom.header.vectors.nmi.toString(16).toUpperCase()}</span>
              </div>
              <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 flex justify-between">
                <span className="text-neutral-400">IRQ Vector ($FFEE):</span>
                <span className="text-neutral-200 font-bold">0x{snesRom.header.vectors.irq.toString(16).toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              <span>DOS Mode 13h Bridge Architecture</span>
            </h3>
            <p className="text-xs text-neutral-400">
              When compiled into the MS-DOS executable wrapper, the x86 bootstrap sets up conventional memory and bridges the SNES subsystems:
            </p>
            <ul className="text-xs text-neutral-300 space-y-2 list-disc pl-4">
              <li>
                <strong className="text-neutral-100">Video Subsystem:</strong> SNES PPU layers (Mode 1 / Mode 7) mapped into 320x200 linear chunky framebuffer at segment <code className="text-amber-300 font-mono-code">0xA000:0000</code>.
              </li>
              <li>
                <strong className="text-neutral-100">Palette Subsystem:</strong> SNES CGRAM 15-bit BGR555 translated to 768-byte 6-bit VGA DAC registers (<code className="text-amber-300 font-mono-code">Port 0x03C8 / 0x03C9</code>).
              </li>
              <li>
                <strong className="text-neutral-100">Audio Subsystem:</strong> Sony SPC700 8-channel DSP audio mapped to Sound Blaster 16 DSP (<code className="text-amber-300 font-mono-code">Port 0x220</code>) and OPL2 FM chips.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
