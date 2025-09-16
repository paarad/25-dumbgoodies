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

	console.log("[Seedream] Raw output:", output);
	console.log("[Seedream] Output type:", typeof output);
	console.log("[Seedream] Is array:", Array.isArray(output));

	// Handle different possible output formats from Replicate
	let imageUrl: string;
	if (Array.isArray(output)) {
		imageUrl = output[0];
	} else if (typeof output === "string") {
		imageUrl = output;
	} else if (output && typeof output === "object" && "url" in output) {
		imageUrl = (output as any).url;
	} else if (output && typeof output === "object" && "image" in output) {
		imageUrl = (output as any).image;
	} else {
		console.error("[Seedream] Unexpected output format:", JSON.stringify(output, null, 2));
		throw new Error(`Unexpected Seedream output format: ${typeof output} - ${JSON.stringify(output)}`);
	}

	if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
		console.error("[Seedream] Invalid image URL:", imageUrl);
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

	console.log("[Seedream] Edit output:", output);

	// Handle output same as generation
	let imageUrl: string;
	if (Array.isArray(output)) {
		imageUrl = output[0];
	} else if (typeof output === "string") {
		imageUrl = output;
	} else if (output && typeof output === "object" && "url" in output) {
		imageUrl = (output as any).url;
	} else if (output && typeof output === "object" && "image" in output) {
		imageUrl = (output as any).image;
	} else {
		console.error("[Seedream] Unexpected edit output format:", JSON.stringify(output, null, 2));
		throw new Error(`Unexpected Seedream edit output format: ${typeof output} - ${JSON.stringify(output)}`);
	}

	if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
		throw new Error(`Invalid image URL from Seedream edit: ${imageUrl}`);
	}

	const response = await fetch(imageUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch edited image: ${response.status}`);
	}
	
	const imageBuffer = Buffer.from(await response.arrayBuffer());
	return { imageBuffer, mimeType: "image/png" };
} 