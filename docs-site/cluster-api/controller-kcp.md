---
layout: doc
title: Cluster API — KubeadmControlPlane Controller
---

# KubeadmControlPlane Controller 深度解析

:::info 相關章節
- [KubeadmControlPlane API](/cluster-api/api-kubeadm-controlplane)
- [Bootstrap KubeadmConfig](/cluster-api/bootstrap-kubeadmconfig)
- [Machine 生命週期](/cluster-api/machine-lifecycle)
- [Core Controller](/cluster-api/controller-core)
:::

## KCP Controller 概覽

`KubeadmControlPlaneReconciler`（位於 `controlplane/kubeadm/internal/controllers/controller.go`）是 CAPI 中負責管理 Control Plane 節點的核心控制器。其主要職責包括：

- **管理 Control Plane 節點生命週期**：建立、更新與刪除 CP Machine
- **協調資源關係**：`KubeadmControlPlane` → `Machine` → `KubeadmConfig` + `InfrastructureMachineTemplate`
- **確保 etcd 叢集健康**：於 scale/rollout 前後驗證 etcd quorum
- **管理憑證輪替**：監控 CP 相關憑證有效期，自動觸發輪替
- **kubeconfig Secret 管理**：建立與輪替 `<cluster>-kubeconfig` Secret

KCP Controller 的設計核心是：在任意時刻都能確保 Control Plane 的可用性，任何 scale 或 rollout 操作都需先通過健康檢查（preflight checks）才能執行。Controller 使用 **一次一個操作** 的原則，每個 Reconcile loop 中只執行一個 scale up、scale down 或 rollout 動作。

---

## KCP Reconcile 主流程（原始碼層級）

### 主 Reconcile 函式

`Reconcile()` 函式是控制器的入口點，負責串接整個協調流程：

```
Reconcile()
  ├─ 取得 KubeadmControlPlane 物件
  ├─ 確保 Finalizer（controlplane.cluster.x-k8s.io/kubeadm-control-plane）
  ├─ 取得所屬 Cluster
  ├─ 初始化 patchHelper
  ├─ 檢查 Paused 狀態（EnsurePausedCondition）
  ├─ initControlPlaneScope()：掃描/採用 CP Machines
  ├─ defer: updateStatus() + patchKubeadmControlPlane()
  ├─ 若有 DeletionTimestamp → reconcileDelete()
  └─ 否則 → reconcile()
```

### reconcile() 正常協調路徑

`reconcile()` 函式依序執行以下步驟：

**Step 1 — reconcileExternalReference()**

驗證 `spec.machineTemplate.spec.infrastructureRef` 指向的 `InfrastructureMachineTemplate` 存在，並確保 Cluster 持有其 OwnerReference。

**Step 2 — 等待 Cluster 基礎設施就緒**

若 `cluster.status.initialization.infrastructureProvisioned` 不為 `true`，則設定 `EtcdClusterHealthy` 及 `ControlPlaneComponentsHealthy` 為 Unknown 並提前返回。

**Step 3 — reconcileClusterCertificates()**

產生或查找 4 組 CA Secrets（`<cluster>-ca`、`<cluster>-etcd`、`<cluster>-sa`、`<cluster>-proxy`）：

- 若 `KubeadmControlPlaneInitialized` 條件**尚未設定為 True**（第一次初始化）：呼叫 `LookupOrGenerateCached()` — 不存在則產生
- 若已初始化：呼叫 `LookupCached()` — 只查找，**不再重新產生**（防止 CA 意外重新簽發）

**Step 4 — 等待 ControlPlaneEndpoint**

若 `cluster.spec.controlPlaneEndpoint` 尚未設定，提前返回。

**Step 5 — reconcileKubeconfig()**

建立或輪替 `<cluster>-kubeconfig` Secret（詳見後述章節）。

**Step 6 — syncMachines()**

將 KCP 的 in-place mutable 欄位同步到所有 CP Machines（如 `nodeDrainTimeoutSeconds`、`taints`），並同步 labels/annotations 至 `InfrastructureMachine` 和 `KubeadmConfig`。

