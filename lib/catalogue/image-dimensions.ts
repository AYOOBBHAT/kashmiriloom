export type PhotoSize = {
  width: number;
  height: number;
};

export function photoSize(width: number, height: number): PhotoSize | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 20000 || height > 20000) {
    return null;
  }
  return { width, height };
}

export function sizeFromCloudinaryInfo(value: unknown): PhotoSize | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const input = (value as { input?: unknown }).input;
  if (!input || typeof input !== "object") {
    return null;
  }
  const width = (input as { width?: unknown }).width;
  const height = (input as { height?: unknown }).height;
  if (typeof width !== "number" || typeof height !== "number") {
    return null;
  }
  return photoSize(width, height);
}

function readU16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function jpegSize(bytes: Uint8Array): PhotoSize | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = readU16(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) {
      return null;
    }
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return photoSize(readU16(bytes, offset + 7), readU16(bytes, offset + 5));
    }
    offset += 2 + length;
  }
  return null;
}

/** Reads the stored width and height from a PNG or JPEG header. */
export function sizeFromImageBytes(bytes: Uint8Array): PhotoSize | null {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return photoSize(readU32(bytes, 16), readU32(bytes, 20));
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return jpegSize(bytes);
  }
  return null;
}
