import { NextRequest, NextResponse } from "next/server";

const badWords = ["nazi", "hitler", "rape", "slur"]; // minimal demo filter
const memoryCounters = new Map<string, { count: number; ts: number }>();

export function middleware(req: NextRequest) {
	const url = new URL(req.url);
	if (url.pathname.startsWith("/api/")) {
		const hdrIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
		const ip = hdrIp || "anon";
		const now = Date.now();
		const key = `${ip}:${new Date().toISOString().slice(0, 16)}`; // minute bucket
		const entry = memoryCounters.get(key) ?? { count: 0, ts: now };
		if (now - entry.ts > 60 * 1000) {
			entry.count = 0;
			entry.ts = now;
		}
		entry.count += 1;
		memoryCounters.set(key, entry);
		if (entry.count > 10) {
			return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
		}

		if (url.pathname.endsWith("/propose")) {
			// best-effort word filter
			try {
				const brand = url.searchParams.get("brand") ?? "";
				const bad = badWords.some((w) => brand.toLowerCase().includes(w));
				if (bad) return NextResponse.json({ error: "Brand not allowed" }, { status: 400 });
			} catch {}
		}
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/api/:path*"],
}; 