/** Profile colors people can pick. All light enough for ink-colored initials on top. */
export const AVATAR_COLORS = [
	'#F2B705', '#F6C79C', '#F4A6B4', '#F7B9D7', '#D9C7F0', '#BFD0EE',
	'#B9E3E8', '#A9D3BE', '#CFE3A1', '#EADBC8', '#D6D3CE', '#FFE08A'
] as const;

export const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export const avatarSrc = (photo: string | null | undefined) => (photo ? `/avatars/${photo}` : null);

/** Square-crops and shrinks a picked photo in the browser so uploads stay tiny. */
export async function shrinkPhoto(file: File, size = 320): Promise<Blob> {
	const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
	const side = Math.min(bmp.width, bmp.height);
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
	bmp.close();
	return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Couldn’t read that photo'))), 'image/jpeg', 0.85));
}
