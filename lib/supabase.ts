import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

export const supabaseAnon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
	auth: { persistSession: false },
});

export const supabaseAdmin = createClient(
	SUPABASE_URL!,
	(SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY)!,
	{ auth: { persistSession: false } }
);

export function publicStorageUrl(bucket: string, path: string): string {
	const encodedPath = encodeURI(path);
	return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

export async function uploadBufferToStorage(params: {
	bucket: string;
	path: string;
	data: Buffer;
	contentType: string;
}): Promise<string> {
	const { error } = await supabaseAdmin.storage
		.from(params.bucket)
		.upload(params.path, params.data, {
			contentType: params.contentType,
			upsert: true,
		});
	if (error) throw error;
	return publicStorageUrl(params.bucket, params.path);
} 