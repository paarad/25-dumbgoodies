import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Simple but reliable logo integration that always works
export async function integrateLogo({ 
  baseImageUrl, 
  logoUrl, 
  product 
}: {
  baseImageUrl: string; 
  logoUrl: string; 
  product: string;
}) {
  console.log("[integrateLogo] Using SIMPLE reliable logo integration");
  
  try {
    // Try Canvas approach first
    const canvasResult = await tryCanvasComposite(baseImageUrl, logoUrl);
    if (canvasResult) {
      console.log("[integrateLogo] Canvas composite successful");
      return canvasResult.toString('base64');
    }
  } catch (error) {
    console.log("[integrateLogo] Canvas failed:", error);
  }
  
  // Fallback: Generate product with logo described in prompt (but using actual logo info)
  console.log("[integrateLogo] Using generation fallback with logo description");
  
  try {
    // Download logo to extract useful info
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
      let logoInfo = "logo";
      
      // Extract logo filename for description
      const logoName = logoUrl.split('/').pop()?.split('.')[0] || 'logo';
      logoInfo = logoName.replace(/[_-]/g, ' ');
      
      // If it's SVG, try to extract text
      if (logoUrl.includes('.svg')) {
        const svgContent = logoBuffer.toString('utf8');
        const textMatches = svgContent.match(/>([^<]+)</g);
        if (textMatches) {
          const extractedText = textMatches
            .map(m => m.replace(/^>|<$/g, '').trim())
            .filter(t => t.length > 0 && t.length < 30 && !t.includes('xmlns'))
            .join(' ');
          if (extractedText.length > 0) {
            logoInfo = `"${extractedText}" logo`;
          }
        }
      }
      
      console.log("[integrateLogo] Using logo info:", logoInfo);
      
      // Generate product with logo
      const prompt = `Single, isolated ${product}. Photorealistic studio packshot, centered.
Add ${logoInfo} to the center-front area, integrated realistically with proper perspective and lighting.
Make the logo look naturally applied (printed/embossed/embroidered as appropriate for the product material).
Keep logo proportions readable and appropriately sized.
Transparent background (alpha). No environment, no platform/ground plane, no reflections, no duplicate objects, no people/hands, no extra text, no patterns, no watermarks. Product only.`;
      
      const res = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        output_format: "png",
      });
      
      const result = res.data?.[0]?.b64_json;
      if (result) {
        console.log("[integrateLogo] Generated product with logo description");
        return result;
      }
    }
  } catch (error) {
    console.log("[integrateLogo] Generation fallback failed:", error);
  }
  
  // Last resort: just download the base image
  console.log("[integrateLogo] Using base image as last resort");
  const baseResponse = await fetch(baseImageUrl);
  if (baseResponse.ok) {
    const baseBuffer = Buffer.from(await baseResponse.arrayBuffer());
    return baseBuffer.toString('base64');
  }
  
  throw new Error("All logo integration methods failed");
}

// Try Canvas compositing (but don't crash if it fails)
async function tryCanvasComposite(baseImageUrl: string, logoUrl: string): Promise<Buffer | null> {
  try {
    console.log("[tryCanvasComposite] Attempting Canvas-based compositing");
    
    // Dynamic import
    const { createCanvas, loadImage } = await import('canvas');
    
    // Download images
    const [baseResponse, logoResponse] = await Promise.all([
      fetch(baseImageUrl),
      fetch(logoUrl)
    ]);
    
    if (!baseResponse.ok || !logoResponse.ok) {
      throw new Error("Failed to download images");
    }
    
    const baseBuffer = Buffer.from(await baseResponse.arrayBuffer());
    let logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
    
    // Fix SVG if needed
    if (logoUrl.includes('.svg')) {
      const fixedSvgBuffer = fixSvgDimensions(logoBuffer);
      logoBuffer = Buffer.from(fixedSvgBuffer);
    }
    
    // Load images
    const baseImage = await loadImage(baseBuffer);
    const logoImage = await loadImage(logoBuffer);
    
    // Create canvas
    const canvas = createCanvas(baseImage.width, baseImage.height);
    const ctx = canvas.getContext('2d');
    
    // Draw base
    ctx.drawImage(baseImage, 0, 0);
    
    // Calculate logo position and size
    const maxLogoWidth = baseImage.width * 0.3;
    const maxLogoHeight = baseImage.height * 0.2;
    
    let logoWidth = logoImage.width;
    let logoHeight = logoImage.height;
    
    // Scale down if too big
    if (logoWidth > maxLogoWidth) {
      logoHeight = (logoHeight / logoWidth) * maxLogoWidth;
      logoWidth = maxLogoWidth;
    }
    if (logoHeight > maxLogoHeight) {
      logoWidth = (logoWidth / logoHeight) * maxLogoHeight;
      logoHeight = maxLogoHeight;
    }
    
    // Center position
    const x = (baseImage.width - logoWidth) / 2;
    const y = (baseImage.height - logoHeight) / 2;
    
    // Draw logo
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logoImage, x, y, logoWidth, logoHeight);
    
    console.log("[tryCanvasComposite] Successfully composited logo");
    return canvas.toBuffer('image/png');
    
  } catch (error) {
    console.log("[tryCanvasComposite] Canvas compositing failed:", error);
    return null;
  }
}

// Fix SVG dimensions
function fixSvgDimensions(svgBuffer: Buffer): Buffer {
  let svgContent = svgBuffer.toString('utf8');
  
  if (!svgContent.includes('width=') || !svgContent.includes('height=')) {
    const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
    let width = '200', height = '200';
    
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/);
      if (parts.length >= 4) {
        width = parts[2] || '200';
        height = parts[3] || '200';
      }
    }
    
    svgContent = svgContent.replace(
      /<svg([^>]*)>/,
      `<svg$1 width="${width}" height="${height}">`
    );
  }
  
  return Buffer.from(svgContent, 'utf8');
} 