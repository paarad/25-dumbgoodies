// lib/openai.ts
import OpenAI from "openai";
import sharp from "sharp";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function hasAlphaChannel(imageBuffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return metadata.hasAlpha === true;
  } catch {
    return false;
  }
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

export async function generatePNG({
  prompt,
  size = "1024x1024",
  brand,
}: {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  brand?: string;
}) {
  let enhancedPrompt = prompt;
  
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai.images.generate({
      model: "gpt-image-1",        // Current Images API model
      prompt: enhancedPrompt,
      size,
      output_format: "png",        // PNG for alpha channel support
      // NO response_format here - images.generate already returns b64_json
      // optional if SDK supports it:
      // background: "transparent",
    });
    
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI generation returned empty response");
    
    // Quick sanity check for transparency on first attempt
    if (attempt === 0) {
      const buffer = Buffer.from(b64, "base64");
      const hasAlpha = await hasAlphaChannel(buffer);
      
      if (!hasAlpha) {
        console.log("[OpenAI] First attempt lacks transparency, retrying with stricter prompt...");
        enhancedPrompt = prompt + "\nTransparent background only. No floor, no platform, no shadow, product cutout.";
        if (brand) {
          enhancedPrompt += `\nNo additional text or labels besides "${brand}".`;
        }
        continue;
      }
    }
    
    return b64;
  }
  
  throw new Error("Failed to generate image with transparency after 2 attempts");
}

// Legacy compatibility - will be replaced
export async function generateBaseImage(prompt: string, brand?: string): Promise<{ imageBuffer: Buffer; mimeType: string }> {
  // Clean the prompt by removing environment/background descriptions
  const cleanPrompt = prompt
    .replace(/,?\s*[^,]*\s*(background|setting|environment|vibes)[^,]*/gi, '')
    .replace(/,?\s*(on a|with a|in a|at a|beach|home|gym|office)[^,]*/gi, '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part && !/(background|setting|environment|vibes|beach|home|gym|office)/i.test(part))
    .join(', ')
    .trim();

  let enhancedPrompt: string;

  if (brand) {
    enhancedPrompt = `Single, isolated ${cleanPrompt}. Photorealistic studio packshot, centered. Apply the "${brand}" logo once, following surface curvature and perspective; preserve aspect ratio and legibility; realistic material/lighting. Transparent background (alpha). No environment, no platform, no ground plane, no reflections, no duplicate objects, no hands/people, no extra text, no patterns, no watermarks. Product only.`;
  } else {
    enhancedPrompt = `Single, isolated ${cleanPrompt}. Photorealistic studio packshot, centered. Transparent background (alpha). No environment, no platform, no ground plane, no reflections, no duplicate objects, no hands/people, no extra text, no patterns, no watermarks. Product only.`;
  }

  console.log("[OpenAI] Generating base image with gpt-image-1:", enhancedPrompt);

  const b64 = await generatePNG({ prompt: enhancedPrompt });
  return { imageBuffer: Buffer.from(b64, "base64"), mimeType: "image/png" };
} 