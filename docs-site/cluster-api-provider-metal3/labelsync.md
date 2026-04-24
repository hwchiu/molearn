---
layout: doc
title: Metal3 Provider — Label 同步機制
---

# Metal3 Provider — Label 同步機制

::: info 相關章節
- [架構概覽](/cluster-api-provider-metal3/architecture) — 了解 CAPM3 整體架構
- [機器層級 CRD](/cluster-api-provider-metal3/crds-machine) — Metal3Machine 詳細說明
:::

## 什麼是 LabelSync

LabelSync 是 Metal3 Provider 提供的一項功能，能夠將 **BareMetalHost（BMH）** 上設定的 labels 自動同步到 workload cluster 中對應的 **Kubernetes Node** 物件。

這對於需要依據裸機硬體特性進行 workload 排程的場景非常有用，例如：

- **GPU 節點**：標記具有特定 GPU 型號的裸機伺服器
- **高速網路節點**：標記配備 25G / 100G 網路卡的節點
- **特定機型**：標記特定廠牌機型（Dell R740、HPE DL380 等）
- **機架位置**：標記所在機架，用於 topology-aware 排程

透過 LabelSync，平台工程師只需在 BMH 上維護硬體標籤，CAPM3 會自動將這些資訊傳播到 Node 層，讓應用開發者能夠使用 `nodeSelector` 或 `affinity` 來精確控制 workload 的排程位置。

## 運作原理

### Label 同步流程

1. BMH 物件設有特定前綴的 labels
2. Metal3Machine 關聯到 BMH 後，`Metal3MachineReconciler` 讀取 BMH 上的所有 labels
3. Reconciler 篩選符合指定前綴的 labels
4. 將篩選後的 labels 寫入 workload cluster 中對應的 K8s Node 物件

### 前綴篩選規則

::: info 前綴設定說明
- **預設前綴**：`infrastructure.metal3.io/`（只有帶此前綴的 BMH labels 才會被同步）
- 可透過 CAPM3 controller manager 啟動參數 `--baremetal-operator-label-prefix` 自定義前綴
:::

## BMH Label 設定範例

### 在 BMH 上設定要同步的 labels

```yaml
apiVersion: metal3.io/v1alpha1
kind: BareMetalHost
metadata:
  name: node-worker-01
  namespace: metal3
  labels:
    # 標準 Metal3 識別標籤（不會被同步）
    metal3.io/uuid: "abc-123"
    # 自定義硬體特性標籤（將被同步到 K8s Node）
    infrastructure.metal3.io/server-type: dell-r740
    infrastructure.metal3.io/rack: rack-03
    infrastructure.metal3.io/gpu: "true"
    infrastructure.metal3.io/network-speed: "25g"
    infrastructure.metal3.io/storage-type: nvme
spec:
  online: true
  bootMACAddress: "00:11:22:33:44:55"
  ...
```

帶有 `metal3.io/uuid` 等非指定前綴的 labels 不會被同步，只有符合前綴的 labels（此例為 `infrastructure.metal3.io/`）才會傳播到 Node。

### 同步後 K8s Node 上的 labels

```yaml
apiVersion: v1
kind: Node
metadata:
  name: node-worker-01
  labels:
    # Kubernetes 標準標籤
    kubernetes.io/hostname: node-worker-01
    kubernetes.io/arch: amd64
    node.kubernetes.io/instance-type: baremetal
    # 從 BMH 同步過來的硬體標籤
    infrastructure.metal3.io/server-type: dell-r740
    infrastructure.metal3.io/rack: rack-03
    infrastructure.metal3.io/gpu: "true"
    infrastructure.metal3.io/network-speed: "25g"
    infrastructure.metal3.io/storage-type: nvme
```

## 實際應用場景

### 場景 1 — GPU Workload 排程

在 BMH 設定 GPU 相關標籤，再透過 Pod 的 `nodeSelector` 將工作負載排程到 GPU 節點：

```yaml
# 在 BMH 設定 GPU 標籤
infrastructure.metal3.io/gpu: "true"
infrastructure.metal3.io/gpu-type: nvidia-a100
```

```yaml
# 在 Pod 使用 nodeSelector 排程到 GPU 節點
apiVersion: v1
kind: Pod
spec:
  nodeSelector:
    infrastructure.metal3.io/gpu: "true"
  containers:
    - name: gpu-app
      resources:
        limits:
          nvidia.com/gpu: 1
```

### 場景 2 — Rack-aware 部署

利用 BMH 的機架標籤，結合 Pod Anti-Affinity 確保高可用應用的副本分散到不同機架：

```yaml
# 使用 Pod Anti-Affinity 確保 Pod 分散到不同 Rack
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels:
                  app: my-app
              topologyKey: infrastructure.metal3.io/rack
```

此配置使 Kubernetes scheduler 在排程時，確保同一 Deployment 的 Pod 不會落在相同機架的節點上，從而降低機架層級故障的影響範圍。

## Label 同步的時機

以下情況會觸發 reconcile loop 中的 label 同步：

- **Metal3Machine 狀態變為 Provisioned**：機器完成 provisioning，Node 物件在 workload cluster 中建立完成
- **Node 加入 workload cluster**：Node 物件首次被建立時，Reconciler 寫入對應的 BMH labels
- **BMH labels 更新時**：CAPM3 reconciler 偵測到 BMH metadata 發生變更，觸發重新同步

::: warning Label 同步為單向操作
- Label 同步是**單向的**：BMH → Node（反向不會同步）
- 若在 Node 上直接修改這些 labels，下次 reconcile 時會被 BMH 的值**覆蓋**
- 若 BMH label 被刪除，對應的 Node label 也會被自動刪除
:::

## 自定義前綴設定

若預設前綴 `infrastructure.metal3.io/` 不符合組織需求，可修改 CAPM3 controller manager Deployment 的啟動參數：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: capm3-controller-manager
  namespace: capm3-system
spec:
  template:
    spec:
      containers:
        - name: manager
          args:
            - "--leader-elect"
            - "--baremetal-operator-label-prefix=hardware.mycompany.io/"
```

::: tip 前綴命名建議
- 使用**組織域名**作為前綴，避免與標準 Kubernetes labels 或其他工具的 labels 衝突
- 前綴**必須包含斜線 `/`**，例如 `hardware.mycompany.io/`
- 建議在整個組織內統一使用同一前綴，方便跨叢集管理
:::

## Label 同步與 Node Reuse 的關係

當 Node Reuse 功能（`keepBMH`）啟用時，機器縮減後再擴展會重用同一台 BMH。由於 BMH 物件本身保持不變，其上的 labels 也不會消失，因此在機器重建後，Node 上的硬體特性 labels 仍然一致。

這確保了節點特性標籤的**持久性**：無論機器經歷多少次重建，Kubernetes scheduler 都能持續依據正確的硬體特性來排程 workload，不受機器生命週期影響。
