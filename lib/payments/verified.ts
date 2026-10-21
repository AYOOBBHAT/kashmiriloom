import { AsyncLocalStorage } from "node:async_hooks";

const verifiedPayment = new AsyncLocalStorage<true>();

export function withVerifiedPayment<T>(work: () => Promise<T>): Promise<T> {
  return verifiedPayment.run(true, work);
}

export function isVerifiedPayment(): boolean {
  return verifiedPayment.getStore() === true;
}
