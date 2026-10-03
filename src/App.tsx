/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { RomAnalyzerTab } from './components/RomAnalyzerTab';
import { DosRunnerTab } from './components/DosRunnerTab';
import { MzHeaderInspectorTab } from './components/MzHeaderInspectorTab';
import { DisassemblyTab } from './components/DisassemblyTab';
import { SoundBlasterLabTab } from './components/SoundBlasterLabTab';
import { SidebarExportPanel } from './components/SidebarExportPanel';
import { getDemoRoms } from './services/snesParser';
import { buildDosExe } from './services/dosExeBuilder';
import { SoundBlasterEmulator } from './services/soundBlasterEmulator';
import { SNESRomData } from './types/rom';
import { SoundBlasterConfig, VgaConfig, ExtenderType } from './types/dos';

export default function App() {
  const demos = useMemo(() => getDemoRoms(), []);

  // State
  const [snesRom, setSnesRom] = useState<SNESRomData>(demos.racer);
  const [activeTab, setActiveTab] = useState<'converter' | 'runner' | 'mzheader' | 'disasm' | 'soundblaster'>('runner');
  const [extender, setExtender] = useState<ExtenderType>('real_mode_16');

  const [sbConfig, setSbConfig] = useState<SoundBlasterConfig>({
    basePort: 0x220,
    irq: 7,
    dma8: 1,
    dma16: 5,
    dspVersion: '4.05 (SB16)',
    oplEnabled: true,
    sampleRate: 11025,
    volumeMaster: 80,
    volumeOpl: 75,
    volumeDac: 85,
  });

  const [vgaConfig, setVgaConfig] = useState<VgaConfig>({
    mode: '13h',
    resolutionWidth: 320,
    resolutionHeight: 200,
    colorDepth: 8,
    dacBits: 6,
    paletteMode: 'adaptive_snes',
    vsyncWait: true,
    doubleBuffer: true,
    crtFilter: 'scanline',
  });

  // Sound Blaster Emulator Singleton
  const sbEmulatorRef = useRef<SoundBlasterEmulator | null>(null);
  if (!sbEmulatorRef.current) {
    sbEmulatorRef.current = new SoundBlasterEmulator(sbConfig);
  }

  // Keep emulator config synced
  useEffect(() => {
    sbEmulatorRef.current?.updateConfig(sbConfig);
  }, [sbConfig]);

  // Build the MS-DOS Executable Binary
  const buildResult = useMemo(() => {
    return buildDosExe(snesRom, sbConfig, vgaConfig, extender);
  }, [snesRom, sbConfig, vgaConfig, extender]);

  // Export standalone .EXE binary
  const handleExportExe = () => {
    const blob = new Blob([buildResult.fileBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildResult.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectDemo = (demo: 'racer' | 'platformer' | 'shmup') => {
    const selected = demos[demo];
    setSnesRom(selected);
    sbEmulatorRef.current?.playDspSample('voice_ready');
  };

  const handleQuickRun = () => {
    setActiveTab('runner');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Bar Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickRun={handleQuickRun}
        onExportExe={handleExportExe}
        exeFileName={buildResult.fileName}
      />

      {/* Main Workspace Layout (1440px wide baseline) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6">
        {/* Main Content Area */}
        <section className="flex-1 min-w-0">
          {activeTab === 'converter' && (
            <RomAnalyzerTab
              snesRom={snesRom}
              setSnesRom={setSnesRom}
              sbConfig={sbConfig}
              setSbConfig={setSbConfig}
              vgaConfig={vgaConfig}
              setVgaConfig={setVgaConfig}
              extender={extender}
              setExtender={setExtender}
              onRebuild={() => {}}
              onRunInDos={handleQuickRun}
            />
          )}

          {activeTab === 'runner' && (
            <DosRunnerTab
              snesRom={snesRom}
              sbConfig={sbConfig}
              vgaConfig={vgaConfig}
              sbEmulator={sbEmulatorRef.current!}
            />
          )}

          {activeTab === 'mzheader' && (
            <MzHeaderInspectorTab
              buildResult={buildResult}
              snesRom={snesRom}
            />
          )}

          {activeTab === 'disasm' && (
            <DisassemblyTab
              buildResult={buildResult}
              snesRom={snesRom}
            />
          )}

          {activeTab === 'soundblaster' && (
            <SoundBlasterLabTab
              sbConfig={sbConfig}
              setSbConfig={setSbConfig}
              sbEmulator={sbEmulatorRef.current!}
            />
          )}
        </section>

        {/* Right Sidebar Export & Quick Config Panel */}
        <SidebarExportPanel
          buildResult={buildResult}
          snesRom={snesRom}
          sbConfig={sbConfig}
          vgaConfig={vgaConfig}
          onSelectDemo={handleSelectDemo}
          onExportExe={handleExportExe}
        />
      </main>

      {/* Quiet Footer */}
      <footer className="px-6 py-4 border-t border-neutral-900 bg-neutral-950 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>SNES-to-DOS Exe Studio</span>
          <span>·</span>
          <span>MS-DOS Mode 13h (320x200 8-Bit)</span>
          <span>·</span>
          <span>Sound Blaster 16 (Port 0x220)</span>
        </div>
        <div className="font-mono-code text-[11px] text-neutral-600">
          MZ Signature: 0x5A4D · Segment 0xA000
        </div>
      </footer>
    </div>
  );
}
