import { NextRequest } from "next/server";
import { z } from "zod";
import { seedreamEditWithMask } from "@/lib/seedream";
import { generateBaseImage, editImageWithMask } from "@/lib/openai";
import { buildCenteredLabelMask, bufferFromUrl, createThumbnail, toPng } from "@/lib/images";
import { BUCKET_RENDERS, BUCKET_THUMBS, uploadBufferToStorage } from "@/lib/supabase";

export const runtime = "nodejs";

const BodySchema = z.object({
	projectId: z.string().uuid(),
	conceptId: z.string().uuid(),
	brand: z.string().min(1),
	logoUrl: z.string().url().optional(),
	productRefUrl: z.string().url().optional(),
	promptBase: z.string().min(1),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = BodySchema.safeParse(body);
		if (!parsed.success) {
			return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
		}
		const { projectId, conceptId, brand, productRefUrl, promptBase } = parsed.data;

		// Build or fetch base image - now using DALL-E 3 as primary
		let baseBuffer: Buffer;
		if (productRefUrl) {
			console.log("[Render] Using product reference image:", productRefUrl);
			baseBuffer = await bufferFromUrl(productRefUrl);
		} else {
			console.log("[Render] Generating base image with DALL-E 3...");
			const base = await generateBaseImage(promptBase);
			baseBuffer = base.imageBuffer;
		}

		// Build mask (simple centered patch for now)
		const maskBuffer = buildCenteredLabelMask(1024, 1024);

		// Run both inpainting models with individual error handling
		console.log("[Render] Starting parallel logo placement with both models...");
		
		// Model 1: Stable Diffusion XL Inpainting (better for logo placement)
		const stableDiffusionPromise = seedreamEditWithMask({ 
			image: baseBuffer, 
			mask: maskBuffer, 
			brand, 
			promptBase 
		}).then(result => ({ success: true, result }))
		.catch(error => {
			console.error("[Render] Stable Diffusion inpainting failed:", error);
			return { success: false, error: error.message };
		});

		// Model 2: DALL-E 2 Inpainting (reliable fallback)
		const dallePromise = editImageWithMask({ 
			image: baseBuffer, 
			mask: maskBuffer, 
			instruction: `Place "${brand}" logo or branding on this product with professional integration. Clean, realistic placement that matches the product's perspective and lighting.` 
		}).then(result => ({ success: true, result }))
		.catch(error => {
			console.error("[Render] DALL-E 2 inpainting failed:", error);
			return { success: false, error: error.message };
		});

		const [stableDiffusionResult, dalleResult] = await Promise.all([stableDiffusionPromise, dallePromise]);

		// Process successful results
		const results = [];
		
		if (stableDiffusionResult.success) {
			console.log("[Render] Stable Diffusion success, persisting...");
			try {
				const persisted = await persistRender({ 
					projectId, 
					conceptId, 
					model: "v2-stable-diffusion-xl", 
					data: (stableDiffusionResult as any).result.imageBuffer 
				});
				results.push(persisted);
			} catch (error) {
				console.error("[Render] Failed to persist Stable Diffusion result:", error);
			}
		} else {
			console.error("[Render] Stable Diffusion failed:", (stableDiffusionResult as any).error);
		}

		if (dalleResult.success) {
			console.log("[Render] DALL-E 2 success, persisting...");
			try {
				const persisted = await persistRender({ 
					projectId, 
					conceptId, 
					model: "v2-dalle-2", 
					data: (dalleResult as any).result.imageBuffer 
				});
				results.push(persisted);
			} catch (error) {
				console.error("[Render] Failed to persist DALL-E 2 result:", error);
			}
		} else {
			console.error("[Render] DALL-E 2 failed:", (dalleResult as any).error);
		}

		// Return results (even if only one succeeded)
		if (results.length === 0) {
			return new Response(
				JSON.stringify({ 
					error: "Both inpainting models failed", 
					details: { 
						stable_diffusion: stableDiffusionResult.success ? "success" : (stableDiffusionResult as any).error,
						dalle: dalleResult.success ? "success" : (dalleResult as any).error
					}
				}), 
				{ status: 500 }
			);
		}

		console.log(`[Render] Completed with ${results.length}/2 successful logo placements`);
		return new Response(
			JSON.stringify({ results }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	} catch (err) {
		console.error("/api/render error", err);
		return new Response(JSON.stringify({ error: "Render failed" }), { status: 500 });
	}
}

async function persistRender(params: { projectId: string; conceptId: string; model: string; data: Buffer; }) {
	const png = await toPng(params.data);
	const thumb = await createThumbnail(png, 512);
	const basePath = `${new Date().toISOString().slice(0, 10)}/${params.projectId}/${params.conceptId}/${params.model}`;
	const imageUrl = await uploadBufferToStorage({ bucket: BUCKET_RENDERS, path: `${basePath}.png`, data: png, contentType: "image/png" });
	const thumbnailUrl = await uploadBufferToStorage({ bucket: BUCKET_THUMBS, path: `${basePath}_512.png`, data: thumb, contentType: "image/png" });
	return { model: params.model as "v2-stable-diffusion-xl" | "v2-dalle-2", imageUrl, thumbnailUrl };
} 