**Step 7 — reconcileControlPlaneAndMachinesConditions()**

透過 `ClusterCache` 連接到 workload cluster，呼叫 `UpdateStaticPodConditions()` 與 `UpdateEtcdConditions()` 更新各 Machine 的健康狀態 Conditions。

**Step 8 — reconcileEtcdMembers()**

清理沒有對應 Machine/Node 的孤立 etcd member（詳見 etcd 章節）。

**Step 9 — reconcilePreTerminateHook()**

處理正在刪除中的 Machine：移轉 etcd leader、移除 etcd member，最後移除 pre-terminate hook annotation 以解除刪除阻塞。

**Step 10 — 決策分支（核心邏輯）**

```go
machinesNeedingRollout, _ := controlPlane.MachinesNeedingRollout()

switch {
case len(machinesNeedingRollout) > 0:
    return r.updateControlPlane(...)   // Rolling Update 優先

case numMachines == 0 && numMachines < desiredReplicas:
    return r.initializeControlPlane(...)  // 第一台 CP Machine（kubeadm init）

case numMachines > 0 && numMachines < desiredReplicas:
    return r.scaleUpControlPlane(...)  // Scale Up（kubeadm join）

case numMachines > desiredReplicas:
    return r.scaleDownControlPlane(...)  // Scale Down
}
```

**Rolling Update 優先**是關鍵設計決策：在進行版本升級或設定變更時，KCP 先處理 rollout，而不是等 scale 操作完成。這確保所有 Machine 儘快同步到新版本。

**Step 11 — 更新 CoreDNS 及 kube-proxy**

當所有機器都在目標版本時，呼叫 `UpdateCoreDNS()` 及 `UpdateKubeProxyImageInfo()` 更新 workload cluster 中的 DaemonSet/Deployment。

**Step 12 — reconcileCertificateExpiries()**

為尚未設定 `cluster.x-k8s.io/machine-certificates-expiry-date` annotation 的 `KubeadmConfig` 查詢並記錄各 CP 節點的 API Server 憑證到期日。

---

## 需要 Rollout 的條件（原始碼層級）

### UpToDate() 函式解析

KCP 在 `initControlPlaneScope()` 時對每台 Machine 呼叫 `internal.UpToDate()` 函式（`controlplane/kubeadm/internal/filters.go`）來計算是否需要 rollout：

```go
func UpToDate(ctx, c, cluster, machine, kcp, reconciliationTime, infraMachines, kubeadmConfigs) (bool, *UpToDateResult, error)
```

函式依序檢查以下條件，若任一成立則該 Machine 需要 rollout：

| 條件 | 觸發邏輯 | 原始碼位置 |
|------|---------|-----------|
| `spec.version` 不符 | `desiredMachine.Spec.Version != machine.Spec.Version` | `matchesMachineSpec()` |
| `InfrastructureMachine` 設定不符 | 比對 `TemplateClonedFromNameAnnotation` 及 spec 差異 | `matchesInfraMachine()` |
| `KubeadmConfig` 設定不符 | 比對 `kubeadmConfigSpec` hash | `matchesKubeadmConfig()` |
| `rollout.before` 憑證即將到期 | `ShouldRolloutBefore(reconciliationTime, kcp.Spec.Rollout.Before)(machine)` | `filters.go` |
| `rollout.after` 排程到期 | `ShouldRolloutAfter(reconciliationTime, kcp.Spec.Rollout.After)(machine)` | `filters.go` |

:::info Labels/Annotations 不觸發 Rollout
KCP 設計上，Machine 的 labels 和 annotations 變更**不會觸發 Rolling Update**。這些欄位是 in-place mutable（透過 `syncMachines()` 直接同步到現有 Machine），以避免不必要的節點重建。
:::

### EligibleForInPlaceUpdate 標記

`UpToDateResult` 中有 `EligibleForInPlaceUpdate` 欄位，以下情況會設為 `false`：

