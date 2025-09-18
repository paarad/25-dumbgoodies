// app/api/render/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generatePNG } from "@/lib/openai";
import { buildProductPrompt } from "@/lib/prompts";
import { getTwoDumbIdeas } from "@/lib/ideas";
import { createThumbnail, toPng } from "@/lib/images";
import { BUCKET_RENDERS, BUCKET_THUMBS, uploadBufferToStorage } from "@/lib/supabase";
import { makeGuideAndMask, integrateLogo } from "@/lib/composite";

export const runtime = "nodejs";

// Simple rate limiting (in-memory, per IP)
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 10) { // 10 renders per minute
    return false;
  }
  
  limit.count++;
  return true;
}

function validateBrand(brand: string): string {
  // Strip newlines/emojis, limit length, reject URLs
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
  console.log(`[generateWithLogo] Starting logo integration for ${product}`);
  
  // Step 1: Generate clean product (no branding)
  const cleanPrompt = buildProductPrompt(brand, product, undefined, true); // hasLogoFile = true
  console.log(`[generateWithLogo] Clean prompt:`, cleanPrompt);
  const baseImageB64 = await generatePNG({ prompt: cleanPrompt }); // No brand for clean product
  const baseBuffer = Buffer.from(baseImageB64, "base64");
  console.log(`[generateWithLogo] Generated clean product image`);
  
  // Step 2: Download logo
  console.log(`[generateWithLogo] Downloading logo from:`, logoUrl);
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("Failed to download logo");
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
  console.log(`[generateWithLogo] Downloaded logo, size:`, logoBuffer.length, 'bytes');
  
  // Step 3: Create guide and mask
  console.log(`[generateWithLogo] Creating guide and mask`);
  const { guide, mask } = await makeGuideAndMask(baseBuffer, logoBuffer);
  console.log(`[generateWithLogo] Created guide and mask`);
  
  // Step 4: Integrate logo using DALL-E edit
  console.log(`[generateWithLogo] Integrating logo using DALL-E edit`);
  const integratedB64 = await integrateLogo({ guide, mask, product });
  console.log(`[generateWithLogo] Logo integration complete`);
  
  return integratedB64;
}

async function generateWithLogoOnProductRef(brand: string, productRefUrl: string, logoUrl: string) {
  // Step 1: Download the product reference image
  const productResponse = await fetch(productRefUrl);
  if (!productResponse.ok) throw new Error("Failed to download product reference");
  const productBuffer = Buffer.from(await productResponse.arrayBuffer());
  
  // Step 2: Download logo
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("Failed to download logo");
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
  
  // Step 3: Create guide and mask using the actual product image as base
  const { guide, mask } = await makeGuideAndMask(productBuffer, logoBuffer);
  
  // Step 4: Integrate logo using DALL-E edit on the actual product
  const integratedB64 = await integrateLogo({ guide, mask, product: "uploaded product" });
  
  return integratedB64;
}

