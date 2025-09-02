import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { PublicKey } from "@solana/web3.js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type AddressLike = string | PublicKey;

export function toBase58(addr: AddressLike): string {
  return typeof addr === "string" ? addr.trim() : addr.toBase58();
}

/**
 * Truncate a Solana address like: 4CGVjk...R8WA
 */
export function truncateAddress(
  addr: AddressLike,
  opts: { leading?: number; trailing?: number; ellipsis?: string } = {}
): string {
  const { leading = 6, trailing = 4, ellipsis = "..." } = opts;
  const s = toBase58(addr);
  if (s.length <= leading + trailing + ellipsis.length) return s;
  return `${s.slice(0, leading)}${ellipsis}${s.slice(-trailing)}`;
}