"use client";

import { useState } from "react";
import { BrandInput } from "@/components/BrandInput";
import { ProductCard } from "@/components/ProductCard";

type ProductItem = {
	product: string;
	images: Array<{
		model: string;
		imageUrl: string;
		thumbnailUrl?: string;
	}>;
};

export default function Home() {
	const [loading, setLoading] = useState(false);
	const [brand, setBrand] = useState<string>("");
	const [logoUrl, setLogoUrl] = useState<string>("");
	const [products, setProducts] = useState<ProductItem[]>([]);

	async function handleStart(params: {
		brand: string;
		logoFile: File;
		productHint?: string | null;
		productRefFile?: File | null;
	}) {
		try {
			setLoading(true);

			// Upload logo (now required)
			const logoFd = new FormData();
			logoFd.append("file", params.logoFile);
			const logoRes = await fetch("/api/upload", { method: "POST", body: logoFd });
			const logoData = await logoRes.json();
			if (!logoRes.ok) throw new Error((logoData as { error?: string }).error || "Logo upload failed");
			const logoUrl = (logoData as { url: string }).url;

			// Upload product reference if provided
			let productRefUrl: string | undefined;
			if (params.productRefFile) {
				const productFd = new FormData();
				productFd.append("file", params.productRefFile);
				const productRes = await fetch("/api/upload", { method: "POST", body: productFd });
				const productData = await productRes.json();
				if (!productRes.ok) throw new Error((productData as { error?: string }).error || "Product image upload failed");
				productRefUrl = (productData as { url: string }).url;
			}

			// Always call propose API to create project and concepts in database
			const requestBody: Record<string, any> = {
				brand: params.brand,
				logoUrl: logoUrl,
			};
			
			// Only add optional fields if they have values
			if (params.productHint?.trim()) requestBody.product_hint = params.productHint.trim();
			if (productRefUrl) requestBody.product_ref_url = productRefUrl;
			
			const res = await fetch("/api/propose", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(requestBody),
			});
			const data = await res.json();
			if (!res.ok) throw new Error((data as { error?: string }).error || "Propose failed");
			
			setBrand(params.brand);
			setLogoUrl(logoUrl);

			// Use new simplified render API - pass brand, logoUrl, and any product hints
			const renderBody: any = { brand: params.brand, logoUrl };
			if (params.productHint?.trim()) {
				renderBody.product = params.productHint.trim();
			}
			if (productRefUrl) {
				renderBody.productRefUrl = productRefUrl;
			}
			
			const renderRes = await fetch("/api/render", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(renderBody),
			});
			const renderData = await renderRes.json();
			if (!renderRes.ok || !renderData.items) throw new Error(renderData.error || "Render failed");
			
			// Set products directly from new API response
			setProducts(renderData.items);
		} catch (e) {
			console.error(e);
			alert("Something failed. Check console.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Production Issue Banner */}
			<div className="bg-yellow-400 text-black py-3 text-center">
				<p className="text-sm font-medium">
					⚠️ This project is currently experiencing issues in production and will be fixed soon. Thank you for your patience! ⚠️
				</p>
			</div>

			{/* Rest of the page */}
			<div className="max-w-4xl mx-auto px-4 py-8">
				<header className="text-center mb-12">
					<h1 className="text-4xl font-bold text-gray-900 mb-4">Dumb Goodies</h1>
					<p className="text-xl text-gray-600">AI-powered custom merch generator</p>
				</header>

				<BrandInput onSubmit={handleStart} />

				{loading && (
					<section className="text-center py-12">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
						<p className="text-gray-600">Generating your dumb goodies...</p>
					</section>
				)}

				{products.length > 0 && !loading && (
					<section className="space-y-6">
						<h2 className="text-xl font-semibold text-gray-900">Your Dumb Goodies</h2>
						<div className="grid gap-6 sm:gap-8 sm:grid-cols-2">
							{products.map((product, index) => (
								<ProductCard
									key={`${product.product}-${index}-${product.images.length}`}
									brand={brand}
									product={product.product}
									logoUrl={logoUrl}
									images={product.images}
									onImageAdded={(newImage) => {
										setProducts(prev => prev.map((p, i) => 
											i === index 
												? { ...p, images: [...p.images, newImage] }
												: p
										));
									}}
								/>
							))}
						</div>
					</section>
				)}

				{!loading && products.length === 0 && (
					<section className="grid gap-6 sm:gap-8 sm:grid-cols-2 mt-2 sm:mt-4">
						<div className="card-neutral">
							<h3 className="font-medium text-gray-900">AI-Powered Branding</h3>
							<p className="text-sm text-gray-600 mt-1">DALL-E 3 generates products with your logo naturally integrated.</p>
						</div>
						<div className="card-neutral">
							<h3 className="font-medium text-gray-900">Smart Placement</h3>
							<p className="text-sm text-gray-600 mt-1">Logos are placed realistically on product surfaces with proper perspective.</p>
						</div>
					</section>
				)}
			</div>
		</div>
	);
}
