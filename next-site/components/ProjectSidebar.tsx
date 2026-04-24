import Link from 'next/link'
import { PROJECTS } from '@/lib/projects'
import type { ProjectId } from '@/lib/projects'

interface Props {
  project: ProjectId
  currentSlug?: string
}

const FEATURE_LABELS: Record<string, string> = {
  'architecture': '系統架構總覽',
  'controller-core': 'Core Controllers',
  'controller-kcp': 'KubeadmControlPlane',
  'controller-topology': 'Topology Controller',
  'api-cluster-machine': 'Cluster & Machine API',
  'api-machineset-machinedeployment': 'MachineSet & MachineDeployment',
  'api-kubeadm-controlplane': 'KubeadmControlPlane API',
  'bootstrap-kubeadmconfig': 'Bootstrap KubeadmConfig',
  'machine-lifecycle': 'Machine 生命週期',
  'machine-health-check': 'MachineHealthCheck',
  'clusterclass-topology': 'ClusterClass & Topology',
  'addons-clusterresourceset': 'ClusterResourceSet',
  'provider-contracts-runtime-hooks': 'Provider 合約',
  'clusterctl': 'clusterctl CLI',
  'controllers': 'Controllers',
  'api-types': 'API Types',
  'integration': 'MAAS 整合',
  'bmh-lifecycle': 'BMH 生命週期',
  'crds-cluster': 'Cluster CRDs',
  'crds-machine': 'Machine CRDs',
  'labelsync': 'Label Sync',
  'node-reuse': 'Node Reuse',
  'data-templates': 'Data Templates',
  'ipam': 'IPAM',
  'remediation': 'Remediation',
  'advanced-features': '進階功能',
}

export function ProjectSidebar({ project, currentSlug }: Props) {
  const proj = PROJECTS[project]
  return (
    <aside className="w-60 flex-shrink-0 border-r border-[#30363d] h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto py-6 px-4">
      <div className="mb-4">
        <Link href={`/${project}`} className="text-xs font-semibold uppercase tracking-wider text-[#8b949e] hover:text-white">
          {proj.shortName}
        </Link>
      </div>
      <nav className="space-y-0.5">
        <Link href={`/${project}/feature-map`}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#8b949e] hover:bg-[#21262d] hover:text-white transition-colors">
          🗺 功能地圖
        </Link>
        <div className="pt-3 pb-1">
          <p className="px-3 text-xs text-[#8b949e] font-semibold uppercase tracking-wider">功能說明</p>
        </div>
        {proj.features.map(slug => (
          <Link key={slug} href={`/${project}/features/${slug}`}
            className={`block px-3 py-2 rounded-md text-sm transition-colors ${
              currentSlug === slug
                ? 'bg-[#21262d] text-white font-medium'
                : 'text-[#8b949e] hover:bg-[#21262d] hover:text-white'
            }`}>
            {FEATURE_LABELS[slug] || slug}
          </Link>
        ))}
        <div className="pt-3 pb-1">
          <p className="px-3 text-xs text-[#8b949e] font-semibold uppercase tracking-wider">測驗</p>
        </div>
        <Link href={`/${project}/quiz`}
          className="block px-3 py-2 rounded-md text-sm text-[#8b949e] hover:bg-[#21262d] hover:text-white transition-colors">
          🧪 互動測驗
        </Link>
      </nav>
    </aside>
  )
}
