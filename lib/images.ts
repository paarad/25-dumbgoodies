import sharp from "sharp";

export async function toPng(buffer: Buffer): Promise<Buffer> {
	return sharp(buffer).png().toBuffer();
}

export async function createThumbnail(buffer: Buffer, size = 512): Promise<Buffer> {
	return sharp(buffer).resize(size, size, { fit: "inside" }).png().toBuffer();
}

export async function bufferFromUrl(url: string): Promise<Buffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	const ab = await res.arrayBuffer();
	return Buffer.from(ab);
}

export function buildCenteredLabelMask(width = 1024, height = 1024): Buffer {
	const rectWidth = Math.floor(width * 0.5);
	const rectHeight = Math.floor(height * 0.18);
	const x = Math.floor((width - rectWidth) / 2);
	const y = Math.floor(height * 0.62);
	const rx = Math.floor(Math.min(rectWidth, rectHeight) * 0.2);

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
	<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
		<rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
		<rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="${rx}" ry="${rx}" fill="rgba(255,255,255,0)"/>
	</svg>`;
	return Buffer.from(svg);
} 