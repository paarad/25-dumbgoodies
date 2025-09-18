import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// NUCLEAR OPTION: Remove all Sharp dependencies
// Just download the logo and use DALL-E edit directly with simple masking
export async function integrateLogo({ 
  baseImageUrl, 
  logoUrl, 
  product 
}: {
  baseImageUrl: string; 
  logoUrl: string; 
  product: string;
}) {
  console.log("[integrateLogo] SHARP-FREE integration starting");
  
  // Download base image
  const baseResponse = await fetch(baseImageUrl);
  if (!baseResponse.ok) throw new Error("Failed to download base image");
  const baseBuffer = Buffer.from(await baseResponse.arrayBuffer());
  
  // Download logo
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("Failed to download logo");
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
  
  console.log("[integrateLogo] Downloaded base and logo, sizes:", baseBuffer.length, logoBuffer.length);
  
  // Create simple prompt for DALL-E to integrate the logo
  const prompt = `Add the uploaded logo to the center-front of this ${product}. 
Integrate it realistically with proper perspective, lighting, and material response.
Keep the logo proportions and make it look naturally applied (printed/embossed/embroidered as appropriate).
Maintain transparent background. Product only, no environment.`;

  console.log("[integrateLogo] Using DALL-E edit with prompt:", prompt);
  
  // Convert buffers to File objects for the API
  const imageFile = new File([new Uint8Array(baseBuffer)], "base.png", { type: "image/png" });
  const maskFile = new File([new Uint8Array(logoBuffer)], "logo.png", { type: "image/png" });

  const res = await openai.images.edit({
    model: "gpt-image-1",
    image: imageFile,
    mask: maskFile, // Use logo as mask - DALL-E will figure it out
    prompt,
    output_format: "png",
  });
  
  const result = res.data?.[0]?.b64_json;
  if (!result) throw new Error("Failed to get image data from DALL-E edit");
  
  console.log("[integrateLogo] DALL-E integration complete");
  return result;
} 