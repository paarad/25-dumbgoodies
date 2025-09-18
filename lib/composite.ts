import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Use Node.js Canvas to composite logo onto base image (no Sharp needed!)
async function compositeLogoOnBase(baseBuffer: Buffer, logoBuffer: Buffer): Promise<Buffer> {
  try {
    // Dynamic import of canvas to avoid startup issues
    const { createCanvas, loadImage } = await import('canvas');
    
    // Load both images
    const baseImage = await loadImage(baseBuffer);
    const logoImage = await loadImage(logoBuffer);
    
    // Create canvas with base image size
    const canvas = createCanvas(baseImage.width, baseImage.height);
    const ctx = canvas.getContext('2d');
    
    // Draw base product image
    ctx.drawImage(baseImage, 0, 0);
    
    // Calculate logo position (center area)
    const logoWidth = Math.min(logoImage.width, baseImage.width * 0.4);
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
    const x = (baseImage.width - logoWidth) / 2;
    const y = baseImage.height * 0.4; // Center-ish area
    
    // Draw logo with some transparency
    ctx.globalAlpha = 0.8;
    ctx.drawImage(logoImage, x, y, logoWidth, logoHeight);
    
    console.log("[compositeLogoOnBase] Composited logo onto base image using Canvas");
    
    // Return as PNG buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.log("[compositeLogoOnBase] Canvas failed, falling back to simple approach:", error);
    // Fallback: just return the base image
    return baseBuffer;
  }
}

// Create a simple center mask for DALL-E edit
function createCenterMask(): Buffer {
  const maskSvg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="black"/>
    <rect x="256" y="384" width="512" height="256" fill="white"/>
  </svg>`;
  
  return Buffer.from(maskSvg, 'utf8');
}

// Proper logo integration using Canvas compositing + DALL-E refinement
export async function integrateLogo({ 
  baseImageUrl, 
  logoUrl, 
  product 
}: {
  baseImageUrl: string; 
  logoUrl: string; 
  product: string;
}) {
  console.log("[integrateLogo] Using Canvas-based logo compositing");
  
  // Download base product image
  const baseResponse = await fetch(baseImageUrl);
  if (!baseResponse.ok) throw new Error("Failed to download base image");
  const baseBuffer = Buffer.from(await baseResponse.arrayBuffer());
  
  // Download logo image
  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok) throw new Error("Failed to download logo");
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
  
  console.log("[integrateLogo] Downloaded images, compositing with Canvas");
  
  // Use Canvas to composite logo onto base image
  const compositeBuffer = await compositeLogoOnBase(baseBuffer, logoBuffer);
  
  // Create simple mask for refinement
  const maskBuffer = createCenterMask();
  
  // Use DALL-E edit to refine the integration
  const prompt = `Refine and improve the logo integration on this ${product}.
Make the logo look more realistic and naturally applied to the product surface.
Enhance perspective, lighting, and material response.
Keep the logo clearly visible and well-integrated.
Maintain transparent background. Product only.`;

  console.log("[integrateLogo] Using DALL-E edit to refine the integration");
  
  try {
    // Convert to File objects for the API
    const imageFile = new File([new Uint8Array(compositeBuffer)], "composite.png", { type: "image/png" });
    const maskFile = new File([new Uint8Array(maskBuffer)], "mask.svg", { type: "image/svg+xml" });

    const res = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      mask: maskFile,
      prompt,
      output_format: "png",
    });
    
    const result = res.data?.[0]?.b64_json;
    if (!result) throw new Error("Failed to get image data from DALL-E edit");
    
    console.log("[integrateLogo] Logo integration refined with DALL-E edit");
    return result;
  } catch (error) {
    console.log("[integrateLogo] DALL-E edit failed, returning Canvas composite:", error);
    // Fallback: return the Canvas composite as base64
    return compositeBuffer.toString('base64');
  }
} 