import React, { useState } from 'react';
import { Palette, RotateCcw, Sliders, Sparkles, Sun, Moon, Copy, Check, Eye } from 'lucide-react';
import { rgbToVgaDac } from '../services/snesParser';

interface PaletteEditorProps {
  palette: Array<[number, number, number]>;
  onPaletteChange: (newPalette: Array<[number, number, number]>) => void;
  onResetOriginal?: () => void;
}

export const PaletteEditor: React.FC<PaletteEditorProps> = ({
  palette,
  onPaletteChange,
  onResetOriginal,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const currentColor = palette[selectedIndex] || [0, 0, 0];
  const [r, g, b] = currentColor;
  const [r6, g6, b6] = rgbToVgaDac(r, g, b);

  // 15-bit SNES BGR555 calculation
  const r5 = Math.round((r * 31) / 255);
  const g5 = Math.round((g * 31) / 255);
  const b5 = Math.round((b * 31) / 255);
  const snesBgr555 = (r5 & 0x1F) | ((g5 & 0x1F) << 5) | ((b5 & 0x1F) << 10);
  const snesHex = `$${snesBgr555.toString(16).toUpperCase().padStart(4, '0')}`;

  const hexColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

  const updateColorAtIndex = (idx: number, newR: number, newG: number, newB: number) => {
    const updated = [...palette];
    updated[idx] = [
      Math.max(0, Math.min(255, Math.round(newR))),
      Math.max(0, Math.min(255, Math.round(newG))),
      Math.max(0, Math.min(255, Math.round(newB))),
    ];
    onPaletteChange(updated);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
    if (val.length === 6) {
      const num = parseInt(val, 16);
      const newR = (num >> 16) & 255;
      const newG = (num >> 8) & 255;
      const newB = num & 255;
      updateColorAtIndex(selectedIndex, newR, newG, newB);
    }
  };

  const handleNativeColorPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const num = parseInt(hex.slice(1), 16);
    const newR = (num >> 16) & 255;
    const newG = (num >> 8) & 255;
    const newB = num & 255;
    updateColorAtIndex(selectedIndex, newR, newG, newB);
  };

  // --- PRESET GENERATORS ---

  const applyClassicVgaPreset = () => {
    const newPal: Array<[number, number, number]> = [];
    const standard16: Array<[number, number, number]> = [
      [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170],
      [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
      [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
      [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255]
    ];
    newPal.push(...standard16);

    // 16 Grayscale shades
    for (let i = 0; i < 16; i++) {
      const v = Math.round((i / 15) * 255);
      newPal.push([v, v, v]);
    }

    // 216 Color cube (6x6x6)
    const steps = [0, 51, 102, 153, 204, 255];
    for (const cr of steps) {
      for (const cg of steps) {
        for (const cb of steps) {
          if (newPal.length < 256) newPal.push([cr, cg, cb]);
        }
      }
    }

    while (newPal.length < 256) newPal.push([0, 0, 0]);
    onPaletteChange(newPal.slice(0, 256));
  };

  const applyGrayscalePreset = () => {
    const newPal: Array<[number, number, number]> = [];
    for (let i = 0; i < 256; i++) {
      const v = Math.round((i / 255) * 255);
      newPal.push([v, v, v]);
    }
    onPaletteChange(newPal);
  };

  const applyCyberpunkPreset = () => {
    const newPal: Array<[number, number, number]> = [];
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const cr = Math.round(Math.sin(t * Math.PI) * 255);
      const cg = Math.round(Math.cos(t * Math.PI * 2) * 127 + 128);
      const cb = Math.round((1 - t) * 255);
      newPal.push([cr, cg, cb]);
    }
    onPaletteChange(newPal);
  };

  const applyGameBoyPreset = () => {
    const newPal: Array<[number, number, number]> = [];
    const gbShades: Array<[number, number, number]> = [
      [15, 56, 15],     // Darkest green
      [48, 98, 48],     // Dark green
      [139, 172, 15],   // Light green
      [155, 188, 15]    // Brightest green
    ];
    for (let i = 0; i < 256; i++) {
      const shade = gbShades[i % 4];
      const intensity = 0.5 + 0.5 * (Math.floor(i / 4) / 63);
      newPal.push([
        Math.round(shade[0] * intensity),
        Math.round(shade[1] * intensity),
        Math.round(shade[2] * intensity)
      ]);
    }
    onPaletteChange(newPal);
  };

  // --- TRANSFORMS ---

  const invertPalette = () => {
    const inverted: Array<[number, number, number]> = palette.map(([cr, cg, cb]) => [
      255 - cr,
      255 - cg,
      255 - cb
    ]);
    onPaletteChange(inverted);
  };

  const convertToGrayscale = () => {
    const grays: Array<[number, number, number]> = palette.map(([cr, cg, cb]) => {
      const gray = Math.round(0.299 * cr + 0.587 * cg + 0.114 * cb);
      return [gray, gray, gray];
    });
    onPaletteChange(grays);
  };

  const adjustBrightness = (factor: number) => {
    const adjusted: Array<[number, number, number]> = palette.map(([cr, cg, cb]) => [
      Math.max(0, Math.min(255, Math.round(cr * factor))),
      Math.max(0, Math.min(255, Math.round(cg * factor))),
      Math.max(0, Math.min(255, Math.round(cb * factor)))
    ]);
    onPaletteChange(adjusted);
  };

  const copyHexList = () => {
    const text = palette.map((rgb, idx) => {
      const hex = `#${((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1).toUpperCase()}`;
      return `${idx.toString().padStart(3, ' ')}: ${hex} (R:${rgb[0]} G:${rgb[1]} B:${rgb[2]})`;
    }).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            <span>VGA 256-Color DAC Palette Editor</span>
            <span className="text-[11px] font-mono-code bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
              Ports 0x03C8 / 0x03C9
            </span>
          </h3>
          <p className="text-xs text-neutral-400">
            Interactive 16×16 swatch matrix. Click any color entry to customize its 8-bit RGB channels and 6-bit hardware DAC registers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onResetOriginal && (
            <button
              onClick={onResetOriginal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 rounded transition-colors"
              title="Reload colors extracted from original SNES CGRAM"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset CGRAM</span>
            </button>
          )}

          <button
            onClick={copyHexList}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Palette'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid & Inspector View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 16x16 Color Swatch Matrix (Left 7 cols) */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>256 Color Indices (0x00 to 0xFF)</span>
            <span className="font-mono-code">
              Selected: <strong className="text-amber-400">#{selectedIndex}</strong> (0x{selectedIndex.toString(16).toUpperCase().padStart(2, '0')})
            </span>
          </div>

          <div className="p-2 bg-neutral-950 border border-neutral-800 rounded-lg">
            <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1 aspect-square sm:aspect-auto">
              {palette.map((rgb, idx) => {
                const isSelected = idx === selectedIndex;
                const bgRgb = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    title={`Index ${idx} (0x${idx.toString(16).toUpperCase()}) - rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`}
                    className={`w-full aspect-square rounded-sm transition-transform cursor-pointer relative group ${
                      isSelected
                        ? 'ring-2 ring-amber-400 z-10 scale-125 shadow-lg'
                        : 'hover:scale-110 hover:z-10'
                    }`}
                    style={{ backgroundColor: bgRgb }}
                  />
                );
              })}
            </div>
          </div>

          {/* Quick presets row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <span className="text-[11px] text-neutral-500 mr-1">Presets:</span>
            <button
              type="button"
              onClick={applyClassicVgaPreset}
              className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
            >
              Classic VGA 256
            </button>
            <button
              type="button"
              onClick={applyGrayscalePreset}
              className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
            >
              Grayscale
            </button>
            <button
              type="button"
              onClick={applyCyberpunkPreset}
              className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
            >
              Cyberpunk
            </button>
            <button
              type="button"
              onClick={applyGameBoyPreset}
              className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
            >
              Game Boy
            </button>
          </div>
        </div>

        {/* Selected Color Adjuster & Hardware Registers (Right 5 cols) */}
        <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-3">
            {/* Color Swatch Preview & Colorpicker input */}
            <div className="relative group w-14 h-14 rounded-lg border border-neutral-700 overflow-hidden shadow-inner shrink-0">
              <div
                className="w-full h-full"
                style={{ backgroundColor: hexColor }}
              />
              <input
                type="color"
                value={hexColor}
                onChange={handleNativeColorPick}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Click to open color picker"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-200">
                  Index #{selectedIndex}
                </span>
                <span className="font-mono-code text-neutral-500">
                  0x{selectedIndex.toString(16).toUpperCase().padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 font-mono-code text-xs">
                <span className="text-neutral-400">HEX:</span>
                <input
                  type="text"
                  value={hexColor}
                  onChange={handleHexChange}
                  maxLength={7}
                  className="w-20 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-amber-300 font-bold focus:outline-none"
                />
              </div>
              <div className="text-[10px] text-neutral-500 font-mono-code mt-0.5">
                SNES 15-Bit BGR555: <span className="text-cyan-400">{snesHex}</span>
              </div>
            </div>
          </div>

          {/* 8-Bit RGB Channels (0..255) */}
          <div className="space-y-2.5 pt-2 border-t border-neutral-800 text-xs">
            <span className="font-semibold text-neutral-300 block text-[11px] uppercase tracking-wider">
              8-Bit Color Channels (0–255)
            </span>

            {/* Red */}
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span className="text-red-400 font-medium">Red (R)</span>
                <span className="font-mono-code text-neutral-200">{r} (6-bit: {r6})</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={r}
                onChange={(e) => updateColorAtIndex(selectedIndex, parseInt(e.target.value), g, b)}
                className="w-full accent-red-500"
              />
            </div>

            {/* Green */}
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span className="text-emerald-400 font-medium">Green (G)</span>
                <span className="font-mono-code text-neutral-200">{g} (6-bit: {g6})</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={g}
                onChange={(e) => updateColorAtIndex(selectedIndex, r, parseInt(e.target.value), b)}
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Blue */}
            <div className="space-y-1">
              <div className="flex justify-between text-neutral-400">
                <span className="text-blue-400 font-medium">Blue (B)</span>
                <span className="font-mono-code text-neutral-200">{b} (6-bit: {b6})</span>
              </div>
              <input
                type="range"
                min="0"
                max="255"
                value={b}
                onChange={(e) => updateColorAtIndex(selectedIndex, r, g, parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          </div>

          {/* VGA Hardware DAC Port Info */}
          <div className="p-2.5 bg-neutral-900 rounded border border-neutral-800 space-y-1 text-[11px] font-mono-code">
            <div className="text-neutral-400 font-semibold flex items-center justify-between">
              <span>VGA 6-Bit DAC Register</span>
              <span className="text-emerald-400">Port 0x03C9</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>DAC R/G/B Triplet:</span>
              <span className="text-neutral-200 font-bold">[{r6}, {g6}, {b6}]</span>
            </div>
          </div>

          {/* Quick Operations */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 text-xs">
            <button
              type="button"
              onClick={invertPalette}
              className="py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 text-center transition-colors"
            >
              Invert Colors
            </button>
            <button
              type="button"
              onClick={convertToGrayscale}
              className="py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 text-center transition-colors"
            >
              Grayscale All
            </button>
            <button
              type="button"
              onClick={() => adjustBrightness(1.15)}
              className="py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 text-center transition-colors flex items-center justify-center gap-1"
            >
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Brighten</span>
            </button>
            <button
              type="button"
              onClick={() => adjustBrightness(0.85)}
              className="py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 text-center transition-colors flex items-center justify-center gap-1"
            >
              <Moon className="w-3 h-3 text-indigo-400" />
              <span>Darken</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