- Machine 有 `DeleteMachineAnnotation`（使用者標記要刪除）
- Machine 有 `RemediateMachineAnnotation`（MHC 標記要修復）
- `rollout.before` 觸發（憑證問題，需要重建）
- `rollout.after` 觸發（排程更新，需要重建）

只有 `EligibleForInPlaceUpdate = true` 且啟用 `InPlaceUpdates` feature gate 時，KCP 才會嘗試 in-place update 而非重建 Machine。

---

## Rolling Update 演算法細節

### rollingUpdate() 函式（`update.go`）

```go
func (r *KubeadmControlPlaneReconciler) rollingUpdate(
    ctx, controlPlane, machinesNeedingRollout, machinesUpToDateResults,
) (ctrl.Result, error) {
    currentReplicas := int32(controlPlane.Machines.Len())
    maxSurge := int32(controlPlane.KCP.Spec.Rollout.Strategy.RollingUpdate.MaxSurge.IntValue())
    maxReplicas := desiredReplicas + maxSurge

    if currentReplicas < maxReplicas {
        return r.scaleUpControlPlane(ctx, controlPlane)  // 先建立新 Machine
    }
    // 選出一台舊機器，執行 in-place update 或 scale down
    machineToDelete := selectMachineForInPlaceUpdateOrScaleDown(...)
    return r.scaleDownControlPlane(ctx, controlPlane, machineToDelete)
}
```

### maxSurge 的運作方式

`maxSurge` 控制 Rolling Update 期間最多可以**超出** `spec.replicas` 的機器數量：

- **maxSurge = 1**（預設）：3 台 CP 升級時，先建立第 4 台新機器（3+1=4），驗證健康後再刪除一台舊機器，以此類推。etcd member 數量流程：3 → 4 → 3 → 4 → 3。
- **maxSurge = 0**：先刪除一台舊機器（etcd member 減少至 2），再建立新機器（恢復至 3）。quorum 維持在邊緣，適合資源受限場景但風險較高。

### 刪除候選機器的選擇策略（selectMachineForInPlaceUpdateOrScaleDown）

位於 `scale.go`，使用兩階段選擇：

**第一階段：選出候選子集**

優先順序如下（高優先度先）：

1. 有 `DeleteMachineAnnotation` 且需要 rollout 的 Machine
2. 有 `DeleteMachineAnnotation` 的任何 Machine（使用者明確要求）
3. 有不健康 CP 元件且需要 rollout 的 Machine（優先修復問題機器）
4. 所有需要 rollout 的 Machine
5. 若上述均無，則選所有 Machine（純 scale down 情境）

**第二階段：Failure Domain 平衡**

從候選子集中，選出 **Failure Domain 中機器數量最多** 的那台 Machine 刪除，確保刪除後各 AZ/rack 的機器分佈更均衡。

### Preflight Checks 詳解

每次 scale up 或 scale down 前，都必須通過 `preflightChecks()`：

```go
func (r *KubeadmControlPlaneReconciler) preflightChecks(
    ctx, controlPlane, isScaleUp, excludeFor ...
) ctrl.Result
```

以下任一條件不滿足時，preflight checks 失敗，操作將等待重試（`RequeueAfter: 15s`）：

| 檢查項目 | 說明 |
|---------|------|
| `HasDeletingMachine` | 有 Machine 正在刪除中，等待完成 |
| `CertificateMissing`（Scale Up 限定） | `KubeadmControlPlaneCertificatesAvailable` 條件不為 True |
| `TopologyVersionMismatch` | 使用 ClusterTopology 時，等待版本升級指令同步 |
| `ControlPlaneComponentsNotHealthy` | 任一 Machine 的 API Server/Controller Manager/Scheduler Pod 不健康 |
| `EtcdClusterNotHealthy` | 任一 Machine 的 etcd Pod 或 etcd member 不健康 |

當 `RemediationInProgressAnnotation` 存在（表示正在從 MHC 修復中恢復）且 `isScaleUp = true` 時，preflight checks 會放寬條件，改為 `checkHealthinessWhileRemediationInProgress()`，只要求 **預期加入新機器後** 的目標狀態是健康的即可。

---

## etcd 成員管理（深度解析）

