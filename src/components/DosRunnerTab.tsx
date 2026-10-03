import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw, Tv, Music, Radio, Sparkles } from 'lucide-react';
import { VgaMode13hRenderer } from '../services/vgaRenderer';
import { SoundBlasterEmulator } from '../services/soundBlasterEmulator';
import { SNESRomData } from '../types/rom';
import { SoundBlasterConfig, VgaConfig } from '../types/dos';

interface DosRunnerTabProps {
  snesRom: SNESRomData;
  sbConfig: SoundBlasterConfig;
  vgaConfig: VgaConfig;
  sbEmulator: SoundBlasterEmulator;
}

export const DosRunnerTab: React.FC<DosRunnerTabProps> = ({
  snesRom,
  sbConfig,
  vgaConfig,
  sbEmulator,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<VgaMode13hRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [musicActive, setMusicActive] = useState<boolean>(true);
  const [crtFilter, setCrtFilter] = useState<'pixel' | 'scanline' | 'amber' | 'green'>('pixel');
  const [screenScale, setScreenScale] = useState<number>(2.5); // 2.5x = 800x500
  const [lastScanCode, setLastScanCode] = useState<string>('0x00');
  const [fps, setFps] = useState<number>(70);

  // Keyboard state
  const keysDownRef = useRef<Record<string, boolean>>({});

  // Initialize renderer and canvas loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new VgaMode13hRenderer(canvasRef.current, snesRom, vgaConfig);
    rendererRef.current = renderer;

    // Start background OPL music
    if (musicActive && !isMuted) {
      sbEmulator.startOplMusic(snesRom.demoType || 'racer');
    }

    let lastTime = performance.now();
    let frames = 0;

    const tick = (now: number) => {
      if (isRunning && rendererRef.current) {
        const { event } = rendererRef.current.renderTick(keysDownRef.current);
        if (event) {
          sbEmulator.playDspSample(event);
        }

        frames++;
        if (now - lastTime >= 1000) {
          setFps(Math.round((frames * 1000) / (now - lastTime)));
          frames = 0;
          lastTime = now;
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      sbEmulator.stopOplMusic();
    };
  }, [snesRom, vgaConfig, isRunning, musicActive, isMuted, sbEmulator]);

  // Handle Global Keyboard Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = true;
      setLastScanCode(getDosScancode(e.code));

      // Quick test hotkeys: Space, Enter, Escape
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDownRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const toggleMute = () => {
    const muted = sbEmulator.toggleMute();
    setIsMuted(muted);
  };

  const toggleMusic = () => {
    if (musicActive) {
      sbEmulator.stopOplMusic();
      setMusicActive(false);
    } else {
      sbEmulator.startOplMusic(snesRom.demoType || 'racer');
      setMusicActive(true);
    }
  };

  const handleReset = () => {
    if (rendererRef.current) {
      rendererRef.current.gameState.playerX = 40;
      rendererRef.current.gameState.playerY = 140;
      rendererRef.current.gameState.carX = 0;
      rendererRef.current.gameState.speed = 0;
      rendererRef.current.gameState.distance = 0;
      rendererRef.current.gameState.score = 0;
      rendererRef.current.gameState.coins = 0;
      rendererRef.current.gameState.lasers = [];
      rendererRef.current.gameState.enemies = [];
    }
    sbEmulator.playDspSample('voice_ready');
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-neutral-200">MS-DOS VGA 13h</span>
          </div>
          <span className="text-neutral-500">|</span>
          <span className="font-mono-code text-neutral-400">320x200 @ {fps}Hz</span>
          <span className="text-neutral-500">|</span>
          <span className="font-mono-code text-amber-400">
            SB16 (0x{sbConfig.basePort.toString(16).toUpperCase()}:IRQ{sbConfig.irq})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRunning ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
            title="Warm reboot VM"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Audio Mute */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors ${
              isMuted
                ? 'bg-red-950/60 text-red-400 border border-red-800/60'
                : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'Muted' : 'Audio On'}</span>
          </button>

          {/* OPL FM Music Toggle */}
          <button
            onClick={toggleMusic}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors ${
              musicActive && !isMuted
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>OPL2 FM</span>
          </button>

          {/* Scale selector & Screen controls */}
          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
            <span className="text-[11px] text-neutral-400">Scale:</span>
            {[2, 2.5, 3].map((scale) => (
              <button
                key={scale}
                onClick={() => setScreenScale(scale)}
                className={`px-1.5 py-0.5 text-[11px] font-mono-code rounded transition-colors ${
                  screenScale === scale
                    ? 'bg-neutral-800 text-amber-400 font-bold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {scale}x
              </button>
            ))}
          </div>

          {/* CRT Filter Dropdown */}
          <div className="flex items-center gap-1 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
            <Tv className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={crtFilter}
              onChange={(e) => setCrtFilter(e.target.value as any)}
              className="bg-transparent text-neutral-200 text-xs focus:outline-none"
            >
              <option value="pixel" className="bg-neutral-900">Pixel Perfect (Sharp)</option>
              <option value="scanline" className="bg-neutral-900">CRT Scanlines</option>
              <option value="amber" className="bg-neutral-900">Amber Monitor</option>
              <option value="green" className="bg-neutral-900">Green Phosphor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Retro CRT Monitor Bezel */}
      <div className="flex flex-col items-center justify-center p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl shadow-2xl">
        <div className="w-full flex flex-col items-center relative p-4 sm:p-6 bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 rounded-2xl border-4 border-neutral-700/80 shadow-inner">
          {/* Monitor top brand logo */}
          <div className="mb-3 flex items-center gap-2 text-[11px] tracking-widest text-neutral-400 font-mono-code font-bold uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>VGA MODE 13h · 320x200 · SOUND BLASTER 16</span>
          </div>

          {/* Canvas Wrapper */}
          <div
            className={`relative rounded-lg overflow-hidden border-2 border-neutral-950 crt-screen crt-glow ${
              crtFilter === 'scanline'
                ? 'crt-scanlines'
                : crtFilter === 'amber'
                ? 'crt-scanlines crt-amber'
                : crtFilter === 'green'
                ? 'crt-scanlines crt-green'
                : ''
            }`}
            style={{
              width: `${320 * screenScale}px`,
              maxWidth: '100%',
              aspectRatio: '16 / 10',
            }}
          >
            <canvas
              ref={canvasRef}
              width={320}
              height={200}
              className="w-full h-full block bg-black"
              style={{
                imageRendering: 'pixelated',
              }}
            />
          </div>

          {/* Monitor bottom bezel controls & LED */}
          <div className="w-full mt-3 flex items-center justify-between px-2 text-[11px] text-neutral-400 font-mono-code border-t border-neutral-800/60 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
              <span>VGA 70Hz · 256 COLORS</span>
            </div>
            <div className="flex items-center gap-3">
              <span>SCANCODE: <span className="text-amber-400 font-bold">{lastScanCode}</span></span>
              <span>SEG: <span className="text-emerald-300">0xA000:0000</span></span>
            </div>
          </div>
        </div>

        {/* On-Screen Virtual Controller for Mouse / Touch */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-1.5 rounded-lg">
            <button
              onMouseDown={() => { keysDownRef.current['ArrowLeft'] = true; setLastScanCode('0x4B (LEFT)'); }}
              onMouseUp={() => { keysDownRef.current['ArrowLeft'] = false; }}
              onTouchStart={() => { keysDownRef.current['ArrowLeft'] = true; setLastScanCode('0x4B (LEFT)'); }}
              onTouchEnd={() => { keysDownRef.current['ArrowLeft'] = false; }}
              className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 active:bg-amber-500/20 text-xs font-mono-code font-bold text-neutral-200 rounded border border-neutral-800 transition-colors"
            >
              ◀ LEFT
            </button>
            <div className="flex flex-col gap-1">
              <button
                onMouseDown={() => { keysDownRef.current['ArrowUp'] = true; setLastScanCode('0x48 (UP)'); }}
                onMouseUp={() => { keysDownRef.current['ArrowUp'] = false; }}
                onTouchStart={() => { keysDownRef.current['ArrowUp'] = true; setLastScanCode('0x48 (UP)'); }}
                onTouchEnd={() => { keysDownRef.current['ArrowUp'] = false; }}
                className="px-3 py-1 bg-neutral-950 hover:bg-neutral-800 active:bg-amber-500/20 text-xs font-mono-code font-bold text-neutral-200 rounded border border-neutral-800 transition-colors"
              >
                ▲ UP
              </button>
              <button
                onMouseDown={() => { keysDownRef.current['ArrowDown'] = true; setLastScanCode('0x50 (DOWN)'); }}
                onMouseUp={() => { keysDownRef.current['ArrowDown'] = false; }}
                onTouchStart={() => { keysDownRef.current['ArrowDown'] = true; setLastScanCode('0x50 (DOWN)'); }}
                onTouchEnd={() => { keysDownRef.current['ArrowDown'] = false; }}
                className="px-3 py-1 bg-neutral-950 hover:bg-neutral-800 active:bg-amber-500/20 text-xs font-mono-code font-bold text-neutral-200 rounded border border-neutral-800 transition-colors"
              >
                ▼ DOWN
              </button>
            </div>
            <button
              onMouseDown={() => { keysDownRef.current['ArrowRight'] = true; setLastScanCode('0x4D (RIGHT)'); }}
              onMouseUp={() => { keysDownRef.current['ArrowRight'] = false; }}
              onTouchStart={() => { keysDownRef.current['ArrowRight'] = true; setLastScanCode('0x4D (RIGHT)'); }}
              onTouchEnd={() => { keysDownRef.current['ArrowRight'] = false; }}
              className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 active:bg-amber-500/20 text-xs font-mono-code font-bold text-neutral-200 rounded border border-neutral-800 transition-colors"
            >
              RIGHT ▶
            </button>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-1.5 rounded-lg">
            <button
              onMouseDown={() => { keysDownRef.current['Space'] = true; setLastScanCode('0x39 (SPACE)'); }}
              onMouseUp={() => { keysDownRef.current['Space'] = false; }}
              onTouchStart={() => { keysDownRef.current['Space'] = true; setLastScanCode('0x39 (SPACE)'); }}
              onTouchEnd={() => { keysDownRef.current['Space'] = false; }}
              className="px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 text-xs font-mono-code font-bold text-amber-300 rounded border border-amber-500/40 transition-colors"
            >
              SPACE (ACTION / JUMP / GAS)
            </button>
          </div>
        </div>

        {/* On-Screen Keyboard / Gamepad Controls Guide */}
        <div className="mt-4 w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-neutral-900/80 p-2.5 rounded border border-neutral-800 text-neutral-300 flex items-center justify-between">
            <span className="text-neutral-400">Steer / Move</span>
            <span className="font-mono-code bg-neutral-950 px-1.5 py-0.5 rounded text-amber-400">Arrows / WASD</span>
          </div>
          <div className="bg-neutral-900/80 p-2.5 rounded border border-neutral-800 text-neutral-300 flex items-center justify-between">
            <span className="text-neutral-400">Accelerate / Jump / Fire</span>
            <span className="font-mono-code bg-neutral-950 px-1.5 py-0.5 rounded text-amber-400">Spacebar</span>
          </div>
          <div className="bg-neutral-900/80 p-2.5 rounded border border-neutral-800 text-neutral-300 flex items-center justify-between">
            <span className="text-neutral-400">Brake / Down</span>
            <span className="font-mono-code bg-neutral-950 px-1.5 py-0.5 rounded text-amber-400">Down / S</span>
          </div>
          <div className="bg-neutral-900/80 p-2.5 rounded border border-neutral-800 text-neutral-300 flex items-center justify-between">
            <span className="text-neutral-400">Exit to MS-DOS</span>
            <span className="font-mono-code bg-neutral-950 px-1.5 py-0.5 rounded text-red-400">ESC</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function getDosScancode(code: string): string {
  switch (code) {
    case 'Escape': return '0x01 (ESC)';
    case 'ArrowUp': return '0x48 (UP)';
    case 'ArrowLeft': return '0x4B (LEFT)';
    case 'ArrowRight': return '0x4D (RIGHT)';
    case 'ArrowDown': return '0x50 (DOWN)';
    case 'Space': return '0x39 (SPACE)';
    case 'Enter': return '0x1C (ENTER)';
    case 'KeyW': return '0x11 (W)';
    case 'KeyA': return '0x1E (A)';
    case 'KeyS': return '0x1F (S)';
    case 'KeyD': return '0x20 (D)';
    default: return '0x00';
  }
}
