/**
 * MS-DOS VGA Mode 13h Framebuffer & SNES PPU-to-DOS Rasterizer
 * 320x200 resolution, 8-bit chunky linear frame buffer (64,000 bytes at 0xA000:0000).
 */

import { VgaConfig } from '../types/dos';
import { SNESRomData } from '../types/rom';
import { generateVga256Palette, generateArcadePalette } from './snesParser';

export interface GameState {
  // Racer state
  carX: number;
  speed: number;
  roadCurve: number;
  distance: number;
  lap: number;

  // Platformer state
  playerX: number;
  playerY: number;
  velY: number;
  isGrounded: boolean;
  score: number;
  coins: number;

  // Shmup state
  shipX: number;
  shipY: number;
  lasers: Array<{ x: number; y: number }>;
  enemies: Array<{ x: number; y: number; hp: number; vx: number }>;
  particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: number }>;
}

export class VgaMode13hRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private frameBuffer: Uint8Array; // 64,000 bytes (320 * 200)
  private palette: Array<[number, number, number]>; // 256 colors
  private vgaConfig: VgaConfig;
  private snesRom: SNESRomData;

  public gameState: GameState = {
    carX: 0,
    speed: 0,
    roadCurve: 0,
    distance: 0,
    lap: 1,

    playerX: 40,
    playerY: 140,
    velY: 0,
    isGrounded: true,
    score: 0,
    coins: 0,

    shipX: 160,
    shipY: 160,
    lasers: [],
    enemies: [],
    particles: [],
  };

  private frameCount: number = 0;
  private stars: Array<{ x: number; y: number; speed: number; color: number }> = [];

  constructor(
    canvas: HTMLCanvasElement,
    snesRom: SNESRomData,
    vgaConfig: VgaConfig
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;

    this.frameBuffer = new Uint8Array(320 * 200);
    this.imgData = this.ctx.createImageData(320, 200);
    this.snesRom = snesRom;
    this.vgaConfig = vgaConfig;

    if (vgaConfig.paletteMode === 'standard_vga') {
      this.palette = generateVga256Palette();
    } else if (vgaConfig.paletteMode === 'retro_arcade') {
      this.palette = generateArcadePalette();
    } else {
      this.palette = snesRom.extractedPalette && snesRom.extractedPalette.length === 256
        ? snesRom.extractedPalette
        : generateVga256Palette();
    }

    // Initialize stars for shmup
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.floor(Math.random() * 320),
        y: Math.floor(Math.random() * 200),
        speed: 1 + Math.random() * 3,
        color: Math.floor(Math.random() * 4) + 16,
      });
    }
  }

  public updatePalette(newPalette: Array<[number, number, number]>) {
    this.palette = newPalette;
  }

  public setPixel(x: number, y: number, colorIndex: number) {
    if (x >= 0 && x < 320 && y >= 0 && y < 200) {
      this.frameBuffer[y * 320 + x] = colorIndex & 0xFF;
    }
  }

  public clear(colorIndex: number = 0) {
    this.frameBuffer.fill(colorIndex & 0xFF);
  }

  /**
   * Blits 64,000 bytes frameBuffer to the HTML5 canvas using DAC palette
   */
  public flush() {
    const data = this.imgData.data;
    const buf = this.frameBuffer;
    const pal = this.palette;

    let pIdx = 0;
    for (let i = 0; i < 64000; i++) {
      const colIdx = buf[i];
      const rgb = pal[colIdx] || [0, 0, 0];
      data[pIdx] = rgb[0];
      data[pIdx + 1] = rgb[1];
      data[pIdx + 2] = rgb[2];
      data[pIdx + 3] = 255;
      pIdx += 4;
    }

    this.ctx.putImageData(this.imgData, 0, 0);
  }

  /**
   * Main game render tick based on the selected demo or payload
   */
  public renderTick(keys: Record<string, boolean>): { event?: 'jump' | 'coin' | 'laser' | 'explosion' | 'engine' } {
    this.frameCount++;
    let soundEvent: 'jump' | 'coin' | 'laser' | 'explosion' | 'engine' | undefined;

    const demo = this.snesRom.demoType || 'racer';

    if (demo === 'racer') {
      soundEvent = this.renderMode7Racer(keys);
    } else if (demo === 'platformer') {
      soundEvent = this.renderPlatformer(keys);
    } else {
      soundEvent = this.renderShmup(keys);
    }

    this.flush();
    return { event: soundEvent };
  }

  /**
   * Mode 7 Style Pseudo-3D Road Racer (Chrono Racer 320)
   */
  private renderMode7Racer(keys: Record<string, boolean>): 'engine' | undefined {
    let sound: 'engine' | undefined;

    // Handle Input
    if (keys['ArrowUp'] || keys['KeyW']) {
      this.gameState.speed = Math.min(180, this.gameState.speed + 1.8);
      if (this.frameCount % 18 === 0) sound = 'engine';
    } else if (keys['ArrowDown'] || keys['KeyS']) {
      this.gameState.speed = Math.max(0, this.gameState.speed - 3.0);
    } else {
      this.gameState.speed = Math.max(0, this.gameState.speed - 0.8);
    }

    if (keys['ArrowLeft'] || keys['KeyA']) {
      this.gameState.carX = Math.max(-140, this.gameState.carX - 2.5);
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      this.gameState.carX = Math.min(140, this.gameState.carX + 2.5);
    }

    this.gameState.distance += this.gameState.speed;
    this.gameState.roadCurve = Math.sin(this.gameState.distance * 0.002) * 40;

    // Draw Sky (Horizon at y=100)
    for (let y = 0; y < 100; y++) {
      const skyCol = 1 + Math.floor((y / 100) * 8); // Blue palette ramp
      for (let x = 0; x < 320; x++) {
        this.setPixel(x, y, skyCol);
      }
    }

    // Mountain silhouettes in background
    for (let x = 0; x < 320; x++) {
      const mountainH = Math.floor(25 * Math.sin((x + this.gameState.distance * 0.02) * 0.03) + 15 * Math.cos(x * 0.07));
      for (let y = 100 - mountainH; y < 100; y++) {
        this.setPixel(x, y, 8); // Dark gray
      }
    }

    // Draw Road & Ground (Mode 7 scanning from y=100 to y=199)
    for (let y = 100; y < 200; y++) {
      const z = (y - 99); // Distance factor (1..100)
      const roadWidth = Math.floor((z / 100) * 220 + 20);
      const curveOffset = Math.floor(Math.sin((this.gameState.distance * 0.01 + z * 0.05)) * (z * 0.4));
      const centerX = 160 + curveOffset - Math.floor(this.gameState.carX * (z / 100));

      const roadLeft = centerX - roadWidth / 2;
      const roadRight = centerX + roadWidth / 2;

      // Striping pattern
      const isAltStrip = Math.floor((this.gameState.distance * 0.1 + z * 0.8)) % 2 === 0;
      const grassColor = isAltStrip ? 2 : 10; // Dark green vs bright green
      const curbColor = isAltStrip ? 12 : 15; // Red vs White
      const roadColor = isAltStrip ? 8 : 7;   // Asphalt shades

      for (let x = 0; x < 320; x++) {
        if (x < roadLeft - 8 || x > roadRight + 8) {
          this.setPixel(x, y, grassColor);
        } else if (x < roadLeft || x > roadRight) {
          this.setPixel(x, y, curbColor); // Curb
        } else {
          // Center dashed line
          if (Math.abs(x - centerX) < 2 && isAltStrip) {
            this.setPixel(x, y, 14); // Yellow line
          } else {
            this.setPixel(x, y, roadColor);
          }
        }
      }
    }

    // Draw Player Car Sprite at (160, 165)
    const carBaseX = 160 - 16;
    const carBaseY = 165;
    this.drawCarSprite(carBaseX, carBaseY);

    // Draw HUD: Speedometer & Lap
    this.drawText(`SPEED: ${Math.floor(this.gameState.speed)} KM/H`, 8, 8, 14);
    this.drawText(`DIST: ${Math.floor(this.gameState.distance / 100)}M`, 8, 18, 11);
    this.drawText(`MODE 13h - 320x200 8-BIT`, 150, 8, 15);

    return sound;
  }

  /**
   * 8-Bit Platformer Engine (Super DOS Mario Tech)
   */
  private renderPlatformer(keys: Record<string, boolean>): 'jump' | 'coin' | undefined {
    let sound: 'jump' | 'coin' | undefined;

    // Horizontal Movement
    if (keys['ArrowLeft'] || keys['KeyA']) {
      this.gameState.playerX = Math.max(10, this.gameState.playerX - 2.5);
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      this.gameState.playerX = Math.min(300, this.gameState.playerX + 2.5);
    }

    // Jumping physics
    if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && this.gameState.isGrounded) {
      this.gameState.velY = -7.5;
      this.gameState.isGrounded = false;
      sound = 'jump';
    }

    // Gravity
    this.gameState.velY += 0.4;
    this.gameState.playerY += this.gameState.velY;

    // Floor collision
    if (this.gameState.playerY >= 148) {
      this.gameState.playerY = 148;
      this.gameState.velY = 0;
      this.gameState.isGrounded = true;
    }

    // Clear sky background
    for (let y = 0; y < 200; y++) {
      const col = y < 160 ? 3 : 6; // Cyan sky, Brown underground
      for (let x = 0; x < 320; x++) {
        this.setPixel(x, y, col);
      }
    }

    // Clouds
    this.drawCloud(40, 30);
    this.drawCloud(190, 45);

    // Floating Brick Blocks & Question Mark Blocks
    this.drawBlock(80, 110, 'brick');
    this.drawBlock(96, 110, 'question');
    this.drawBlock(112, 110, 'brick');
    this.drawBlock(128, 110, 'question');
    this.drawBlock(144, 110, 'brick');

    // Pipe at x=230
    this.drawPipe(230, 128);

    // Ground grass line
    for (let x = 0; x < 320; x++) {
      this.setPixel(x, 160, 10); // Bright green grass top
      this.setPixel(x, 161, 2);
    }

    // Check hit question block
    if (
      this.gameState.playerY <= 126 &&
      this.gameState.playerY >= 110 &&
      this.gameState.velY < 0 &&
      ((this.gameState.playerX >= 90 && this.gameState.playerX <= 104) ||
       (this.gameState.playerX >= 122 && this.gameState.playerX <= 136))
    ) {
      this.gameState.coins++;
      this.gameState.score += 100;
      this.gameState.velY = 1; // Bounce down
      sound = 'coin';
    }

    // Draw Player Sprite (Mario style)
    this.drawPlayerSprite(Math.floor(this.gameState.playerX), Math.floor(this.gameState.playerY));

    // HUD
    this.drawText(`MARIO`, 16, 8, 15);
    this.drawText(`SCORE: ${this.gameState.score}`, 16, 18, 14);
    this.drawText(`COINS: x${this.gameState.coins}`, 120, 18, 14);
    this.drawText(`WORLD 1-1`, 220, 18, 15);

    return sound;
  }

  /**
   * Vertical/Horizontal Space Shmup (Space Horizon 1993)
   */
  private renderShmup(keys: Record<string, boolean>): 'laser' | 'explosion' | undefined {
    let sound: 'laser' | 'explosion' | undefined;

    // Movement
    if (keys['ArrowLeft'] || keys['KeyA']) this.gameState.shipX = Math.max(16, this.gameState.shipX - 3);
    if (keys['ArrowRight'] || keys['KeyD']) this.gameState.shipX = Math.min(304, this.gameState.shipX + 3);
    if (keys['ArrowUp'] || keys['KeyW']) this.gameState.shipY = Math.max(20, this.gameState.shipY - 3);
    if (keys['ArrowDown'] || keys['KeyS']) this.gameState.shipY = Math.min(180, this.gameState.shipY + 3);

    // Fire Laser
    if (keys['Space'] && this.frameCount % 8 === 0) {
      this.gameState.lasers.push({ x: this.gameState.shipX, y: this.gameState.shipY - 10 });
      sound = 'laser';
    }

    // Spawn enemies
    if (this.frameCount % 45 === 0 && this.gameState.enemies.length < 6) {
      this.gameState.enemies.push({
        x: Math.floor(Math.random() * 260) + 30,
        y: -10,
        hp: 2,
        vx: (Math.random() - 0.5) * 2,
      });
    }

    // Clear Space (Black)
    this.clear(0);

    // Parallax Starfield
    for (const star of this.stars) {
      star.y += star.speed;
      if (star.y >= 200) {
        star.y = 0;
        star.x = Math.floor(Math.random() * 320);
      }
      this.setPixel(Math.floor(star.x), Math.floor(star.y), star.color);
    }

    // Update & Draw Lasers
    for (let i = this.gameState.lasers.length - 1; i >= 0; i--) {
      const l = this.gameState.lasers[i];
      l.y -= 6;
      if (l.y < 0) {
        this.gameState.lasers.splice(i, 1);
        continue;
      }
      // Draw Laser beam
      this.setPixel(l.x, l.y, 11);
      this.setPixel(l.x, l.y + 1, 15);
      this.setPixel(l.x, l.y + 2, 11);
    }

    // Update & Draw Enemies
    for (let i = this.gameState.enemies.length - 1; i >= 0; i--) {
      const e = this.gameState.enemies[i];
      e.y += 1.6;
      e.x += e.vx;
      if (e.x < 20 || e.x > 300) e.vx = -e.vx;

      // Check collision with lasers
      for (let j = this.gameState.lasers.length - 1; j >= 0; j--) {
        const l = this.gameState.lasers[j];
        if (Math.abs(l.x - e.x) < 10 && Math.abs(l.y - e.y) < 10) {
          e.hp--;
          this.gameState.lasers.splice(j, 1);
          if (e.hp <= 0) {
            // Spawn explosion particles
            for (let p = 0; p < 16; p++) {
              this.gameState.particles.push({
                x: e.x,
                y: e.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 15,
                color: Math.random() > 0.5 ? 12 : 14,
              });
            }
            this.gameState.enemies.splice(i, 1);
            this.gameState.score += 250;
            sound = 'explosion';
            break;
          }
        }
      }

      if (e.y > 210) {
        this.gameState.enemies.splice(i, 1);
        continue;
      }

      // Draw Enemy Spacecraft
      this.drawEnemyShip(Math.floor(e.x), Math.floor(e.y));
    }

    // Update Particles
    for (let i = this.gameState.particles.length - 1; i >= 0; i--) {
      const p = this.gameState.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.gameState.particles.splice(i, 1);
        continue;
      }
      this.setPixel(Math.floor(p.x), Math.floor(p.y), p.color);
    }

    // Draw Player Fighter Ship
    this.drawFighterShip(Math.floor(this.gameState.shipX), Math.floor(this.gameState.shipY));

    // HUD
    this.drawText(`SCORE: ${this.gameState.score}`, 8, 8, 14);
    this.drawText(`SB16 DSP DMA CH1`, 200, 8, 11);
    this.drawText(`SHIPS: 3`, 8, 18, 15);

    return sound;
  }

  // --- SPRITE DRAWING HELPERS ---

  private drawCarSprite(cx: number, cy: number) {
    // 32x16 sports car sprite
    const bodyColor = 12; // Red
    const windowColor = 11; // Cyan glass
    const tireColor = 0; // Black
    const lightColor = 14; // Yellow

    for (let dy = 0; dy < 14; dy++) {
      for (let dx = 0; dx < 32; dx++) {
        // Simple sports car silhouette
        if (dy >= 6 && dy <= 12 && dx >= 2 && dx <= 29) {
          this.setPixel(cx + dx, cy + dy, bodyColor);
        } else if (dy >= 2 && dy <= 5 && dx >= 8 && dx <= 23) {
          this.setPixel(cx + dx, cy + dy, windowColor);
        } else if (dy >= 10 && dy <= 13 && (dx <= 4 || dx >= 27)) {
          this.setPixel(cx + dx, cy + dy, tireColor); // Wheels
        } else if (dy === 7 && (dx === 3 || dx === 28)) {
          this.setPixel(cx + dx, cy + dy, lightColor); // Tail lights
        }
      }
    }
  }

  private drawPlayerSprite(px: number, py: number) {
    // 16x16 8-bit platformer hero
    const red = 12;
    const blue = 1;
    const skin = 6;
    const yellow = 14;

    // Hat (red)
    for (let x = 3; x <= 10; x++) this.setPixel(px + x, py + 1, red);
    for (let x = 2; x <= 12; x++) this.setPixel(px + x, py + 2, red);

    // Face / Mustache
    for (let x = 3; x <= 9; x++) this.setPixel(px + x, py + 3, skin);
    this.setPixel(px + 10, py + 3, 0); // Eye
    for (let x = 6; x <= 11; x++) this.setPixel(px + x, py + 4, 0); // Mustache

    // Shirt & Overalls
    for (let y = 6; y <= 9; y++) {
      for (let x = 3; x <= 12; x++) {
        this.setPixel(px + x, py + y, red);
      }
    }
    // Overalls straps
    for (let y = 8; y <= 13; y++) {
      for (let x = 4; x <= 11; x++) {
        this.setPixel(px + x, py + y, blue);
      }
    }
    this.setPixel(px + 5, py + 9, yellow); // Button
    this.setPixel(px + 10, py + 9, yellow);

    // Shoes
    for (let x = 2; x <= 5; x++) this.setPixel(px + x, py + 14, 6);
    for (let x = 10; x <= 13; x++) this.setPixel(px + x, py + 14, 6);
  }

  private drawBlock(bx: number, by: number, type: 'brick' | 'question') {
    const mainCol = type === 'brick' ? 6 : 14;
    const borderCol = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) {
          this.setPixel(bx + x, by + y, borderCol);
        } else {
          this.setPixel(bx + x, by + y, mainCol);
        }
      }
    }
    if (type === 'question') {
      // Draw '?' in white
      this.setPixel(bx + 7, by + 4, 15);
      this.setPixel(bx + 8, by + 4, 15);
      this.setPixel(bx + 9, by + 5, 15);
      this.setPixel(bx + 8, by + 7, 15);
      this.setPixel(bx + 8, by + 10, 15);
    }
  }

  private drawPipe(px: number, py: number) {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 24; x++) {
        const col = x === 0 || x === 23 ? 0 : x < 6 ? 10 : 2;
        this.setPixel(px + x, py + y, col);
      }
    }
  }

  private drawCloud(cx: number, cy: number) {
    for (let dy = 0; dy < 10; dy++) {
      for (let dx = 0; dx < 24; dx++) {
        if (dy > 3 || (dx > 4 && dx < 20)) {
          this.setPixel(cx + dx, cy + dy, 15); // White
        }
      }
    }
  }

  private drawFighterShip(sx: number, sy: number) {
    // Arrow spacecraft
    for (let dy = -8; dy <= 8; dy++) {
      const span = Math.floor(Math.abs(dy));
      for (let dx = -8 + span; dx <= 8 - span; dx++) {
        this.setPixel(sx + dx, sy + dy, dy === 0 ? 11 : 7);
      }
    }
    // Jet flame
    if (this.frameCount % 2 === 0) {
      this.setPixel(sx - 1, sy + 9, 14);
      this.setPixel(sx, sy + 10, 12);
      this.setPixel(sx + 1, sy + 9, 14);
    }
  }

  private drawEnemyShip(ex: number, ey: number) {
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        if (Math.abs(dx) + Math.abs(dy) < 10) {
          this.setPixel(ex + dx, ey + dy, 13); // Magenta alien
        }
      }
    }
  }

  /**
   * Minimal 5x7 DOS Bitmap Font Rasterizer
   */
  private drawText(str: string, x: number, y: number, colorIndex: number) {
    const chars = str.toUpperCase();
    let cx = x;
    for (let i = 0; i < chars.length; i++) {
      const code = chars.charCodeAt(i);
      this.drawChar(code, cx, y, colorIndex);
      cx += 6;
    }
  }

  private drawChar(code: number, cx: number, cy: number, colorIndex: number) {
    // Simple 5x7 glyph table for essential characters
    const GLYPHS: Record<number, number[]> = {
      48: [0x70, 0x88, 0x98, 0xA8, 0xC8, 0x88, 0x70], // 0
      49: [0x20, 0x60, 0x20, 0x20, 0x20, 0x20, 0x70], // 1
      50: [0x70, 0x88, 0x08, 0x30, 0x40, 0x80, 0xF8], // 2
      51: [0xF8, 0x08, 0x10, 0x30, 0x08, 0x88, 0x70], // 3
      52: [0x10, 0x30, 0x50, 0x90, 0xF8, 0x10, 0x10], // 4
      53: [0xF8, 0x80, 0xF0, 0x08, 0x08, 0x88, 0x70], // 5
      54: [0x30, 0x40, 0x80, 0xF0, 0x88, 0x88, 0x70], // 6
      55: [0xF8, 0x08, 0x10, 0x20, 0x40, 0x40, 0x40], // 7
      56: [0x70, 0x88, 0x88, 0x70, 0x88, 0x88, 0x70], // 8
      57: [0x70, 0x88, 0x88, 0x78, 0x08, 0x10, 0x60], // 9
      58: [0x00, 0x20, 0x20, 0x00, 0x20, 0x20, 0x00], // :
      45: [0x00, 0x00, 0x00, 0xF8, 0x00, 0x00, 0x00], // -
      65: [0x70, 0x88, 0x88, 0xF8, 0x88, 0x88, 0x88], // A
      66: [0xF0, 0x88, 0x88, 0xF0, 0x88, 0x88, 0xF0], // B
      67: [0x70, 0x88, 0x80, 0x80, 0x80, 0x88, 0x70], // C
      68: [0xF0, 0x88, 0x88, 0x88, 0x88, 0x88, 0xF0], // D
      69: [0xF8, 0x80, 0x80, 0xF0, 0x80, 0x80, 0xF8], // E
      70: [0xF8, 0x80, 0x80, 0xF0, 0x80, 0x80, 0x80], // F
      71: [0x70, 0x88, 0x80, 0xB8, 0x88, 0x88, 0x70], // G
      72: [0x88, 0x88, 0x88, 0xF8, 0x88, 0x88, 0x88], // H
      73: [0x70, 0x20, 0x20, 0x20, 0x20, 0x20, 0x70], // I
      75: [0x88, 0x90, 0xA0, 0xC0, 0xA0, 0x90, 0x88], // K
      76: [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0xF8], // L
      77: [0x88, 0xD8, 0xA8, 0x88, 0x88, 0x88, 0x88], // M
      78: [0x88, 0xC8, 0xA8, 0x98, 0x88, 0x88, 0x88], // N
      79: [0x70, 0x88, 0x88, 0x88, 0x88, 0x88, 0x70], // O
      80: [0xF0, 0x88, 0x88, 0xF0, 0x80, 0x80, 0x80], // P
      82: [0xF0, 0x88, 0x88, 0xF0, 0xA0, 0x90, 0x88], // R
      83: [0x70, 0x88, 0x80, 0x70, 0x08, 0x88, 0x70], // S
      84: [0xF8, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20], // T
      85: [0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x70], // U
      86: [0x88, 0x88, 0x88, 0x88, 0x50, 0x50, 0x20], // V
      87: [0x88, 0x88, 0x88, 0xA8, 0xA8, 0xD8, 0x88], // W
      88: [0x88, 0x88, 0x50, 0x20, 0x50, 0x88, 0x88], // X
      89: [0x88, 0x88, 0x50, 0x20, 0x20, 0x20, 0x20], // Y
    };

    const glyph = GLYPHS[code];
    if (!glyph) return;

    for (let r = 0; r < 7; r++) {
      const rowByte = glyph[r];
      for (let c = 0; c < 5; c++) {
        if ((rowByte & (0x80 >> c)) !== 0) {
          this.setPixel(cx + c, cy + r, colorIndex);
        }
      }
    }
  }
}