### etcd 連接機制

KCP 透過以下路徑存取 etcd：

```
KCP Controller
  └─ ClusterCache.GetWorkloadCluster()
       └─ WorkloadCluster (連接 workload cluster API server)
            └─ etcd client (透過 port-forward 到 etcd Pod)
                 └─ etcd member 操作（list/remove）
```

`EtcdDialTimeout` 和 `EtcdCallTimeout` 在 `KubeadmControlPlaneReconciler` 結構中設定，確保 etcd 操作不會無限期阻塞。

### reconcileEtcdMembers() — 孤立成員清理

此函式是 **保護機制**（safeguard），處理 etcd member 與 Machine 不一致的情況：

```go
func (r *KubeadmControlPlaneReconciler) reconcileEtcdMembers(ctx, controlPlane)
```

執行條件：
- `IsEtcdManaged()` 為 true（非外部 etcd）
- `EtcdClusterHealthyCondition` 不為 True（有不一致性）
- 所有 Machine 都已有 NodeRef（表示 CP 已穩定）

對每個 etcd member，若找不到對應的 Node/Machine：

1. 評估移除此 member 是否會導致 quorum 損失（`targetEtcdClusterHealthy()`）
2. 若安全，呼叫 `workloadCluster.RemoveEtcdMember()` 移除
3. 移除後 `RequeueAfter: 1s` 觸發立即重新協調

### reconcilePreTerminateHook() — 刪除前的 etcd 操作

KCP 透過 **Pre-Terminate Hook** 機制確保在 Machine 真正被刪除前，完成 etcd 相關操作：

```
Machine 設定 DeletionTimestamp
  → Machine Controller 觸發 drain
  → 等待 PreTerminateHookCleanupAnnotation 被移除
  → KCP reconcilePreTerminateHook() 處理
      ├─ 確認 Machine 已完成 drain（MachineDeletingWaitingForPreTerminateHookReason）
      ├─ 確認 CP 還有其他健康 Machine（否則直接允許刪除）
      ├─ targetKubernetesControlPlaneComponentsHealthy() 檢查
      ├─ targetEtcdClusterHealthy() 檢查
      ├─ ForwardEtcdLeadership()：將 etcd leader 移轉到最新的 Machine
      ├─ RemoveEtcdMember()：從 etcd 叢集移除此 member
      └─ removePreTerminateHookAnnotationFromMachine()：解除刪除阻塞
```

:::warning 只處理一台機器
`reconcilePreTerminateHook()` 使用 `OldestDeletionTimestamp()` 每次只處理**一台**正在刪除的 Machine，並等待前一台完成後才處理下一台。這確保 etcd 操作的串行性，防止並發刪除導致 quorum 損失。
:::

### Kubernetes 1.31+ 的 pre-terminate hook 改進

在 K8s >= 1.31 時，KCP pre-terminate hook 會**等待其他 pre-terminate hook 先完成**（`machineHasOtherPreTerminateHooks()` 檢查），使 KCP 的 hook 最後執行。這讓 kubelet 在所有其他 hooks 執行期間保持可用，提高清理過程的可靠性。

### quorum 計算（targetEtcdClusterHealthy）

KCP 在每次刪除操作前都會模擬「目標狀態」的 etcd 健康度。目標狀態等於：

> 目前成員清單 − 要刪除的成員 + 要新增的成員（若有）

只有在目標狀態能維持 quorum（超過半數成員健康）時，操作才被允許。

---

## kubeconfig Secret 管理

### reconcileKubeconfig()（`helpers.go`）

kubeconfig Secret 的命名規則為 `<cluster-name>-kubeconfig`，存放在管理叢集（management cluster）的同一 Namespace 下。

```go
func (r *KubeadmControlPlaneReconciler) reconcileKubeconfig(ctx, controlPlane)
```

**建立流程**：

若 Secret 不存在，呼叫 `kubeconfig.CreateSecretWithOwner()`：

