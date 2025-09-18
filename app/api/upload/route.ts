import { NextRequest } from "next/server";
import { BUCKET_UPLOADS, uploadBufferToStorage } from "@/lib/supabase";
import crypto from "node:crypto";

export const runtime = "nodejs";

// Debug endpoint to verify route is working - v2
export async function GET() {
	return new Response(JSON.stringify({ status: "Upload endpoint is working", method: "GET", version: "v2-with-detailed-logging" }), { 
		status: 200, 
		headers: { "content-type": "application/json" } 
	});
}

export async function POST(req: NextRequest) {
	try {
		console.log("[Upload] ===== UPLOAD REQUEST STARTED v2 =====");
		console.log("[Upload] Method:", req.method);
		console.log("[Upload] URL:", req.url);
		console.log("[Upload] Headers:", Object.fromEntries(req.headers.entries()));
		console.log("[Upload] Timestamp:", new Date().toISOString());
		
		const contentType = req.headers.get("content-type") || "";
		console.log("[Upload] Content-Type:", contentType);
		
		if (!contentType.includes("multipart/form-data")) {
			console.log("[Upload] ERROR: Invalid content type:", contentType);
			return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), { 
				status: 400,
				headers: { "content-type": "application/json" }
			});
		}
		
		console.log("[Upload] Parsing form data...");
		const formData = await req.formData();
		console.log("[Upload] Form data keys:", Array.from(formData.keys()));
		
		const file = formData.get("file");
		console.log("[Upload] File object:", file);
		console.log("[Upload] File instanceof File:", file instanceof File);
		
		if (!file || !(file instanceof File)) {
			console.log("[Upload] ERROR: Missing or invalid file");
			return new Response(JSON.stringify({ error: "Missing file" }), { 
				status: 400,
				headers: { "content-type": "application/json" }
			});
		}

		console.log("[Upload] File details:");
		console.log("  - Name:", file.name);
		console.log("  - Type:", file.type);
		console.log("  - Size:", file.size, "bytes");
		
		const arrayBuffer = await file.arrayBuffer();
		const inputBuffer = Buffer.from(arrayBuffer);
		console.log("[Upload] Created buffer, size:", inputBuffer.length, "bytes");
		
		// NUCLEAR OPTION: Skip all Sharp processing, just use original buffer
		console.log("[Upload] SHARP-FREE: Using original buffer directly");
		const finalBuffer = inputBuffer;

		const id = crypto.randomUUID();
		const fileExt = file.type === "image/svg+xml" ? "svg" : "png";
		const path = `${new Date().toISOString().slice(0, 10)}/${id}.${fileExt}`;
		
		console.log("[Upload] Uploading to Supabase:", path, "Type:", file.type);
		const url = await uploadBufferToStorage({
			bucket: BUCKET_UPLOADS,
			path,
			data: finalBuffer,
			contentType: file.type || "image/png",
		});

		console.log("[Upload] Upload successful:", url);
		console.log("[Upload] ===== UPLOAD REQUEST COMPLETE =====");
		
		return new Response(JSON.stringify({ url }), { 
			status: 200, 
			headers: { "content-type": "application/json" } 
		});
	} catch (err) {
		console.error("[Upload] ===== UPLOAD ERROR =====");
		console.error("[Upload] Error details:", err);
		console.error("[Upload] Error message:", err instanceof Error ? err.message : "Unknown error");
		console.error("[Upload] Error stack:", err instanceof Error ? err.stack : "No stack trace");
		console.error("[Upload] ===== END ERROR =====");
		
		const errorMessage = err instanceof Error ? err.message : "Upload failed";
		return new Response(JSON.stringify({ 
			error: errorMessage,
			details: err instanceof Error ? err.stack : "Unknown error"
		}), { 
			status: 500, 
			headers: { "content-type": "application/json" } 
		});
	}
} 