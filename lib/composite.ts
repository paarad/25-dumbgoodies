import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// SIMPLE APPROACH: Just regenerate the product with logo described in prompt
export async function integrateLogo({ 
  baseImageUrl, 
  logoUrl, 
  product 
}: {
  baseImageUrl: string; 
  logoUrl: string; 
  product: string;
}) {
  console.log("[integrateLogo] Using simple generation approach instead of edit");
  
  // Download logo to analyze it
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("Failed to download logo");
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
  
  // Detect if it's SVG and try to extract text content
  let logoDescription = "a logo";
  if (logoUrl.includes('.svg') || logoUrl.includes('svg')) {
    const logoText = logoBuffer.toString('utf8');
    // Try to extract text from SVG
    const textMatch = logoText.match(/>([^<]+)</g);
    if (textMatch) {
      const extractedText = textMatch
        .map(m => m.replace(/^>|<$/g, '').trim())
        .filter(t => t.length > 0 && !t.includes('xmlns') && !t.includes('svg'))
        .join(' ');
      if (extractedText.length > 0 && extractedText.length < 50) {
        logoDescription = `"${extractedText}" text logo`;
      }
    }
  }
  
  console.log("[integrateLogo] Detected logo description:", logoDescription);
  
  // Generate a new product image with the logo integrated
  const prompt = `Single, isolated ${product}. Photorealistic studio packshot, centered.
Add ${logoDescription} to the center-front area, integrated realistically with proper perspective and lighting.
Make the logo look naturally applied (printed/embossed/embroidered as appropriate for the product material).
Keep logo proportions readable and appropriately sized - not too large or too small.
Transparent background (alpha). No environment, no platform/ground plane, no reflections, no duplicate objects, no people/hands, no extra text, no patterns, no watermarks. Product only.`;

  console.log("[integrateLogo] Generating new product with integrated logo");
  
  const res = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    output_format: "png",
  });
  
  const result = res.data?.[0]?.b64_json;
  if (!result) throw new Error("Failed to get image data from DALL-E generation");
  
  console.log("[integrateLogo] Logo integration complete via generation");
  return result;
} 