1. 使用 `<cluster>-ca` Secret 中的 CA 憑證簽發新的 client 憑證
2. 產生 kubeconfig 格式的資料，endpoint 為 `cluster.spec.controlPlaneEndpoint`
3. 以 `cluster.x-k8s.io/secret` 類型建立 Secret，並設定 KCP 為 controller owner

若 CA Secret 尚未存在（`ErrDependentCertificateNotFound`），則 `RequeueAfter: 10s` 等待。

**輪替邏輯**：

```go
needsRotation, err := kubeconfig.NeedsClientCertRotation(configSecret, certs.ClientCertificateRenewalDuration)
if needsRotation {
    kubeconfig.RegenerateSecret(ctx, r.Client, configSecret, ...)
}
```

`ClientCertificateRenewalDuration` 預設為 **80% 到期時間**（即在有效期剩餘 20% 時觸發輪替）。輪替操作是 **in-place 更新** Secret 內容，不需要重建 Machine。

:::info kubeconfig 用途
此 `<cluster>-kubeconfig` Secret 是提供給**管理者直接存取 workload cluster** 使用的 admin kubeconfig。與 KCP Controller 本身用來連接 workload cluster 的憑證（來自 ClusterCache）是不同的憑證路徑。
:::

### kubeconfig 中的憑證資訊

Secret 資料格式為標準 kubeconfig YAML，包含：

- `clusters[].cluster.certificate-authority-data`：Base64 編碼的 CA 憑證
- `users[].user.client-certificate-data`：Base64 編碼的 client 憑證
- `users[].user.client-key-data`：Base64 編碼的 client 私鑰

---

## 憑證管理深度解析

### KCP 管理的 Secrets

| Secret 名稱 | 類型 | 內容 | 說明 |
|------------|------|------|------|
| `<cluster>-ca` | CA | `tls.crt` + `tls.key` | Kubernetes API Server 根 CA |
| `<cluster>-etcd` | CA | `tls.crt` + `tls.key` | etcd peer/client 通訊根 CA |
| `<cluster>-sa` | Key Pair | `tls.crt` + `tls.key` | ServiceAccount token 簽發金鑰 |
| `<cluster>-proxy` | CA | `tls.crt` + `tls.key` | API Server Aggregation（front-proxy）CA |
| `<cluster>-kubeconfig` | kubeconfig | kubeconfig YAML | 管理員存取 workload cluster |

所有 CA Secrets 在 `reconcileClusterCertificates()` 中由 `secret.NewCertificatesForInitialControlPlane()` 建立。

### 初始化後的憑證保護

一旦 `KubeadmControlPlaneInitialized` 設定為 True，KCP **不再重新產生** CA：

```go
if !conditions.IsTrue(controlPlane.KCP, controlplanev1.KubeadmControlPlaneInitializedCondition) {
    certificates.LookupOrGenerateCached(...)  // 可產生
} else {
    certificates.LookupCached(...)  // 只查找，不產生
}
```

這是重要的安全設計：避免在 CA 遺失時意外產生新 CA，導致整個叢集憑證體系崩潰。若初始化後 CA Secret 遺失，KCP 會設定 `CertificatesAvailableCondition = False` 並停止操作。

### reconcileCertificateExpiries() — 到期日追蹤

此函式查詢 workload cluster 中各節點實際的 API Server 憑證（`/etc/kubernetes/pki/apiserver.crt`）到期日：

```go
certificateExpiry, err := workloadCluster.GetAPIServerCertificateExpiry(ctx, kubeadmConfig, nodeName)
annotations[clusterv1.MachineCertificatesExpiryDateAnnotation] = expiry.Format(time.RFC3339)
```

到期日記錄在 `KubeadmConfig` 的 annotation `cluster.x-k8s.io/machine-certificates-expiry-date` 中。

### 憑證輪替觸發邏輯

`UpToDate()` 函式中透過 `ShouldRolloutBefore()` 檢查：

```go
if collections.ShouldRolloutBefore(reconciliationTime, kcp.Spec.Rollout.Before)(machine) {
    // 標記此 Machine 需要 rollout
}
```

