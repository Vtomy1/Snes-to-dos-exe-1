import React, { useState } from 'react';
import { Download, Package, FileCode, Disc, Check, Cpu, Monitor, Volume2 } from 'lucide-react';
import { DosExeBuildResult, SoundBlasterConfig, VgaConfig } from '../types/dos';
import { SNESRomData } from '../types/rom';
import { createDosboxZipBundle } from '../services/dosExeBuilder';

interface SidebarExportPanelProps {
  buildResult: DosExeBuildResult;
  snesRom: SNESRomData;
  sbConfig: SoundBlasterConfig;
  vgaConfig: VgaConfig;
  onSelectDemo: (demo: 'racer' | 'platformer' | 'shmup') => void;
  onExportExe: () => void;
}

export const SidebarExportPanel: React.FC<SidebarExportPanelProps> = ({
  buildResult,
  snesRom,
  sbConfig,
  vgaConfig,
  onSelectDemo,
  onExportExe,
}) => {
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true);
      const zipBlob = await createDosboxZipBundle(buildResult, snesRom);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${buildResult.fileName.replace(/\.EXE$/i, '')}_DOSBOX.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <aside className="w-full lg:w-80 space-y-5 shrink-0">
      {/* Quick Built-in Demo Switcher */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
            <Disc className="w-3.5 h-3.5 text-amber-400" />
            <span>Preloaded SNES Cartridges</span>
          </span>
          <span className="text-[10px] text-neutral-500 font-mono-code">1-Click</span>
        </div>

        <div className="space-y-1.5">
          <button
            onClick={() => onSelectDemo('racer')}
            className={`w-full text-left p-2.5 rounded border transition-colors flex items-center justify-between text-xs ${
              snesRom.demoType === 'racer'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <div>
              <div className="font-semibold font-mono-code">CHRONO RACER 320</div>
              <div className="text-[10px] text-neutral-500">Mode 7 Pseudo-3D · SB16 Engine</div>
            </div>
            {snesRom.demoType === 'racer' && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </button>

          <button
            onClick={() => onSelectDemo('platformer')}
            className={`w-full text-left p-2.5 rounded border transition-colors flex items-center justify-between text-xs ${
              snesRom.demoType === 'platformer'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <div>
              <div className="font-semibold font-mono-code">SUPER DOS MARIO TECH</div>
              <div className="text-[10px] text-neutral-500">8-Bit Tilemap · SB DSP Jump Ping</div>
            </div>
            {snesRom.demoType === 'platformer' && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </button>

          <button
            onClick={() => onSelectDemo('shmup')}
            className={`w-full text-left p-2.5 rounded border transition-colors flex items-center justify-between text-xs ${
              snesRom.demoType === 'shmup'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <div>
              <div className="font-semibold font-mono-code">SPACE HORIZON 1993</div>
              <div className="text-[10px] text-neutral-500">Starfield Shmup · 8-Bit Explosion</div>
            </div>
            {snesRom.demoType === 'shmup' && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </button>
        </div>
      </div>

      {/* Target Binary Specification Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
          DOS Executable Profile
        </h3>

        <div className="space-y-2 text-xs font-mono-code">
          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-500">Binary File:</span>
            <span className="text-amber-400 font-bold">{buildResult.fileName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-500">MZ Format:</span>
            <span className="text-neutral-200">16-Bit Real Mode</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-500">Total File Size:</span>
            <span className="text-neutral-200">{buildResult.totalSize.toLocaleString()} bytes</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-500">512-Byte Pages:</span>
            <span className="text-neutral-200">{buildResult.pagesCount}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-500">Video Segment:</span>
            <span className="text-emerald-400">0xA000:0000</span>
          </div>
          <div className="flex justify-between py-1 border-b border-neutral-800/60">
            <span className="text-neutral-500">Sound Blaster:</span>
            <span className="text-cyan-400">0x{sbConfig.basePort.toString(16).toUpperCase()}:IRQ{sbConfig.irq}</span>
          </div>
        </div>
      </div>

      {/* Export Action Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2.5">
        <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-1">
          Export Packages
        </h3>

        <button
          onClick={onExportExe}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded text-xs font-semibold transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>Download {buildResult.fileName}</span>
        </button>

        <button
          onClick={handleDownloadZip}
          disabled={downloadingZip}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-medium transition-colors"
        >
          <Package className="w-4 h-4 text-emerald-400" />
          <span>{downloadingZip ? 'Packing ZIP...' : 'Full DOSBox Package (.ZIP)'}</span>
        </button>
      </div>
    </aside>
  );
};
