import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Activity, Play, Radio, Sliders, Copy, Check, Sparkles } from 'lucide-react';
import { SoundBlasterEmulator } from '../services/soundBlasterEmulator';
import { SoundBlasterConfig } from '../types/dos';

interface SoundBlasterLabTabProps {
  sbConfig: SoundBlasterConfig;
  setSbConfig: React.Dispatch<React.SetStateAction<SoundBlasterConfig>>;
  sbEmulator: SoundBlasterEmulator;
}

export const SoundBlasterLabTab: React.FC<SoundBlasterLabTabProps> = ({
  sbConfig,
  setSbConfig,
  sbEmulator,
}) => {
  const oscCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  const [copiedBlaster, setCopiedBlaster] = useState<boolean>(false);
  const [modRatio, setModRatio] = useState<number>(2.0);
  const [modDepth, setModDepth] = useState<number>(350);

  // Real-time Oscilloscope loop
  useEffect(() => {
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = sbEmulator.getAnalyser();
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Center horizontal line
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      // Vertical grid lines
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      ctx.stroke();

      if (analyser) {
        analyser.getByteTimeDomainData(dataArray);

        // Draw green/amber phosphor oscilloscope beam
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8'; // Cyan phosphor beam
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0; // 0.0 to 2.0
          const y = (v * canvas.height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [sbEmulator]);

  const blasterString = `SET BLASTER=A${sbConfig.basePort.toString(16).toUpperCase()} I${sbConfig.irq} D${sbConfig.dma8} H${sbConfig.dma16} T6`;

  const copyBlaster = () => {
    navigator.clipboard.writeText(blasterString);
    setCopiedBlaster(true);
    setTimeout(() => setCopiedBlaster(false), 2000);
  };

  const playDacSample = (type: 'engine' | 'jump' | 'laser' | 'coin' | 'explosion' | 'voice_ready') => {
    sbEmulator.playDspSample(type);
  };

  const playOplTone = (freq: number) => {
    sbEmulator.playOplNote(freq, 0.35, modRatio, modDepth);
  };

  return (
    <div className="space-y-6">
      {/* Overview & BLASTER string */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>Sound Blaster 16 & Yamaha YM3812 (OPL2) Hardware Lab</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Simulates the authentic 8-bit DAC resistor ladder quantization noise and dual-operator FM synthesis circuitry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded text-xs font-mono-code text-amber-300">
            {blasterString}
          </div>
          <button
            onClick={copyBlaster}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 rounded transition-colors"
          >
            {copiedBlaster ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedBlaster ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Live Audio Oscilloscope */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Real-Time Sound Blaster DSP Oscilloscope</span>
          </h3>
          <span className="text-xs font-mono-code text-neutral-400">
            Sample Rate: 11,025 Hz · 8-Bit DAC · Low-Pass Filter: 4,500 Hz
          </span>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex justify-center">
          <canvas
            ref={oscCanvasRef}
            width={640}
            height={160}
            className="w-full max-w-2xl h-40 bg-neutral-950 rounded border border-neutral-900"
          />
        </div>
      </div>

      {/* Interactive Sound Decks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sound Blaster DSP 8-Bit Digitized DAC Samples */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <span>Sound Blaster 16 DSP Digitized 8-Bit DAC Samples</span>
            </h3>
            <span className="text-xs font-mono-code text-neutral-400">DMA Channel 1</span>
          </div>

          <p className="text-xs text-neutral-400">
            Click to trigger vintage 8-bit quantized PCM audio samples through the analog filter:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => playDacSample('voice_ready')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-left transition-colors group"
            >
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300">
                Voice Ready
              </div>
              <div className="text-[10px] text-neutral-500 font-mono-code mt-1">Formant speech</div>
            </button>

            <button
              onClick={() => playDacSample('engine')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-left transition-colors group"
            >
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300">
                Engine Rev
              </div>
              <div className="text-[10px] text-neutral-500 font-mono-code mt-1">Chrono Racer</div>
            </button>

            <button
              onClick={() => playDacSample('jump')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-left transition-colors group"
            >
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300">
                Jump Ping
              </div>
              <div className="text-[10px] text-neutral-500 font-mono-code mt-1">Super DOS Mario</div>
            </button>

            <button
              onClick={() => playDacSample('coin')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-left transition-colors group"
            >
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300">
                Coin Chime
              </div>
              <div className="text-[10px] text-neutral-500 font-mono-code mt-1">Dual-tone sine</div>
            </button>

            <button
              onClick={() => playDacSample('laser')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-left transition-colors group"
            >
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300">
                Laser Pew
              </div>
              <div className="text-[10px] text-neutral-500 font-mono-code mt-1">Space Horizon</div>
            </button>

            <button
              onClick={() => playDacSample('explosion')}
              className="p-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-left transition-colors group"
            >
              <div className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300">
                Explosion
              </div>
              <div className="text-[10px] text-neutral-500 font-mono-code mt-1">8-Bit DAC noise</div>
            </button>
          </div>
        </div>

        {/* Yamaha YM3812 (OPL2) FM Synthesizer Deck */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Yamaha YM3812 (OPL2) 2-Operator FM Synth</span>
            </h3>
            <span className="text-xs font-mono-code text-neutral-400">Port 0x388 / 0x389</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>Modulator Ratio:</span>
                <span className="font-mono-code text-neutral-200">{modRatio.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="8.0"
                step="0.5"
                value={modRatio}
                onChange={(e) => setModRatio(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>Modulation Depth:</span>
                <span className="font-mono-code text-neutral-200">{modDepth}</span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="50"
                value={modDepth}
                onChange={(e) => setModDepth(parseInt(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-neutral-400 block mb-2">Play FM Keyboard Note (AdLib / OPL2):</label>
            <div className="grid grid-cols-7 gap-1.5">
              {[
                { label: 'C4', freq: 261.63 },
                { label: 'D4', freq: 293.66 },
                { label: 'E4', freq: 329.63 },
                { label: 'F4', freq: 349.23 },
                { label: 'G4', freq: 392.00 },
                { label: 'A4', freq: 440.00 },
                { label: 'B4', freq: 493.88 },
              ].map((note) => (
                <button
                  key={note.label}
                  onClick={() => playOplTone(note.freq)}
                  className="py-2.5 bg-neutral-950 hover:bg-neutral-800 active:bg-amber-500/20 border border-neutral-800 rounded text-center text-xs font-mono-code font-bold text-neutral-200 transition-colors"
                >
                  {note.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
