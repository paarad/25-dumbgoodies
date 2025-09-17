// app/api/render-more/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generatePNG } from "@/lib/openai";
import { buildProductPrompt } from "@/lib/prompts";
import { createThumbnail, toPng } from "@/lib/images";
import { BUCKET_RENDERS, BUCKET_THUMBS, uploadBufferToStorage } from "@/lib/supabase";

export const runtime = "nodejs";

function validateBrand(brand: string): string {
  const cleaned = brand
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[^\w\s\-\.]/g, '')
    .trim()
    .slice(0, 24);
  
  if (cleaned.length === 0) throw new Error("Invalid brand name");
  if (/^https?:\/\//.test(cleaned)) throw new Error("Brand cannot be a URL");
  
  return cleaned;
}

export async function POST(req: NextRequest) {
  const { brand, product } = await req.json();

  if (!brand || typeof brand !== "string") {
    return NextResponse.json({ error: "brand_required" }, { status: 400 });
  }

  if (!product || typeof product !== "string") {
    return NextResponse.json({ error: "product_required" }, { status: 400 });
  }

  // Validate and clean brand name
  let cleanBrand: string;
  try {
    cleanBrand = validateBrand(brand);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  try {
    // Generate one more variant of the specified product
    const prompt = buildProductPrompt(cleanBrand, product);
    const imageB64 = await generatePNG({ prompt, brand: cleanBrand });
    
    // Convert to buffer and upload
    const buffer = Buffer.from(imageB64, "base64");
    const png = await toPng(buffer);
    const thumb = await createThumbnail(png, 512);
    const basePath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${product.replace(/\s+/g, '-')}-more`;
    const imageUrl = await uploadBufferToStorage({ bucket: BUCKET_RENDERS, path: `${basePath}.png`, data: png, contentType: "image/png" });
    const thumbnailUrl = await uploadBufferToStorage({ bucket: BUCKET_THUMBS, path: `${basePath}_512.png`, data: thumb, contentType: "image/png" });
    
    return NextResponse.json({ 
      product, 
      image: { model: "v1_5-openai", imageUrl, thumbnailUrl }
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message ?? "render_error" }, { status: 500 });
  }
} 