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

export async function buildCenteredLabelMask(width = 1024, height = 1024): Promise<Buffer> {
	const rectWidth = Math.floor(width * 0.5);
	const rectHeight = Math.floor(height * 0.18);
	const x = Math.floor((width - rectWidth) / 2);
	const y = Math.floor(height * 0.62);
	const rx = Math.floor(Math.min(rectWidth, rectHeight) * 0.2);

	// OpenAI expects: black areas = preserve, white/transparent areas = edit
	const svg = `<?xml version="1.0" encoding="UTF-8"?>
	<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
		<rect x="0" y="0" width="${width}" height="${height}" fill="black"/>
		<rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="${rx}" ry="${rx}" fill="white"/>
	</svg>`;

	// Convert SVG to PNG bitmap
	const pngBuffer = await sharp(Buffer.from(svg))
		.png()
		.toBuffer();
	
	return pngBuffer;
}

export async function compositeLogoOnProduct(params: {
	productImage: Buffer;
	logoImage: Buffer;
	brand: string;
}): Promise<Buffer> {
	console.log(`[Images] Compositing ${params.brand} logo onto product image`);
	
	// Get product image dimensions
	const productMeta = await sharp(params.productImage).metadata();
	const productWidth = productMeta.width || 1024;
	const productHeight = productMeta.height || 1024;
	
	// Calculate logo placement (centered horizontally, lower third vertically)
	const logoMaxWidth = Math.floor(productWidth * 0.4); // Logo max 40% of product width
	const logoMaxHeight = Math.floor(productHeight * 0.15); // Logo max 15% of product height
	
	// Resize logo to fit within constraints while maintaining aspect ratio
	const resizedLogo = await sharp(params.logoImage)
		.resize(logoMaxWidth, logoMaxHeight, { 
			fit: 'inside',
			withoutEnlargement: true,
			background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
		})
		.png()
		.toBuffer();
	
	// Get resized logo dimensions
	const logoMeta = await sharp(resizedLogo).metadata();
	const logoWidth = logoMeta.width || 0;
	const logoHeight = logoMeta.height || 0;
	
	// Calculate position (centered horizontally, positioned at 62% down vertically)
	const logoX = Math.floor((productWidth - logoWidth) / 2);
	const logoY = Math.floor(productHeight * 0.62);
	
	console.log(`[Images] Logo placement: ${logoWidth}x${logoHeight} at (${logoX}, ${logoY})`);
	
	// Composite logo onto product image
	const composited = await sharp(params.productImage)
		.composite([{
			input: resizedLogo,
			left: logoX,
			top: logoY,
			blend: 'over' // Proper alpha blending
		}])
		.png()
		.toBuffer();
	
	return composited;
} 