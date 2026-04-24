---
layout: doc
title: Metal3 Provider — 專案總覽
---

# Metal3 Provider — 專案總覽

## 什麼是 cluster-api-provider-metal3

**cluster-api-provider-metal3（CAPM3）** 是 [Cluster API（CAPI）](https://cluster-api.sigs.k8s.io/) 的 **Infrastructure Provider**，負責橋接 Cluster API 與 Metal3 的 Bare Metal Operator（BMO），讓 Cluster API 能夠以宣告式方式管理裸機伺服器的生命週期。

::: info 核心設計原則
CAPM3 **不直接控制裸機硬體**，而是透過 `BareMetalHost`（BMH）CRD 與 Metal3/Ironic 溝通：

- **CAPM3** 負責機器層邏輯：如何選擇 BMH、組合 image、metadata、network data
- **BMO（Bare Metal Operator）** 負責實際硬體操作：PXE 開機、IPMI 電源控制、Redfish API 呼叫
- **Ironic** 執行底層裸機管理，BMO 透過 Ironic API 驅動實際硬體

CAPM3 屬於 [metal3-io](https://github.com/metal3-io) 組織，與 BMO、Ironic 共同構成完整的 Metal3 裸機管理生態系。
:::

![Metal3 生態系架構圖](/diagrams/metal3/ecosystem.png)

---

## Metal3 生態系概覽

Metal3 生態系由四個核心元件組成，各自負責不同層次的職責：

| 元件 | 角色 | 核心職責 |
|------|------|---------|
| **Ironic** | 裸機管理 API | PXE 開機、IPMI 電源控制、Redfish/iDRAC 介面 |
| **Baremetal Operator（BMO）** | K8s Operator | 管理 `BareMetalHost` CRD，驅動 Ironic 完成硬體操作 |
| **CAPM3** | CAPI Infrastructure Provider | 實作 CAPI InfraCluster/InfraMachine 合約，管理 CAPI Machine → BMH 的映射 |
| **IPAM**（ipam.metal3.io） | IP 位址管理 | 提供 `IPPool` CRD，為機器分配靜態 IP |

::: tip 元件協作流程
1. 使用者建立 CAPI `Cluster` + `Machine` 物件
2. CAPM3 的 `Metal3MachineReconciler` 選擇符合條件的 `BareMetalHost`
3. CAPM3 設定 BMH 的 `spec.image`、`userData`、`metaData`、`networkData`
4. BMO 監聽 BMH 狀態變化，呼叫 Ironic 完成 PXE 開機與系統部署
5. 節點上線後，CAPM3 取得 ProviderID，CAPI 完成 Machine 狀態更新
:::

---

## 九個 CRD 一覽

CAPM3 定義了 9 個 CRD，涵蓋叢集管理、機器管理、資料模板與 Remediation：

| CRD | Short Name | 用途 |
|-----|-----------|------|
| `Metal3Cluster` | `m3c` | 叢集層級：apiEndpoint 設定（controlPlaneEndpoint pass-through） |
| `Metal3Machine` | `m3m` | 機器層級：BMH 選取、image、metadata/networkdata 設定 |
| `Metal3MachineTemplate` | `m3mt` | 不可變機器模板（供 MachineDeployment 使用） |
| `Metal3Data` | `m3d` | 每台機器實際渲染後的 metadata/networkdata 資料 |
| `Metal3DataTemplate` | `m3dt` | Jinja2 模板，定義 metadata/networkdata 格式 |
| `Metal3DataClaim` | `m3dc` | Metal3Machine 請求 Metal3Data 的宣告物件 |
| `Metal3Remediation` | `m3r` | 自定義 remediation（支援 Reboot 策略） |
| `Metal3RemediationTemplate` | — | Remediation 模板（供 MachineHealthCheck 使用） |
| `Metal3ClusterTemplate` | `m3ct` | 叢集模板（供 ClusterClass 拓撲使用） |

::: info API Group
所有 CRD 均屬於 `infrastructure.cluster.x-k8s.io/v1beta1` API Group。
:::

---

## 七個 Controller 一覽

CAPM3 包含七個 Reconciler，各自負責不同 CRD 的調和邏輯：

| Controller | 負責對象 | 核心職責 |
|-----------|---------|---------|
| `Metal3ClusterReconciler` | `Metal3Cluster` | 設定 controlPlaneEndpoint（pass-through 模式），管理叢集 Finalizer |
| `Metal3MachineReconciler` | `Metal3Machine` | 選擇 BMH、設定 image/userdata/metadata/networkdata、設定 ProviderID |
| `Metal3DataReconciler` | `Metal3Data` | 渲染 Jinja2 模板，產生 metadata/networkdata Secrets |
| `Metal3DataTemplateReconciler` | `Metal3DataTemplate` | 追蹤 Metal3DataClaim，確保對應 Metal3Data 物件建立 |
| `Metal3MachineTemplateReconciler` | `Metal3MachineTemplate` | 管理節點重用（Node Reuse）labels，支援升級場景 |
| `Metal3LabelSyncReconciler` | `Metal3Machine` | 同步 BMH labels 到對應的 K8s Node 物件 |
| `Metal3RemediationReconciler` | `Metal3Remediation` | 執行 Reboot remediation，配合 MachineHealthCheck 運作 |

---

## 文件導覽

| 頁面 | 說明 |
|------|------|
| [架構設計](./architecture.md) | 系統架構、BMH 生命週期流程、元件關係圖 |
| [BMH 生命週期](./bmh-lifecycle.md) | BareMetalHost 狀態機、CAPM3 與 BMO 協作細節 |
| [叢集層級 CRD](./crds-cluster.md) | Metal3Cluster、Metal3ClusterTemplate |
| [機器層級 CRD](./crds-machine.md) | Metal3Machine、Metal3MachineTemplate |
| [Data Templates](./data-templates.md) | Metal3DataTemplate、Metal3Data、Metal3DataClaim |
| [IPAM 整合](./ipam.md) | IP 位址管理、IPPool、雙重 IPAM 支援 |
| [Remediation](./remediation.md) | MachineHealthCheck + Metal3Remediation 整合 |
| [LabelSync](./labelsync.md) | BMH labels 同步到 K8s Node |
| [Node Reuse](./node-reuse.md) | 升級時重用同一台裸機（避免重新 provision） |
| [進階功能](./advanced-features.md) | BMH Name-Based Preallocation 等高級特性 |
| [互動式測驗](./quiz.md) | 自我評測 |

---

## 專案基本資訊

| 項目 | 內容 |
|------|------|
| **GitHub** | [metal3-io/cluster-api-provider-metal3](https://github.com/metal3-io/cluster-api-provider-metal3) |
| **API Group** | `infrastructure.cluster.x-k8s.io/v1beta1` |
| **程式碼規模** | 約 58k LoC，144 個 Go 檔案 |
| **主要相依** | `sigs.k8s.io/cluster-api`、`github.com/metal3-io/baremetal-operator` |
| **運行需求** | 需同時運行 BMO（Bare Metal Operator）與 Ironic |

::: warning 部署前提
CAPM3 本身不包含 Ironic 或 BMO。在部署 CAPM3 之前，必須確保叢集中已運行：
- **Bare Metal Operator（BMO）**：管理 BareMetalHost CRD
- **Ironic**：提供裸機管理 API

建議使用 [Metal3 Dev Environment](https://github.com/metal3-io/metal3-dev-env) 快速建立完整的開發測試環境。
:::
