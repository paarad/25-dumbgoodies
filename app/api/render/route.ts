import { NextRequest } from "next/server";
import { z } from "zod";
import { seedreamGenerateBase, seedreamEditWithMask } from "@/lib/seedream";
import { editImageWithMask } from "@/lib/openai";
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

		// Build or fetch base image
		let baseBuffer: Buffer;
		if (productRefUrl) {
			console.log("[Render] Using product reference image:", productRefUrl);
			baseBuffer = await bufferFromUrl(productRefUrl);
		} else {
			console.log("[Render] Generating base image with Seedream...");
			const base = await seedreamGenerateBase(promptBase);
			baseBuffer = base.imageBuffer;
		}

		// Build mask (simple centered patch for now)
		const maskBuffer = buildCenteredLabelMask(1024, 1024);

		// Run both models with individual error handling
		console.log("[Render] Starting parallel rendering with both models...");
		
		const seedreamPromise = seedreamEditWithMask({ 
			image: baseBuffer, 
			mask: maskBuffer, 
			brand, 
			promptBase 
		}).then(result => ({ success: true, result }))
		.catch(error => {
			console.error("[Render] Seedream edit failed:", error);
			return { success: false, error: error.message };
		});

		const openaiPromise = editImageWithMask({ 
			image: baseBuffer, 
			mask: maskBuffer, 
			instruction: `Place ${brand} logo` 
		}).then(result => ({ success: true, result }))
		.catch(error => {
			console.error("[Render] OpenAI edit failed:", error);
			return { success: false, error: error.message };
		});

		const [seedreamResult, openaiResult] = await Promise.all([seedreamPromise, openaiPromise]);

		// Process successful results
		const results = [];
		
		if (seedreamResult.success) {
			console.log("[Render] Seedream success, persisting...");
			try {
				const persisted = await persistRender({ 
					projectId, 
					conceptId, 
					model: "v1-seedream", 
					data: (seedreamResult as any).result.imageBuffer 
				});
				results.push(persisted);
			} catch (error) {
				console.error("[Render] Failed to persist Seedream result:", error);
			}
		} else {
			console.error("[Render] Seedream failed:", (seedreamResult as any).error);
		}

		if (openaiResult.success) {
			console.log("[Render] OpenAI success, persisting...");
			try {
				const persisted = await persistRender({ 
					projectId, 
					conceptId, 
					model: "v1_5-openai", 
					data: (openaiResult as any).result.imageBuffer 
				});
				results.push(persisted);
			} catch (error) {
				console.error("[Render] Failed to persist OpenAI result:", error);
			}
		} else {
			console.error("[Render] OpenAI failed:", (openaiResult as any).error);
		}

		// Return results (even if only one succeeded)
		if (results.length === 0) {
			return new Response(
				JSON.stringify({ 
					error: "Both models failed", 
					details: { 
						seedream: seedreamResult.success ? "success" : (seedreamResult as any).error,
						openai: openaiResult.success ? "success" : (openaiResult as any).error
					}
				}), 
				{ status: 500 }
			);
		}

		console.log(`[Render] Completed with ${results.length}/2 successful renders`);
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
	return { model: params.model as "v1-seedream" | "v1_5-openai", imageUrl, thumbnailUrl };
} 