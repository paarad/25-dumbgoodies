import { NextRequest } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/openai";
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

		// Always create a project first
		const projectId = globalThis.crypto.randomUUID();
		await getSupabaseAdmin().from("dumbgoodies_projects").insert({ id: projectId, brand });

		// If product hint or product reference is provided, create a single concept for it
		if (product_hint || product_ref_url) {
			const conceptLabel = product_hint || "Custom Product";
			const promptBase = product_hint || "custom product";
			
			const conceptId = globalThis.crypto.randomUUID();
			await getSupabaseAdmin().from("dumbgoodies_concepts").insert({
				id: conceptId,
				project_id: projectId,
				label: conceptLabel,
				prompt_base: promptBase,
				status: "idea"
			});

			return new Response(
				JSON.stringify({ 
					concepts: [{ 
						id: conceptId, 
						label: conceptLabel, 
						prompt_base: promptBase 
					}] 
				}),
				{ status: 200, headers: { "content-type": "application/json", "x-project-id": projectId } }
			);
		}

		// Otherwise, propose 2 ideas using AI
		const sys = proposeIdeas(brand);
		const chat = await getOpenAI().chat.completions.create({
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

		const concepts = ideas.map((i) => ({ id: globalThis.crypto.randomUUID(), label: i.label, prompt_base: i.prompt_base }));
		await getSupabaseAdmin().from("dumbgoodies_concepts").insert(
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