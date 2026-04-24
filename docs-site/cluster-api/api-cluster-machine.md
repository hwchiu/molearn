---
layout: doc
title: Cluster API — Cluster 與 Machine 核心資源
---

# Cluster 與 Machine 核心資源

本頁深入解析 Cluster API 兩個最基礎的資源：**Cluster** 與 **Machine**。這兩個資源是整個 CAPI 架構的骨幹，其他所有資源（MachineDeployment、KubeadmControlPlane 等）皆圍繞它們運作。

:::info 相關章節
- [架構設計](/cluster-api/architecture) — Provider 模型與整體架構
- [MachineSet 與 MachineDeployment](/cluster-api/api-machineset-machinedeployment) — Worker 節點管理
- [KubeadmControlPlane](/cluster-api/api-kubeadm-controlplane) — Control Plane 管理
- [Machine 生命週期](/cluster-api/machine-lifecycle) — Machine 完整生命週期與刪除流程
:::

---

## Cluster 資源

### 概念說明

`Cluster` 是 CAPI 的頂層資源，代表一個完整的 Kubernetes 叢集。它本身不直接管理基礎設施或 Control Plane，而是透過兩個引用（Reference）將工作委派給對應的 Provider：

- **`infrastructureRef`** → 指向 Infrastructure Provider 資源（如 `Metal3Cluster`、`AWSCluster`）
- **`controlPlaneRef`** → 指向 Control Plane Provider 資源（如 `KubeadmControlPlane`）

這種設計讓 CAPI 核心邏輯與底層實作完全解耦，只要 Provider 遵守 CAPI 合約（實作 `status.ready` 等欄位），就能無縫整合。

### ClusterSpec 欄位詳解

| 欄位 | 類型 | 說明 |
|------|------|------|
| `paused` | bool | 暫停所有 reconcile 操作 |
| `clusterNetwork.pods.cidrBlocks` | []string | Pod CIDR 範圍 |
| `clusterNetwork.services.cidrBlocks` | []string | Service CIDR 範圍 |
| `clusterNetwork.serviceDomain` | string | Service DNS domain（預設 cluster.local）|
| `controlPlaneEndpoint.host` | string | API server 的 IP 或 hostname |
| `controlPlaneEndpoint.port` | int | API server port（預設 6443）|
| `controlPlaneRef` | ObjectReference | ControlPlane Provider 資源引用（例如 KubeadmControlPlane）|
| `infrastructureRef` | ObjectReference | Infrastructure Provider 資源引用（例如 Metal3Cluster）|
| `topology` | Topology | ClusterClass 拓撲設定（ClusterTopology feature gate）|

### ClusterStatus 欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `phase` | string | 叢集目前 phase（見下方狀態說明）|
| `infrastructureReady` | bool | InfraCluster.status.ready = true |
| `controlPlaneReady` | bool | ControlPlane.status.ready = true |
| `controlPlaneInitialized` | bool | 第一個 CP node 已加入叢集 |
| `conditions` | Conditions | 目前服務狀態 |
| `failureDomains` | FailureDomains | 從 InfraCluster 取得的 failure domain 清單 |
| `observedGeneration` | int64 | 最後 reconcile 的 generation |

### Cluster 生命週期 Phase

| Phase | 說明 |
|-------|------|
| `Pending` | 叢集剛建立，等待 InfraCluster/ControlPlane 初始化 |
| `Provisioning` | 基礎設施正在建立 |
| `Provisioned` | 所有基礎設施就緒，叢集正常運行 |
| `Deleting` | 叢集正在被刪除 |
| `Failed` | 叢集進入不可恢復的錯誤狀態 |
| `Unknown` | 叢集狀態未知 |

### Cluster 與 Provider 的關聯方式

以下 YAML 展示 Cluster 如何同時引用 Infrastructure Provider（Metal3Cluster）和 Control Plane Provider（KubeadmControlPlane）：

```yaml
apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: my-cluster
  namespace: default
spec:
  clusterNetwork:
    pods:
      cidrBlocks: ["10.244.0.0/16"]
    services:
      cidrBlocks: ["10.96.0.0/12"]
    serviceDomain: "cluster.local"
  controlPlaneEndpoint:
    host: 192.168.1.100
    port: 6443
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
    kind: Metal3Cluster           # InfraCluster
    name: my-metal3-cluster
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta1
    kind: KubeadmControlPlane     # CP Provider
    name: my-cluster-cp
```

![Cluster 資源關係圖](/diagrams/capi/cluster-resource-relations.png)

---

## Machine 資源

### 概念說明

`Machine` 代表叢集中的一個節點（Control Plane 或 Worker）。在實際操作中，**通常不直接手動建立 Machine**，而是透過以下方式間接管理：

- **Worker 節點** → 透過 `MachineDeployment` → `MachineSet` 自動建立
- **Control Plane 節點** → 透過 `KubeadmControlPlane` 自動建立

Machine 同樣採用 Provider 引用模式：`infrastructureRef` 指向 InfraMachine（如 `Metal3Machine`），`bootstrap.configRef` 指向 Bootstrap Provider（如 `KubeadmConfig`）。

