import type { GeneratedImage } from "./openai";
import { generateBaseImage as openaiGenerate, editImageWithMask as openaiEdit } from "./openai";
import { openaiEditInstruction } from "./prompts";

const _SEEDREAM_API_KEY = process.env.SEEDREAM_API_KEY;

export async function seedreamGenerateBase(prompt: string): Promise<GeneratedImage> {
	// TODO: Integrate real Seedream 4.0 generation API.
	// Fallback to OpenAI base generation for now so the pipeline works end-to-end.
	return openaiGenerate(prompt);
}

export async function seedreamEditWithMask(params: {
	image: Buffer;
	mask: Buffer;
	brand: string;
	promptBase: string;
}): Promise<GeneratedImage> {
	// TODO: Integrate real Seedream 4.0 edit/inpaint API using reference logo.
	// Fallback: reuse OpenAI edit with the same instruction string.
	const instruction = openaiEditInstruction(params.brand);
	return openaiEdit({ image: params.image, mask: params.mask, instruction });
} 