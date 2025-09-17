import { NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "edge";

const BodySchema = z.object({
	brand: z.string().min(1),
	product: z.string().min(1),
	model: z.string(),
	imageUrl: z.string().url(),
	thumbnailUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = BodySchema.safeParse(body);
		if (!parsed.success) {
			return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
		}
		const { brand, product, model, imageUrl, thumbnailUrl } = parsed.data;
		const id = globalThis.crypto.randomUUID();
		const { error } = await getSupabaseAdmin().from("dumbgoodies_renders").insert({
			id,
			brand,
			product,
			model,
			image_url: imageUrl,
			thumbnail_url: thumbnailUrl,
			public: true,
		});
		if (error) throw error;
		return new Response(JSON.stringify({ ok: true, renderId: id }), { status: 200, headers: { "content-type": "application/json" } });
	} catch (err) {
		console.error("/api/save error", err);
		return new Response(JSON.stringify({ error: "Save failed" }), { status: 500 });
	}
} 