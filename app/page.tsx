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
		setLoading(true);
		try {
			let logoUrl: string | undefined;
			let productRefUrl: string | undefined;
			if (params.logoFile) {
				logoUrl = await uploadFile(params.logoFile);
			}
			if (params.productRefFile) {
				productRefUrl = await uploadFile(params.productRefFile);
			}

			// Propose exactly two concepts if no product guidance
			let conceptsLocal: Array<{ id: string; label: string; prompt_base: string }> = [];
			let createdProjectId: string;
			if (!params.productHint && !productRefUrl) {
				const res = await fetch("/api/propose", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ brand: params.brand, logoUrl }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error((data as { error?: string }).error || "Propose failed");
				conceptsLocal = (data as { concepts: { id: string; label: string; prompt_base: string }[] }).concepts;
				createdProjectId = res.headers.get("x-project-id") || crypto.randomUUID();
			} else {
				// Create a project and a single concept for the guided product
				createdProjectId = crypto.randomUUID();
				conceptsLocal = [
					{
						id: crypto.randomUUID(),
						label: params.productHint ? `User Product: ${params.productHint}` : "User Product",
						prompt_base: params.productHint || "clean studio product shot, 1:1",
					},
				];
			}

			setProjectId(createdProjectId);
			setConcepts(conceptsLocal);

			// Render competition for each concept
			const entries = await Promise.all(
				conceptsLocal.map(async (c) => {
					const res = await fetch("/api/render", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							projectId: createdProjectId,
							conceptId: c.id,
							brand: params.brand,
							logoUrl,
							productRefUrl,
							promptBase: c.prompt_base,
						}),
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
		<main className="max-w-5xl mx-auto px-4 py-8">
			<h1 className="text-2xl font-semibold mb-4">DumbGoodies — Competition</h1>
			<div className="rounded-xl border p-4 mb-6">
				<BrandInput onSubmit={handleStart} />
			</div>
			{loading && <div className="text-sm text-gray-600">Rendering...</div>}
			<div className="grid grid-cols-1 gap-6">
				{concepts.map((c) => (
					<IdeaCard
						key={c.id}
						projectId={projectId ?? ""}
						conceptId={c.id}
						label={c.label}
						results={resultsByConcept[c.id]}
					/>
				))}
			</div>
		</main>
	);
}

async function uploadFile(file: File): Promise<string> {
	const fd = new FormData();
	fd.append("file", file);
	const res = await fetch("/api/upload", { method: "POST", body: fd });
	const data = await res.json();
	if (!res.ok) throw new Error((data as { error?: string }).error || "Upload failed");
	return (data as { url: string }).url;
}
