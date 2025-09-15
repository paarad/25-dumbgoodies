import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedAnon: SupabaseClient | null = null;
let cachedAdmin: SupabaseClient | null = null;

function ensureEnv() {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		throw new Error("supabaseUrl is required.");
	}
}

export function getSupabaseAnon(): SupabaseClient {
	if (!cachedAnon) {
		ensureEnv();
		cachedAnon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
			auth: { persistSession: false },
		});
	}
	return cachedAnon;
}

export function getSupabaseAdmin(): SupabaseClient {
	if (!cachedAdmin) {
		ensureEnv();
		const key = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY!;
		cachedAdmin = createClient(SUPABASE_URL!, key, { auth: { persistSession: false } });
	}
	return cachedAdmin;
}

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
	const { error } = await getSupabaseAdmin().storage
		.from(params.bucket)
		.upload(params.path, params.data, {
			contentType: params.contentType,
			upsert: true,
		});
	if (error) throw error;
	return publicStorageUrl(params.bucket, params.path);
} 