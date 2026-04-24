---
layout: home

hero:
  name: "Cluster API 生態系"
  text: "原始碼深度分析"
  tagline: 深入剖析 CAPI 核心與各 Infrastructure Provider 的架構設計、控制器邏輯與實作細節
  actions:
    - theme: brand
      text: 📘 Cluster API (CAPI)
      link: /cluster-api/
    - theme: alt
      text: 🔌 Provider 列表
      link: /cluster-api-provider-maas/

features:
  - icon: ⚙️
    title: Cluster API (CAPI)
    details: Kubernetes SIG 官方 Cluster API — 宣告式叢集生命週期管理框架。涵蓋核心控制器、Machine、MachineSet、MachineDeployment、ClusterClass 等完整原始碼分析。
    link: /cluster-api/
    linkText: 開始閱讀

  - icon: 🏗️
    title: Provider MAAS
    details: Spectro Cloud 的 MAAS（Metal as a Service）Infrastructure Provider — 分析如何整合 Canonical MAAS 裸機管理平台實現 Kubernetes 叢集的自動化部署。
    link: /cluster-api-provider-maas/
    linkText: 開始閱讀

  - icon: 🔧
    title: Provider Metal3
    details: metal3-io 的 Metal3 Infrastructure Provider — 透過 Ironic 裸機 provisioning 介面實現 Kubernetes 叢集管理，分析 BareMetalHost、Metal3Machine 等 CRD 與控制器設計。
    link: /cluster-api-provider-metal3/
    linkText: 開始閱讀
---
