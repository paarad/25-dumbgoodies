import { supabaseAnon } from "@/lib/supabase";

export const revalidate = 0;

async function fetchRenders() {
	const { data, error } = await supabaseAnon
		.from("renders")
		.select("id, image_url, thumbnail_url, model, created_at")
		.eq("public", true)
		.order("created_at", { ascending: false })
		.limit(60);
	if (error) throw error;
	return data ?? [];
}

export default async function GalleryPage() {
	const renders = await fetchRenders();
	return (
		<main className="max-w-6xl mx-auto px-4 py-8">
			<h1 className="text-2xl font-semibold mb-4">Gallery</h1>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
				{renders.map((r) => (
					<a key={r.id} href={r.image_url} target="_blank" className="block group">
						<img src={r.thumbnail_url ?? r.image_url} className="w-full h-auto rounded-md" />
						<div className="mt-1 text-xs text-gray-600">{r.model}</div>
					</a>
				))}
			</div>
		</main>
	);
} 