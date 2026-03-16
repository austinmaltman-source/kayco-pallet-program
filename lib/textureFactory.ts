import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from "three";

import type { Product } from "@/types/product";

// Cache for product label textures to prevent GPU memory leaks
const labelCache = new Map<string, CanvasTexture>();

/**
 * Create a product label texture for the front face of 3D product boxes.
 * Cached by product ID to avoid re-creating canvases.
 */
function drawLabelContent(ctx: CanvasRenderingContext2D, product: Product, size: number) {
  // Background fill with product color
  ctx.fillStyle = product.color;
  ctx.fillRect(0, 0, size, size);

  // Subtle gradient overlay for depth
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  // Product name (word-wrapped, white, bold)
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const name = product.name;
  const maxWidth = size - 40;
  const fontSize = 28;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  const words = name.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Limit to 3 lines
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].substring(0, lines[2].length - 3) + "...";
  }

  const lineH = fontSize + 4;
  const textBlockY = size / 2 - (lines.length * lineH) / 2 + lineH / 2 - 10;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], size / 2, textBlockY + i * lineH);
  }

  // SKU below name
  ctx.font = `${18}px Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(product.sku, size / 2, textBlockY + lines.length * lineH + 8);
}

function drawArtworkLabel(ctx: CanvasRenderingContext2D, img: HTMLImageElement, product: Product, size: number) {
  // Draw artwork image covering the full canvas
  ctx.drawImage(img, 0, 0, size, size);

  // Semi-transparent product color overlay at 15% opacity
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = product.color;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  // Thin white border
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, size - 16, size - 16);
}

export function getProductLabelTexture(product: Product): CanvasTexture {
  const cacheKey = `${product.id}-${product.color}-${product.artworkUrl || ""}`;
  const cached = labelCache.get(cacheKey);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;

  if (product.artworkUrl) {
    // Draw placeholder label immediately
    drawLabelContent(ctx, product, size);
    texture.needsUpdate = true;

    // Async load artwork image and update texture when ready
    const img = new Image();
    img.onload = () => {
      drawArtworkLabel(ctx, img, product, size);
      texture.needsUpdate = true;
    };
    img.src = product.artworkUrl;
  } else {
    drawLabelContent(ctx, product, size);
    texture.needsUpdate = true;
  }

  labelCache.set(cacheKey, texture);
  return texture;
}

/**
 * Create a canvas texture with repeating branded text on a colored strip.
 * Used for the shelf divider strips ("ALL YOUR HOLIDAY NEEDS").
 */
export function createStripTexture(
  text: string,
  bgColor: string,
  textColor: string = "#ffffff",
  width: number = 1024,
  height: number = 64,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const drawLeaf = (x: number, y: number, scale: number, rotation: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(5, -10, 10, -5);
    ctx.quadraticCurveTo(5, 5, 0, 0);
    ctx.fill();
    ctx.restore();
  };

  const drawStar = (x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(0, -size);
        ctx.translate(0, -size);
        ctx.rotate(Math.PI / 3);
        ctx.translate(0, size);
    }
    // simplified 6 pointed star approximation
    ctx.fill();
    ctx.restore();
  };

  // Repeating text with motifs
  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.floor(height * 0.42)}px 'Inter', Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const segment = ` ${text.toUpperCase()} `;
  const segmentWidth = ctx.measureText(segment).width;
  
  // Adding small motifs between the text
  const spacing = 40;
  const repetitionWidth = segmentWidth + spacing * 2;
  const count = Math.ceil(width / repetitionWidth) + 1;

  for (let i = 0; i < count; i++) {
    const cx = repetitionWidth * i;
    ctx.fillText(segment, cx, height / 2);
    
    // Draw decorative botanical motif between texts
    ctx.fillStyle = `${textColor}ee`;
    drawLeaf(cx + segmentWidth / 2 + spacing, height / 2 - 2, 0.8, -Math.PI / 4);
    drawLeaf(cx + segmentWidth / 2 + spacing + 8, height / 2 + 3, 0.7, Math.PI / 6);
    // little dot or star
    ctx.beginPath();
    ctx.arc(cx + segmentWidth / 2 + spacing + 18, height / 2 - 1, 2, 0, Math.PI*2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Create a branded side panel texture for half pallet mode.
 * Large centered text with decorative elements.
 */
export function createBrandedPanelTexture(
  text: string,
  bgColor: string,
  textColor: string = "#ffffff",
  width: number = 512,
  height: number = 768,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Decorative botanical art helpers
  const drawTrigo = (cx: number, cy: number, scale: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = textColor;
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1.5;
    
    // Stem
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.quadraticCurveTo(10, 0, 0, -50);
    ctx.stroke();

    const drawGrain = (x:number, y:number, r:number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r);
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // Whisper beard
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(5, -25);
      ctx.stroke();
      ctx.restore();
    }

    // Grains
    for(let i=0; i<6; i++) {
      const y = -30 + i*12;
      drawGrain(3, y, Math.PI/6);
      drawGrain(-3, y+6, -Math.PI/6);
    }
    
    ctx.restore();
  };

  const drawBotanicalBranch = (cx: number, cy: number, rot: number, scale: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-20, -40, 0, -100);
    ctx.stroke();

    ctx.fillStyle = textColor;
    const drawLeaf = (x:number, y:number, r:number) => {
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(r);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.quadraticCurveTo(8,-8, 15,0);
      ctx.quadraticCurveTo(8,8, 0,0);
      ctx.fill();
      ctx.restore();
    }

    for(let i=1; i<=4; i++) {
      drawLeaf(-5, -i*20, Math.PI + Math.PI/4);
      drawLeaf(5, -i*20 + 10, -Math.PI/4);
    }
    ctx.restore();
  }

  // Draw bottom botanicals
  drawTrigo(width * 0.25, height * 0.8, 1);
  drawTrigo(width * 0.75, height * 0.8, 1);
  drawBotanicalBranch(width * 0.15, height * 0.9, 0.2, 1.2);
  drawBotanicalBranch(width * 0.85, height * 0.9, -0.2, 1.2);
  drawBotanicalBranch(width * 0.5, height * 0.85, 0, 1.1);
  drawBotanicalBranch(width * 0.35, height * 0.88, -0.4, 0.9);
  drawBotanicalBranch(width * 0.65, height * 0.88, 0.4, 0.9);

  // Draw some floating botanicals
  drawBotanicalBranch(width * 0.1, height * 0.3, 1, 0.8);
  drawBotanicalBranch(width * 0.9, height * 0.3, -1, 0.8);

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const words = text.toUpperCase().split(" ");
  const lineHeight = Math.floor(height * 0.1);
  const fontSize = Math.floor(height * 0.085);
  ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;

  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > width * 0.8 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const totalTextHeight = lines.length * lineHeight;
  // Push text a little higher to leave room for the heavy bottom botanicals
  const startY = height * 0.45 - totalTextHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineHeight);
  }

  // Decorative floral stars scattered
  for(let i=0; i<8; i++) {
    ctx.save();
    ctx.translate(width * 0.1 + Math.random()*0.8*width, height * 0.1 + Math.random()*0.8*height);
    ctx.fillStyle = textColor;
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for(let j=0; j<4; j++){
      ctx.rotate(Math.PI/2);
      ctx.ellipse(0, 4, 1.5, 4, 0, 0, Math.PI*2);
    }
    ctx.fill();
    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Create a header/topper texture with holiday branding.
 * Optionally renders a subtitle line above the main text.
 */
export function createHeaderTexture(
  text: string,
  bgColor: string = "#00a3c7",
  textColor: string = "#ffffff",
  width: number = 800,
  height: number = 200,
  subtitle?: string,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // The Header topper incorporates both the cyan Happy Passover text and the top white logo bar

  // Fill Cyan Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Draw Top White Logo Bar Wrapper
  const logoBarHeight = height * 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, logoBarHeight);

  // Draw some faux logos in the white bar
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  const drawLogo = (text: string, x: number, y: number, color: string, style: string, spacing?: number, maxWScale: number = 0.8) => {
    ctx.fillStyle = color;
    let fontSize = Math.floor(logoBarHeight * 0.35);
    ctx.font = `${style} ${fontSize}px 'Inter', Arial, sans-serif`;
    
    // Auto-shrink text if it's too wide for its allotted cell
    const maxAllowedWidth = (width / 5) * maxWScale;
    let actualWidth = ctx.measureText(text).width;
    if (spacing) {
      actualWidth += (text.length - 1) * spacing;
    }
    
    if (actualWidth > maxAllowedWidth) {
      const scale = maxAllowedWidth / actualWidth;
      fontSize = Math.floor(fontSize * scale);
      ctx.font = `${style} ${fontSize}px 'Inter', Arial, sans-serif`;
    }

    if (spacing) {
      const chars = text.split('');
      const totalWidth = ctx.measureText(text).width + (chars.length - 1) * spacing;
      let startX = x - totalWidth / 2;
      
      ctx.textAlign = "left";
      for (const char of chars) {
        ctx.fillText(char, startX, y);
        startX += ctx.measureText(char).width + spacing;
      }
      ctx.textAlign = "center"; // reset
    } else {
      ctx.fillText(text, x, y);
    }
  };

  const logoY = logoBarHeight / 2 + 2;
  
  // Refined logo styling and positioning to prevent overlap 
  ctx.save();
  
  // KEDEM - serif, wide tracked
  ctx.font = `bold ${Math.floor(logoBarHeight * 0.30)}px 'Georgia', serif`;
  ctx.fillStyle = "#582f6f";
  const kedemText = "KEDEM";
  let curX = width * 0.1 - ctx.measureText(kedemText).width/2;
  ctx.textAlign = "left";
  for(let char of kedemText.split('')){
    ctx.fillText(char, curX, logoY);
    curX += ctx.measureText(char).width + 3; // custom tracking
  }
  ctx.textAlign = "center";
  
  // GEFEN - heavy italic, rounded look
  drawLogo("GEFEN", width * 0.30, logoY, "#0072bc", "900 italic");
  
  // BARTENURA - elegant serif or thin sans
  ctx.font = `normal ${Math.floor(logoBarHeight * 0.28)}px 'Georgia', serif`;
  ctx.fillStyle = "#5b92e5";
  ctx.fillText("BARTENURA", width * 0.50, logoY);
  
  // Primavera - script/italic lowercase looking
  ctx.font = `italic 600 ${Math.floor(logoBarHeight * 0.35)}px 'Georgia', serif`;
  ctx.fillStyle = "#f05a28";
  ctx.fillText("Primavera", width * 0.70, logoY);

  // MANISCHEWITZ - bold tightly packed
  drawLogo("MANISCHEWITZ", width * 0.90, logoY, "#e31837", "800", undefined, 0.95);

  ctx.restore();

  // Bottom Cyan area
  const cyanYCenter = logoBarHeight + (height - logoBarHeight) / 2;

  // Decorative touches in the cyan area
  ctx.strokeStyle = `${textColor}40`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.2, cyanYCenter - 15);
  ctx.quadraticCurveTo(width * 0.5, cyanYCenter - 30, width * 0.8, cyanYCenter - 15);
  ctx.stroke();

  // Scattered tiny flowers
  ctx.fillStyle = textColor;
  for(let i=0; i<6; i++) {
    const fx = width * 0.1 + Math.random() * width * 0.8;
    const fy = logoBarHeight + 20 + Math.random() * (height - logoBarHeight - 40);
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.textAlign = "center";

  if (subtitle) {
    // Subtitle - smaller
    const subtitleSize = Math.floor(height * 0.12);
    ctx.fillStyle = textColor;
    ctx.font = `${subtitleSize}px 'Georgia', serif`; // Removed italic to match reference better, or stay italic
    ctx.textBaseline = "middle";
    ctx.fillText(subtitle, width / 2, logoBarHeight + (height - logoBarHeight) * 0.35);

    // Main text - large, bold
    const mainSize = Math.floor(height * 0.30);
    ctx.fillStyle = textColor;
    ctx.font = `900 ${mainSize}px 'Arial Black', sans-serif`;
    ctx.fillText(text.toUpperCase(), width / 2, logoBarHeight + (height - logoBarHeight) * 0.72);
  } else {
    // Single line centered
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.floor(height * 0.35)}px 'Inter', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), width / 2, cyanYCenter);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}
