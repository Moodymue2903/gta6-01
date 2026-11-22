// VERMILION KEYS — building facades (Fix Round 5, brightness pass).
// Procedural CanvasTexture facades replace the flat window-grid boxes:
// bleached limestone with arched openings, terracotta with shutters,
// and a neon ground-floor awning band. The textures are painted once
// and shared by the instanced building meshes in city.js.

import { canvasTexture } from '../util.js';

// Limestone: pale bleached-coral base, arched windows with warm lit
// panes, a terracotta string course between floors.
export function limestoneFacade() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f2e6d8';
    ctx.fillRect(0, 0, w, h);
    // Subtle stone courses.
    ctx.strokeStyle = 'rgba(180,150,120,0.35)';
    ctx.lineWidth = 1;
    for (let y = 32; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Arched windows: dark arch, warm glass, terracotta sill.
    for (let y = 14; y < h - 18; y += 42) {
      for (let x = 12; x < w - 12; x += 30) {
        ctx.fillStyle = '#33272e';
        ctx.beginPath();
        ctx.moveTo(x, y + 22);
        ctx.lineTo(x, y + 8);
        ctx.arc(x + 7, y + 8, 7, Math.PI, 0);
        ctx.lineTo(x + 14, y + 22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = Math.random() < 0.45 ? '#ffd9a0' : '#4a5a6a';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 22);
        ctx.lineTo(x + 2, y + 9);
        ctx.arc(x + 7, y + 9, 5, Math.PI, 0);
        ctx.lineTo(x + 12, y + 22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d96b43';
        ctx.fillRect(x - 1, y + 22, 16, 3);
      }
    }
    // Terracotta string course at the top.
    ctx.fillStyle = '#d96b43';
    ctx.fillRect(0, 0, w, 6);
  });
}

// Terracotta: warm ochre base, shuttered windows in pairs, ironwork
// balcony rails as dark bands.
export function terracottaFacade() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e89f65';
    ctx.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 16; y += 40) {
      for (let x = 10; x < w - 10; x += 28) {
        // Shutters, left and right of a dark glass slit.
        ctx.fillStyle = '#b85a30';
        ctx.fillRect(x, y, 6, 20);
        ctx.fillRect(x + 16, y, 6, 20);
        ctx.fillStyle = '#2a3542';
        ctx.fillRect(x + 6, y + 2, 10, 16);
        ctx.fillStyle = Math.random() < 0.4 ? '#ffe0b0' : '#3a4a5a';
        ctx.fillRect(x + 7, y + 3, 8, 14);
        // Balcony rail under each window.
        ctx.fillStyle = '#2a2a34';
        ctx.fillRect(x - 2, y + 22, 26, 2);
      }
    }
    // Limestone base course.
    ctx.fillStyle = '#f2e6d8';
    ctx.fillRect(0, h - 10, w, 10);
  });
}

// Neon awning band for ground floors: alternating awning stripes with
// a warm sign strip above them.
export function neonAwningTexture(accent = '#ff3366') {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f2e6d8';
    ctx.fillRect(0, 0, w, 16);
    ctx.fillStyle = '#3a2a3a';
    for (let x = 8; x < w - 8; x += 14) ctx.fillRect(x, 5, 8, 6);
    ctx.fillStyle = '#2a3a44';
    ctx.fillRect(0, 16, w, 32);
    for (let x = 8; x < w - 14; x += 26) {
      ctx.fillStyle = Math.random() < 0.6 ? '#ffd9a0' : '#4a6a7a';
      ctx.fillRect(x, 22, 16, 20);
    }
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? '#e8e8e8' : accent;
      ctx.fillRect(x, 48, 16, 16);
    }
  });
}
