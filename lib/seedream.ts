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

// Helper to handle Replicate output (ReadableStream or URL)
async function extractImageFromOutput(output: any): Promise<string> {
	console.log("[Seedream] Processing output:", output);
	console.log("[Seedream] Output type:", typeof output);
	console.log("[Seedream] Is array:", Array.isArray(output));

	// Handle array output (get first item)
	if (Array.isArray(output)) {
		output = output[0];
	}

	// Handle ReadableStream
	if (output && typeof output === "object" && output.constructor && output.constructor.name === "ReadableStream") {
		console.log("[Seedream] Handling ReadableStream");
		const reader = output.getReader();
		const chunks: Uint8Array[] = [];
		
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
		} finally {
			reader.releaseLock();
		}
		
		// Combine chunks and convert to text (should be URL)
		const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}
		
		const text = new TextDecoder().decode(combined).trim();
		console.log("[Seedream] Stream decoded to:", text);
		return text;
	}

	// Handle direct string URL
	if (typeof output === "string") {
		console.log("[Seedream] Direct string URL:", output);
		return output;
	}

	// Handle object with url/image property
	if (output && typeof output === "object") {
		if ("url" in output) {
			console.log("[Seedream] Object with url:", output.url);
			return output.url;
		}
		if ("image" in output) {
			console.log("[Seedream] Object with image:", output.image);
			return output.image;
		}
	}

	throw new Error(`Unsupported Replicate output format: ${typeof output} - ${JSON.stringify(output)}`);
}

export async function seedreamGenerateBase(prompt: string): Promise<GeneratedImage> {
	const replicate = getReplicate();
	
	console.log("[Seedream] Generating with prompt:", prompt);
	
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

	const imageUrl = await extractImageFromOutput(output);

	if (!imageUrl || !imageUrl.startsWith("http")) {
		throw new Error(`Invalid image URL from Seedream: ${imageUrl}`);
	}

	console.log("[Seedream] Using image URL:", imageUrl);

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
	
	console.log("[Seedream] Editing with prompt:", editPrompt);
	
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

	const imageUrl = await extractImageFromOutput(output);

	if (!imageUrl || !imageUrl.startsWith("http")) {
		throw new Error(`Invalid image URL from Seedream edit: ${imageUrl}`);
	}

	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch edited image: ${response.status}`);
	}
	
	const imageBuffer = Buffer.from(await response.arrayBuffer());
	return { imageBuffer, mimeType: "image/png" };
} 