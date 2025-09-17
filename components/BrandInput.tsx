"use client";

import { useRef, useState } from "react";

type Props = {
	onSubmit: (data: {
		brand: string;
		logoFile: File;
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
		
		// Auto-extract brand name from filename
		if (file) {
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

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!logoFile) {
			alert("Please upload a logo first!");
			return;
		}
		if (!brand.trim()) {
			alert("Please use a logo file with a meaningful filename!");
			return;
		}
		setSubmitting(true);
		onSubmit({
			brand: brand.trim(),
			logoFile,
			productHint: productHint.trim() || null,
			productRefFile: productFile,
		});
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-6">
			<div className="space-y-3">
				<div className="text-sm font-medium text-gray-900">1. Upload Your Logo</div>
				<div className="flex items-stretch gap-2">
					<input 
						ref={logoRef} 
						type="file" 
						accept="image/png,image/svg+xml,image/jpeg" 
						className="hidden" 
						id="logo-input"
						onChange={handleLogoChange}
						required
					/>
					<label htmlFor="logo-input" className="button-secondary flex-1 justify-center">
						{logoFile ? `✓ ${brand} Logo` : "Upload Logo (Required)"}
					</label>
				</div>
				
				{logoFile && (
					<div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
						📎 {logoFile.name} → Brand: "{brand}"
					</div>
				)}
			</div>

			<div className="space-y-3">
				<div className="text-sm font-medium text-gray-900">2. Specific Product (Optional)</div>
				<div className="flex items-stretch gap-2">
					<input
						value={productHint}
						onChange={(e) => setProductHint(e.target.value)}
						placeholder="Specific product (e.g., 'inflatable pool floatie', 'ceramic coffee mug')"
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
						{productFile ? "✓ Product" : "Upload Product"}
					</label>
				</div>
				
				{productFile && (
					<div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
						📎 Product: {productFile.name}
					</div>
				)}
			</div>

			<div className="text-xs text-gray-500">
				💡 Brand name auto-extracted from logo filename • Leave product empty for 2 auto-generated ideas
			</div>

			<button type="submit" disabled={submitting || !logoFile} className="button-primary">
				{submitting ? "Generating..." : `Generate ${brand || "Dumb"} Goodies`}
			</button>
		</form>
	);
}
