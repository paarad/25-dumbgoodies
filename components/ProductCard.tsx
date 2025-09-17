"use client";

import { useState } from "react";

type Props = {
  brand: string;
  product: string;
  logoUrl?: string;
  images: Array<{
    model: string;
    imageUrl: string;
    thumbnailUrl?: string;
  }>;
  onGenerateMore: () => void;
  onImageAdded: (image: { model: string; imageUrl: string; thumbnailUrl?: string }) => void;
  generatingMore?: boolean;
};

function ProductImageCard({ 
  brand, 
  product, 
  model, 
  imageUrl, 
  thumbnailUrl 
}: {
  brand: string;
  product: string;
  model: string;
  imageUrl: string;
  thumbnailUrl?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function onSave() {
    if (saving || savedId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand, product, model, imageUrl, thumbnailUrl }),
      });
      const data = await res.json();
      if (data.renderId) setSavedId(data.renderId);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3 flex flex-col gap-3 bg-white shadow-sm">
      <a href={imageUrl} target="_blank" rel="noreferrer" className="block">
        <img 
          src={thumbnailUrl ?? imageUrl} 
          alt={`${product} mockup`} 
          className="w-full h-auto rounded-md bg-gray-50" 
        />
      </a>
      <div className="flex items-center gap-2">
        <a
          href={imageUrl}
          download={`${brand}-${product}.png`}
          className="button-primary flex-1 justify-center text-center"
        >
          Download PNG
        </a>
        <button
          onClick={onSave}
          disabled={saving || !!savedId}
          className="button-secondary flex-1 justify-center"
        >
          {savedId ? "Saved" : saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export function ProductCard({ brand, product, logoUrl, images, onGenerateMore, onImageAdded, generatingMore }: Props) {
  const [localGenerating, setLocalGenerating] = useState(false);

  async function handleGenerateMore() {
    if (localGenerating) return;
    setLocalGenerating(true);
    onGenerateMore(); // Notify parent that we're generating
    
    try {
      const res = await fetch("/api/render-more", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brand, product, logoUrl }),
      });
      const data = await res.json();
      if (res.ok && data.image) {
        onImageAdded(data.image);
      } else {
        console.error("Generate more failed:", data.error);
      }
    } catch (err) {
      console.error("Generate more error:", err);
    } finally {
      setLocalGenerating(false);
    }
  }

  return (
    <div className="card-neutral">
      <div className="mb-4">
        <h3 className="font-medium text-lg">{product}</h3>
        <p className="text-sm text-gray-600">Brand: {brand}</p>
      </div>
      
      <div className="space-y-4">
        {images.map((image, index) => (
          <ProductImageCard
            key={`${image.imageUrl}-${index}`}
            brand={brand}
            product={product}
            model={image.model}
            imageUrl={image.imageUrl}
            thumbnailUrl={image.thumbnailUrl}
          />
        ))}
        
        <button
          onClick={handleGenerateMore}
          disabled={localGenerating || generatingMore}
          className="button-secondary w-full justify-center"
        >
          {localGenerating || generatingMore ? "Generating..." : "Generate One More"}
        </button>
      </div>
    </div>
  );
} 