---
layout: doc
title: Cluster API — 系統架構與 Provider 模型
---

# Cluster API — 系統架構與 Provider 模型

::: info 相關章節
- [專案總覽](./index.md) — 核心概念與 CRD 一覽
- [核心控制器](./controller-core.md) — Cluster / Machine Reconcile 流程
- [Provider 合約與 Runtime Hooks](./provider-contracts-runtime-hooks.md) — 合約規範細節
- [ClusterClass 與 Topology](./clusterclass-topology.md) — Topology Controller 架構
:::

---

## Manager 架構與 Controller 清單

CAPI 在 management cluster 中運行一個 **controller-manager Pod**，其內部以多個 reconciler goroutine 的形式並行處理各種資源。這個 Pod 通常由 `clusterctl` 安裝，使用 Deployment 部署，並支援 leader election 以實現高可用。

![CAPI Manager 元件部署圖](/diagrams/capi/manager-components.png)

### Controllers 清單

| Controller | 管理資源 | 預設並發數 |
|-----------|---------|----------|
| `ClusterReconciler` | Cluster | 10 |
| `MachineReconciler` | Machine | 10 |
| `MachineSetReconciler` | MachineSet | 10 |
| `MachineDeploymentReconciler` | MachineDeployment | 10 |
| `MachinePoolReconciler` | MachinePool | 10 |
| `KubeadmConfigReconciler` | KubeadmConfig | 10 |
| `KubeadmConfigTemplateReconciler` | KubeadmConfigTemplate | 10 |
| `KubeadmControlPlaneReconciler` | KubeadmControlPlane | 10 |
| `MachineHealthCheckReconciler` | MachineHealthCheck | 10 |
| `ClusterResourceSetReconciler` | ClusterResourceSet | 10 |
| `TopologyReconciler` | Cluster（topology 模式）| 10 |
| `ClusterClassReconciler` | ClusterClass | 10 |

每個 reconciler 都是獨立的 goroutine pool，彼此不共用 worker，因此不同類型的資源可以完全並行處理。

### Manager 啟動參數

| 參數 | 說明 |
|------|------|
| `--leader-elect` | 啟用 HA 模式，多副本時只有 leader 執行 reconcile，其餘副本待命 |
| `--feature-gates` | 開關 feature gates，例如 `ClusterTopology=true`、`RuntimeSDK=true` |
| `--sync-period` | 定期 resync interval，預設 `10m`（確保長時間未觸發的物件也能被重新協調）|
| `--metrics-bind-addr` | metrics 端點，預設 `:8080`，供 Prometheus 抓取 |
| `--health-addr` | 健康檢查端點，預設 `:9440` |
| `--webhook-cert-dir` | Webhook TLS 憑證目錄，預設 `/tmp/k8s-webhook-server/serving-certs` |

---

## Provider 合約介面

Provider 合約是 CAPI 最重要的設計概念之一。CAPI 核心只定義 **介面規格**，具體的基礎設施操作完全由各 Provider 實作。CAPI 與 Provider 之間透過 Kubernetes CRD 欄位的「約定格式」進行溝通，這就是所謂的「合約（Contract）」。

CAPI 定義了四類 Provider 合約：

### InfraCluster 合約

Infrastructure Provider 必須實作的叢集層級資源（例如 `AWSCluster`、`Metal3Cluster`）：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `spec.controlPlaneEndpoint` | APIEndpoint | Control Plane API server 的 endpoint（host:port）|
| `status.ready` | bool | Infrastructure 是否已就緒，CAPI 等待此欄位為 `true` 才繼續 |
| `status.failureDomains` | FailureDomains | 可用的 failure domains（可選，用於跨 AZ 分散）|

### InfraMachine 合約

Infrastructure Provider 必須實作的機器層級資源（例如 `AWSMachine`、`Metal3Machine`）：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `spec.providerID` | string | 機器的唯一識別碼，格式由 Provider 定義（如 `aws:///us-east-1a/i-0abc123`）|
| `status.ready` | bool | 機器 VM 是否已建立並就緒 |
| `status.addresses` | []MachineAddress | 機器的 IP 地址列表（InternalIP、ExternalIP 等）|
| `status.failureReason` | string | 失敗原因代碼（可選，例如 `InsufficientResourcesError`）|
| `status.failureMessage` | string | 失敗訊息的詳細描述（可選）|

