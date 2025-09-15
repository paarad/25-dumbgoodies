import { NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "node:crypto";

export const runtime = "edge";

const BodySchema = z.object({
	projectId: z.string().uuid(),
	conceptId: z.string().uuid(),
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
		const { projectId, conceptId, model, imageUrl, thumbnailUrl } = parsed.data;
		const id = randomUUID();
		const { error } = await supabaseAdmin.from("renders").insert({
			id,
			project_id: projectId,
			concept_id: conceptId,
			model,
			image_url: imageUrl,
			thumbnail_url: thumbnailUrl,
			public: true,
		});
		if (error) throw error;
		return new Response(JSON.stringify({ ok: true, renderId: id }), { status: 200, headers: { "content-type": "application/json" } });
	} catch (err: any) {
		console.error("/api/save error", err);
		return new Response(JSON.stringify({ error: err?.message ?? "Save failed" }), { status: 500 });
	}
} 