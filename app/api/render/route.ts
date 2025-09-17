import { NextRequest } from "next/server";
import { z } from "zod";
// import { seedreamEditWithMask } from "@/lib/seedream";
import { generateBaseImage, editImageWithMask } from "@/lib/openai";
import { buildCenteredLabelMask, bufferFromUrl, createThumbnail, toPng, compositeLogoOnProduct } from "@/lib/images";
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
		const { projectId, conceptId, brand, logoUrl, productRefUrl, promptBase } = parsed.data;

		// Build or fetch base image - using DALL-E 3 as primary
		let baseBuffer: Buffer;
		if (productRefUrl) {
			console.log("[Render] Using product reference image:", productRefUrl);
			baseBuffer = await bufferFromUrl(productRefUrl);
		} else {
			console.log("[Render] Generating base image with DALL-E 3...");
			// Generate with brand included in prompt for natural logo integration
			const base = await generateBaseImage(promptBase, brand);
			baseBuffer = base.imageBuffer;
		}

		// Convert to PNG and ensure proper format
		console.log("[Render] Converting base image to PNG format...");
		const pngBaseBuffer = await toPng(baseBuffer);
		const baseImageSize = pngBaseBuffer.length;
		console.log(`[Render] Base image size: ${Math.round(baseImageSize / 1024)} KB`);

		// Check size limit and compress if needed
		const maxSize = 4 * 1024 * 1024; // 4MB
		if (baseImageSize > maxSize) {
			console.log("[Render] Image too large, compressing...");
			const compressed = await createThumbnail(pngBaseBuffer, 1024);
			baseBuffer = compressed;
			console.log(`[Render] Compressed image size: ${Math.round(compressed.length / 1024)} KB`);
		} else {
			baseBuffer = pngBaseBuffer;
		}

		// Create results array for different approaches
		const results = [];

		// Approach 1: Direct generation with brand in prompt (primary)
		if (!productRefUrl) {
			console.log("[Render] Using direct brand generation in DALL-E 3...");
			try {
				const persisted = await persistRender({ 
					projectId, 
					conceptId, 
					model: "v2-dalle-3-direct", 
					data: baseBuffer 
				});
				results.push(persisted);
				console.log("[Render] Direct brand generation success, persisted");
			} catch (error) {
				console.error("[Render] Direct brand generation failed:", error);
			}
		}

		// Approach 2: Logo compositing (if logo URL provided and we want a second version)
		if (logoUrl) {
			console.log("[Render] Creating additional logo composite version...");
			try {
				// Generate a clean base image without brand for compositing
				const cleanBase = await generateBaseImage(promptBase);
				const logoBuffer = await bufferFromUrl(logoUrl);
				const compositedImage = await compositeLogoOnProduct({
					productImage: cleanBase.imageBuffer,
					logoImage: logoBuffer,
					brand
				});

				const persisted = await persistRender({ 
					projectId, 
					conceptId, 
					model: "v2-logo-composite", 
					data: compositedImage 
				});
				results.push(persisted);
				console.log("[Render] Logo composite success, persisted");
			} catch (error) {
				console.error("[Render] Logo composite failed:", error);
			}
		}

		// Return results
		if (results.length === 0) {
			return new Response(
				JSON.stringify({
					error: "Logo compositing failed",
					details: logoUrl ? "Logo compositing failed" : "No logo provided and base image persistence failed"
				}),
				{ status: 500 }
			);
		}

		console.log(`[Render] Completed with ${results.length} successful render(s)`);
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
	return { model: params.model as "v2-logo-composite" | "v2-dalle-2", imageUrl, thumbnailUrl };
} 