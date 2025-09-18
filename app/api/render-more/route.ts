// app/api/render-more/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generatePNG } from "@/lib/openai";
import { buildProductPrompt } from "@/lib/prompts";
import { createThumbnail, toPng } from "@/lib/images";
import { BUCKET_RENDERS, BUCKET_THUMBS, uploadBufferToStorage } from "@/lib/supabase";
import { integrateLogo } from "@/lib/composite";

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

async function generateWithLogo(brand: string, product: string, logoUrl: string) {
  console.log(`[render-more] Canvas-based logo integration for ${product}`);
  
  // Step 1: Generate clean product (no branding) - needed for Canvas compositing
  const cleanPrompt = buildProductPrompt(brand, product, undefined, true); // hasLogoFile = true
  const baseImageB64 = await generatePNG({ prompt: cleanPrompt, brand });
  console.log(`[render-more] Generated clean product image`);
  
  // Step 2: Upload base image to get URL (needed for Canvas approach)
  const baseBuffer = Buffer.from(baseImageB64, "base64");
  const basePath = `temp/${Date.now()}-base.png`;
  const baseImageUrl = await uploadBufferToStorage({
    bucket: BUCKET_RENDERS,
    path: basePath,
    data: baseBuffer,
    contentType: "image/png"
  });
  console.log(`[render-more] Uploaded base image:`, baseImageUrl);
  
  // Step 3: Use Canvas to composite logo, then DALL-E to refine
  console.log(`[render-more] Integrating logo using Canvas + DALL-E`);
  const integratedB64 = await integrateLogo({ 
    baseImageUrl, 
    logoUrl, 
    product 
  });
  console.log(`[render-more] Logo integration complete`);
  
  return integratedB64;
}

export async function POST(req: NextRequest) {
  const { brand, product, logoUrl } = await req.json();

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
    let imageB64: string;
    
    if (logoUrl && typeof logoUrl === "string") {
      // Use logo integration pipeline
      imageB64 = await generateWithLogo(cleanBrand, product, logoUrl);
    } else {
      // Use text-based branding (existing flow)
      const prompt = buildProductPrompt(cleanBrand, product);
      imageB64 = await generatePNG({ prompt, brand: cleanBrand });
    }
    
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