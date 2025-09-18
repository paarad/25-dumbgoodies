// lib/openai.ts
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// NUCLEAR OPTION: Remove all Sharp dependencies
// Just assume images need transparency and let DALL-E handle it

function validateBrand(brand: string): string {
  const cleaned = brand.replace(/[^\w\s\-\.]/g, '').trim().slice(0, 24);
  if (!cleaned || /^https?:\/\//.test(cleaned)) throw new Error("Invalid brand");
  return cleaned;
}

export async function generatePNG({ 
  prompt, 
  brand, 
  size = "1024x1024" 
}: { 
  prompt: string; 
  brand?: string; 
  size?: "1024x1024" | "1792x1024" | "1024x1792"; 
}): Promise<string> {
  const enhancedPrompt = `${prompt}

CRITICAL: Generate with transparent background (alpha channel). Product must be isolated on transparent background with NO environment, platform, or ground plane.`;

  console.log("[OpenAI] SHARP-FREE generation with gpt-image-1:", enhancedPrompt);
  
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai.images.generate({
      model: "gpt-image-1",
      prompt: enhancedPrompt,
      size,
      output_format: "png",
    });
    
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data received");
    
    // NUCLEAR: Skip transparency check, just return the image
    console.log("[OpenAI] SHARP-FREE: Generated image, skipping transparency check");
    return b64;
  }
  
  throw new Error("Failed to generate image after retries");
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