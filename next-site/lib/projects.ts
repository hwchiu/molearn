import path from 'path'

export type ProjectId = 'cluster-api' | 'cluster-api-provider-maas' | 'cluster-api-provider-metal3'

export interface LearningPathStep {
  slug: string
  note: string
}

export interface FeatureGroup {
  label: string
  icon: string
  slugs: string[]
}

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
  featureGroups: FeatureGroup[]
  difficulty: '🟢 入門' | '🟡 中階' | '🔴 進階'
  difficultyColor: string
  problemStatement: string
  learningPaths: {
    beginner: LearningPathStep[]
    intermediate: LearningPathStep[]
    advanced: LearningPathStep[]
  }
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
    featureGroups: [
      { label: '從這裡開始', icon: '🚀', slugs: ['architecture'] },
      { label: '控制器原理', icon: '🔄', slugs: ['controller-core', 'controller-kcp', 'controller-topology'] },
      { label: 'API 資源設計', icon: '📋', slugs: ['api-cluster-machine', 'api-machineset-machinedeployment', 'api-kubeadm-controlplane', 'bootstrap-kubeadmconfig'] },
      { label: '機器生命週期', icon: '⚙️', slugs: ['machine-lifecycle', 'machine-health-check'] },
      { label: '進階管理', icon: '🏗', slugs: ['clusterclass-topology', 'addons-clusterresourceset', 'provider-contracts-runtime-hooks', 'clusterctl'] },
    ],
    difficulty: '🟡 中階',
    difficultyColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    problemStatement: '想像你需要管理 50 個 Kubernetes 叢集，分散在 AWS、裸機、vSphere 等不同環境。每個環境的建立方式都不同，維運成本極高。Cluster API 定義了一套統一的「語言」：你只需要宣告「我想要一個有 3 個 master + 5 個 worker 的叢集」，由各個 Provider 去翻譯並執行。就像 Kubernetes 統一了容器管理，CAPI 統一了叢集管理。',
    learningPaths: {
      beginner: [
        { slug: 'architecture', note: '了解整體設計思想與各元件角色' },
        { slug: 'api-cluster-machine', note: '了解用什麼「表單」操作叢集與機器' },
        { slug: 'machine-lifecycle', note: '追蹤一台機器從申請到就緒的完整流程' },
      ],
      intermediate: [
        { slug: 'architecture', note: '快速瀏覽，確認架構印象' },
        { slug: 'controller-core', note: '重點理解 Reconcile 邏輯與狀態機' },
        { slug: 'provider-contracts-runtime-hooks', note: '了解 Provider 擴充點與合約設計' },
      ],
      advanced: [
        { slug: 'controller-kcp', note: '深入 KubeadmControlPlane 控制器原始碼' },
        { slug: 'clusterclass-topology', note: '理解 ClusterClass 拓樸管理與 patch engine' },
        { slug: 'machine-health-check', note: '分析錯誤處理與自癒機制的 edge case' },
      ],
    },
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
    featureGroups: [
      { label: '從這裡開始', icon: '🚀', slugs: ['architecture'] },
      { label: '核心機制', icon: '🔄', slugs: ['controllers', 'machine-lifecycle'] },
      { label: 'API 與整合', icon: '📋', slugs: ['api-types', 'integration'] },
    ],
    difficulty: '🟡 中階',
    difficultyColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    problemStatement: '想像你管理著一個有 100 台實體伺服器的數據中心。每次需要新 Kubernetes 節點，你都要：登入 MAAS UI → 找到空閒的機器 → 分配 IP → 選 OS image → 等待部署 → 設定 Kubernetes。這個流程費時且容易出錯。MAAS Provider 讓這一切變成一個 YAML 宣告，Kubernetes 自動透過 MAAS API 完成剩下的事，讓裸機如同雲端資源一樣彈性。',
    learningPaths: {
      beginner: [
        { slug: 'architecture', note: '了解 MAAS Provider 與 CAPI 的整合架構' },
        { slug: 'api-types', note: '認識 MaasMachine / MaasCluster CRD 欄位' },
        { slug: 'machine-lifecycle', note: '追蹤裸機從 Allocate 到 Deploy 的完整流程' },
      ],
      intermediate: [
        { slug: 'architecture', note: '快速複習 Provider 合約對應關係' },
        { slug: 'controllers', note: '深入 Reconcile 邏輯與 MAAS API 互動' },
        { slug: 'integration', note: '理解與上層 CAPI 核心的整合方式' },
      ],
      advanced: [
        { slug: 'api-types', note: '分析 CRD 設計決策與欄位語意' },
        { slug: 'controllers', note: '追蹤錯誤路徑與冪等性保證' },
        { slug: 'machine-lifecycle', note: '分析複雜狀態轉換與 finalizer 處理' },
      ],
    },
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
    featureGroups: [
      { label: '從這裡開始', icon: '🚀', slugs: ['architecture'] },
      { label: '裸機生命週期', icon: '⚙️', slugs: ['bmh-lifecycle', 'crds-cluster', 'crds-machine'] },
      { label: '資料與網路', icon: '🌐', slugs: ['data-templates', 'ipam'] },
      { label: '運維與自癒', icon: '🔧', slugs: ['labelsync', 'node-reuse', 'remediation', 'advanced-features'] },
    ],
    difficulty: '🔴 進階',
    difficultyColor: 'text-red-400 bg-red-400/10 border-red-400/30',
    problemStatement: 'Metal3 解決的問題與 MAAS Provider 類似，但走的是另一條路：它不依賴外部平台，而是讓 Kubernetes 自己管理裸機——透過 BMC（伺服器遠端管理介面，如 iDRAC / iLO）直接控制電源、開機、掛載 ISO。整個裸機生命週期完全在 Kubernetes 生態系內閉環。代價是元件更多、概念更複雜，但換來的是更強的可擴充性與對底層硬體的完整掌控。',
    learningPaths: {
      beginner: [
        { slug: 'architecture', note: '了解 BMO / CAPM3 / CAPI 三層架構關係' },
        { slug: 'crds-machine', note: '認識 Metal3Machine / BareMetalHost CRD' },
        { slug: 'bmh-lifecycle', note: '追蹤裸機從 Registering 到 Provisioned 的狀態機' },
      ],
      intermediate: [
        { slug: 'architecture', note: '確認各元件職責邊界' },
        { slug: 'crds-cluster', note: '理解叢集層級資源設計' },
        { slug: 'remediation', note: '深入故障自癒與節點修復機制' },
      ],
      advanced: [
        { slug: 'data-templates', note: '分析 Metal3DataTemplate 與 cloud-init 整合' },
        { slug: 'ipam', note: '研究 IP 位址管理與 IPAddressClaim 設計' },
        { slug: 'advanced-features', note: '探索 node-reuse、labelsync 等進階功能原始碼' },
      ],
    },
  },
}

export const PROJECT_IDS: ProjectId[] = Object.keys(PROJECTS) as ProjectId[]

export function getProject(id: string): ProjectMeta | undefined {
  return PROJECTS[id as ProjectId]
}
