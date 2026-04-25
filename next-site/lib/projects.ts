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

export interface StoryScene {
  step: number
  icon: string
  actor: string
  action: string
  detail: string
}

export interface ProjectStory {
  protagonist: string
  challenge: string
  scenes: StoryScene[]
  outcome: string
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
  story: ProjectStory
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
    story: {
      protagonist: '🧑‍💻 SRE 工程師 小王',
      challenge: '公司決定多雲策略：AWS 生產叢集 + 裸機測試叢集 + vSphere 開發叢集，三套完全不同的建置流程，每次新叢集要花 2 週。',
      scenes: [
        { step: 1, icon: '📝', actor: '小王', action: '寫一份 YAML 宣告「我要一個有 3 master + 5 worker 的叢集」', detail: '使用 Cluster、MachineDeployment 等 CRD，就像寫 Kubernetes Deployment 一樣簡單。' },
        { step: 2, icon: '🔄', actor: 'Cluster API Controller', action: '接收宣告，開始 Reconcile Loop', detail: '持續比對「期望狀態」與「實際狀態」，發現缺少機器就通知 Provider 去建立。' },
        { step: 3, icon: '🏗️', actor: 'Infrastructure Provider（AWS/MAAS/vSphere）', action: '收到指令，去對應平台建立實際資源', detail: '每個 Provider 只需實作 CAPI 合約的幾個欄位（status.ready, spec.providerID），核心邏輯由 CAPI 統一管理。' },
        { step: 4, icon: '⚙️', actor: 'Bootstrap Provider（KubeadmConfig）', action: '產生 cloud-init 腳本，讓新機器自動加入叢集', detail: '控制節點用 kubeadm init，工作節點用 kubeadm join，全程自動化，無需 SSH 進機器手動操作。' },
        { step: 5, icon: '✅', actor: '小王', action: '叢集就緒，kubectl get cluster 看到 Provisioned', detail: '3 個 master、5 個 worker 全部健康。同樣的流程在 AWS、裸機、vSphere 上完全一致。' },
      ],
      outcome: '從此小王的團隊用同一套 GitOps workflow 管理所有環境的叢集。新環境 PR 合併 = 叢集自動建立，省下 90% 的手動作業。',
    },
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
    story: {
      protagonist: '🏢 基礎設施工程師 小李',
      challenge: '機房有 200 台裸機伺服器，客戶要求能像雲端一樣按需建立 Kubernetes 叢集。目前靠 Ansible playbook 手動建，出錯率高、無版本控制。',
      scenes: [
        { step: 1, icon: '📋', actor: '小李', action: '把 200 台實體機登記進 MAAS，為每台機器定義 hostname、IP 範圍、電源管理', detail: 'MAAS 負責裸機的 PXE boot、OS 安裝、網路設定。這是 MAAS Provider 的「基礎設施層」。' },
        { step: 2, icon: '📝', actor: '小李', action: '寫一份 MaasMachine + MaasCluster YAML 宣告「我要 3 台 control-plane + 5 台 worker」', detail: '透過 machineType（機器標籤）指定要選哪類裸機，例如 gpu=true 或 role=compute。' },
        { step: 3, icon: '🔍', actor: 'MaasClusterReconciler', action: '向 MAAS API 查詢符合條件的可用機器', detail: '呼叫 MAAS REST API /machines?tags=xxx，選出空閒機器，為它們分配 IP 並設定 DNS。' },
        { step: 4, icon: '⚡', actor: 'MaasMachineReconciler', action: '透過 MAAS 觸發 PXE boot，安裝 OS，等待機器上線', detail: '機器安裝完成後設定 providerID=maas://hostname，CAPI 核心收到 ready 訊號即開始 bootstrap。' },
        { step: 5, icon: '✅', actor: '小李', action: '叢集建立完成，kubectl get cluster 顯示 Provisioned', detail: '整個流程不需 SSH 進任何機器。損壞的機器自動觸發替換流程。' },
      ],
      outcome: '小李的團隊現在用 Git PR 管理叢集生命週期。200 台裸機的利用率從 40% 提升到 85%，故障恢復時間從 4 小時降至 20 分鐘。',
    },
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
    story: {
      protagonist: '📡 電信工程師 小張',
      challenge: '要在全台 50 個邊緣機房部署 5G MEC 節點，每個機房有 2-4 台裸機。節點壞了需要自動修復，不能靠人工介入——機房根本沒人。',
      scenes: [
        { step: 1, icon: '🔩', actor: '小張', action: '在每個機房部署 Ironic 服務，連接裸機 BMC（IPMI/Redfish）', detail: 'Ironic 是 Metal3 的裸機控制層，透過 BMC 可以遠端開關機、PXE 開機、設定 BIOS。BareMetalHost CRD 代表每台實體機器。' },
        { step: 2, icon: '📝', actor: '小張', action: '宣告 BareMetalHost 和 Metal3Machine，描述要部署的 OS image 與網路設定', detail: 'Metal3Data CRD 管理每台機器的 network config 和 meta-data 模板，可以批量產生 cloud-init 設定。' },
        { step: 3, icon: '⚙️', actor: 'Metal3MachineReconciler', action: '選定一台 available 狀態的 BareMetalHost，開始 provisioning', detail: '透過 Ironic 觸發 PXE boot + OS image 寫入磁碟。整個流程狀態機包含：available → provisioning → provisioned。' },
        { step: 4, icon: '🩺', actor: 'Metal3RemediationReconciler', action: '偵測到某台節點的 MachineHealthCheck 失敗（長時間 NotReady）', detail: '自動觸發 BMC 強制重啟（或 OS 重新安裝），無需人工通報。故障處理從告警到修復完全自動化。' },
        { step: 5, icon: '✅', actor: '小張', action: '50 個邊緣機房全部穩定運行，節點故障率 < 0.1%', detail: '每個機房的狀態都在 management cluster 的 BareMetalHost 列表中可見，GitOps 管理所有設定變更。' },
      ],
      outcome: '小張的團隊從此告別凌晨 3 點的緊急通知。50 個邊緣節點的自動修復率達到 95%，人工介入只需要在物理硬體損壞時才觸發。',
    },
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
