import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns up to 2 initials from a full name, e.g. "Andy Xu" → "AX" */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Returns true if the given user ID belongs to any admin account */
export function isAdmin(userId: string): boolean {
  const adminIds = [
    process.env.NEXT_PUBLIC_ADMIN_USER_ID,
    process.env.NEXT_PUBLIC_ADMIN_USER_ID_2,
  ].filter(Boolean) as string[]
  return adminIds.includes(userId)
}
