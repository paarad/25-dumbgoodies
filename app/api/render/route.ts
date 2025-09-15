import { NextRequest } from "next/server";
import { z } from "zod";
import { seedreamGenerateBase, seedreamEditWithMask } from "@/lib/seedream";
import { editImageWithMask, generateBaseImage } from "@/lib/openai";
import { buildCenteredLabelMask, bufferFromUrl, createThumbnail, toPng } from "@/lib/images";
import { uploadBufferToStorage } from "@/lib/supabase";

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

		// Build or fetch base image
		let baseBuffer: Buffer;
		if (productRefUrl) {
			baseBuffer = await bufferFromUrl(productRefUrl);
		} else {
			const base = await seedreamGenerateBase(promptBase);
			baseBuffer = base.imageBuffer;
		}

		// Build mask (simple centered patch for now)
		const maskBuffer = buildCenteredLabelMask(1024, 1024);

		// Run both models in parallel
		const [seedreamEdited, openaiEdited] = await Promise.all([
			seedreamEditWithMask({ image: baseBuffer, mask: maskBuffer, brand, promptBase }),
			editImageWithMask({ image: baseBuffer, mask: maskBuffer, instruction: `Place ${brand} logo` }),
		]);

		// Normalize to PNG, create thumbnails, upload
		const results = await Promise.all([
			persistRender({ projectId, conceptId, model: "v1-seedream", data: seedreamEdited.imageBuffer }),
			persistRender({ projectId, conceptId, model: "v1_5-openai", data: openaiEdited.imageBuffer }),
		]);

		return new Response(
			JSON.stringify({ results }),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	} catch (err: any) {
		console.error("/api/render error", err);
		return new Response(JSON.stringify({ error: err?.message ?? "Render failed" }), { status: 500 });
	}
}

async function persistRender(params: { projectId: string; conceptId: string; model: string; data: Buffer; }) {
	const png = await toPng(params.data);
	const thumb = await createThumbnail(png, 512);
	const basePath = `${new Date().toISOString().slice(0, 10)}/${params.projectId}/${params.conceptId}/${params.model}`;
	const imageUrl = await uploadBufferToStorage({ bucket: "renders", path: `${basePath}.png`, data: png, contentType: "image/png" });
	const thumbnailUrl = await uploadBufferToStorage({ bucket: "thumbs", path: `${basePath}_512.png`, data: thumb, contentType: "image/png" });
	return { model: params.model as "v1-seedream" | "v1_5-openai", imageUrl, thumbnailUrl };
} 