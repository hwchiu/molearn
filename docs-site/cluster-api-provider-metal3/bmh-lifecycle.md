---
layout: doc
title: Metal3 Provider — BareMetalHost 生命週期
---

# Metal3 Provider — BareMetalHost 生命週期

::: info 相關章節
- [專案總覽](./index.md)
- [架構概覽](./architecture.md)
:::

---

## 什麼是 BareMetalHost（BMH）

**BareMetalHost（BMH）** 是由 [metal3-io/baremetal-operator](https://github.com/metal3-io/baremetal-operator) 定義的 CRD，代表一台真實的裸機伺服器。

- **BMO（Bare Metal Operator）** 負責管理 BMH，透過 Ironic 執行實際的硬體操作（PXE 開機、IPMI 電源控制、Redfish API 呼叫等）
- **CAPM3** 透過修改 BMH 的 `spec` 欄位來「請求」BMO 執行特定動作，自身不直接操作硬體
- **BMH 的狀態**（`status.provisioning.state`）反映裸機的實際狀態，由 BMO 負責維護與更新

![BMH 生命週期狀態圖](/diagrams/metal3/bmh-lifecycle.png)

---

## BMH 狀態機（State Machine）

BMH 的 `status.provisioning.state` 欄位記錄裸機當前所處的生命週期階段，所有狀態由 BMO 管理。

| 狀態 | 說明 | 轉換觸發條件 |
|------|------|------------|
| `registering` | BMH 剛建立，BMO 正在初始化 IPMI/BMC 連線 | 自動 |
| `inspecting` | BMO 透過 Ironic 取得硬體資訊（CPU、記憶體、磁碟） | 自動 |
| `available` / `ready` | 已完成 introspection，可被 CAPM3 選取 | introspection 完成 |
| `provisioning` | Ironic 正在安裝 OS（PXE boot + 寫入磁碟） | `BMH.spec.image` 被設定 |
| `provisioned` | OS 已安裝完成，機器已上線運行 | provisioning 完成 |
| `deprovisioning` | Ironic 正在清除磁碟、重置機器 | `BMH.spec.image` 被清除 |
| `available` | 釋放完成，可再次被選取 | deprovisioning 完成 |
| `deleting` | BMH 資源被刪除中 | BMH DeletionTimestamp 設定 |
| `error` | 發生無法自動恢復的錯誤 | 各階段錯誤 |
| `paused` | BMH 被暫停，不接受任何操作 | 設定 pause annotation |

::: warning BMH 狀態由 BMO 控制
BMH 的狀態轉換完全由 **BMO** 負責管理，CAPM3 只能透過修改 BMH 的 `spec` 欄位（如設定或清除 `spec.image`）來**間接**影響狀態轉換。CAPM3 無法直接強制改變 BMH 的 provisioning state。
:::

---

## CAPM3 與 BMH 的協作流程（建立機器）

當 CAPI 建立 `Machine` 物件後，`Metal3MachineReconciler` 會執行以下七個步驟：

### Step 1 — 選擇 BMH（chooseHost）

CAPM3 在以下條件下選擇 BMH：

- BMH 在相同 namespace
- `BMH.Status.Provisioning.State` 是 `available` 或 `ready`
- 沒有 `errorMessage`
- 沒有 pause annotation
- 沒有 unhealthy annotation
- `BMH.Spec.ConsumerRef` 為空（未被其他 Metal3Machine 佔用）

**選擇優先順序：**

1. 帶有 `infrastructure.cluster.x-k8s.io/node-reuse` label 的 BMH（升級重用）
2. Name-Based Preallocation 預分配的 BMH（若啟用）
3. 任意 `ready` 狀態 BMH
4. 任意 `available` 狀態 BMH

### Step 2 — 設定 ConsumerRef

- 設定 `BMH.Spec.ConsumerRef` 指向對應的 `Metal3Machine`
- 這標記 BMH 為「已被佔用」，防止其他 `Metal3Machine` 選取同一台 BMH

### Step 3 — 設定 Image

設定 `BMH.Spec.Image` 包含以下資訊：

| 欄位 | 說明 |
|------|------|
| `url` | OS image 下載 URL |
| `checksum` | image checksum 值 |
| `checksumType` | 校驗演算法：`md5` / `sha256` / `sha512` |
| `format` | image 格式：`raw` / `qcow2`（可選） |

BMO 偵測到 `spec.image` 被設定後，即開始 provisioning 流程（BMH 狀態轉為 `provisioning`）。

### Step 4 — 設定 UserData

- 讀取 CAPI Bootstrap Secret（由 `KubeadmConfig` 產生的 cloud-init 內容）
- 建立新 Secret 並設定到 `BMH.Spec.UserData`
- Ironic 在 provisioning 時將 userdata 傳入機器，供 cloud-init 在首次開機時執行（加入節點至 K8s 叢集）

### Step 5 — 設定 MetaData 與 NetworkData

若 `Metal3Machine` 有 `dataTemplate` 引用：

- `Metal3DataReconciler` 渲染 Jinja2 模板，產生 metadata/networkdata 內容
- 建立對應的 Kubernetes Secrets
- 設定到 `BMH.Spec.MetaData` 和 `BMH.Spec.NetworkData`

| 資料類型 | 說明 |
|---------|------|
| **Metadata** | 機器特定的設定（hostname、UUID 等） |
| **NetworkData** | NIC 設定（IP 位址、gateway、DNS 伺服器） |

### Step 6 — 等待 Provisioned

- CAPM3 輪詢 `BMH.Status.Provisioning.State`
- 若不是 `provisioned` → 等待下次 reconcile 觸發
- 若是 `provisioned` → 繼續執行 Step 7

### Step 7 — 設定 ProviderID 並標記就緒

- 從 BMH status 取得 IP addresses → 設定 `Metal3Machine.Status.Addresses`
- 設定 ProviderID 格式：`metal3://<namespace>/<bmh-name>/<m3m-name>`
- 透過 `ClusterCacheTracker` 取得 workload cluster 的 Kubernetes client
- Patch workload cluster 對應 Node 的 `Spec.ProviderID`
- 設定 `Metal3Machine.Status.Ready = true`，通知 CAPI Machine 已就緒

---

## CAPM3 與 BMH 的協作流程（刪除機器）

當 CAPI 刪除 `Machine` 物件後，`Metal3MachineReconciler` 會執行以下三個步驟：

### Step 1 — 清除 BMH Image 設定

- 清除 `BMH.Spec.Image`（設為 nil）
- 清除 `BMH.Spec.UserData`
- 清除 `BMH.Spec.MetaData` 和 `BMH.Spec.NetworkData`
- BMO 偵測到 `spec.image` 被清除後，開始 deprovisioning 流程（BMH 狀態轉為 `deprovisioning`）

### Step 2 — 等待 Deprovisioned

- 輪詢 `BMH.Status.Provisioning.State`
- 等待狀態回到 `available` 或 `ready`

### Step 3 — 清除 ConsumerRef

- 清除 `BMH.Spec.ConsumerRef`（釋放 BMH，使其可被其他機器選取）
- 移除 `Metal3Machine` finalizer，允許物件被 Kubernetes GC 回收

---

## automatedCleaningMode 設定

`Metal3MachineTemplate.spec.template.spec.automatedCleaningMode` 控制 Ironic 在 deprovisioning 時的磁碟清理行為：

| 值 | 說明 |
|----|------|
| `metadata`（預設） | Ironic 執行完整的 disk cleaning（清除所有資料），確保資料安全 |
| `disabled` | 跳過 disk cleaning，大幅加速機器釋放速度 |

::: tip Node Reuse 場景建議
在 **Node Reuse**（節點升級重用）場景中，建議將 `automatedCleaningMode` 設為 `disabled`。由於升級時會重用同一台裸機，省略 disk cleaning 可以顯著縮短升級所需時間，加快整個升級流程。
:::

---

## BMH pause 機制

在 BMH 加上以下 annotation 可暫停 BMO 對此 BMH 的所有操作：

```
baremetalhost.metal3.io/paused: ""
```

**使用場景：**

- CAPM3 在某些操作（如設定 `ConsumerRef`）時可能暫時 pause BMH，以確保設定的原子性，避免 BMO 在設定過程中提前觸發狀態轉換
- 管理員可手動 pause BMH 以進行維護操作

::: warning 注意事項
應避免手動 pause 正在 `provisioning` 或 `deprovisioning` 狀態的 BMH。暫停進行中的操作可能導致 Ironic 任務懸空，需要手動干預才能恢復正常狀態。
:::
