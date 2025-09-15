import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
	console.warn("[openai] OPENAI_API_KEY is not set. Some features will fail.");
}

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export type GeneratedImage = {
	imageBuffer: Buffer;
	mimeType: string; // e.g., "image/png"
};

export async function generateBaseImage(prompt: string): Promise<GeneratedImage> {
	const resp = await openai.images.generate({
		model: "gpt-image-1",
		prompt,
		size: "1024x1024",
		response_format: "b64_json",
	});
	const first = resp.data?.[0];
	const b64 = first?.b64_json;
	if (!b64) throw new Error("OpenAI generation returned empty response");
	return { imageBuffer: Buffer.from(b64, "base64"), mimeType: "image/png" };
}

export async function editImageWithMask(params: {
	image: Buffer;
	mask: Buffer;
	instruction: string;
	prompt?: string;
}): Promise<GeneratedImage> {
	const form = new FormData();
	form.append("model", "gpt-image-1");
	form.append("prompt", params.prompt ?? params.instruction);
	form.append("image", new Blob([params.image], { type: "image/png" }), "image.png");
	form.append("mask", new Blob([params.mask], { type: "image/png" }), "mask.png");
	form.append("size", "1024x1024");
	form.append("response_format", "b64_json");

	// SDK does not yet expose a high-level helper for edits with buffers; use fetch directly
	const res = await fetch("https://api.openai.com/v1/images/edits", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${OPENAI_API_KEY}`,
		},
		body: form,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`OpenAI edit failed: ${res.status} ${text}`);
	}
	const json: any = await res.json();
	const b64 = json?.data?.[0]?.b64_json;
	if (!b64) throw new Error("OpenAI edit returned no image");
	return { imageBuffer: Buffer.from(b64, "base64"), mimeType: "image/png" };
} 