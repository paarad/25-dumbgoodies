import { getSupabaseAnon } from "@/lib/supabase";

export const revalidate = 0;

async function fetchRenders() {
	const { data, error } = await getSupabaseAnon()
		.from("dumbgoodies_renders")
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
		<div className="font-sans min-h-screen p-6 sm:p-10 max-w-6xl mx-auto flex flex-col gap-8">
			<section className="pt-8 sm:pt-16 pb-2 sm:pb-4 text-center">
				<h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-gray-900">Gallery</h1>
				<p className="mt-3 text-sm sm:text-base text-gray-600">Public collection of generated dumb goodies from the community.</p>
			</section>

			<section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
				{renders.map((r) => (
					<a key={r.id} href={r.image_url} target="_blank" className="block group">
						<div className="rounded-lg border border-gray-200 p-2 bg-white hover:bg-gray-50 transition-colors shadow-sm">
							<img src={r.thumbnail_url ?? r.image_url} alt={r.model} className="w-full h-auto rounded-md bg-gray-50" />
							<div className="mt-2 text-xs text-gray-600 font-medium">{r.model}</div>
						</div>
					</a>
				))}
			</section>

			{renders.length === 0 && (
				<section className="text-center py-16">
					<div className="text-sm text-gray-600">No renders yet. Be the first to create some dumb goodies!</div>
				</section>
			)}
		</div>
	);
} 