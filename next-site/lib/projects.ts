import path from 'path'

export type ProjectId = 'cluster-api' | 'cluster-api-provider-maas' | 'cluster-api-provider-metal3'

export interface ProjectMeta {
  id: ProjectId
  displayName: string
  shortName: string
  description: string
  githubUrl: string
  submodulePath: string
  color: string
  accentClass: string
  features: string[]
}

const REPO_ROOT = path.join(process.cwd(), '..')

export const PROJECTS: Record<ProjectId, ProjectMeta> = {
  'cluster-api': {
    id: 'cluster-api',
    displayName: 'Cluster API',
    shortName: 'CAPI',
    description: '宣告式 Kubernetes 叢集生命週期管理框架，定義 Provider 合約與核心 CRD',
    githubUrl: 'https://github.com/kubernetes-sigs/cluster-api',
    submodulePath: path.join(REPO_ROOT, 'cluster-api'),
    color: 'blue',
    accentClass: 'border-blue-500 text-blue-400',
    features: [
      'architecture', 'controller-core', 'controller-kcp', 'controller-topology',
      'api-cluster-machine', 'api-machineset-machinedeployment', 'api-kubeadm-controlplane',
      'bootstrap-kubeadmconfig', 'machine-lifecycle', 'machine-health-check',
      'clusterclass-topology', 'addons-clusterresourceset',
      'provider-contracts-runtime-hooks', 'clusterctl',
    ],
  },
  'cluster-api-provider-maas': {
    id: 'cluster-api-provider-maas',
    displayName: 'CAPI Provider MAAS',
    shortName: 'CAPM',
    description: '整合 Canonical MAAS 裸機管理平台，實作 InfraCluster / InfraMachine Provider 合約',
    githubUrl: 'https://github.com/spectrocloud/cluster-api-provider-maas',
    submodulePath: path.join(REPO_ROOT, 'cluster-api-provider-maas'),
    color: 'orange',
    accentClass: 'border-orange-500 text-orange-400',
    features: ['architecture', 'controllers', 'machine-lifecycle', 'api-types', 'integration'],
  },
  'cluster-api-provider-metal3': {
    id: 'cluster-api-provider-metal3',
    displayName: 'CAPI Provider Metal3',
    shortName: 'CAPM3',
    description: '整合 Metal3 BareMetalHost Operator，以 BMO 管理裸機生命週期',
    githubUrl: 'https://github.com/metal3-io/cluster-api-provider-metal3',
    submodulePath: path.join(REPO_ROOT, 'cluster-api-provider-metal3'),
    color: 'purple',
    accentClass: 'border-purple-500 text-purple-400',
    features: [
      'architecture', 'bmh-lifecycle', 'crds-cluster', 'crds-machine',
      'labelsync', 'node-reuse', 'data-templates', 'ipam', 'remediation', 'advanced-features',
    ],
  },
}

export const PROJECT_IDS: ProjectId[] = Object.keys(PROJECTS) as ProjectId[]

export function getProject(id: string): ProjectMeta | undefined {
  return PROJECTS[id as ProjectId]
}
