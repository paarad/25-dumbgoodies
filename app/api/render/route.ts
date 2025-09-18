// app/api/render/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generatePNG } from "@/lib/openai";
import { buildProductPrompt } from "@/lib/prompts";
import { getTwoDumbIdeas } from "@/lib/ideas";
import { BUCKET_RENDERS, BUCKET_THUMBS, uploadBufferToStorage } from "@/lib/supabase";

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
  console.log(`[generateWithLogo] Canvas-based logo integration for ${product}`);
  
  // Step 1: Generate clean product (no branding) - needed for Canvas compositing
  const cleanPrompt = buildProductPrompt(brand, product, undefined, true); // hasLogoFile = true
  console.log(`[generateWithLogo] Clean prompt:`, cleanPrompt);
  const baseImageB64 = await generatePNG({ prompt: cleanPrompt }); 
  console.log(`[generateWithLogo] Generated clean product image`);
  
  // Step 2: Upload base image to get URL (needed for Canvas approach)
  const baseBuffer = Buffer.from(baseImageB64, "base64");
  const basePath = `temp/${Date.now()}-base.png`;
  const baseImageUrl = await uploadBufferToStorage({
    bucket: BUCKET_RENDERS,
    path: basePath,
    data: baseBuffer,
    contentType: "image/png"
  });
  console.log(`[generateWithLogo] Uploaded base image:`, baseImageUrl);
  
  // Step 3: Use Canvas to composite logo, then DALL-E to refine
  console.log(`[generateWithLogo] Integrating logo using Canvas + DALL-E`);
  const { integrateLogo } = await import("@/lib/composite");
  const integratedB64 = await integrateLogo({ 
    baseImageUrl, 
    logoUrl, 
    product 
  });
  console.log(`[generateWithLogo] Logo integration complete`);
  
  return integratedB64;
}

async function generateWithLogoOnProductRef(brand: string, productRefUrl: string, logoUrl: string) {
  console.log(`[generateWithLogoOnProductRef] SHARP-FREE logo integration on product ref for ${brand}`);
  
  // Step 1: Use the product reference image directly (already uploaded)
  console.log("[generateWithLogoOnProductRef] Using product reference:", productRefUrl);
  
  // Step 2: Integrate logo using DALL-E edit (NO SHARP!)
  console.log("[generateWithLogoOnProductRef] Integrating logo using DALL-E edit");
  const { integrateLogo } = await import("@/lib/composite");
  const integratedB64 = await integrateLogo({ 
    baseImageUrl: productRefUrl, 
    logoUrl, 
    product: "uploaded product" 
  });
  console.log("[generateWithLogoOnProductRef] Logo integration complete");
  
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
          const { toPng, createThumbnail } = await import("@/lib/images");
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
        const { toPng, createThumbnail } = await import("@/lib/images");
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
      const { toPng, createThumbnail } = await import("@/lib/images");
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