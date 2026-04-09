import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAvatarUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return ""
  if (imageUrl.startsWith("http")) return imageUrl
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace("/api", "") ?? ""
  return `${base}${imageUrl}`
}
