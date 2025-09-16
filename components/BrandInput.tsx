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

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		try {
			onSubmit({
				brand,
				logoFile: logoRef.current?.files?.[0] ?? null,
				productHint: productHint || null,
				productRefFile: productRef.current?.files?.[0] ?? null,
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
					placeholder="Brand name (e.g., DumbGoodies)"
					className="flex-1 input-neutral"
					required
				/>
				<input ref={logoRef} type="file" accept="image/png,image/svg+xml" className="hidden" id="logo-input" />
				<label htmlFor="logo-input" className="button-secondary">
					Logo
				</label>
				<button disabled={submitting} className="button-primary">
					{submitting ? "Working..." : "Go"}
				</button>
			</div>
			
			<div className="flex items-stretch gap-2">
				<input
					value={productHint}
					onChange={(e) => setProductHint(e.target.value)}
					placeholder="Optional: product name (e.g., mug, t-shirt)"
					className="flex-1 input-neutral"
				/>
				<input ref={productRef} type="file" accept="image/*" className="hidden" id="product-input" />
				<label htmlFor="product-input" className="button-secondary">
					Product Photo
				</label>
			</div>
			
			<div className="text-xs opacity-70">
				Leave product fields empty to auto-generate 2 dumb ideas • Upload files for guided rendering
			</div>
		</form>
	);
} 