export const proposeIdeas = (brand: string) => `
Invent exactly TWO absurd but visually clear FAKE merch products for the brand "${brand}".
Constraints:
- Each should be a single, photographable object (e.g., flip-flops, hot sauce bottle, mug).
- Avoid real trademarks and text-heavy labels.
Return JSON:
[
  { "label": "AI Flip-Flops", "prompt_base": "foam flip-flops on a clean studio background, soft shadows, product centered, 1:1" },
  { "label": "Crypto Hot Sauce", "prompt_base": "small glass bottle of hot sauce with greenish hue, clean studio background, 1:1" }
]
No prose.`;

export const seedreamPrompt = ({ brand, promptBase, withLogo }: {
	brand: string; promptBase: string; withLogo: boolean;
}) => `
Photorealistic studio product shot. ${promptBase}
If a brand mark is present, incorporate "${brand}" subtly as a printed label, emboss, or small badge aligned to surface perspective. Keep it clean, not tiled. Maintain realistic lighting, reflections, and material response. 1:1 aspect.`;

export const openaiEditInstruction = (brand: string) =>
	`Place the brand "${brand}" cleanly on the designated area. Respect perspective, curvature, and lighting; integrate as printed label or small embossed mark. No repeating patterns; no oversized decal.`; 