import { NextRequest } from "next/server";
import { BUCKET_UPLOADS, uploadBufferToStorage } from "@/lib/supabase";
import crypto from "node:crypto";

export const runtime = "nodejs";

// Debug endpoint to verify route is working
export async function GET() {
	return new Response(JSON.stringify({ status: "Upload endpoint is working", method: "GET" }), { 
		status: 200, 
		headers: { "content-type": "application/json" } 
	});
}

export async function POST(req: NextRequest) {
	try {
		console.log("[Upload] Processing upload request...");
		
		const contentType = req.headers.get("content-type") || "";
		if (!contentType.includes("multipart/form-data")) {
			console.log("[Upload] Invalid content type:", contentType);
			return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), { status: 400 });
		}
		
		const formData = await req.formData();
		const file = formData.get("file");
		if (!file || !(file instanceof File)) {
			console.log("[Upload] Missing or invalid file");
			return new Response(JSON.stringify({ error: "Missing file" }), { status: 400 });
		}

		console.log("[Upload] File received:", file.name, file.type, file.size, "bytes");

		const arrayBuffer = await file.arrayBuffer();
		const inputBuffer = Buffer.from(arrayBuffer);
		
		console.log("[Upload] Using original image buffer (bypassing Sharp conversion for production stability)");
		const pngBuffer = inputBuffer; // Use original buffer directly
		console.log("[Upload] Buffer ready, size:", pngBuffer.length, "bytes");

		const id = crypto.randomUUID();
		const fileExt = file.type === "image/svg+xml" ? "svg" : "png";
		const path = `${new Date().toISOString().slice(0, 10)}/${id}.${fileExt}`;
		
		console.log("[Upload] Uploading to Supabase:", path, "Type:", file.type);
		const url = await uploadBufferToStorage({
			bucket: BUCKET_UPLOADS,
			path,
			data: pngBuffer,
			contentType: file.type || "image/png",
		});

		console.log("[Upload] Upload successful:", url);
		return new Response(JSON.stringify({ url }), { status: 200, headers: { "content-type": "application/json" } });
	} catch (err) {
		console.error("/api/upload error", err);
		const errorMessage = err instanceof Error ? err.message : "Upload failed";
		return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { "content-type": "application/json" } });
	}
} 