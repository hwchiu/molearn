---
layout: doc
title: Cluster API — Machine 生命週期
---

# Machine 生命週期

::: info 相關章節
- [Cluster 與 Machine](/cluster-api/api-cluster-machine) — Machine API 物件詳解
- [Core Controller](/cluster-api/controller-core) — MachineReconciler 運作原理
- [MachineHealthCheck](/cluster-api/machine-health-check) — 節點健康檢查與自動修復
- [KubeadmControlPlane](/cluster-api/api-kubeadm-controlplane) — Control Plane 管理
:::

## Machine 生命週期概覽

CAPI Machine 代表叢集中的一台機器（VM、裸機或雲端節點）。從建立到刪除，Machine 會歷經多個 Phase，每個 Phase 代表機器在整個 provisioning 流程中的不同狀態。

MachineReconciler 持續監控 Machine 物件，根據 Bootstrap Provider 和 Infrastructure Provider 的回報狀態推進 Machine 的 Phase。

### Machine Phase 狀態機

| Phase | 說明 | 前置條件 |
|-------|------|---------|
| `Pending` | Machine 剛建立，等待 bootstrap 就緒 | 初始狀態 |
| `Provisioning` | Bootstrap 就緒，Infrastructure Provider 正在建立機器 | Bootstrap ready=true |
| `Provisioned` | Infrastructure Provider 已建立機器（有 ProviderID）| InfraMachine ready=true |
| `Running` | Machine 對應的 K8s Node 已加入叢集且 Ready | NodeRef 已設定 |
| `Deleting` | Machine 正在刪除流程中 | DeletionTimestamp 已設定 |
| `Deleted` | Machine 已完全刪除 | 最終狀態 |
| `Failed` | 發生不可恢復的錯誤 | 需人工介入 |
| `Unknown` | 狀態不明（通常是 controller 無法連線）| — |

---

## 建立流程詳解

### Phase 1 — Pending（等待 Bootstrap）

Machine 物件建立後立即進入 `Pending` 狀態。此階段 MachineReconciler 的主要工作是等待 Bootstrap Provider 就緒：

- MachineReconciler 監看 `bootstrap.configRef` 所指向的 Bootstrap Provider（例如 KubeadmConfig）
- Bootstrap Provider Controller 根據叢集設定（kubeadm token、CA 憑證等）生成 cloud-init user-data，並存入一個 Secret
- Bootstrap Provider 將 Secret 名稱寫入 `BootstrapConfig.Status.DataSecretName`
- MachineReconciler 偵測到 dataSecretName 後，設定 `Machine.Status.BootstrapReady = true`，推進至下一個 Phase

### Phase 2 — Provisioning（等待 Infrastructure）

Bootstrap 資料就緒後，Machine 進入 `Provisioning` 狀態，由 Infrastructure Provider 負責建立實際的機器：

- MachineReconciler 從 Bootstrap Secret 取得 user-data，將 `dataSecretName` 傳遞給 InfrastructureMachine
- Infrastructure Provider（如 CAPMAAS、CAPM3）讀取 user-data，開始 provisioning（VM 建立、BMH deprovisioning 流程等）
- 機器啟動後，cloud-init / ignition 執行 `kubeadm init` 或 `kubeadm join`，將節點加入叢集
- Provisioning 完成後，Infrastructure Provider 在 InfrastructureMachine 上設定 `Status.ProviderID`

### Phase 3 — Provisioned（等待 Node 加入）

Infrastructure Provider 完成機器建立並回報 `InfrastructureMachine.Status.Ready = true` 後，Machine 進入 `Provisioned` 狀態：

- MachineReconciler 透過 ClusterCache 連線到 workload cluster 的 API Server
- 依據 ProviderID（`Machine.Spec.ProviderID`）比對 workload cluster 中各 `Node.Spec.ProviderID`
- 等待對應 Node 出現且進入 `Ready` 狀態

### Phase 4 — Running（正常運行）

MachineReconciler 找到對應的 Node 並確認其 Ready 後：

- 設定 `Machine.Status.NodeRef` 指向 workload cluster 中的對應 Node 物件
- 設定 `Machine.Status.Phase = Running`
- Machine 進入穩定運行狀態，MachineReconciler 持續監控其健康狀況

---

