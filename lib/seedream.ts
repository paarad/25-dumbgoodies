import Replicate from "replicate";

type GeneratedImage = {
  model?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  imageBuffer?: Buffer;
  mimeType?: string;
};

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
// Using Stable Diffusion XL for inpainting instead of Seedream
const REPLICATE_MODEL = process.env.REPLICATE_MODEL || "stability-ai/stable-diffusion-xl-base-1.0";
const INPAINTING_MODEL = "stability-ai/sdxl-inpainting";

function getReplicate(): Replicate {
	if (!REPLICATE_API_TOKEN) {
		throw new Error("Missing REPLICATE_API_TOKEN");
	}
	return new Replicate({ auth: REPLICATE_API_TOKEN });
}

export async function stableDiffusionGenerateBase(prompt: string): Promise<GeneratedImage> {
	const replicate = getReplicate();
	
	console.log("[StableDiffusion] Generating base image with prompt:", prompt);
	
	const enhancedPrompt = `Product photography of ${prompt}, clean white background, professional studio lighting, centered composition, high quality, commercial product shot, 4k`;
	
	// Generate base product image using Stable Diffusion XL
	const output = await replicate.run(REPLICATE_MODEL as any, {
		input: {
			prompt: enhancedPrompt,
			width: 1024,
			height: 1024,
			num_inference_steps: 30,
			guidance_scale: 7.5,
			num_outputs: 1,
		},
	});

	console.log("[StableDiffusion] Raw output:", output);
	
	// Handle output - should be array of URLs
	let imageUrl: string;
	if (Array.isArray(output) && output.length > 0) {
		imageUrl = output[0];
	} else if (typeof output === "string") {
		imageUrl = output;
	} else {
		throw new Error(`Unexpected Stable Diffusion output format: ${typeof output}`);
	}

	if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
		throw new Error(`Invalid image URL from Stable Diffusion: ${typeof imageUrl} - ${imageUrl}`);
	}

	console.log("[StableDiffusion] Using image URL:", imageUrl);

	// Fetch the image and convert to buffer
	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch generated image: ${response.status}`);
	}
	
	const imageBuffer = Buffer.from(await response.arrayBuffer());
	return { imageBuffer, mimeType: "image/png" };
}

export async function stableDiffusionInpaint(params: {
	image: Buffer;
	mask: Buffer;
	brand: string;
	promptBase: string;
}): Promise<GeneratedImage> {
	const replicate = getReplicate();
	
	// Convert buffers to data URLs for Replicate
	const imageDataUrl = `data:image/png;base64,${params.image.toString("base64")}`;
	const maskDataUrl = `data:image/png;base64,${params.mask.toString("base64")}`;
	
	const inpaintPrompt = `Add "${params.brand}" logo or branding to this ${params.promptBase}. Professional product photography, clean integration, realistic lighting and perspective`;
	
	console.log("[StableDiffusion] Inpainting with prompt:", inpaintPrompt);
	
	// Use Stable Diffusion XL Inpainting for precise logo placement
	const output = await replicate.run(INPAINTING_MODEL as any, {
		input: {
			prompt: inpaintPrompt,
			image: imageDataUrl,
			mask: maskDataUrl,
			num_inference_steps: 30,
			guidance_scale: 7.5,
			strength: 0.8,
			num_outputs: 1,
		},
	});

	console.log("[StableDiffusion] Inpaint output:", output);

	// Handle output same as generation
	let imageUrl: string;
	if (Array.isArray(output) && output.length > 0) {
		imageUrl = output[0];
	} else if (typeof output === "string") {
		imageUrl = output;
	} else {
		throw new Error(`Unexpected Stable Diffusion inpaint output format: ${typeof output}`);
	}

	if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
		throw new Error(`Invalid image URL from Stable Diffusion inpaint: ${typeof imageUrl} - ${imageUrl}`);
	}

	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch inpainted image: ${response.status}`);
	}
	
	const imageBuffer = Buffer.from(await response.arrayBuffer());
	return { imageBuffer, mimeType: "image/png" };

}

// Keep old function names for compatibility but use new implementations
export const seedreamGenerateBase = stableDiffusionGenerateBase;
export const seedreamEditWithMask = stableDiffusionInpaint; 