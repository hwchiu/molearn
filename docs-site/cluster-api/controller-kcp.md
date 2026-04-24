---
layout: doc
title: Cluster API — KCP Controller 詳解
---

# KCP Controller 詳解

:::info 相關章節
- [KubeadmControlPlane API](/cluster-api/api-kubeadm-controlplane)
- [Bootstrap KubeadmConfig](/cluster-api/bootstrap-kubeadmconfig)
- [Machine 生命週期](/cluster-api/machine-lifecycle)
- [Core Controller](/cluster-api/controller-core)
:::

## KCP Controller 概覽

`KubeadmControlPlaneReconciler` 是 CAPI 中負責管理 Control Plane 節點的核心控制器。其主要職責包括：

- **管理 Control Plane 節點生命週期**：建立、更新與刪除 CP Machine
- **協調資源關係**：`KubeadmControlPlane` → `Machine` → `KubeadmConfig` + `InfrastructureMachineTemplate`
- **確保 etcd 叢集健康**：於 scale/rollout 前後驗證 etcd quorum
- **管理憑證輪替**：監控 CP 相關憑證有效期，自動觸發輪替

KCP Controller 的設計核心是：在任意時刻都能確保 Control Plane 的可用性，任何 scale 或 rollout 操作都需先通過健康檢查才能執行。

---

## KCP Reconcile 主流程

### 正常 Reconcile

**Step 1 — 取得物件並確認所屬 Cluster**

Controller 取得 `KubeadmControlPlane` 物件，並查找對應的 `Cluster` 物件，確認 ownership 關係是否正確。

---

**Step 2 — 初始化（首次 Reconcile）**

若為第一次建立，KCP 會：

- 建立 Kubernetes CA、etcd CA 等必要憑證（若對應 Secret 不存在）
- 建立管理員用 kubeconfig Secret（`<cluster-name>-kubeconfig`）

---

**Step 3 — Scale Up（擴展）**

當目前 Machine 數量 < `spec.replicas` 時：

1. 建立 `KubeadmConfig`（第一台使用 `init`，後續使用 `join`）
2. 從 `machineTemplate` 建立 `InfrastructureMachine`
3. 建立 `Machine`，分別指向上述兩個物件
4. 等待新 Machine 加入 etcd 叢集並通過健康確認

---

**Step 4 — Rollout（滾動更新）**

當有 Machine 需要更新（版本不符、template hash 變更等）時：

1. 根據 `rolloutStrategy.rollingUpdate.maxSurge` 建立新 Machine
2. 等待新 Machine 就緒並通過 etcd 健康檢查
3. 對舊 Machine 執行 drain，完成後刪除

---

**Step 5 — Scale Down（縮減）**

當目前 Machine 數量 > `spec.replicas` 時：

1. 選取最舊的 Machine 進行刪除
2. 刪除前確認 etcd 叢集健康（不能低於 quorum）
3. 從 etcd 中移除對應 member，再刪除 Machine

---

**Step 6 — 更新 KCP Status**

完成所有操作後，更新以下狀態欄位：

| 欄位 | 說明 |
|------|------|
| `status.replicas` | 目前 Machine 總數 |
| `status.readyReplicas` | 已就緒的 Machine 數 |
| `status.updatedReplicas` | 已更新到最新版本的 Machine 數 |
| `status.initialized` | Control Plane 是否已完成初始化 |
| `status.ready` | Control Plane 是否可接受工作負載 |

---

## 需要 Rollout 的條件

以下變更會觸發 KCP 的 Rolling Update：

| 觸發條件 | 說明 |
|---------|------|
| `spec.version` 變更 | K8s 版本升級／降級 |
| `spec.machineTemplate.infrastructureRef` 變更 | 指向新的 `InfrastructureMachineTemplate` |
| `spec.kubeadmConfigSpec` 變更 | kubeadm 設定變更（如 `clusterConfiguration`）|
| `spec.machineTemplate.metadata` 變更 | Machine metadata（labels/annotations）變更 |
| 憑證即將到期 | KCP 自動偵測並觸發 certificate rollout |

KCP 透過對每台 Machine 計算 **template hash** 來判斷是否需要更新。只要上述任一條件成立，對應 Machine 的 hash 就會與當前 `KubeadmControlPlane` spec 不符，進而觸發 rollout。

---

## etcd 健康管理

### etcd Member 管理

KCP 透過 **ClusterCache** 連接到 workload cluster，再透過對 etcd Pod 的 port-forward 建立 etcd client，查詢成員狀態。

確認 etcd quorum 的規則為：

> N 個成員需要 **(N/2) + 1** 個成員處於 healthy 狀態

任何 scale down 或 rollout 操作執行前，KCP 都會先驗證此條件，防止操作導致 etcd 失去 quorum。

### etcd Member 清理

:::info etcd 清理機制
當 Machine 被刪除時，KCP 會主動從 etcd 叢集中移除對應的 etcd member，以防止 etcd 記錄到已不存在的 peer，確保 etcd 叢集的成員列表保持乾淨。若 etcd member 移除失敗，KCP Controller 會持續重試，直到成功為止。
:::

### Stale Machine 偵測

若 Machine 仍然存在，但對應的 etcd member 已不存在（例如 etcd 資料遺失或 Pod 異常），KCP 會將此 Machine 標記為需要更新。在下次 rollout 時，這些 Machine 會被優先處理。

---

## 憑證管理

### KCP 管理的 Secrets

| Secret 名稱 | 內容 | 說明 |
|------------|------|------|
| `<cluster>-ca` | Kubernetes CA | API Server 使用的根 CA |
| `<cluster>-etcd` | etcd CA | etcd peer/client 通訊憑證 |
| `<cluster>-sa` | Service Account Key | ServiceAccount token 簽發 |
| `<cluster>-proxy` | Front Proxy CA | Aggregation layer 憑證 |
| `<cluster>-kubeconfig` | kubeconfig | 管理員連到 workload cluster 用 |

這些 Secret 由 KCP 在初始化階段建立，並由 `KubeadmConfig` Bootstrap Controller 掛載至每台 Control Plane Machine。

### 憑證自動輪替

KCP 會持續監控各 CP 節點上的憑證有效期。觸發 certificate rollout 的條件為：

- 憑證剩餘有效期 **< 10%**，或
- 憑證剩餘有效期 **< 1 年**

Certificate rollout 等同於一次完整的 Rolling Update：KCP 會依序重建所有 Control Plane Machine，以便 kubeadm 在每台節點上重新產生並簽發憑證。

:::warning 憑證到期風險
預設憑證有效期為 **1 年**。若超過 1 年未進行 K8s 版本升級或其他觸發 rollout 的操作，KCP 會在憑證到期前自動觸發 rollout。

若 KCP 處於暫停狀態（`spec.paused: true`），憑證輪替**不會**自動進行。在長時間暫停的情況下，必須特別注意憑證到期的風險，並在到期前手動恢復或進行輪替。
:::

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
