/** Largest catalogue price: ₹10,000,000, stored as paise. */
export const MAX_PAISE = 1_000_000_000;

export function rupeesToPaise(rupees: number): number {
  if (!Number.isInteger(rupees) || rupees < 0) {
    throw new Error("Rupee amounts must be whole numbers.");
  }
  const paise = rupees * 100;
  if (!Number.isSafeInteger(paise) || paise > MAX_PAISE) {
    throw new Error("That price is outside the catalogue range.");
  }
  return paise;
}

export function isPaise(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_PAISE;
}

/** Format integer paise as INR without floating-point money math. */
export function formatInrFromPaise(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    return "₹—";
  }
  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rupees);
  const amount = remainder === 0 ? whole : `${whole}.${String(remainder).padStart(2, "0")}`;
  return `${negative ? "-" : ""}₹${amount}`;
}
