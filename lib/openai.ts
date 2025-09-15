import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export function getOpenAI(): OpenAI {
	if (!OPENAI_API_KEY) {
		throw new Error("Missing OPENAI_API_KEY");
	}
	return new OpenAI({ apiKey: OPENAI_API_KEY });
}

export type GeneratedImage = {
	imageBuffer: Buffer;
	mimeType: string; // e.g., "image/png"
};

export async function generateBaseImage(prompt: string): Promise<GeneratedImage> {
	const resp = await getOpenAI().images.generate({
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
	form.append("image", new Blob([new Uint8Array(params.image)], { type: "image/png" }), "image.png");
	form.append("mask", new Blob([new Uint8Array(params.mask)], { type: "image/png" }), "mask.png");
	form.append("size", "1024x1024");
	form.append("response_format", "b64_json");

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
	type EditJson = { data?: Array<{ b64_json?: string }> };
	const json = (await res.json()) as EditJson;
	const b64 = json?.data?.[0]?.b64_json;
	if (!b64) throw new Error("OpenAI edit returned no image");
	return { imageBuffer: Buffer.from(b64, "base64"), mimeType: "image/png" };
} 