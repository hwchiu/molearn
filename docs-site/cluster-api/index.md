---
layout: doc
title: Cluster API — 專案總覽
---

# Cluster API — 專案總覽

## 什麼是 Cluster API

**Cluster API（CAPI）** 是 Kubernetes SIG Cluster Lifecycle 的子專案，提供聲明式、Kubernetes 風格的 API 來管理叢集的整個生命週期——包括建立、升級、擴縮與刪除。

### 核心理念

**用 Kubernetes 管理 Kubernetes**：叢集本身被表示為 Kubernetes 物件（CRDs），可透過 GitOps 工具（如 Flux、ArgoCD）進行版本控制與自動化管理。

### 關鍵概念

| 概念 | 說明 |
|------|------|
| **Management Cluster** | 運行 CAPI controllers 的 Kubernetes 叢集，負責協調所有 Workload Cluster 的生命週期 |
| **Workload Cluster** | 由 CAPI 所管理的目標叢集，是業務工作負載實際運行的環境 |
| **統一抽象層** | 隱藏不同基礎設施（AWS、Azure、GCP、裸機等）的差異，對外提供一致的 API 介面 |
| **Provider 模型** | CAPI 定義介面合約，具體實作由各 Infrastructure / Bootstrap / ControlPlane Provider 負責 |

![CAPI Provider 生態系概覽](/diagrams/capi/provider-ecosystem.png)

---

## 核心設計哲學：Provider 模型

CAPI 採用高度模組化的 Provider 架構，將叢集生命週期的不同面向拆分給專門的 Provider 負責：

| Provider 類型 | 職責 | 範例 |
|--------------|------|------|
| **Infrastructure Provider** | 建立 VM 或裸機節點，提供實際的計算資源 | CAPMAAS, CAPM3, CAPAWS, CAPZ |
| **Bootstrap Provider** | 產生機器啟動設定（cloud-init / ignition），完成節點初始化與 Kubernetes 安裝 | KubeadmConfig（內建）|
| **ControlPlane Provider** | 管理 Control Plane 節點的建立、升級與健康維護 | KubeadmControlPlane（內建）|
| **IPAM Provider** | 提供 IP 位址管理，為節點分配靜態 IP | ipam.metal3.io, ipam.cluster.x-k8s.io |

這種設計使得基礎設施的替換與組合成為可能，同時保持核心邏輯的穩定性。

---

## 六大 API 群組一覽

CAPI 的功能分散在六個 Kubernetes API Group 中：

| API Group | 版本 | 主要 CRD | 用途 |
|-----------|------|---------|------|
| `cluster.x-k8s.io` | v1beta1 | Cluster, Machine, MachineSet, MachineDeployment, MachinePool, ClusterClass, MachineHealthCheck, MachineDrainRule | 核心叢集管理 |
| `bootstrap.cluster.x-k8s.io` | v1beta1 | KubeadmConfig, KubeadmConfigTemplate | 機器啟動設定 |
| `controlplane.cluster.x-k8s.io` | v1beta1 | KubeadmControlPlane, KubeadmControlPlaneTemplate | Control Plane 管理 |
| `addons.cluster.x-k8s.io` | v1beta1 | ClusterResourceSet, ClusterResourceSetBinding | 附加元件管理 |
| `ipam.cluster.x-k8s.io` | v1alpha1 | IPAddress, IPAddressClaim | IP 位址管理 |
| `runtime.cluster.x-k8s.io` | v1alpha1 | ExtensionConfig | Runtime SDK 擴展 |

---

## 所有 16 個 CRD 全覽

