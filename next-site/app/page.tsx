import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { PROJECTS, PROJECT_IDS } from '@/lib/projects'
import { ExternalLink, BookOpen, Map, HelpCircle, ArrowRight } from 'lucide-react'

const COLOR_CLASSES: Record<string, { badge: string; card: string }> = {
  blue:   { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',   card: 'hover:border-blue-500/50' },
  orange: { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30', card: 'hover:border-orange-500/50' },
  purple: { badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30', card: 'hover:border-purple-500/50' },
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="px-6 py-24 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-xs text-[#8b949e] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            以原始碼為基礎的深度學習
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
            深入 Kubernetes<br />
            <span className="text-[#2f81f7]">基礎設施管理</span>
          </h1>
          <p className="text-xl text-[#8b949e] max-w-2xl mx-auto mb-10 leading-relaxed">
            從功能視角出發，逐層深入 Cluster API 生態系的原始碼。<br />
            理解每個 Controller 的設計決策與實作細節。
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/cluster-api"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#2f81f7] text-white font-semibold hover:bg-blue-600 transition-colors">
              開始學習 <ArrowRight size={16} />
            </Link>
            <a href="https://github.com/hwchiu/molearn" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-[#30363d] text-[#e6edf3] hover:border-[#2f81f7] transition-colors">
              <ExternalLink size={14} /> GitHub
            </a>
          </div>
        </section>

        <section className="px-6 pb-24 max-w-5xl mx-auto">
          <h2 className="text-lg font-semibold text-[#8b949e] uppercase tracking-wider mb-8 text-center">涵蓋專案</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PROJECT_IDS.map(id => {
              const proj = PROJECTS[id]
              const cc = COLOR_CLASSES[proj.color] || COLOR_CLASSES.blue
              return (
                <Link key={id} href={`/${id}`}
                  className={`group flex flex-col p-6 rounded-2xl border border-[#30363d] bg-[#161b22] transition-all duration-200 ${cc.card} hover:bg-[#21262d]`}>
                  <div className="flex items-start justify-between mb-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cc.badge}`}>
                      {proj.shortName}
                    </span>
                    <span className="text-xs text-[#8b949e]">{proj.features.length} 功能</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#2f81f7] transition-colors">
                    {proj.displayName}
                  </h3>
                  <p className="text-sm text-[#8b949e] leading-relaxed flex-1 mb-4">
                    {proj.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-[#8b949e]">
                    <span className="flex items-center gap-1"><Map size={11} /> 功能地圖</span>
                    <span className="flex items-center gap-1"><BookOpen size={11} /> 深度解析</span>
                    <span className="flex items-center gap-1"><HelpCircle size={11} /> 測驗</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
