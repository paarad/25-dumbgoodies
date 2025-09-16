"use client";

import { RenderCard } from "./RenderCard";

type Props = {
	projectId: string;
	conceptId: string;
	label: string;
	results?: Array<{
		model: "v1-seedream" | "v1_5-openai";
		imageUrl: string;
		thumbnailUrl?: string;
	}>;
};

export function IdeaCard({ projectId, conceptId, label, results }: Props) {
	return (
		<div className="card-neutral">
			<div className="mb-4 font-medium">{label}</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{results?.map((r) => (
					<RenderCard
						key={r.model}
						projectId={projectId}
						conceptId={conceptId}
						model={r.model}
						imageUrl={r.imageUrl}
						thumbnailUrl={r.thumbnailUrl}
					/>
				))}
			</div>
		</div>
	);
} 