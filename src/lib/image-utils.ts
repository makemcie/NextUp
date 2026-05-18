export function compressImage(
	file: File,
	maxSize: number = 800,
	quality: number = 0.92,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				let { width, height } = img;
				if (width > height) {
					if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
				} else {
					if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
				}
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (!ctx) return reject(new Error("Canvas not supported"));
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = "high";
				ctx.drawImage(img, 0, 0, width, height);
				resolve(canvas.toDataURL("image/jpeg", quality));
			};
			img.onerror = reject;
			img.src = reader.result as string;
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
