"use client";

import { useState } from "react";

type Props = {
	projectId: string;
	conceptId: string;
	model: "v1-seedream" | "v1_5-openai";
	imageUrl: string;
	thumbnailUrl?: string;
};

export function RenderCard({ projectId, conceptId, model, imageUrl, thumbnailUrl }: Props) {
	const [saving, setSaving] = useState(false);
	const [savedId, setSavedId] = useState<string | null>(null);

	async function onSave() {
		try {
			setSaving(true);
			const res = await fetch("/api/save", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ projectId, conceptId, model, imageUrl, thumbnailUrl }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Save failed");
			setSavedId(data.renderId);
		} catch (e) {
			console.error(e);
			alert("Failed to save render");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="rounded-lg border p-3 flex flex-col gap-2">
			<div className="text-xs text-gray-600">{model === "v1-seedream" ? "v1 Seedream" : "v1.5 OpenAI"}</div>
			<a href={imageUrl} target="_blank" rel="noreferrer" className="block">
				<img src={thumbnailUrl ?? imageUrl} alt={model} className="w-full h-auto rounded-md bg-gray-50" />
			</a>
			<div className="flex items-center gap-2">
				<a
					href={imageUrl}
					download
					className="px-3 py-1.5 text-sm rounded-md bg-gray-900 text-white hover:bg-black"
				>
					Download
				</a>
				<button
					onClick={onSave}
					disabled={saving || !!savedId}
					className="px-3 py-1.5 text-sm rounded-md border hover:bg-gray-50 disabled:opacity-60"
				>
					{savedId ? "Saved" : saving ? "Saving..." : "Save"}
				</button>
			</div>
		</div>
	);
} 