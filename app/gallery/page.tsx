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
				<h1 className="text-4xl sm:text-6xl font-bold tracking-tight">Gallery</h1>
				<p className="mt-3 text-sm sm:text-base opacity-80">Public collection of generated dumb goodies from the community.</p>
			</section>

			<section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
				{renders.map((r) => (
					<a key={r.id} href={r.image_url} target="_blank" className="block group">
						<div className="rounded-lg border border-black/10 dark:border-white/10 p-2 bg-white dark:bg-black/20 hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
							<img src={r.thumbnail_url ?? r.image_url} alt={r.model} className="w-full h-auto rounded-md bg-gray-50 dark:bg-gray-800" />
							<div className="mt-2 text-xs opacity-70 font-medium">{r.model}</div>
						</div>
					</a>
				))}
			</section>

			{renders.length === 0 && (
				<section className="text-center py-16">
					<div className="text-sm opacity-70">No renders yet. Be the first to create some dumb goodies!</div>
				</section>
			)}
		</div>
	);
} 