`Rollout.Before.CertificatesExpiryDays` 預設值讓 KCP 在憑證到期前 **N 天**觸發 rolling update。由於 certificate rollout 等同於完整的 Rolling Update，KCP 會依序重建所有 Control Plane Machine，讓 kubeadm 在每台節點上重新產生並簽發憑證。

:::warning 憑證到期風險
預設 kubeadm 簽發的憑證有效期為 **1 年**。若超過 1 年未進行 K8s 版本升級或其他觸發 rollout 的操作，KCP 會在憑證到期前自動觸發 rollout。

若 KCP 處於暫停狀態（`spec.paused: true`），憑證輪替**不會**自動進行。在長時間暫停的情況下，必須特別注意憑證到期的風險，並在到期前手動恢復或進行輪替。
:::

---

## KCP Status 欄位更新時機

`updateStatus()` 在每次 Reconcile 的 `defer` 中呼叫，確保狀態始終反映最新情況。

### 主要數值欄位

| 欄位 | 來源 | 更新條件 |
|------|------|---------|
| `status.replicas` | `len(controlPlane.Machines)` | 每次 Reconcile |
| `status.readyReplicas` | `MachineReadyCondition = True` 的 Machine 數 | 每次 Reconcile |
| `status.availableReplicas` | `MachineAvailableCondition = True` 的 Machine 數 | 每次 Reconcile |
| `status.upToDateReplicas` | `MachineUpToDateCondition = True` 的 Machine 數 | 每次 Reconcile |
| `status.version` | 所有 CP Machines 中**最低的** K8s 版本 | 每次 Reconcile |
| `status.selector` | `controlplane=<cluster-name>` 的 label selector | 每次 Reconcile |

### Initialization 欄位

| 欄位 | 更新時機 | 說明 |
|------|---------|------|
| `status.initialization.controlPlaneInitialized` | workload cluster 中存在 `kubeadm-config` ConfigMap 時 | 只會從 `false` 變成 `true`，不會逆轉。KCP 透過連接 workload cluster API Server 確認。 |

`setControlPlaneInitialized()` 還有一個邊界條件保護：若唯一的 CP Machine 正在被 MHC 修復或正在刪除中，**不會**設定 `ControlPlaneInitialized = true`，以防 kubeadm init 在短暫視窗完成後導致不一致狀態。

### Conditions（v1beta2）

| Condition 類型 | Status = True 時機 | 說明 |
|--------------|-------------------|------|
| `KubeadmControlPlaneInitialized` | 同 `status.initialization.controlPlaneInitialized` | CP 初始化完成 |
| `KubeadmControlPlaneAvailable` | 足夠 etcd member 健康且有足夠 CP 元件 | `setAvailableCondition()` 計算 |
| `KubeadmControlPlaneCertificatesAvailable` | CA Secrets 均存在且有效 | `reconcileClusterCertificates()` 設定 |
| `KubeadmControlPlaneEtcdClusterHealthy` | 所有 etcd member 健康且一致 | `UpdateEtcdConditions()` 設定 |
| `KubeadmControlPlaneControlPlaneComponentsHealthy` | 所有 CP 元件 Pod 健康 | `UpdateStaticPodConditions()` 設定 |
| `KubeadmControlPlaneMachinesReady` | 所有 CP Machine `MachineReady = True` | `setMachinesReadyCondition()` |
| `KubeadmControlPlaneMachinesUpToDate` | 所有 CP Machine `MachineUpToDate = True` | `setMachinesUpToDateCondition()` |
| `KubeadmControlPlaneRollingOut` | 有 Machine `MachineUpToDate = False` | `setRollingOutCondition()` |
| `KubeadmControlPlaneScalingUp` | 目前 replicas < 目標 | `setScalingUpCondition()` |
| `KubeadmControlPlaneScalingDown` | 目前 replicas > 目標 | `setScalingDownCondition()` |
| `KubeadmControlPlaneRemediating` | 有 Machine 被 KCP 觸發修復 | `setRemediatingCondition()` |
| `KubeadmControlPlaneDeleting` | KCP 有 DeletionTimestamp | `setDeletingCondition()` |