export async function POST(req: NextRequest) {
  const { brand, product, variants = 2, logoUrl, productRefUrl } = await req.json();

  if (!brand || typeof brand !== "string") {
    return NextResponse.json({ error: "brand_required" }, { status: 400 });
  }

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  // Validate and clean brand name
  let cleanBrand: string;
  try {
    cleanBrand = validateBrand(brand);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid brand name";
    return NextResponse.json({ error: message }, { status: 400 });
  }

      try {
      // Case A: productRefUrl provided -> use uploaded product image with logo integration
      if (productRefUrl && typeof productRefUrl === "string" && logoUrl && typeof logoUrl === "string") {
        const imagePromises = Array.from({ length: Math.max(1, Math.min(variants, 4)) })
          .map(() => generateWithLogoOnProductRef(cleanBrand, productRefUrl, logoUrl));
        const images = await Promise.all(imagePromises);
        
        // Convert to buffers and upload
        const results = [];
        for (let i = 0; i < images.length; i++) {
          const buffer = Buffer.from(images[i], "base64");
          const png = await toPng(buffer);
          const thumb = await createThumbnail(png, 512);
          const basePath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-uploaded-${i}`;
          const imageUrl = await uploadBufferToStorage({ bucket: BUCKET_RENDERS, path: `${basePath}.png`, data: png, contentType: "image/png" });
          const thumbnailUrl = await uploadBufferToStorage({ bucket: BUCKET_THUMBS, path: `${basePath}_512.png`, data: thumb, contentType: "image/png" });
          results.push({ model: "v1_5-openai", imageUrl, thumbnailUrl });
        }

        return NextResponse.json({ items: [{ product: "Custom Product", images: results }] });
      }
      
      // Case B: product name provided -> N variants of that product
      if (product && typeof product === "string") {
        let images: string[];
        
        if (logoUrl && typeof logoUrl === "string") {
          // Use logo integration pipeline
          const imagePromises = Array.from({ length: Math.max(1, Math.min(variants, 4)) })
            .map(() => generateWithLogo(cleanBrand, product, logoUrl));
          images = await Promise.all(imagePromises);
        } else {
          // Use text-based branding (existing flow)
          const prompts = Array.from({ length: Math.max(1, Math.min(variants, 4)) })
            .map(() => buildProductPrompt(cleanBrand, product));
          images = await Promise.all(prompts.map(p => generatePNG({ prompt: p, brand: cleanBrand })));
        }
      
      // Convert to buffers and upload
      const results = [];
      for (let i = 0; i < images.length; i++) {
        const buffer = Buffer.from(images[i], "base64");
        const png = await toPng(buffer);
        const thumb = await createThumbnail(png, 512);
        const basePath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${i}`;
        const imageUrl = await uploadBufferToStorage({ bucket: BUCKET_RENDERS, path: `${basePath}.png`, data: png, contentType: "image/png" });
        const thumbnailUrl = await uploadBufferToStorage({ bucket: BUCKET_THUMBS, path: `${basePath}_512.png`, data: thumb, contentType: "image/png" });
        results.push({ model: "dalle-3-direct", imageUrl, thumbnailUrl });
      }
      
      return NextResponse.json({ items: [{ product, images: results }] });
    }

                    // Case C: no product specified -> propose 2 dumb ideas, each with 1 image initially (2 images total)
      const ideas = await getTwoDumbIdeas(cleanBrand); // returns 2 strings
      const results = [];
      for (const idea of ideas) {
        let imageB64: string;
        
        if (logoUrl && typeof logoUrl === "string") {
          // Use logo integration pipeline
          console.log(`[Render] Using logo integration for ${idea} with logo:`, logoUrl);
          imageB64 = await generateWithLogo(cleanBrand, idea, logoUrl);
        } else {
          // Use text-based branding (existing flow)
          console.log(`[Render] Using text-based branding for ${idea} with brand:`, cleanBrand);
          const prompt = buildProductPrompt(cleanBrand, idea);
          imageB64 = await generatePNG({ prompt, brand: cleanBrand });
        }
      
      // Convert to buffer and upload
      const buffer = Buffer.from(imageB64, "base64");
      const png = await toPng(buffer);
      const thumb = await createThumbnail(png, 512);
      const basePath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${idea.replace(/\s+/g, '-')}-0`;
      const imageUrl = await uploadBufferToStorage({ bucket: BUCKET_RENDERS, path: `${basePath}.png`, data: png, contentType: "image/png" });
      const thumbnailUrl = await uploadBufferToStorage({ bucket: BUCKET_THUMBS, path: `${basePath}_512.png`, data: thumb, contentType: "image/png" });
      
      results.push({ 
        product: idea, 
        images: [{ model: "v1_5-openai", imageUrl, thumbnailUrl }]
      });
    }
    return NextResponse.json({ items: results });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "render_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 