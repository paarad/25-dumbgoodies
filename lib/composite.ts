import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function makeGuideAndMask(basePngBuf: Buffer, logoPngBuf: Buffer) {
  // Lazy load Sharp to avoid startup crashes
  const sharp = (await import("sharp")).default;
  
  const base = sharp(basePngBuf).ensureAlpha();
  const meta = await base.metadata(); 
  const W = meta.width!, H = meta.height!;
  
  // Center ROI ~42%×22% (tweak per product type)
  const roiW = Math.round(W * 0.42), roiH = Math.round(H * 0.22);
  const x = Math.round(W * 0.29), y = Math.round(H * 0.38);

  const logoFitted = await sharp(logoPngBuf).ensureAlpha()
    .resize({ width: roiW, height: roiH, fit: "inside", withoutEnlargement: true })
    .png().toBuffer();

  // 2a) GUIDE: faint logo pasted (gives the model exact artwork to integrate)
  const guide = await base.composite([{ 
    input: logoFitted, 
    left: x, 
    top: y, 
    blend: "over"
  }]).png().toBuffer();

  // 2b) MASK: transparent where edits allowed (around logo), feather edges
  const hard = await sharp({ 
    create: { 
      width: W, 
      height: H, 
      channels: 4, 
      background: { r:0, g:0, b:0, alpha:1 }
    }
  }).png().toBuffer();
  
  const hole = await sharp({ 
    create: { 
      width: roiW, 
      height: roiH, 
      channels: 4, 
      background: { r:0, g:0, b:0, alpha:0 }
    }
  }).png().toBuffer();
  
  const maskHard = await sharp(hard).composite([{ 
    input: hole, 
    left: x, 
    top: y 
  }]).png().toBuffer();
  
  const mask = await sharp(maskHard).blur(4).png().toBuffer(); // soft edges help blending

  return { guide, mask };
}

export async function integrateLogo({ 
  guide, 
  mask, 
  product 
}: {
  guide: Buffer; 
  mask: Buffer; 
  product: string;
}) {
  const prompt = `Keep everything identical except inside the transparent mask.
Use ONLY the exact logo artwork already visible in the masked area; do NOT add any additional graphics, icons, or design elements.
If it's text-only, keep it as text-only. If it has graphics, preserve those exactly as shown.
Integrate it realistically onto the ${product}: correct perspective/curvature, lighting and material response (print/emboss/embroider as appropriate).
Maintain exact proportions and legibility. Product only, transparent background. 
AVOID: adding symbols, icons, decorative elements, vector graphics, or any visual elements not present in the original logo.`;

  // Convert buffers to File objects for the API
  const imageFile = new File([new Uint8Array(guide)], "guide.png", { type: "image/png" });
  const maskFile = new File([new Uint8Array(mask)], "mask.png", { type: "image/png" });

  const res = await openai.images.edit({
    model: "gpt-image-1",
    image: imageFile,
    mask: maskFile,
    prompt,
    output_format: "png",
    // quality: "high", // if supported
    // input_fidelity: "high", // if your SDK exposes it
  });
  
  const result = res.data?.[0]?.b64_json;
  if (!result) throw new Error("Failed to get image data from DALL-E edit");
  return result;
} 