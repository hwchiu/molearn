import { defineConfig } from 'vitepress'

// ─── Sidebars ────────────────────────────────────────────────────────────────
const maasSidebar = [
  {
    text: '🗺️ 學習路徑',
    items: [
      { text: '學習路徑入口', link: '/cluster-api-provider-maas/learning-path/' },
      { text: '故事驅動式', link: '/cluster-api-provider-maas/learning-path/story' },
    ],
  },
  {
    text: 'Cluster API Provider MAAS',
    items: [
      { text: '專案總覽', link: '/cluster-api-provider-maas/' },
    ],
  },
  {
    text: '系統架構',
    collapsed: false,
    items: [
      { text: '架構概覽', link: '/cluster-api-provider-maas/architecture' },
    ],
  },
  {
    text: '核心概念',
    collapsed: false,
    items: [
      { text: '核心功能分析', link: '/cluster-api-provider-maas/core-features' },
      { text: '控制器與 API', link: '/cluster-api-provider-maas/controllers-api' },
      { text: '控制器實作', link: '/cluster-api-provider-maas/controllers' },
      { text: 'Machine 生命週期', link: '/cluster-api-provider-maas/machine-lifecycle' },
    ],
  },
  {
    text: 'API 與整合',
    collapsed: true,
    items: [
      { text: 'API 型別與 CRD', link: '/cluster-api-provider-maas/api-types' },
      { text: '外部整合', link: '/cluster-api-provider-maas/integration' },
    ],
  },
]

const metal3Sidebar = [
  {
    text: '🗺️ 學習路徑',
    items: [
      { text: '學習路徑入口', link: '/cluster-api-provider-metal3/learning-path/' },
      { text: '故事驅動式', link: '/cluster-api-provider-metal3/learning-path/story' },
    ],
  },
  {
    text: 'Cluster API Provider Metal3',
    items: [
      { text: '專案總覽', link: '/cluster-api-provider-metal3/' },
    ],
  },
  {
    text: '系統架構',
    collapsed: false,
    items: [
      { text: '架構概覽', link: '/cluster-api-provider-metal3/architecture' },
    ],
  },
  {
    text: '核心概念',
    collapsed: false,
    items: [
      { text: '核心功能分析', link: '/cluster-api-provider-metal3/core-features' },
      { text: '控制器與 API', link: '/cluster-api-provider-metal3/controllers-api' },
      { text: 'BMH 生命週期', link: '/cluster-api-provider-metal3/bmh-lifecycle' },
    ],
  },
  {
    text: 'API 與整合',
    collapsed: true,
    items: [
      { text: '外部整合', link: '/cluster-api-provider-metal3/integration' },
    ],
  },
]

const capiSidebar = [
  {
    text: '🗺️ 學習路徑',
    items: [
      { text: '學習路徑入口', link: '/cluster-api/learning-path/' },
      { text: '故事驅動式', link: '/cluster-api/learning-path/story' },
    ],
  },
  {
    text: 'Cluster API',
    items: [
      { text: '專案總覽', link: '/cluster-api/' },
    ],
  },
  {
    text: '系統架構',
    collapsed: false,
    items: [
      { text: '架構設計', link: '/cluster-api/architecture' },
    ],
  },
  {
    text: 'API 資源詳解',
    collapsed: false,
    items: [
      { text: 'Cluster 與 Machine', link: '/cluster-api/api-cluster-machine' },
      { text: 'MachineSet 與 MachineDeployment', link: '/cluster-api/api-machineset-machinedeployment' },
      { text: 'KubeadmControlPlane', link: '/cluster-api/api-kubeadm-controlplane' },
      { text: 'Bootstrap KubeadmConfig', link: '/cluster-api/bootstrap-kubeadmconfig' },
    ],
  },
  {
    text: '控制器分析',
    collapsed: false,
    items: [
      { text: '核心控制器', link: '/cluster-api/controller-core' },
      { text: 'KCP Controller', link: '/cluster-api/controller-kcp' },
      { text: 'Topology Controller', link: '/cluster-api/controller-topology' },
    ],
  },
  {
    text: '進階主題',
    collapsed: true,
    items: [
      { text: 'Machine 生命週期', link: '/cluster-api/machine-lifecycle' },
      { text: 'MachineHealthCheck', link: '/cluster-api/machine-health-check' },
      { text: 'ClusterClass 與 Topology', link: '/cluster-api/clusterclass-topology' },
      { text: 'ClusterResourceSet', link: '/cluster-api/addons-clusterresourceset' },
      { text: 'Provider 合約與 Runtime Hooks', link: '/cluster-api/provider-contracts-runtime-hooks' },
      { text: 'clusterctl', link: '/cluster-api/clusterctl' },
    ],
  },
  {
    text: '自我評測',
    items: [
      { text: '互動式測驗', link: '/cluster-api/quiz' },
    ],
  },
]

// ─── Main Config ─────────────────────────────────────────────────────────────
export default defineConfig({
  title: 'Cluster API 深度分析',
  description: 'Cluster API 生態系原始碼深度分析：CAPI、MAAS Provider、Metal3 Provider',
  lang: 'zh-TW',

  themeConfig: {
    nav: [
      { text: '🏠 首頁', link: '/' },
      {
        text: '📦 專案',
        items: [
          { text: 'Cluster API (CAPI)', link: '/cluster-api/' },
          { text: 'Provider: MAAS', link: '/cluster-api-provider-maas/' },
          { text: 'Provider: Metal3', link: '/cluster-api-provider-metal3/' },
        ],
      },
    ],

    sidebar: {
      '/cluster-api-provider-maas/': maasSidebar,
      '/cluster-api-provider-metal3/': metal3Sidebar,
      '/cluster-api/': capiSidebar,
    },

    search: { provider: 'local' },
    outline: { label: '本頁目錄', level: [2, 3] },
    docFooter: { prev: '上一頁', next: '下一頁' },
    lastUpdated: { text: '最後更新' },
  },
})
