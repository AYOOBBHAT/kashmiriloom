import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function inProject(parentURL) {
  if (!parentURL || parentURL.includes("/node_modules/")) {
    return false;
  }
  return parentURL.includes("/kashmiriloom/");
}

function resolveFile(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, join(base, "index.ts")];
  return candidates.find((file) => existsSync(file));
}

export function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL ?? "";
  if (!inProject(parent)) {
    return nextResolve(specifier, context);
  }

  if (specifier.startsWith("@/")) {
    const file = resolveFile(join(process.cwd(), specifier.slice(2)));
    if (file) {
      return nextResolve(pathToFileURL(file).href, context);
    }
  }

  if (specifier.startsWith(".")) {
    const file = resolveFile(join(dirname(fileURLToPath(parent)), specifier));
    if (file) {
      return nextResolve(pathToFileURL(file).href, context);
    }
  }

  return nextResolve(specifier, context);
}