### Bootstrap Provider 合約

Bootstrap Provider 負責產生機器啟動所需的 userdata（例如 `KubeadmConfig`）：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `status.dataSecretName` | string | 包含 bootstrap data 的 Secret 名稱（CAPI 讀取後注入機器）|
| `status.ready` | bool | Bootstrap data 是否已產生完畢 |

### ControlPlane Provider 合約

ControlPlane Provider 管理 Control Plane 節點的生命週期（例如 `KubeadmControlPlane`）：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `spec.replicas` | int | 期望的 CP 副本數（通常為奇數，例如 1 或 3）|
| `status.initialized` | bool | CP 是否已初始化（第一個 CP node 已成功 join）|
| `status.ready` | bool | CP 是否完全就緒（所有副本健康）|
| `status.replicas` | int | 目前 CP Machine 總數 |
| `status.readyReplicas` | int | 目前就緒的 CP Machine 數 |
| `status.updatedReplicas` | int | 已套用最新版本的 CP Machine 數 |
| `status.version` | string | 目前運行的 Kubernetes 版本 |
| `status.selector` | string | 用於選取 CP machines 的 label selector（供 HPA 等工具使用）|

::: info v1beta2 合約演進
CAPI v1beta2 計畫將 `status.initialization.provisioned` 作為更標準化的合約欄位，統一取代各 Provider 分散實作的初始化狀態判斷，讓核心 controller 有更一致的方式讀取 Provider 狀態。部分舊有欄位將被標記為 deprecated。
:::

---

## 六大 API Group 詳解

CAPI 的功能依職責分散在六個 API Group 中，每個 group 負責不同的生命週期面向：

### 1. `cluster.x-k8s.io`（核心）

這是 CAPI 的核心 API group，定義了所有叢集與機器的基礎資源：

| 資源 | 說明 |
|------|------|
| `Cluster` | 頂層叢集宣告，引用 InfrastructureRef（InfraCluster）和 ControlPlaneRef（CP Provider）|
| `Machine` | 單一節點的宣告，引用 InfrastructureRef 和 Bootstrap DataSecretName |
| `MachineSet` | 維持固定數量的 Machine 群組，類似 Kubernetes ReplicaSet |
| `MachineDeployment` | 支援滾動更新的 Machine 群組，類似 Kubernetes Deployment |
| `MachinePool` | 委託 Provider 原生機制（如 ASG）管理節點池，Beta 功能 |
| `ClusterClass` | 可重用的叢集模板，定義拓撲結構（需開啟 `ClusterTopology` feature gate）|
| `MachineHealthCheck` | 定義健康檢查規則，自動替換故障節點 |
| `MachineDrainRule` | 自定義節點 drain 行為，控制 Pod 驅逐順序與等待時間 |

### 2. `bootstrap.cluster.x-k8s.io`

負責產生機器啟動所需的初始化資料：

| 資源 | 說明 |
|------|------|
| `KubeadmConfig` | 根據 kubeadm 設定產生 cloud-init 或 ignition userdata，包含 kubeadm init/join 指令 |
| `KubeadmConfigTemplate` | KubeadmConfig 的模板，供 MachineDeployment / MachineSet 引用 |

這個 group 是 CAPI 內建的 Bootstrap Provider 實作，也是目前最廣泛使用的 bootstrap 方式。

### 3. `controlplane.cluster.x-k8s.io`

負責 Control Plane 節點的完整生命週期管理：

| 資源 | 說明 |
|------|------|
| `KubeadmControlPlane`（KCP） | 管理 etcd 成員和 API server 節點，支援安全的滾動升級 |
| `KubeadmControlPlaneTemplate` | KCP 的模板，用於 ClusterClass 中 |

KCP Controller 是 CAPI 最複雜的 controller 之一，需要協調 etcd quorum 維護、kubeconfig 更新、以及節點的有序替換。

### 4. `addons.cluster.x-k8s.io`

管理 workload cluster 中附加元件（addons）的自動部署：