| CRD | API Group | 用途 |
|-----|-----------|------|
| `Cluster` | cluster.x-k8s.io | 叢集宣告，引用 Infrastructure / ControlPlane Provider |
| `Machine` | cluster.x-k8s.io | 單一機器節點管理 |
| `MachineSet` | cluster.x-k8s.io | 固定數量的 Machine 群組 |
| `MachineDeployment` | cluster.x-k8s.io | 支援滾動更新的 Machine 群組 |
| `MachinePool` | cluster.x-k8s.io | 支援 provider-native 擴縮的機器池（Beta） |
| `ClusterClass` | cluster.x-k8s.io | 可重用叢集模板定義 |
| `MachineHealthCheck` | cluster.x-k8s.io | 機器健康檢查與自動修復 |
| `MachineDrainRule` | cluster.x-k8s.io | 自定義節點 drain 規則 |
| `KubeadmConfig` | bootstrap.cluster.x-k8s.io | 產生 cloud-init / ignition userdata |
| `KubeadmConfigTemplate` | bootstrap.cluster.x-k8s.io | KubeadmConfig 模板 |
| `KubeadmControlPlane` | controlplane.cluster.x-k8s.io | Kubeadm 型 Control Plane 管理 |
| `KubeadmControlPlaneTemplate` | controlplane.cluster.x-k8s.io | KCP 模板 |
| `ClusterResourceSet` | addons.cluster.x-k8s.io | 自動部署 CNI 等附加元件 |
| `ClusterResourceSetBinding` | addons.cluster.x-k8s.io | CRS 應用狀態追蹤 |
| `IPAddress` | ipam.cluster.x-k8s.io | IP 位址分配記錄 |
| `IPAddressClaim` | ipam.cluster.x-k8s.io | 請求 IP 位址 |

---

## Feature Gates 總覽

CAPI 使用 Feature Gates 控制實驗性功能的開關：

| Feature Gate | 狀態 | 預設值 | 說明 |
|-------------|------|-------|------|
| `MachinePool` | Beta | on | MachinePool CRD 支援 |
| `ClusterTopology` | Beta | on | ClusterClass / Topology 支援 |
| `RuntimeSDK` | Alpha | off | Runtime Extension Hooks |
| `MachineSetPreflightChecks` | Beta | on | MachineSet 部署前健康檢查 |
| `InPlaceUpdates` | Alpha | off | 原地更新（不重建節點）|
| `KubeadmBootstrapFormatIgnition` | Alpha | off | Ignition 格式 Bootstrap |
| `MachinePoolMachines` | Alpha | off | MachinePool 個別 Machine 管理 |

---

## 程式碼規模

::: info 專案規模（cluster-api 主倉庫）
- **1,331** 個 Go 原始檔
- **6** 個 API Groups
- **16** 個 CRD
- **13+** 個 Controllers
- 約 **270k+ LoC**
:::

---

## 文件導覽

| 頁面 | 說明 |
|------|------|
| [架構設計](./architecture.md) | Manager 架構、Provider 合約、ClusterCache |
| [Cluster 與 Machine](./api-cluster-machine.md) | 核心資源欄位詳解 |
| [MachineSet 與 MachineDeployment](./api-machineset-machinedeployment.md) | 滾動更新策略 |
| [KubeadmControlPlane](./api-kubeadm-controlplane.md) | CP 管理與安全更新 |
| [Bootstrap KubeadmConfig](./bootstrap-kubeadmconfig.md) | cloud-init / ignition 生成 |
| [核心控制器](./controller-core.md) | Cluster / Machine / MachineSet / MD reconcile 分析 |
| [KCP Controller](./controller-kcp.md) | Control Plane 滾動更新控制器 |
| [Topology Controller](./controller-topology.md) | ClusterClass 驅動的拓撲管理 |
| [Machine 生命週期](./machine-lifecycle.md) | Provisioning → Running → Drain → Delete |
| [MachineHealthCheck](./machine-health-check.md) | 健康檢查與 Circuit Breaker |
| [ClusterClass 與 Topology](./clusterclass-topology.md) | 可重用叢集模板 |
| [ClusterResourceSet](./addons-clusterresourceset.md) | 附加元件自動部署 |
| [Provider 合約與 Runtime Hooks](./provider-contracts-runtime-hooks.md) | 合約規範與擴展點 |
| [clusterctl](./clusterctl.md) | CLI 工具使用指南 |
| [互動式測驗](./quiz.md) | 自我評測 |