### MachineSpec 欄位詳解

| 欄位 | 類型 | 必填 | 說明 |
|------|------|:----:|------|
| `clusterName` | string | ✅ | 所屬叢集名稱（建立後不可變）|
| `bootstrap.configRef` | ObjectReference | ❌* | Bootstrap Provider 資源引用（例如 KubeadmConfig）|
| `bootstrap.dataSecretName` | string | ❌* | 直接指定 bootstrap data secret 名稱 |
| `infrastructureRef` | ObjectReference | ✅ | InfraMachine 資源引用（例如 Metal3Machine）|
| `version` | string | ❌ | Kubernetes 版本（例如 v1.28.0，webhook 自動加 v 前綴）|
| `providerID` | string | ❌（唯讀）| 由 InfraMachine controller 設定 |
| `failureDomain` | string | ❌ | 指定部署的 failure domain |
| `nodeDrainTimeout` | Duration | ❌ | Node drain 超時（預設無限）|
| `nodeVolumeDetachTimeout` | Duration | ❌ | Volume detach 超時（預設無限）|
| `nodeDeletionTimeout` | Duration | ❌ | Node 刪除超時（預設 10s）|
| `readinessGates` | []MachineReadinessGate | ❌ | 額外的就緒條件 |

> \* `bootstrap.configRef` 和 `bootstrap.dataSecretName` 至少需要提供一個。

### MachineStatus 欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `phase` | string | Machine 目前 phase |
| `bootstrapReady` | bool | Bootstrap data 已就緒 |
| `infrastructureReady` | bool | InfraMachine.status.ready = true |
| `addresses` | []MachineAddress | 節點 IP 地址（來自 InfraMachine）|
| `nodeRef` | ObjectReference | 對應的 K8s Node 物件引用 |
| `conditions` | Conditions | 目前服務狀態 |
| `deletion.waitForNodeVolumeDetach` | bool | 是否正在等待 volume detach |

### Machine 生命週期 Phase

| Phase | 說明 | 觸發條件 |
|-------|------|---------|
| `Pending` | Machine 剛建立 | 初始狀態 |
| `Provisioning` | Bootstrap 或 Infrastructure 尚未就緒 | bootstrapReady=false 或 infraReady=false |
| `Provisioned` | Bootstrap + Infrastructure 就緒，等待 Node 加入 | bootstrapReady=true, infraReady=true |
| `Running` | Node 已加入叢集（nodeRef 已設定）| nodeRef != nil |
| `Deleting` | Machine 被標記刪除 | DeletionTimestamp != nil |
| `Deleted` | Machine 已刪除完成 | 終止狀態 |
| `Failed` | 不可恢復錯誤 | failureReason/Message 設定 |
| `Unknown` | 狀態未知 | 無法確定狀態 |

### 常用 Labels 與 Annotations

| Label / Annotation | 說明 |
|--------------------|------|
| `cluster.x-k8s.io/cluster-name` | 機器所屬叢集名稱（自動設定）|
| `cluster.x-k8s.io/control-plane` | 標記此 Machine 為 Control Plane 節點 |
| `cluster.x-k8s.io/paused` | 暫停此 Machine 的 reconcile |
| `cluster.x-k8s.io/delete-machine` | 標記此 Machine 優先被刪除（MachineSet 縮容時使用）|
| `machine.cluster.x-k8s.io/exclude-node-draining` | 刪除時跳過 node drain |
| `cluster.x-k8s.io/remediate-machine` | 觸發 MachineHealthCheck remediation |
| `machine.cluster.x-k8s.io/certificates-expiry` | 憑證到期時間（ISO 8601 格式）|
| `topology.cluster.x-k8s.io/owned` | 標記此 Machine 被 Topology Controller 管理 |

---

## Webhook 驗證限制

CAPI 透過 Admission Webhook 對 Machine 資源進行驗證與預設值填充（defaulting）：

| 欄位 | 規則 | 說明 |
|------|------|------|
| `spec.clusterName` | Immutable | 機器不能在叢集間移動 |
| `spec.version` | 自動加 v 前綴 | `1.28.0` → `v1.28.0` |
| `spec.nodeDeletionTimeout` | 預設 10s | webhook defaulting 自動填充 |
| `spec.bootstrap` | 至少一個 | `configRef` 或 `dataSecretName` 必填一個 |

---

## Machine 刪除流程概要

Machine 刪除涉及多個步驟，以確保節點安全退出叢集：

1. 設定 `DeletionTimestamp` → phase 進入 `Deleting`
2. 執行 **pre-drain hooks**（若有設定）
3. **Cordon Node**（標記不可排程）
4. **Drain Node**（驅逐 Pod，PDB-aware）
5. 等待 `VolumeAttachments` detach
6. 執行 **pre-terminate hooks**（若有設定）
7. 刪除 Bootstrap 與 InfraMachine 資源
8. 移除 finalizer，完成刪除

:::info 詳細刪除流程
完整的 Machine 刪除流程（包含 hook 機制、PDB 處理、逾時邏輯）請參閱：[Machine 生命週期](/cluster-api/machine-lifecycle)
:::
