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
		<form onSubmit={handleSubmit} className="flex flex-col gap-3">
			<div>
				<label className="block text-sm mb-1">Brand name</label>
				<input
					value={brand}
					onChange={(e) => setBrand(e.target.value)}
					placeholder="DumbGoodies"
					className="w-full rounded-md border px-3 py-2"
					required
				/>
			</div>
			<div>
				<label className="block text-sm mb-1">Logo (PNG/SVG)</label>
				<input ref={logoRef} type="file" accept="image/png,image/svg+xml" className="w-full" />
			</div>
			<div>
				<label className="block text-sm mb-1">Optional: product name</label>
				<input
					value={productHint}
					onChange={(e) => setProductHint(e.target.value)}
					placeholder="e.g., mug"
					className="w-full rounded-md border px-3 py-2"
				/>
			</div>
			<div>
				<label className="block text-sm mb-1">Optional: product reference photo</label>
				<input ref={productRef} type="file" accept="image/*" className="w-full" />
			</div>
			<div>
				<button disabled={submitting} className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-black disabled:opacity-60">
					{submitting ? "Working..." : "Go"}
				</button>
			</div>
		</form>
	);
} 