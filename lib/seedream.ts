import Replicate from "replicate";
import type { GeneratedImage } from "./openai";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_MODEL = process.env.REPLICATE_MODEL || "bytedance/seedream-4";

function getReplicate(): Replicate {
	if (!REPLICATE_API_TOKEN) {
		throw new Error("Missing REPLICATE_API_TOKEN");
	}
	return new Replicate({ auth: REPLICATE_API_TOKEN });
}

export async function seedreamGenerateBase(prompt: string): Promise<GeneratedImage> {
	const replicate = getReplicate();
	
	// Generate base product image using Seedream
	const output = await replicate.run(REPLICATE_MODEL as any, {
		input: {
			prompt: prompt,
			guidance_scale: 7.5,
			num_inference_steps: 20,
			width: 1024,
			height: 1024,
		},
	});

	// Replicate returns array of URLs, get the first one
	const imageUrl = Array.isArray(output) ? output[0] : output;
	if (typeof imageUrl !== "string") {
		throw new Error("Unexpected Seedream output format");
	}

	// Fetch the image and convert to buffer
	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch generated image: ${response.status}`);
	}
	
	const imageBuffer = Buffer.from(await response.arrayBuffer());
	return { imageBuffer, mimeType: "image/png" };
}

export async function seedreamEditWithMask(params: {
	image: Buffer;
	mask: Buffer;
	brand: string;
	promptBase: string;
}): Promise<GeneratedImage> {
	const replicate = getReplicate();
	
	// Convert buffers to data URLs for Replicate
	const imageDataUrl = `data:image/png;base64,${params.image.toString("base64")}`;
	const maskDataUrl = `data:image/png;base64,${params.mask.toString("base64")}`;
	
	const editPrompt = `Add "${params.brand}" branding to this product. ${params.promptBase}`;
	
	// Use Seedream for inpainting/editing
	const output = await replicate.run(REPLICATE_MODEL as any, {
		input: {
			prompt: editPrompt,
			image: imageDataUrl,
			mask: maskDataUrl,
			guidance_scale: 7.5,
			num_inference_steps: 20,
			strength: 0.8,
		},
	});

	// Handle output same as generation
	const imageUrl = Array.isArray(output) ? output[0] : output;
	if (typeof imageUrl !== "string") {
		throw new Error("Unexpected Seedream edit output format");
	}

	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch edited image: ${response.status}`);
	}
	
	const imageBuffer = Buffer.from(await response.arrayBuffer());
	return { imageBuffer, mimeType: "image/png" };
} 