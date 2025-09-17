// lib/ideas.ts
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const BLOCKED_TERMS = [
  'knife', 'blade', 'weapon', 'gun', 'pill', 'drug', 'cigarette', 'alcohol',
  'beer', 'wine', 'vodka', 'prescription', 'medicine', 'syringe', 'needle'
];

function isBlockedProduct(product: string): boolean {
  const lower = product.toLowerCase();
  return BLOCKED_TERMS.some(term => lower.includes(term));
}

export async function getTwoDumbIdeas(brand: string): Promise<string[]> {
  const sys = "You invent meme-friendly FAKE merch items. Keep them easily photographable as single products. Avoid weapons, drugs, alcohol, medical items, or anything unsafe.";
  const user = `Give exactly 2 product ideas (2-4 words each) for brand "${brand}".
Return a JSON array of strings only, no prose. Examples style: "AI Flip-Flops", "Crypto Hot Sauce".`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    });

    try {
      const obj = JSON.parse(r.choices[0].message.content || "{}");
      // allow either {ideas:[...]} or [...]
      const arr = Array.isArray(obj) ? obj : obj.ideas || obj.products || [];
      const ideas = (arr as string[]).slice(0, 2);

      // Filter out blocked terms
      const safeIdeas = ideas.filter(idea => !isBlockedProduct(idea));
      if (safeIdeas.length >= 2) {
        return safeIdeas.slice(0, 2);
      }
    } catch {
      // Continue to fallback
    }
  }

  // Safe fallbacks
  return ["Smart Socks", "Holographic Keychain"];
} 