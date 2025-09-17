"use client";

import { useState } from "react";
import { BrandInput } from "@/components/BrandInput";
import { IdeaCard } from "@/components/IdeaCard";

type RenderResult = { model: "v1-seedream" | "v1_5-openai"; imageUrl: string; thumbnailUrl: string };

export default function HomePage() {
	const [projectId, setProjectId] = useState<string | null>(null);
	const [concepts, setConcepts] = useState<Array<{ id: string; label: string; prompt_base: string }>>([]);
	const [resultsByConcept, setResultsByConcept] = useState<Record<string, RenderResult[]>>({});
	const [loading, setLoading] = useState(false);

	async function handleStart(params: {
		brand: string;
		logoFile?: File | null;
		productHint?: string | null;
		productRefFile?: File | null;
	}) {
		try {
			setLoading(true);

			let logoUrl: string | undefined;
			let productRefUrl: string | undefined;

			// Upload logo if provided
			if (params.logoFile) {
				const fd = new FormData();
				fd.append("file", params.logoFile);
				const res = await fetch("/api/upload", { method: "POST", body: fd });
				const data = await res.json();
				if (!res.ok) throw new Error((data as { error?: string }).error || "Logo upload failed");
				logoUrl = (data as { url: string }).url;
			}

			// Upload product reference if provided
			if (params.productRefFile) {
				const fd = new FormData();
				fd.append("file", params.productRefFile);
				const res = await fetch("/api/upload", { method: "POST", body: fd });
				const data = await res.json();
				if (!res.ok) throw new Error((data as { error?: string }).error || "Product image upload failed");
				productRefUrl = (data as { url: string }).url;
			}

			// Always call propose API to create project and concepts in database
			const requestBody: Record<string, any> = {
				brand: params.brand,
			};
			
			// Only add optional fields if they have values
			if (logoUrl) requestBody.logoUrl = logoUrl;
			if (params.productHint?.trim()) requestBody.product_hint = params.productHint.trim();
			if (productRefUrl) requestBody.product_ref_url = productRefUrl;
			
			const res = await fetch("/api/propose", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(requestBody),
			});
			const data = await res.json();
			if (!res.ok) throw new Error((data as { error?: string }).error || "Propose failed");
			
			const conceptsLocal = (data as { concepts: { id: string; label: string; prompt_base: string }[] }).concepts;
			const createdProjectId = res.headers.get("x-project-id") || crypto.randomUUID();

			setProjectId(createdProjectId);
			setConcepts(conceptsLocal);

			// Render competition for each concept
			const entries = await Promise.all(
				conceptsLocal.map(async (c) => {
					const renderBody: Record<string, any> = {
						projectId: createdProjectId,
						conceptId: c.id,
						brand: params.brand,
						promptBase: c.prompt_base,
					};
					
					// Only add optional fields if they have values
					if (logoUrl) renderBody.logoUrl = logoUrl;
					if (productRefUrl) renderBody.productRefUrl = productRefUrl;
					
					const res = await fetch("/api/render", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(renderBody),
					});
					const json = (await res.json()) as { results?: RenderResult[]; error?: string };
					if (!res.ok || !json.results) throw new Error(json.error || "Render failed");
					return [c.id, json.results] as const;
				})
			);
			setResultsByConcept(Object.fromEntries(entries));
		} catch (e) {
			console.error(e);
			alert("Something failed. Check console.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="font-sans min-h-screen p-6 sm:p-10 max-w-5xl mx-auto flex flex-col gap-8">
			<section className="pt-8 sm:pt-16 pb-2 sm:pb-4 text-center">
				<h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-gray-900">DumbGoodies</h1>
				<p className="mt-3 text-sm sm:text-base text-gray-600">
					Generate dumb merch images from your logo or brand name with AI. 
					<br className="hidden sm:block" />
					Specify a product to generate the same item multiple times!
				</p>
			</section>

			<section className="card-neutral">
				<BrandInput onSubmit={handleStart} />
			</section>

			{loading && (
				<section className="text-center">
					<div className="text-sm text-gray-600">Rendering your dumb goodies...</div>
				</section>
			)}

			{concepts.length > 0 && (
				<section className="grid gap-6">
					{concepts.map((c) => (
						<IdeaCard
							key={c.id}
							projectId={projectId ?? ""}
							conceptId={c.id}
							label={c.label}
							results={resultsByConcept[c.id]}
						/>
					))}
				</section>
			)}

			{!loading && concepts.length === 0 && (
				<section className="grid gap-6 sm:gap-8 sm:grid-cols-2 mt-2 sm:mt-4">
					<div className="card-neutral">
						<h3 className="font-medium text-gray-900">AI Competition</h3>
						<p className="text-sm text-gray-600 mt-1">Compare Seedream 4.0 vs OpenAI gpt-image-1 side-by-side for each concept.</p>
					</div>
					<div className="card-neutral">
						<h3 className="font-medium text-gray-900">Smart Placement</h3>
						<p className="text-sm text-gray-600 mt-1">Logos are intelligently placed with proper perspective and realistic materials.</p>
					</div>
				</section>
			)}
		</div>
	);
}
