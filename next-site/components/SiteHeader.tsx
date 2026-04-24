import Link from 'next/link'
import { BookOpen, Github } from 'lucide-react'
import type { ProjectId } from '@/lib/projects'

interface Props {
  currentProject?: ProjectId
}

export function SiteHeader({ currentProject }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#30363d] bg-[#0d1117]/90 backdrop-blur">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-white hover:text-[#2f81f7] transition-colors">
          <BookOpen size={18} className="text-[#2f81f7]" />
          <span>MoLearn</span>
        </Link>
        <span className="text-[#30363d]">/</span>
        <span className="text-sm text-[#8b949e]">Kubernetes Source Deep Dive</span>
        <div className="ml-auto flex items-center gap-3">
          <a href="https://github.com/hwchiu/molearn" target="_blank" rel="noopener noreferrer"
            className="text-[#8b949e] hover:text-white transition-colors">
            <Github size={18} />
          </a>
        </div>
      </div>
    </header>
  )
}
