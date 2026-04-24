---
layout: doc
title: Cluster API — Addons 與 ClusterResourceSet
---

# Addons 與 ClusterResourceSet

::: info 相關章節
- [架構概覽](/cluster-api/architecture)
- [ClusterClass 與 Topology](/cluster-api/clusterclass-topology)
- [Core Controller](/cluster-api/controller-core)
:::

## 什麼是 ClusterResourceSet

ClusterResourceSet（CRS）是 Cluster API 提供的 Addon 管理機制，核心功能是**自動將 ConfigMap 或 Secret 中定義的 Kubernetes 資源套用到符合條件的 workload cluster**。

傳統上，新叢集建立完成後，工程師需要手動安裝 CNI 插件、StorageClass、監控 agent 等元件。CRS 解決了這個問題：只要叢集帶有特定 label，CAPI 控制器就會自動將對應的 addon 資源部署進去。

| 項目 | 說明 |
|------|------|
| Feature Gate | `ClusterResourceSet`（GA，預設開啟） |
| CRD API group | `addons.cluster.x-k8s.io/v1beta1` |
| 適用場景 | CNI、StorageClass、監控 agent、初始 RBAC 等 |

---

## ClusterResourceSet CRD 結構

### Spec 欄位

| 欄位 | 類型 | 必要 | 說明 |
|------|------|------|------|
| `spec.clusterSelector` | LabelSelector | ✅ | 選擇要套用資源的叢集 |
| `spec.resources` | []ResourceRef | ✅ | 要套用的 ConfigMap/Secret 列表 |
| `spec.strategy` | string | ❌ | `ApplyOnce`（預設）或 `Reconcile` |

### ResourceRef 結構

| 欄位 | 類型 | 說明 |
|------|------|------|
| `name` | string | ConfigMap 或 Secret 的名稱 |
| `kind` | string | `ConfigMap` 或 `Secret` |

### 完整範例

```yaml
apiVersion: addons.cluster.x-k8s.io/v1beta1
kind: ClusterResourceSet
metadata:
  name: calico-cni
  namespace: default
spec:
  strategy: Reconcile
  clusterSelector:
    matchLabels:
      cni: calico
  resources:
    - name: calico-configmap
      kind: ConfigMap
    - name: calico-secret
      kind: Secret
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: calico-configmap
  namespace: default
data:
  calico.yaml: |
    apiVersion: apps/v1
    kind: DaemonSet
    metadata:
      name: calico-node
      namespace: kube-system
    ...
```

---

## 套用策略（Strategy）

### ApplyOnce（預設）

- 每個 resource **只套用一次**
- 套用後，即使 ConfigMap 內容修改，也不會重新套用
- 適合初始化型的資源，例如 StorageClass、初始 RBAC

### Reconcile

- **持續監控**並確保資源與 ConfigMap/Secret 中的定義一致
- ConfigMap 更新後，會自動更新 workload cluster 中的對應資源
- 適合需要持續同步的資源，例如 CNI 設定、監控 agent

::: info 注意
Strategy 一旦設定就**不可變更**（immutable）。若需要調整策略，必須刪除並重新建立 ClusterResourceSet。
:::

---

## ClusterResourceSetBinding

ClusterResourceSetBinding 是 CAPI 自動建立的物件，**不需要手動管理**。

- 建立在與 workload cluster 相同的 namespace
- 記錄哪些資源已套用、套用時間、套用結果（hash）
- 供 CAPI controller 判斷是否需要（重新）套用某個資源

```yaml
# 自動建立的 ClusterResourceSetBinding 範例
apiVersion: addons.cluster.x-k8s.io/v1beta1
kind: ClusterResourceSetBinding
metadata:
  name: my-cluster
  namespace: default
spec:
  bindings:
    - clusterResourceSetName: calico-cni
      resources:
        - applied: true
          hash: sha256:abc123...
          kind: ConfigMap
          lastAppliedTime: "2024-01-15T10:30:00Z"
          name: calico-configmap
```

---

## 實際應用場景

### 場景 1 — 自動安裝 CNI

| 步驟 | 操作 |
|------|------|
| 1 | 建立包含 Calico YAML 的 ConfigMap |
| 2 | 建立 ClusterResourceSet，選擇器匹配 `cni: calico` 的叢集 |
| 3 | 在 Cluster 物件加上 label `cni: calico` |
| 4 | CAPI 自動將 Calico 套用到 workload cluster |

### 場景 2 — 多環境 Addon 管理

針對不同環境使用不同的 CRS，搭配 label 做到精細化控制：

```yaml
# 開發環境 CRS
apiVersion: addons.cluster.x-k8s.io/v1beta1
kind: ClusterResourceSet
metadata:
  name: dev-addons
spec:
  clusterSelector:
    matchLabels:
      environment: dev
  resources:
    - name: dev-storage-class
      kind: ConfigMap
    - name: dev-monitoring
      kind: ConfigMap

# 生產環境 CRS（不同資源，更嚴格設定）
apiVersion: addons.cluster.x-k8s.io/v1beta1
kind: ClusterResourceSet
metadata:
  name: prod-addons
spec:
  strategy: Reconcile
  clusterSelector:
    matchLabels:
      environment: production
  resources:
    - name: prod-storage-class
      kind: ConfigMap
    - name: prod-monitoring
      kind: ConfigMap
    - name: prod-network-policies
      kind: ConfigMap
```

### 場景 3 — 與 ClusterClass 整合

在使用 ClusterClass 建立叢集時，可以在 Cluster 物件的 `metadata.labels` 中預先設定好對應的 addon label。如此一來，只要叢集透過 ClusterClass 建立完成，CRS 控制器便會立即偵測到符合條件的叢集並自動套用 addon，實現**「建立叢集即自動安裝 addon」**的完整自動化流程，無需任何手動介入。

---

## 注意事項

::: warning 使用限制
- ConfigMap/Secret 必須與 ClusterResourceSet 在**相同 namespace**
- CRS 套用的資源會使用 `server-side apply`，請確保資源 YAML 格式正確且欄位定義完整
- 若 workload cluster 的 API Server 不可用，CRS 控制器會持續重試，直到套用成功為止
:::

::: tip 資源大小建議
- 套用的資源大小受 ConfigMap/Secret 本身的大小限制（最大 **1MB**）
- 大型 addon（如 Istio）建議**分拆為多個 ConfigMap**，分別放入不同的 ResourceRef
:::
