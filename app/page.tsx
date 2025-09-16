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
		<div className="font-sans min-h-screen p-6 sm:p-10 max-w-5xl mx-auto flex flex-col gap-8">
			<section className="pt-8 sm:pt-16 pb-2 sm:pb-4 text-center">
				<h1 className="text-4xl sm:text-6xl font-bold tracking-tight">DumbGoodies</h1>
				<p className="mt-3 text-sm sm:text-base opacity-80">Generate dumb merch images from your logo or brand name with AI competition mode.</p>
			</section>

			<section className="card-neutral">
				<BrandInput onSubmit={handleStart} />
			</section>

			{loading && (
				<section className="text-center">
					<div className="text-sm opacity-70">Rendering your dumb goodies...</div>
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
						<h3 className="font-medium">AI Competition</h3>
						<p className="text-sm opacity-80 mt-1">Compare Seedream 4.0 vs OpenAI gpt-image-1 side-by-side for each concept.</p>
					</div>
					<div className="card-neutral">
						<h3 className="font-medium">Smart Placement</h3>
						<p className="text-sm opacity-80 mt-1">Logos are intelligently placed with proper perspective and realistic materials.</p>
					</div>
				</section>
			)}
		</div>
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
