"use client";

import { useRef, useState } from "react";

type Props = {
	onSubmit: (data: {
		brand: string;
		logoFile?: File | null;
		productHint?: string | null;
		productRefFile?: File | null;
	}) => void;
};

export function BrandInput({ onSubmit }: Props) {
	const [brand, setBrand] = useState("");
	const [productHint, setProductHint] = useState("");
	const logoRef = useRef<HTMLInputElement>(null);
	const productRef = useRef<HTMLInputElement>(null);
	const [submitting, setSubmitting] = useState(false);
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [productFile, setProductFile] = useState<File | null>(null);

	function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] || null;
		setLogoFile(file);
		
		// Auto-extract brand name from filename if brand is empty
		if (file && !brand.trim()) {
			const filename = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
			const brandName = filename
				.replace(/[-_]/g, " ") // Replace dashes/underscores with spaces
				.replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
				.trim();
			setBrand(brandName);
		}
	}

	function handleProductChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0] || null;
		setProductFile(file);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			onSubmit({
				brand,
				logoFile,
				productHint: productHint || null,
				productRefFile: productFile,
			});
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-4">
			<div className="flex items-stretch gap-2">
				<input
					value={brand}
					onChange={(e) => setBrand(e.target.value)}
					placeholder="Brand name (auto-filled from logo filename)"
					className="flex-1 input-neutral"
					required
				/>
				<input 
					ref={logoRef} 
					type="file" 
					accept="image/png,image/svg+xml" 
					className="hidden" 
					id="logo-input"
					onChange={handleLogoChange}
				/>
				<label htmlFor="logo-input" className="button-secondary">
					{logoFile ? "✓ Logo" : "Upload Logo"}
				</label>
				<button disabled={submitting} className="button-primary">
					{submitting ? "Working..." : "Go"}
				</button>
			</div>
			
			{logoFile && (
				<div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
					📎 Logo: {logoFile.name}
				</div>
			)}
			
			<div className="flex items-stretch gap-2">
				<input
					value={productHint}
					onChange={(e) => setProductHint(e.target.value)}
					placeholder="Optional: product name (e.g., mug, t-shirt)"
					className="flex-1 input-neutral"
				/>
				<input 
					ref={productRef} 
					type="file" 
					accept="image/*" 
					className="hidden" 
					id="product-input"
					onChange={handleProductChange}
				/>
				<label htmlFor="product-input" className="button-secondary">
					{productFile ? "✓ Photo" : "Product Photo"}
				</label>
			</div>
			
			{productFile && (
				<div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
					📎 Product: {productFile.name}
				</div>
			)}
			
			<div className="text-xs text-gray-500">
				💡 Upload a logo to auto-fill brand name • Leave product fields empty for 2 auto-generated ideas
			</div>
		</form>
	);
} 