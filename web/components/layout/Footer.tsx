interface FooterProps {
  copyright: string
  description: string
}

export function Footer({ copyright, description }: FooterProps) {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-[var(--mute)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/impressum">Impressum</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/credits">Credits</Link>
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  )
}
import Link from 'next/link'
