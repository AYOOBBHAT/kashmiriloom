/** Top-level folders under public that hold one shawl per subfolder. */
export const SHAWL_SOURCES = [
  {
    directory: "Kalamkari shawls",
    matchNames: ["kalamkari shawls", "kalamkari"],
    matchSlugs: ["kalamkari", "kalamkari-shawls"],
  },
  {
    directory: "Kani shawls",
    matchNames: ["kani shawls", "kani weave"],
    matchSlugs: ["kani"],
  },
  {
    directory: "Machine embroidery",
    matchNames: ["machine embroidery"],
    matchSlugs: ["machine-embroidery"],
  },
  {
    directory: "Sozni shawls",
    matchNames: ["sozni shawls", "sozni"],
    matchSlugs: ["sozni", "sozni-shawls"],
  },
  {
    directory: "Zari shawls",
    matchNames: ["zari shawls", "zari"],
    matchSlugs: ["zari", "zari-shawls"],
  },
] as const;

export const SHAWL_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;