## 刪除流程詳解

### 觸發刪除的情境

Machine 可能因下列原因進入刪除流程：

- **手動刪除**：使用者執行 `kubectl delete machine <name>`
- **MachineSet/MachineDeployment 縮減**：副本數下調時，MachineSet 會選擇並刪除多餘的 Machine
- **KCP Rolling Update**：KubeadmControlPlane 升級時會依序建立新 CP Machine、刪除舊 CP Machine
- **MachineHealthCheck Remediation**：節點健康檢查失敗，CAPI 預設策略會刪除問題 Machine 並由 MachineSet 重建

一旦 Machine 被刪除（`kubectl delete`），Kubernetes 設定 `DeletionTimestamp`，MachineReconciler 開始執行以下八個步驟的刪除流程。

---

### Step 1 — Pre-Drain Hook

MachineReconciler 首先檢查 Machine 是否帶有 pre-drain lifecycle hook annotation：

```
pre-drain.delete.hook.machine.cluster.x-k8s.io/<hook-name>
```

若存在此 annotation，MachineReconciler 會暫停刪除流程，等待外部系統（備份工具、監控系統等）完成所需操作後主動移除此 annotation。

```bash
# 外部系統完成備份後，移除 annotation 以解除阻塞
kubectl annotate machine my-machine \
  pre-drain.delete.hook.machine.cluster.x-k8s.io/backup-
```

此機制為無限等待，需確保外部系統能正確移除 annotation，否則 Machine 將永遠無法刪除。

---

### Step 2 — Cordon（封鎖節點）

MachineReconciler 透過 ClusterCache 對 workload cluster 中對應的 Node 執行 cordon：

- 等同於 `kubectl cordon <node-name>`
- Node 被標記為 `Unschedulable = true`
- 新的 Pod 不再排程到此節點，確保後續 drain 的影響範圍可控

---

### Step 3 — Drain（驅逐 Pods）

對節點上的 Pod 執行 drain：

- 依照 PodDisruptionBudget（PDB）規則安全地驅逐所有 Pod
- **跳過的 Pod 類型：**
  - DaemonSet Pods — 由 DaemonSet 管理，會在節點刪除後自動清理
  - Mirror Pods — Static Pod 的鏡像，不可驅逐

超時設定可在 Machine 或 MachineDeployment 層級配置：

```yaml
spec:
  nodeDrainTimeout: 10m  # 預設：無超時，等待 PDB 允許驅逐
```

::: warning PDB 阻擋 Drain
若 Pod 設定了 PDB 且 `disruptionsAllowed = 0`，drain 會被完全阻塞。

- 確保 PDB 的 `maxUnavailable` 設定合理，避免無限阻塞刪除流程
- 強烈建議設定 `nodeDrainTimeout`，避免升級或縮減操作永久卡住
- 若超過 `nodeDrainTimeout`，MachineReconciler 會強制繼續進行後續步驟
:::

---

### Step 4 — 等待 Volume Detach

確保所有 CSI volumes 已從節點卸除：

- 防止「split-brain」問題（兩個節點同時掛載同一塊 volume）
- 確保資料完整性，特別對有狀態應用（資料庫等）至關重要
- 超時設定：`Machine.Spec.NodeVolumeDetachTimeout`
- 若超過 timeout，MachineReconciler 繼續進行下一步（不強制等待）

---

### Step 5 — Pre-Terminate Hook

類似 pre-drain hook，MachineReconciler 檢查是否存在 pre-terminate annotation：

```
pre-terminate.delete.hook.machine.cluster.x-k8s.io/<hook-name>
```

此 hook 在 drain 完成、volumes 卸除後觸發，適合用於：

- 通知外部系統（如 CMDB、監控系統）節點即將刪除
- 等待 load balancer 完成流量切換
- 執行節點刪除前的最後備份

外部系統完成後移除此 annotation，MachineReconciler 才會繼續。

---

### Step 6 — 刪除 InfrastructureMachine

MachineReconciler 刪除 InfrastructureMachine 物件，觸發 Infrastructure Provider 開始實際刪除機器：

- **AWS CAPA**：終止 EC2 Instance
- **Metal3 CAPM3**：BMH 進入 deprovisioning 流程
- **MAAS CAPMAAS**：釋放 MAAS Machine，重新進入 Ready 狀態

