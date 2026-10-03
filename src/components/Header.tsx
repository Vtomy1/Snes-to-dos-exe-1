import React from 'react';
import { Terminal, Download, Play, Disc } from 'lucide-react';

interface HeaderProps {
  activeTab: 'converter' | 'runner' | 'mzheader' | 'disasm' | 'soundblaster';
  setActiveTab: (tab: 'converter' | 'runner' | 'mzheader' | 'disasm' | 'soundblaster') => void;
  onQuickRun: () => void;
  onExportExe: () => void;
  exeFileName: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onQuickRun,
  onExportExe,
  exeFileName,
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-3.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Terminal className="w-4 h-4" />
        </div>
        <span className="text-base font-semibold tracking-tight text-neutral-100 font-mono-code">
          SNES-TO-DOS EXE STUDIO
        </span>
      </div>

      {/* Zone 2: Navigation Links / Tabs */}
      <nav className="hidden lg:flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800/80">
        <button
          onClick={() => setActiveTab('converter')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'converter'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          ROM & Converter
        </button>
        <button
          onClick={() => setActiveTab('runner')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'runner'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          DOS 320x200 Runner
        </button>
        <button
          onClick={() => setActiveTab('mzheader')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'mzheader'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          MZ Header & Hex
        </button>
        <button
          onClick={() => setActiveTab('disasm')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'disasm'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          x86 Disassembly
        </button>
        <button
          onClick={() => setActiveTab('soundblaster')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            activeTab === 'soundblaster'
              ? 'bg-neutral-800 text-amber-400 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Sound Blaster Lab
        </button>
      </nav>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onQuickRun}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 rounded hover:bg-emerald-900/60 transition-colors whitespace-nowrap"
          title="Launch DOS Mode 13h Screen"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Run in DOS</span>
        </button>
        <button
          onClick={onExportExe}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-neutral-950 bg-amber-400 rounded hover:bg-amber-300 transition-colors shadow-sm whitespace-nowrap"
          title={`Download ${exeFileName}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export {exeFileName}</span>
        </button>
      </div>
    </header>
  );
};