| 資源 | 說明 |
|------|------|
| `ClusterResourceSet`（CRS）| 定義要套用到叢集的資源集合（如 CNI YAML），支援 `ApplyOnce` 或 `Reconcile` 策略 |
| `ClusterResourceSetBinding` | 記錄 CRS 在各叢集的套用狀態，避免重複部署 |

CRS 解決了「叢集建立完成後如何自動安裝 CNI」的問題，是 Day 0 自動化的關鍵元件。

### 5. `ipam.cluster.x-k8s.io`（Alpha）

提供標準化的 IP 地址管理介面，讓 Infrastructure Provider 可以透過統一 API 請求靜態 IP：

| 資源 | 說明 |
|------|------|
| `IPAddressClaim` | Infrastructure Provider 發起的 IP 請求，IPAM Provider 監聽此資源並分配 IP |
| `IPAddress` | IPAM Provider 建立的 IP 分配記錄，包含 IP、gateway、prefix 等資訊 |

這個 group 讓不同的 IPAM 實作（如 Metal3 IPAM、自定義 IPAM）可以透過統一介面與 CAPI 整合，而不需要各自與 Infrastructure Provider 緊耦合。

### 6. `runtime.cluster.x-k8s.io`（Alpha）

支援 Runtime SDK 擴展點，讓外部服務可以在叢集生命週期的關鍵時刻介入：

| 資源 | 說明 |
|------|------|
| `ExtensionConfig` | 註冊外部 webhook 端點，定義其提供的 Runtime Hook 清單 |

Runtime SDK 允許實作 `BeforeClusterCreate`、`AfterControlPlaneInitialized`、`BeforeMachineDelete` 等生命週期 hook，無需修改 CAPI 核心程式碼。

---

## ClusterCache 與遠端叢集快取

### 為什麼需要 ClusterCache？

CAPI controllers 主要在 management cluster 中運作，但有些操作需要直接存取 **workload cluster** 的資源，例如：

- 查看 Node 的 `Ready` condition 狀態
- 將 `ProviderID` patch 到 Node 物件上
- 監控 etcd member 健康狀態（KCP Controller）
- 在 workload cluster 中套用 CNI 等資源（ClusterResourceSet）

ClusterCache（舊稱 RemoteClusterCache）提供了安全、高效的方式來建立並維護這些跨叢集連線。

### 運作機制

1. **建立連線**：CAPI 讀取 `<cluster-name>-kubeconfig` Secret 中的 kubeconfig，為每個 workload cluster 建立一個獨立的 Kubernetes client
2. **Watch 機制**：透過 informer 監控 workload cluster 的資源變化（如 Node 狀態），避免輪詢（polling）帶來的 API server 負荷
3. **快取資料**：將 workload cluster 的資源快取在 management cluster 的記憶體中，減少跨叢集查詢延遲
4. **自動重建**：當連線失效時（例如 workload cluster 重啟），以指數退避（exponential backoff）策略自動重建連線
5. **生命週期管理**：當叢集被刪除時，ClusterCache 會清理對應的 client 與 informer，防止資源洩漏

### 使用 ClusterCache 的 Controller

| Controller | 用途 |
|-----------|------|
| `MachineController` | 設定 Node 的 ProviderID annotation、執行 node drain |
| `KubeadmControlPlaneController` | 查詢 etcd member health、檢查 API server 連通性 |
| `MachineHealthCheckController` | 監控 workload cluster 中 Node 的 condition 狀態 |
| `ClusterResourceSetController` | 在 workload cluster 中 apply ConfigMap / Secret 中的資源 |

---

## Webhook 架構

CAPI 廣泛使用 **ValidatingWebhook** 和 **MutatingWebhook**，在資源寫入 etcd 之前進行驗證與預設值填充。

### Webhook 設計原則

- **`failurePolicy: Fail`**：當 webhook 失敗時，請求會被拒絕，防止格式錯誤的物件進入 etcd，這是 CAPI 的安全防線
- **Immutability（不可變性）**：許多核心欄位建立後不允許修改，防止錯誤的設定變更導致叢集狀態不一致

### 主要不可變欄位

