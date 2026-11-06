import type { ReactNode } from 'react'

// The page itself is laid out by app/[locale]/layout.tsx, which knows the language to set on <html>.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children
}
