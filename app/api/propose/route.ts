import { NextRequest } from "next/server";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { proposeIdeas } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "edge";

const BodySchema = z.object({
	brand: z.string().min(1),
	logoUrl: z.string().url().optional(),
	product_hint: z.string().optional(),
	product_ref_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = BodySchema.safeParse(body);
		if (!parsed.success) {
			return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
		}
		const { brand, product_hint, product_ref_url } = parsed.data;

		if (product_hint || product_ref_url) {
			return new Response(JSON.stringify({ concepts: [] }), { status: 200 });
		}

		const sys = proposeIdeas(brand);
		const chat = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: sys },
				{ role: "user", content: "Return JSON only." },
			],
			response_format: { type: "json_object" },
		});
		const content = chat.choices[0]?.message?.content ?? "[]";
		let ideas: Array<{ label: string; prompt_base: string }> = [];
		try {
			const parsedJson = JSON.parse(content) as unknown;
			if (Array.isArray(parsedJson)) {
				ideas = parsedJson as Array<{ label: string; prompt_base: string }>;
			}
		} catch {
			ideas = [];
		}
		if (!Array.isArray(ideas) || ideas.length !== 2) {
			return new Response(JSON.stringify({ error: "Bad ideas response" }), { status: 500 });
		}

		const projectId = globalThis.crypto.randomUUID();
		await getSupabaseAdmin().from("projects").insert({ id: projectId, brand });

		const concepts = ideas.map((i) => ({ id: globalThis.crypto.randomUUID(), label: i.label, prompt_base: i.prompt_base }));
		await getSupabaseAdmin().from("concepts").insert(
			concepts.map((c) => ({ id: c.id, project_id: projectId, label: c.label, prompt_base: c.prompt_base, status: "idea" }))
		);

		return new Response(
			JSON.stringify({ concepts }),
			{ status: 200, headers: { "content-type": "application/json", "x-project-id": projectId } }
		);
	} catch (err) {
		console.error("/api/propose error", err);
		return new Response(JSON.stringify({ error: "Propose failed" }), { status: 500 });
	}
} 