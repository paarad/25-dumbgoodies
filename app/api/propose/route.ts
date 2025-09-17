import { NextRequest } from "next/server";
import { z } from "zod";
import { getRandomDumbProducts } from "@/lib/dumb-products";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "edge";

const BodySchema = z.object({
	brand: z.string().min(1),
	logoUrl: z.string().url(), // Now required
	product_hint: z.string().optional(),
	product_ref_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		console.log("[Propose] Received body:", JSON.stringify(body, null, 2));
		
		const parsed = BodySchema.safeParse(body);
		if (!parsed.success) {
			console.error("[Propose] Validation failed:", JSON.stringify(parsed.error, null, 2));
			return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400 });
		}
		const { brand, logoUrl, product_hint, product_ref_url } = parsed.data;

		// Always create a project first
		const projectId = globalThis.crypto.randomUUID();
		await getSupabaseAdmin().from("dumbgoodies_projects").insert({ 
			id: projectId, 
			brand,
			logo_url: logoUrl // Store the logo URL
		});

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

		// Otherwise, use predefined random dumb products (reliable!)
		console.log("[Propose] Generating 2 random dumb products from predefined list");
		const randomProducts = getRandomDumbProducts(2);
		
		const concepts = randomProducts.map((product) => ({
			id: globalThis.crypto.randomUUID(),
			label: product.label,
			prompt_base: product.prompt_base
		}));

		await getSupabaseAdmin().from("dumbgoodies_concepts").insert(
			concepts.map((c) => ({ 
				id: c.id, 
				project_id: projectId, 
				label: c.label, 
				prompt_base: c.prompt_base, 
				status: "idea" 
			}))
		);

		console.log("[Propose] Successfully created project and concepts:", concepts.map(c => c.label));

		return new Response(
			JSON.stringify({ concepts }),
			{ status: 200, headers: { "content-type": "application/json", "x-project-id": projectId } }
		);
	} catch (err) {
		console.error("/api/propose error", err);
		return new Response(JSON.stringify({ error: "Propose failed" }), { status: 500 });
	}
}
