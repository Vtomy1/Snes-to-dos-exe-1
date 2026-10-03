import React, { useRef } from 'react';
import { Upload, Cpu, CheckCircle2, AlertTriangle, Layers, Volume2, Monitor, ArrowRight, RefreshCw, Palette } from 'lucide-react';
import { SNESRomData } from '../types/rom';
import { SoundBlasterConfig, VgaConfig, ExtenderType } from '../types/dos';
import { parseSnesRom } from '../services/snesParser';
import { PaletteEditor } from './PaletteEditor';

interface RomAnalyzerTabProps {
  snesRom: SNESRomData;
  setSnesRom: (rom: SNESRomData) => void;
  sbConfig: SoundBlasterConfig;
  setSbConfig: React.Dispatch<React.SetStateAction<SoundBlasterConfig>>;
  vgaConfig: VgaConfig;
  setVgaConfig: React.Dispatch<React.SetStateAction<VgaConfig>>;
  extender: ExtenderType;
  setExtender: (ext: ExtenderType) => void;
  onRebuild: () => void;
  onRunInDos: () => void;
}

export const RomAnalyzerTab: React.FC<RomAnalyzerTabProps> = ({
  snesRom,
  setSnesRom,
  sbConfig,
  setSbConfig,
  vgaConfig,
  setVgaConfig,
  extender,
  setExtender,
  onRebuild,
  onRunInDos,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = new Uint8Array(event.target?.result as ArrayBuffer);
      const parsed = parseSnesRom(buffer, file.name);
      setSnesRom(parsed);
      onRebuild();
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePaletteChange = (newPalette: Array<[number, number, number]>) => {
    setSnesRom({
      ...snesRom,
      extractedPalette: newPalette,
    });
    onRebuild();
  };

  const handleResetPalette = () => {
    const reParsed = parseSnesRom(snesRom.rawBuffer, snesRom.fileName);
    setSnesRom({
      ...snesRom,
      extractedPalette: reParsed.extractedPalette,
    });
    onRebuild();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Upload Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
              <span>SNES Cartridge Header & ROM Binary</span>
              <span className="text-xs font-mono-code px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                {snesRom.fileName}
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Parses SNES 65816 vector headers, strips 512-byte copier artifacts, and structures binary for DOS Mode 13h injection.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".smc,.sfc,.bin,.rom"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Load Custom ROM (.SMC / .SFC)</span>
            </button>
            <button
              onClick={onRunInDos}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors"
            >
              <span>Launch 320x200 DOS VM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SNES ROM Header Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Title & Cartridge Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Cartridge Title</span>
            <span className="font-mono-code">21-Byte ASCII</span>
          </div>
          <div className="text-base font-semibold text-neutral-100 truncate font-mono-code">
            {snesRom.header.title}
          </div>
          <div className="text-xs text-neutral-400 flex items-center gap-1.5 pt-1 border-t border-neutral-800/80">
            <span className="text-neutral-500">Hardware:</span>
            <span className="text-neutral-300 truncate">{snesRom.header.romType}</span>
          </div>
        </div>

        {/* Memory Mapping & Speed */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Bus Architecture</span>
            <span className="font-mono-code">{snesRom.header.mapping}</span>
          </div>
          <div className="text-base font-semibold text-neutral-100 font-mono-code">
            {snesRom.header.speed}
          </div>
          <div className="text-xs text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <span>Header Offset:</span>
            <span className="font-mono-code text-amber-400">0x{snesRom.header.headerOffset.toString(16).toUpperCase()}</span>
          </div>
        </div>

        {/* ROM & RAM Sizes */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Memory Capacity</span>
            <span className="font-mono-code">{(snesRom.fileSize / 1024).toFixed(0)} KB File</span>
          </div>
          <div className="text-base font-semibold text-neutral-100 font-mono-code">
            {snesRom.header.romSizeKb >= 1024
              ? `${(snesRom.header.romSizeKb / 1024).toFixed(1)} MB ROM`
              : `${snesRom.header.romSizeKb} KB ROM`}
          </div>
          <div className="text-xs text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <span>SRAM Size:</span>
            <span className="font-mono-code text-neutral-300">{snesRom.header.ramSizeKb} KB</span>
          </div>
        </div>

        {/* Checksum Validation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Checksum & Inverse</span>
            {snesRom.header.isValidChecksum ? (
              <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Valid
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" /> Unchecked
              </span>
            )}
          </div>
          <div className="text-base font-semibold text-neutral-100 font-mono-code">
            0x{snesRom.header.checksum.toString(16).toUpperCase()}
          </div>
          <div className="text-xs text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-800/80">
            <span>Complement:</span>
            <span className="font-mono-code text-neutral-300">0x{snesRom.header.complement.toString(16).toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* SNES Interrupt Vectors Breakdown */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-neutral-200 mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-400" />
          <span>65816 CPU Native Interrupt Vectors (Mapped to DOS Entry Points)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800/80">
            <div className="text-[11px] text-neutral-400 uppercase">RESET ($FFFC)</div>
            <div className="text-sm font-mono-code font-semibold text-amber-400">
              0x{snesRom.header.vectors.reset.toString(16).toUpperCase()}
            </div>
            <div className="text-[10px] text-neutral-500">Execution Entry</div>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800/80">
            <div className="text-[11px] text-neutral-400 uppercase">NMI ($FFEA)</div>
            <div className="text-sm font-mono-code font-semibold text-neutral-200">
              0x{snesRom.header.vectors.nmi.toString(16).toUpperCase()}
            </div>
            <div className="text-[10px] text-neutral-500">V-Blank Interrupt</div>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800/80">
            <div className="text-[11px] text-neutral-400 uppercase">IRQ ($FFEE)</div>
            <div className="text-sm font-mono-code font-semibold text-neutral-200">
              0x{snesRom.header.vectors.irq.toString(16).toUpperCase()}
            </div>
            <div className="text-[10px] text-neutral-500">Timer Interrupt</div>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800/80">
            <div className="text-[11px] text-neutral-400 uppercase">COP ($FFE4)</div>
            <div className="text-sm font-mono-code font-semibold text-neutral-400">
              0x{snesRom.header.vectors.cop.toString(16).toUpperCase()}
            </div>
            <div className="text-[10px] text-neutral-500">Coprocessor Vector</div>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800/80">
            <div className="text-[11px] text-neutral-400 uppercase">BRK ($FFE6)</div>
            <div className="text-sm font-mono-code font-semibold text-neutral-400">
              0x{snesRom.header.vectors.brk.toString(16).toUpperCase()}
            </div>
            <div className="text-[10px] text-neutral-500">Software Trap</div>
          </div>
          <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800/80">
            <div className="text-[11px] text-neutral-400 uppercase">ABORT ($FFE8)</div>
            <div className="text-sm font-mono-code font-semibold text-neutral-400">
              0x{snesRom.header.vectors.abort.toString(16).toUpperCase()}
            </div>
            <div className="text-[10px] text-neutral-500">Hardware Abort</div>
          </div>
        </div>
      </div>

      {/* Target MS-DOS Configuration Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VGA Subsystem Configuration */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-400" />
              <span>VGA Subsystem (INT 10h Mode 13h)</span>
            </h3>
            <span className="text-[11px] font-mono-code text-neutral-400">Segment 0xA000:0000</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Video Display Mode</label>
              <div className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200 font-mono-code flex items-center justify-between">
                <span>VGA Mode 13h (320x200, 256 Colors, 8-Bit Chunky)</span>
                <span className="text-emerald-400">0x0013</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Palette Quantization Mode</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVgaConfig({ ...vgaConfig, paletteMode: 'adaptive_snes' });
                    onRebuild();
                  }}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    vgaConfig.paletteMode === 'adaptive_snes'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Adaptive SNES
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVgaConfig({ ...vgaConfig, paletteMode: 'standard_vga' });
                    onRebuild();
                  }}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    vgaConfig.paletteMode === 'standard_vga'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Standard VGA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVgaConfig({ ...vgaConfig, paletteMode: 'retro_arcade' });
                    onRebuild();
                  }}
                  className={`px-3 py-2 text-xs rounded border transition-colors ${
                    vgaConfig.paletteMode === 'retro_arcade'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 font-medium'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Retro Arcade
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-neutral-300 border-t border-neutral-800">
              <span>Wait for Vertical Retrace (VSync Port 03DAh):</span>
              <input
                type="checkbox"
                checked={vgaConfig.vsyncWait}
                onChange={(e) => {
                  setVgaConfig({ ...vgaConfig, vsyncWait: e.target.checked });
                  onRebuild();
                }}
                className="rounded border-neutral-700 bg-neutral-950 text-amber-500 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-300">
              <span>Double Buffering (Alloc 64KB Scratch RAM):</span>
              <input
                type="checkbox"
                checked={vgaConfig.doubleBuffer}
                onChange={(e) => {
                  setVgaConfig({ ...vgaConfig, doubleBuffer: e.target.checked });
                  onRebuild();
                }}
                className="rounded border-neutral-700 bg-neutral-950 text-amber-500 focus:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Sound Blaster Configuration */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <span>Sound Blaster 16 / DSP Configuration</span>
            </h3>
            <span className="text-[11px] font-mono-code text-neutral-400">
              SET BLASTER=A{sbConfig.basePort.toString(16).toUpperCase()} I{sbConfig.irq} D{sbConfig.dma8}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Base I/O Port</label>
              <select
                value={sbConfig.basePort}
                onChange={(e) => {
                  setSbConfig({ ...sbConfig, basePort: parseInt(e.target.value) });
                  onRebuild();
                }}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200 font-mono-code"
              >
                <option value={0x220}>0x220 (Standard Default)</option>
                <option value={0x240}>0x240 (Alternate)</option>
                <option value={0x260}>0x260 (Secondary)</option>
                <option value={0x280}>0x280 (Rare)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Interrupt IRQ</label>
              <select
                value={sbConfig.irq}
                onChange={(e) => {
                  setSbConfig({ ...sbConfig, irq: parseInt(e.target.value) });
                  onRebuild();
                }}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200 font-mono-code"
              >
                <option value={7}>IRQ 7 (Classic Sound Blaster)</option>
                <option value={5}>IRQ 5 (SB16 / Game Default)</option>
                <option value={2}>IRQ 2 (Cascade)</option>
                <option value={10}>IRQ 10 (High IRQ)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">Low 8-Bit DMA Channel</label>
              <select
                value={sbConfig.dma8}
                onChange={(e) => {
                  setSbConfig({ ...sbConfig, dma8: parseInt(e.target.value) });
                  onRebuild();
                }}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200 font-mono-code"
              >
                <option value={1}>DMA 1 (Standard 8-bit)</option>
                <option value={0}>DMA 0</option>
                <option value={3}>DMA 3</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-neutral-400 block mb-1">DOS Target Extender</label>
              <select
                value={extender}
                onChange={(e) => {
                  setExtender(e.target.value as ExtenderType);
                  onRebuild();
                }}
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200 font-mono-code"
              >
                <option value="real_mode_16">16-Bit Real Mode (MZ)</option>
                <option value="pmode_32">32-Bit PMODE/W Stub</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-neutral-300 border-t border-neutral-800">
            <span>Enable Yamaha YM3812 (OPL2) FM Music Synthesizer:</span>
            <input
              type="checkbox"
              checked={sbConfig.oplEnabled}
              onChange={(e) => {
                setSbConfig({ ...sbConfig, oplEnabled: e.target.checked });
                onRebuild();
              }}
              className="rounded border-neutral-700 bg-neutral-950 text-amber-500 focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* 8-Bit VGA 256-Color DAC Palette Editor */}
      <PaletteEditor
        palette={snesRom.extractedPalette}
        onPaletteChange={handlePaletteChange}
        onResetOriginal={handleResetPalette}
      />
    </div>
  );
};
