/**
 * Chooses how a photo sits in a fixed frame.
 * A photo taller than the frame uses contain, because cover would cut the top and bottom.
 * A wider photo uses cover so a textile close-up still fills the card.
 */
export function frameObjectFit(
  photoWidth: number,
  photoHeight: number,
  frameWidth: number,
  frameHeight: number,
): "contain" | "cover" {
  if (photoWidth <= 0 || photoHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return "contain";
  }
  const photoRatio = photoWidth / photoHeight;
  const frameRatio = frameWidth / frameHeight;
  return photoRatio < frameRatio ? "contain" : "cover";
}
