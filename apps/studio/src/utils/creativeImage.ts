/** Real decoded image metadata; filenames and caller-provided MIME types are not evidence. */
export interface CreativeImageMetadata {
  sha256: string
  bytes: number
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  width: number
  height: number
}

/** Decode through the browser's image implementation and release its temporary URL. */
export async function decodeCreativeImage(blob: Blob): Promise<{ width: number, height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

/** Hash actual bytes and require a successful raster decode before creating an import candidate. */
export async function inspectCreativeImage(blob: Blob, decode = decodeCreativeImage): Promise<{ image: CreativeImageMetadata, data: ArrayBuffer }> {
  if (!blob.size || blob.size > 20 * 1024 * 1024)
    throw new Error('CREATIVE_IMAGE_SIZE')
  const data = await blob.arrayBuffer()
  const bytes = new Uint8Array(data)
  const signature = Array.from(bytes.slice(0, 12))
  const mimeType = signature.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
    ? 'image/png'
    : signature.slice(0, 3).join(',') === '255,216,255'
      ? 'image/jpeg'
      : String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' && String.fromCharCode(...signature.slice(8, 12)) === 'WEBP'
        ? 'image/webp'
        : undefined
  if (!mimeType)
    throw new Error('CREATIVE_IMAGE_FORMAT')
  const { width, height } = await decode(new Blob([data], { type: mimeType }))
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0 && value <= 16384) || width * height > 64000000)
    throw new Error('CREATIVE_IMAGE_DIMENSIONS')
  const digest = await crypto.subtle.digest('SHA-256', data)
  const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
  return { image: { sha256, bytes: data.byteLength, mimeType, width, height }, data }
}
