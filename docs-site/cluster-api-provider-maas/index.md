---
layout: doc
title: MAAS Provider — 專案總覽
---

# MAAS Provider — 專案總覽

## 什麼是 MAAS Infrastructure Provider

**MAAS（Metal As A Service）** 是 Canonical 開發的裸金屬管理平台，提供自動化的裸金屬機器生命週期管理，包含硬體探測、作業系統部署、IP 管理與 DNS 設定。

此 Provider 是 **Cluster API（CAPI）的 Infrastructure Provider**，實作 CAPI 所定義的 `InfraCluster` 與 `InfraMachine` contracts，讓 CAPI 能夠透過 MAAS 在裸金屬機器上自動化建立與管理 Kubernetes 叢集。

- **開發維護者：** Spectro Cloud
- **MAAS SDK：** [spectrocloud/maas-client-go](https://github.com/spectrocloud/maas-client-go)
- **API Group：** `infrastructure.cluster.x-k8s.io/v1beta1`

## 在 Cluster API 生態系中的定位

CAPI 採用三層架構，各層職責分明：

```
CAPI Core（Cluster、Machine、MachineDeployment）
    ↓
Infrastructure Provider（本 Provider：MaasCluster、MaasMachine）
    ↓
底層基礎設施（MAAS 管理的裸金屬機器）
```

> 圖示說明：MAAS Provider 在 CAPI 生態系中的層次定位
>
> ![架構示意圖](/diagrams/maas/overview-position.png)
>
> *(此圖將由 fireworks-tech-graph skill 產生)*

**MAAS Provider 負責：**

- **機器分配（Allocate）：** 依資源需求向 MAAS API 請求分配符合條件的裸金屬機器
- **作業系統部署（Deploy）：** 透過 MAAS 部署 OS，並注入 cloud-init userdata
- **DNS 管理：** 自動建立與清除 Control Plane 的 FQDN DNS 記錄
- **Node ProviderID 設定：** 將 MAAS 系統 ID 轉換為 `maas:///{system_id}` 格式，寫入 Kubernetes Node

**與 Bootstrap Provider 的協作：**

Bootstrap Provider（如 KubeadmConfig）負責產生 cloud-init userdata，MAAS Provider 將此 userdata 注入 MAAS Deploy API，機器啟動後自動執行 kubeadm 初始化流程。

## 核心功能一覽

- 裸金屬 Kubernetes 叢集管理（Control Plane 與 Worker Nodes）
- 依資源需求自動分配機器（`minCPU`、`minMemoryInMB`、`tags`、`resourcePool`）
- 支援 **in-memory 部署模式**（需 MAAS ≥ 3.5.10，適合 ephemeral 叢集，OS 完全運行於 RAM）
- 自動 DNS 管理（Control Plane FQDN 自動建立與清除，無需手動設定）
- 多租戶隔離（透過 resource pool 與 tags 區隔不同租戶的機器資源）
- **Failure domains 支援**（可跨可用區分散 Control Plane）
- 機器狀態機（MaasMachine 完整的 Phase 追蹤）

## 技術規格

| 項目 | 說明 |
|------|------|
| API Group | `infrastructure.cluster.x-k8s.io/v1beta1` |
| CRD 數量 | 3（`MaasCluster`、`MaasMachine`、`MaasMachineTemplate`）|
| Controller 數量 | 2（`MaasClusterReconciler`、`MaasMachineReconciler`）|
| CAPI 依賴版本 | `sigs.k8s.io/cluster-api v1.9.4` |
| MAAS SDK | `spectrocloud/maas-client-go v0.1.3-beta1` |
| 固定 Pod CIDR | `192.168.0.0/16` |

## 使用情境

| 情境 | 說明 |
|------|------|
| 企業裸金屬 Kubernetes 環境 | 需要完整掌控硬體，不依賴公有雲 IaaS |
| 多租戶裸金屬資源池 | 透過 resource pool 與 tags 隔離不同團隊的機器資源 |
| 臨時（Ephemeral）叢集 | In-memory 模式快速建立、用完即棄，適合 CI/CD 或測試 |
| 災難復原（DR） | 搭配 MAAS 的硬體庫存管理，快速重建叢集 |
| 混合雲環境 | 與公有雲 provider 並存，統一透過 CAPI 管理 |

## 已知限制

- **Pod CIDR 固定為 `192.168.0.0/16`**，目前無法自訂（硬編碼於 cloud-init 產生邏輯中）
- **不支援原生 Kubernetes 版本升級**，需透過 rolling MachineDeployment 替換節點來完成升級
- **In-memory 部署**需要 MAAS ≥ 3.5.10，且目標機器至少具備 **16 GB RAM**
- MaasCluster 刪除時若 DNS 記錄清除失敗，可能需要手動介入

## 文件導覽

| 頁面 | 說明 |
|------|------|
| [架構設計](./architecture.md) | Controller 與 CRD 組成，環境變數設定 |
| [API 型別與 CRD](./api-types.md) | 所有 CRD 欄位與 Conditions 詳解 |
| [控制器實作](./controllers.md) | Reconcile 流程詳解 |
| [Machine 生命週期](./machine-lifecycle.md) | 從 Allocate 到 Ready 的完整流程 |
| [整合與部署指南](./integration.md) | 安裝步驟、建立叢集、擴縮節點、排查指引 |
| [互動測驗](./quiz.md) | 自我評測 |

::: info 相關章節

本文件系列涵蓋 MAAS Infrastructure Provider 的完整分析：

- **架構設計** → 了解 Controller Manager 啟動流程與環境變數設定
- **API 型別與 CRD** → 深入 `MaasCluster`、`MaasMachine` 的欄位定義
- **控制器實作** → 追蹤 Reconcile loop 的每個步驟
- **Machine 生命週期** → 理解從裸金屬到 Kubernetes Node 的轉換過程
- **整合與外部依賴** → 了解 MAAS SDK 呼叫、DNS 操作、cloud-init 注入
:::