MachineReconciler 等待 InfrastructureMachine 物件完全從 API Server 消失後才進行下一步。

---

### Step 7 — 刪除 BootstrapConfig

- 刪除 KubeadmConfig 或其他 Bootstrap Provider 物件
- 清理存放 cloud-init user-data 的 bootstrap Secret
- 確保 bootstrap credentials（kubeadm token、憑證等）不殘留

---

### Step 8 — 移除 Finalizer

最後一步，MachineReconciler 移除 Machine 的 finalizer：

```
machine.cluster.x-k8s.io
```

Finalizer 移除後，Kubernetes API Server 將 Machine 物件從 etcd 中正式刪除，整個刪除流程完成。

---

## Machine Conditions 詳解

Machine 的 `Status.Conditions` 提供細粒度的健康狀態資訊，可透過 `kubectl get machine -o yaml` 或 `clusterctl describe cluster` 查看。

| Condition | True 條件 | 說明 |
|-----------|----------|------|
| `InfrastructureReady` | InfraMachine.Status.Ready=true | Infrastructure 已就緒 |
| `BootstrapReady` | Bootstrap dataSecretName 已設定 | Bootstrap 資料已就緒 |
| `NodeHealthy` | Node Ready 且 NodeRef 已設定 | 節點健康 |
| `APIServerPodHealthy` | kube-apiserver pod 健康 | （CP only）API Server 運作正常 |
| `ControllerManagerPodHealthy` | kube-controller-manager pod 健康 | （CP only）Controller Manager 運作正常 |
| `SchedulerPodHealthy` | kube-scheduler pod 健康 | （CP only）Scheduler 運作正常 |
| `EtcdPodHealthy` | etcd pod 健康 | （CP only, local etcd）etcd Pod 運作正常 |
| `EtcdMemberHealthy` | etcd member 狀態健康 | （CP only, local etcd）etcd 成員健康 |

Control Plane Machine 的 Conditions 比 Worker Machine 多，因為 KCP Controller 會額外監控各個 CP 元件（kube-apiserver、etcd 等）的健康狀況。

---

## ProviderID 的重要性

ProviderID 是 Machine 在 Infrastructure Provider 中的**唯一識別符**，是連接 CAPI Machine 物件與 workload cluster K8s Node 的關鍵橋樑。

CAPI 透過以下方式建立對應關係：

1. Infrastructure Provider 將 ProviderID 寫入 `InfrastructureMachine.Spec.ProviderID`
2. MachineReconciler 將此值同步至 `Machine.Spec.ProviderID`
3. cloud-init 啟動時，kubelet 以相同的 ProviderID 向 K8s API 註冊，寫入 `Node.Spec.ProviderID`
4. MachineReconciler 掃描 workload cluster 的所有 Node，依 ProviderID 找到對應 Node

不同 Infrastructure Provider 的 ProviderID 格式各異：

| Provider | ProviderID 格式範例 |
|----------|-------------------|
| AWS (CAPA) | `aws:///ap-northeast-1a/i-0abc123def456` |
| Metal3 (CAPM3) | `metal3://metal3/my-bmh/my-m3machine` |
| MAAS (CAPMAAS) | `maas://abc123-def456-ghi789` |
| vSphere (CAPV) | `vsphere://420f1234-5678-abcd-ef01-234567890abc` |

**ProviderID 一旦設定即不可變更。** 若因特殊原因需要更改，必須重建整個 Machine 物件。

---

## 多版本升級考量

::: warning 版本升級注意事項
CAPI 建議嚴格遵守以下升級原則，違反可能導致叢集不穩定：

- **逐版升級**：v1.27 → v1.28 → v1.29，不建議跨版本升級（如直接從 v1.27 升到 v1.29）
- **版本順序**：Worker 節點版本**不能高於** Control Plane 版本
- **升級順序**：先升級 Control Plane（透過更新 KubeadmControlPlane 的 `version` 欄位），再升級 Worker 節點（透過更新 MachineDeployment 的 `version` 欄位）
- **查看升級路徑**：使用 `clusterctl upgrade plan` 確認可用的升級選項及建議順序

違反版本順序可能導致 API 相容性問題，造成 workload cluster 控制面不穩定。
:::