### RequeueAfter 機制

在 `Reconcile()` 的 defer 中，KCP 會在以下情況設定 `RequeueAfter: 20s`：

- `status.initialization.controlPlaneInitialized` 不為 True（等待 CP 初始化）
- `KubeadmControlPlaneControlPlaneComponentsHealthyCondition` 為 False（等待 CP 元件健康）

這確保 KCP 能及時偵測到 CP 初始化完成或健康狀態恢復，而不需等待預設的 10 分鐘全量 resync。

---

## Machine 採用機制（adoptMachines）

KCP 可以**採用**（adopt）已存在但沒有 ownerReference 的 CP Machine，例如在手動建立 Machine 或在叢集遷移場景中。

```go
adoptableMachines := controlPlaneMachines.Filter(
    collections.AdoptableControlPlaneMachines(cluster.Name)
)
```

採用流程：

1. 使用 `APIReader`（不走 cache）直接讀取最新的 KCP 物件，確認 KCP 尚未被刪除（防止 GC 剛孤立 Machine 後又重新採用）
2. 驗證待採用 Machine 的 K8s 版本必須在 KCP 版本的 **±1 minor** 範圍內
3. 為 Machine 設定 `controllerRef` 指向 KCP
4. 同步 Machine 擁有的 Secrets 的 ownerReference

若採用版本超出 ±1 minor 範圍，KCP 發出 Warning Event 但**不返回錯誤**，讓管理者介入決定如何處理。

:::warning 採用後立即 Requeue
`initControlPlaneScope()` 發現並採用機器後，立即返回不做其他操作，等待 ownerReference 更新觸發下次 Reconcile。這避免基於不完整資訊做出錯誤決策。
:::

---

## KCP 刪除流程（reconcileDelete）

KCP 刪除遵循以下規則：

1. **等待 Worker 先刪除**：若叢集中還有非 CP 的 Machine 或 MachinePool，KCP 等待它們先被刪除（`RequeueAfter: 15s`）
2. **移除 pre-terminate hook**：對所有 CP Machines 移除 `PreTerminateHookCleanupAnnotation`，讓它們可以直接刪除而不走正常的 etcd 清理流程
3. **並行刪除**：對所有 CP Machine 同時發送刪除請求
4. **移除 Finalizer**：等所有 Machine 消失後，移除 KCP 的 Finalizer

刪除時**不進行** etcd member 的逐一清理，因為整個 etcd 叢集都會被刪除。

---

## KCP 與 Node Reuse 整合

在使用 Metal3 Provider 的環境中，KCP 與 Node Reuse 機制有特殊的協作方式：

1. 升級時，KCP 決定哪台 CP Machine 需要更新
2. KCP 在對應的 `BareMetalHost`（BMH）上設定 label：
   ```
   infrastructure.cluster.x-k8s.io/metal3machine: <new-machine-name>
   ```
3. `Metal3MachineReconciler` 偵測到此 label 後，優先選用這台 BMH 來部署新 Machine

:::tip Provider Contract 的延伸設計
這種協作模式（KCP 設定 label，Metal3 Provider 遵循）是 CAPI Provider Contract 的延伸體現。KCP 作為 Control Plane Provider 的協調者，透過 label 傳遞意圖；Infrastructure Provider（Metal3）則在自身 reconcile 邏輯中尊重這個意圖。這正是 CAPI 可插拔設計哲學的具體展現。
:::

---

## KCP 暫停與恢復

KCP 支援透過 `spec.paused` 欄位暫停所有自動化操作：

```yaml
spec:
  paused: true  # 暫停所有 reconcile
```

:::info 暫停行為說明
- 設定 `spec.paused: true` 後，KCP Controller 不會執行任何 scale、rollout 或憑證輪替操作
- 適合在**維護視窗期間**暫時停止自動化行為，避免預期外的 Machine 重建
- 恢復方式：設定 `spec.paused: false` 或直接刪除 `paused` 欄位
- **注意**：暫停期間憑證不會自動輪替，請務必在憑證到期前恢復 KCP 正常運作
:::
