export async function toPng(buffer: Buffer): Promise<Buffer> {
	const sharp = (await import("sharp")).default;
	return sharp(buffer).png().toBuffer();
}

export async function createThumbnail(buffer: Buffer, size = 512): Promise<Buffer> {
	const sharp = (await import("sharp")).default;
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
	const pngBuffer = await (await import("sharp")).default(Buffer.from(svg))
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
	const productMeta = await (await import("sharp")).default(params.productImage).metadata();
	const productWidth = productMeta.width || 1024;
	const productHeight = productMeta.height || 1024;
	
	// Calculate logo size - much smaller for more realistic placement
	const logoMaxWidth = Math.floor(productWidth * 0.15); // Reduced to 15% 
	const logoMaxHeight = Math.floor(productHeight * 0.08); // Reduced to 8%
	
	// Resize logo to fit within constraints while maintaining aspect ratio
	const resizedLogo = await (await import("sharp")).default(params.logoImage)
		.resize(logoMaxWidth, logoMaxHeight, { 
			fit: 'inside',
			withoutEnlargement: true,
			background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
		})
		.png()
		.toBuffer();
	
	// Get resized logo dimensions
	const logoMeta = await (await import("sharp")).default(resizedLogo).metadata();
	const logoWidth = logoMeta.width || 0;
	const logoHeight = logoMeta.height || 0;
	
	// Multiple positioning strategies for better placement
	const positions = [
		// Lower center (common for product labels)
		{ 
			x: Math.floor((productWidth - logoWidth) / 2), 
			y: Math.floor(productHeight * 0.75 - logoHeight / 2),
			name: "lower-center"
		},
		// Right side center (good for bottles, cans)
		{ 
			x: Math.floor(productWidth * 0.7 - logoWidth / 2), 
			y: Math.floor((productHeight - logoHeight) / 2),
			name: "right-center"
		},
		// Center of image (most likely object location)
		{ 
			x: Math.floor((productWidth - logoWidth) / 2), 
			y: Math.floor((productHeight - logoHeight) / 2),
			name: "center"
		},
		// Upper center
		{ 
			x: Math.floor((productWidth - logoWidth) / 2), 
			y: Math.floor(productHeight * 0.25 - logoHeight / 2),
			name: "upper-center"
		},
	];

	// Use the lower-center position as it's most common for product labels
	const bestPosition = positions[0]; // lower-center position

	console.log(`[Images] Logo placement: ${logoWidth}x${logoHeight} at (${bestPosition.x}, ${bestPosition.y}) [${bestPosition.name}]`);

	// Create a subtle shadow/outline effect for better integration
	const logoWithShadow = await (await import("sharp")).default(resizedLogo)
		.modulate({ 
			brightness: 0.85, // Slightly darker to look more integrated
			saturation: 0.9   // Slightly desaturated
		})
		.png()
		.toBuffer();

	// Composite logo onto product image with better blending
	const composited = await (await import("sharp")).default(params.productImage)
		.composite([{
			input: logoWithShadow,
			left: bestPosition.x,
			top: bestPosition.y,
			blend: 'overlay' // Use overlay for more realistic integration (was 'multiply')
		}])
		.png()
		.toBuffer();

	return composited;
} 