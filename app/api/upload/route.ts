import { NextRequest } from "next/server";
import { toPng } from "@/lib/images";
import { uploadBufferToStorage } from "@/lib/supabase";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		const contentType = req.headers.get("content-type") || "";
		if (!contentType.includes("multipart/form-data")) {
			return new Response(JSON.stringify({ error: "Expected multipart/form-data" }), { status: 400 });
		}
		const formData = await req.formData();
		const file = formData.get("file");
		if (!file || !(file instanceof File)) {
			return new Response(JSON.stringify({ error: "Missing file" }), { status: 400 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const inputBuffer = Buffer.from(arrayBuffer);
		const pngBuffer = await toPng(inputBuffer);

		const id = crypto.randomUUID();
		const path = `${new Date().toISOString().slice(0, 10)}/${id}.png`;
		const url = await uploadBufferToStorage({
			bucket: "uploads",
			path,
			data: pngBuffer,
			contentType: "image/png",
		});

		return new Response(JSON.stringify({ url }), { status: 200, headers: { "content-type": "application/json" } });
	} catch (err: any) {
		console.error("/api/upload error", err);
		return new Response(JSON.stringify({ error: err?.message ?? "Upload failed" }), { status: 500 });
	}
} 