| 資源 | 不可變欄位 | 說明 |
|------|----------|------|
| `Machine` | `spec.clusterName` | 機器一旦建立，不能在叢集間移動 |
| `MachineSet` | `spec.clusterName` | 同上 |
| `MachineDeployment` | `spec.clusterName` | 同上 |
| `MachineHealthCheck` | `spec.clusterName` | 健康檢查必須綁定到建立時指定的叢集 |
| `ClusterResourceSet` | `spec.strategy` | 部署策略（`ApplyOnce`/`Reconcile`）設定後不可變更 |
| `ClusterResourceSet` | `spec.clusterSelector` | 選擇器設定後不可變，防止意外影響其他叢集 |
| `IPAddress` | `spec.*` | IP 位址相關設定全部不可變，防止 IP 被重新分配 |

### Defaulting Webhook 的重要功能

Mutating webhook 在物件建立時自動補全省略的欄位，減少使用者的設定負擔：

| 資源.欄位 | Defaulting 行為 |
|----------|----------------|
| `Machine.spec.version` | 自動補上 `v` 前綴：`1.28.0` → `v1.28.0` |
| `Machine.spec.nodeDeletionTimeout` | 預設 `10s`（等待 Node 物件消失的超時時間）|
| `MachineDeployment.spec.minReadySeconds` | 預設 `0` |
| `ClusterClass` patches | 驗證 patch 格式合法性，確保 JSON patch 路徑正確 |
| `KubeadmControlPlane.spec.rolloutStrategy` | 預設 `RollingUpdate` 策略 |

---

## 工具套件（Utility Libraries）

CAPI 提供了多個跨 Provider 共用的工具套件，讓 Provider 開發者不需要重複實作通用邏輯。

### conditions 套件

統一 conditions 的讀寫介面，確保所有 CAPI 資源的 condition 格式一致：

```go
// v1beta1 conditions
conditions.MarkTrue(machine, clusterv1.ReadyCondition)
conditions.MarkFalse(machine, clusterv1.ReadyCondition,
    clusterv1.DeletingReason, clusterv1.ConditionSeverityInfo, "正在刪除")
conditions.MarkUnknown(machine, clusterv1.ReadyCondition,
    clusterv1.DeletingReason, "狀態未知")

// Mirror：將子資源的 condition 複製到父資源
conditions.SetMirrorCondition(machineSet, clusterv1.ReadyCondition, machine, ...)
```

支援 **v1beta1 conditions**（現有格式）和 **v1beta2 conditions**（新格式，支援更豐富的 reason 資訊），Controller 開發時應優先使用 conditions 套件而非直接操作 `status.conditions` slice。

### patch helper

解決多個 controller 並發修改同一 Kubernetes 物件時的 conflict 問題：

```go
// 建立 patch helper（在 Reconcile 開始時 snapshot 物件狀態）
patchHelper, err := patch.NewHelper(cluster, r.Client)

// ... 執行 reconcile 邏輯，修改 cluster 物件 ...

// Reconcile 結束時，patch 差異到 API server
if err := patchHelper.Patch(ctx, cluster); err != nil {
    return ctrl.Result&#123;&#125;, err
}
```

patch helper 使用 **SSA（Server-Side Apply）** 或 **optimistic locking** 策略，確保只送出實際有變更的欄位，避免覆蓋其他 controller 的修改。

### kubeconfig helper

標準化 kubeconfig Secret 的建立與讀取：

```go
// 讀取 workload cluster 的 kubeconfig
kubeconfig, err := kubeconfig.FromSecret(ctx, r.Client, cluster)

// Secret 命名格式固定為：<cluster-name>-kubeconfig
// Namespace 與 Cluster 物件相同
```

所有 CAPI 元件都遵循相同的 kubeconfig Secret 命名規範，讓 ClusterCache 和其他工具可以可靠地找到連線憑證。

### failuredomains helper

在多個 failure domain（可用區）之間均勻分配 Machine，提高叢集的可用性：

```go
// 選擇 Machine 數量最少的 failure domain
// 確保 CP 節點跨 AZ 分散，避免單一 AZ 故障影響叢集
fd := failuredomains.PickFewest(cluster.Status.FailureDomains, existingMachines)
```

運作原理：
1. 統計每個 failure domain 中現有 Machine 的數量
2. 選擇數量最少的 domain 部署新的 Machine
3. 當多個 domain 數量相同時，以確定性方式（consistent hashing）選擇，避免隨機分配導致不均勻
