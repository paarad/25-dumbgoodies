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
	
	// Calculate logo size - smaller and more proportional
	const logoMaxWidth = Math.floor(productWidth * 0.25); // Logo max 25% of product width (reduced from 40%)
	const logoMaxHeight = Math.floor(productHeight * 0.1); // Logo max 10% of product height (reduced from 15%)
	
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
	
	// Try multiple positioning strategies to find the best placement
	const positions = [
		// Center of image (most likely object location)
		{ 
			x: Math.floor((productWidth - logoWidth) / 2), 
			y: Math.floor((productHeight - logoHeight) / 2),
			name: "center"
		},
		// Lower center (common for products)
		{ 
			x: Math.floor((productWidth - logoWidth) / 2), 
			y: Math.floor(productHeight * 0.7 - logoHeight / 2),
			name: "lower-center"
		},
		// Upper center
		{ 
			x: Math.floor((productWidth - logoWidth) / 2), 
			y: Math.floor(productHeight * 0.3 - logoHeight / 2),
			name: "upper-center"
		},
		// Right side center
		{ 
			x: Math.floor(productWidth * 0.7 - logoWidth / 2), 
			y: Math.floor((productHeight - logoHeight) / 2),
			name: "right-center"
		}
	];
	
	// For now, use the center position as it's most likely to be on the object
	// In the future, we could use computer vision to detect the object boundaries
	const bestPosition = positions[0]; // center position
	
	console.log(`[Images] Logo placement: ${logoWidth}x${logoHeight} at (${bestPosition.x}, ${bestPosition.y}) [${bestPosition.name}]`);
	
	// Composite logo onto product image with semi-transparent blending for better integration
	const composited = await sharp(params.productImage)
		.composite([{
			input: await sharp(resizedLogo)
				.modulate({ brightness: 0.9 }) // Slightly darken to look more integrated
				.png()
				.toBuffer(),
			left: bestPosition.x,
			top: bestPosition.y,
			blend: 'multiply' // Use multiply blend mode for more realistic integration
		}])
		.png()
		.toBuffer();
	
	return composited;
} 