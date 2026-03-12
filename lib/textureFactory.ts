import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from "three";

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

  // Decorative wave line
  ctx.strokeStyle = `${textColor}33`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < width; x += 2) {
    ctx.lineTo(x, height * 0.2 + Math.sin(x * 0.04) * 3);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let x = 0; x < width; x += 2) {
    ctx.lineTo(x, height * 0.8 + Math.sin(x * 0.04 + 1) * 3);
  }
  ctx.stroke();

  // Repeating text with dot separators
  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.floor(height * 0.38)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const segment = `  ${text.toUpperCase()}  ·  `;
  const segmentWidth = ctx.measureText(segment).width;
  const count = Math.ceil(width / segmentWidth) + 1;

  for (let i = 0; i < count; i++) {
    ctx.fillText(segment, segmentWidth * i, height / 2);
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

  // Subtle decorative floral elements (circles and dots)
  ctx.fillStyle = `${textColor}11`;
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 8 + Math.random() * 24;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small decorative dots
  ctx.fillStyle = `${textColor}18`;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.beginPath();
    ctx.arc(x, y, 2 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main text - large, centered, broken into lines
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const words = text.toUpperCase().split(" ");
  const lineHeight = Math.floor(height * 0.1);
  const fontSize = Math.floor(height * 0.085);
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

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
  const startY = height / 2 - totalTextHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineHeight);
  }

  // Bottom decorative line
  ctx.strokeStyle = `${textColor}44`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, height * 0.85);
  ctx.lineTo(width * 0.85, height * 0.85);
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Create a header/topper texture with holiday branding.
 */
export function createHeaderTexture(
  text: string,
  bgColor: string = "#114a7d",
  textColor: string = "#ebd29a",
  width: number = 512,
  height: number = 128,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = `${textColor}55`;
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  // Text
  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.floor(height * 0.35)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), width / 2, height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}
