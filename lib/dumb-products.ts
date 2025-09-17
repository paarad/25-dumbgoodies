// Predefined list of dumb product ideas for reliable generation
export const DUMB_PRODUCTS = [
  {
    label: "AI Flip-Flops",
    prompt_base: "foam flip-flops with colorful straps, beach setting, sand and water background, summer vibes"
  },
  {
    label: "Crypto Hot Sauce",
    prompt_base: "small glass hot sauce bottle with red chili pepper sauce, kitchen counter setting"
  },
  {
    label: "Tech Bro Coffee Mug",
    prompt_base: "ceramic coffee mug with steam rising from hot coffee, office desk setting"
  },
  {
    label: "Influencer Tote Bag",
    prompt_base: "canvas tote bag hanging on a hook, minimalist background"
  },
  {
    label: "Startup T-Shirt",
    prompt_base: "cotton t-shirt laid flat on clean surface, casual wear style"
  },
  {
    label: "Gamer Energy Drink",
    prompt_base: "aluminum energy drink can with vibrant colors, gaming setup background"
  },
  {
    label: "Metaverse Sunglasses",
    prompt_base: "trendy sunglasses with reflective lenses, outdoor sunny setting"
  },
  {
    label: "Blockchain Water Bottle",
    prompt_base: "stainless steel water bottle with modern design, gym or office setting"
  },
  {
    label: "NFT Phone Case",
    prompt_base: "smartphone case with artistic design, tech desk background"
  },
  {
    label: "Cloud Storage USB",
    prompt_base: "sleek USB flash drive on modern desk, tech accessories around"
  },
  {
    label: "Social Media Stickers",
    prompt_base: "collection of vinyl stickers on laptop or water bottle surface"
  },
  {
    label: "Digital Nomad Backpack",
    prompt_base: "modern backpack with multiple compartments, travel setting"
  },
  {
    label: "Podcast Microphone Stress Ball",
    prompt_base: "microphone-shaped stress ball on desk, office environment"
  },
  {
    label: "Meme Mousepad",
    prompt_base: "computer mousepad with funny design, gaming desk setup"
  },
  {
    label: "Viral Video Cap",
    prompt_base: "baseball cap with trendy design, urban street background"
  },
  {
    label: "Influencer Ring Light Keychain",
    prompt_base: "miniature ring light keychain, keys and accessories background"
  },
  {
    label: "Crypto Mining Socks",
    prompt_base: "colorful patterned socks laid out flat, cozy home setting"
  },
  {
    label: "AI Assistant Rubber Duck",
    prompt_base: "yellow rubber duck with tech twist, bathroom or desk setting"
  },
  {
    label: "Startup Ping Pong Balls",
    prompt_base: "white ping pong balls on table tennis table, office recreation area"
  },
  {
    label: "Tech Conference Lanyard",
    prompt_base: "colorful conference lanyard with badge holder, professional setting"
  }
];

export function getRandomDumbProducts(count: number = 2): Array<{label: string; prompt_base: string}> {
  const shuffled = [...DUMB_PRODUCTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
