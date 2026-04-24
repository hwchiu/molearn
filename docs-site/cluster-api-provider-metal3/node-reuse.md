---
layout: doc
title: Metal3 Provider — Node Reuse
---

# Node Reuse（節點重用）

:::info 相關章節
- [BMH 生命週期](/cluster-api-provider-metal3/bmh-lifecycle) — 了解 BMH 狀態轉換流程
- [IPAM 整合](/cluster-api-provider-metal3/ipam) — 搭配固定 IP 分配
- [Label 同步機制](/cluster-api-provider-metal3/labelsync) — Label 在 Metal3 中的作用
:::

## 什麼是 Node Reuse

在裸機環境（Bare Metal）中，對一台 BareMetalHost（BMH）進行完整的 provisioning 流程通常需要相當長的時間：

- **OS 安裝與配置**：10–20 分鐘
- **BMO cleaning 流程**（磁碟清除）：10–15 分鐘
- **等待 BMH 回到 Available 狀態**：5–10 分鐘

這意味著每台 Control Plane 節點的升級週期可長達 30–55 分鐘。若叢集有 3 台 CP 節點，一次滾動升級可能耗費 90–165 分鐘。

**Node Reuse** 功能的核心思想是：升級時不要丟棄舊的 BMH，而是讓新 Metal3Machine 直接沿用同一台 BMH，跳過 deprovisioning → cleaning → reselection 的耗時流程，大幅縮短升級所需時間。

:::warning 啟用條件與限制
- 目前只支援 **KubeadmControlPlane（KCP）** 的 Control Plane 滾動升級
- Worker node 升級（透過 MachineDeployment）**不支援** Node Reuse
- 需要在 Metal3Machine 規格中設定 `automatedCleaningMode: disabled`，否則每次仍需完整的磁碟清除流程
:::

---

## 核心機制：keepBMH Label

Node Reuse 的關鍵在於一個特殊的 Label，會在升級過程中由 KubeadmControlPlane controller 打到 BMH 上：

```
infrastructure.cluster.x-k8s.io/metal3machine: <new-metal3machine-name>
```

### 運作原理

正常情況下，當 Metal3Machine 被刪除時，Metal3MachineReconciler 會將對應的 BMH **release**（觸發 deprovisioning 流程）。

啟用 Node Reuse 後，流程改變為：

1. **升級前**：KCP controller 在舊 BMH 上設定上述 Label，指定這台 BMH 要預留給哪台新 Metal3Machine
2. **刪除舊 Machine 時**：Metal3 Provider 偵測到 BMH 上帶有此 Label，因此**不做 deprovisioning**，BMH 直接進入輕量 cleaning 流程（若 `automatedCleaningMode: disabled` 則直接跳過）
3. **建立新 Machine 時**：Metal3MachineReconciler 優先選取帶有對應 Label 的 BMH，省去 BMH 選擇流程

---

## Node Reuse 啟用設定

### Metal3Machine 中設定 automatedCleaningMode

```yaml
apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
kind: Metal3Machine
metadata:
  name: my-cluster-controlplane-0
spec:
  automatedCleaningMode: disabled   # 關鍵：禁用 disk cleaning
  image:
    url: https://images.example.com/ubuntu-22.04-kubeadm-v1.28.tar.gz
    checksum: sha256:abcdef...
    checksumType: sha256
    format: raw
  dataTemplate:
    name: my-cluster-controlplane-template
```

:::tip 為何要設定 `automatedCleaningMode: disabled`？
- 預設模式（`metadata`）會在 provisioning 前清除磁碟，這與 Node Reuse 的「快速重用」目的相悖
- 設為 `disabled` 後，BMH 不做磁碟清除，可直接重新 provision → 省下 10–15 分鐘的 cleaning 時間
- 注意：若 BMH 上有舊系統的殘留資料，可能影響新系統安裝，需根據實際環境評估是否可接受
:::

### Metal3DataTemplate 範例

```yaml
apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
kind: Metal3DataTemplate
metadata:
  name: my-cluster-controlplane-template
  namespace: metal3
spec:
  clusterName: my-cluster
  metaData:
    objectNames:
      - object: machine
        key: name
  networkData:
    links:
      ethernets:
        - id: eth0
          type: phy
          macAddress:
            fromHostInterface: eth0
    networks:
      ipv4:
        - id: eth0
          link: eth0
          ipAddressFromIPPool: my-control-plane-pool
```

---

## Node Reuse 升級流程（KubeadmControlPlane）

以下說明 KCP 滾動升級搭配 Node Reuse 的完整步驟。

### Step 1 — 啟動升級

修改 KubeadmControlPlane 的版本欄位，觸發滾動升級：

```
KubeadmControlPlane.Spec.Version: v1.27.0 → v1.28.0
```

KCP controller 開始逐台更新 Control Plane 節點，預設從最舊的節點開始。

### Step 2 — 標記舊 BMH 供重用

KCP controller 選出第一台要更新的 CP 節點後，在對應 BMH 上設定 Label：

```
infrastructure.cluster.x-k8s.io/metal3machine: <new-cp-machine-name>
```

此 Label 告知 Metal3 Provider：這台 BMH 已預留給即將建立的新 Metal3Machine，不得被其他 Machine 搶佔。

### Step 3 — 刪除舊 Machine

KCP 刪除舊 Machine 物件，觸發以下連鎖：

- `Metal3MachineReconciler` 開始處理 Metal3Machine 的刪除
- 偵測到 BMH 上帶有 keepBMH Label → **不做 deprovisioning**
- BMH 進入輕量清除流程；由於 `automatedCleaningMode: disabled`，跳過磁碟清除
- BMH 快速回到 **Available** 狀態（幾秒到數分鐘，而非原本 10–15 分鐘）

### Step 4 — 建立新 Machine

KCP 建立帶有新版本 K8s 的 Machine 物件：

- `Metal3MachineReconciler` 開始 BMH 選取流程
- 優先篩選帶有 `infrastructure.cluster.x-k8s.io/metal3machine: <this-machine-name>` Label 的 BMH
- 找到預留的 BMH → 直接使用，跳過一般的 BMH 選擇演算法

### Step 5 — 重新 Provision

在同一台 BMH 上使用新版本的 bootstrap config 進行 provisioning：

- 套用新版本的 kubeadm bootstrap configuration（cloud-init）
- BMH 重新安裝 OS（此步驟仍需時間，約 10–20 分鐘）
- 因為 `automatedCleaningMode: disabled`，省去 disk cleaning 流程

### Step 6 — 節點加入叢集

- 新版本 K8s 節點加入 Control Plane
- 等待 etcd 成員同步完成、API Server 就緒
- KCP controller 確認節點健康後，重複 Step 2–6，處理下一台 CP 節點

---

## 時間節省估算

| 流程 | 傳統升級 | Node Reuse 升級 |
|------|---------|----------------|
| BMH deprovisioning | 10–15 分鐘 | 1–2 分鐘（skip cleaning）|
| 等待 BMH 可用 | 5–10 分鐘 | 幾秒鐘 |
| OS 重新安裝 | 10–20 分鐘 | 10–20 分鐘（同樣需要）|
| 節點加入叢集 | 5–10 分鐘 | 5–10 分鐘（同樣需要）|
| **單台 CP 升級總時間** | **30–55 分鐘** | **15–30 分鐘** |
| **3 台 CP 節點升級** | **90–165 分鐘** | **45–90 分鐘** |

Node Reuse 可讓整體升級時間縮短約 **40–50%**，在生產環境中意義重大。

---

## 與 preAllocations 的協同使用

Node Reuse 解決了「哪台 BMH」的問題，但升級後節點可能拿到不同的 IP。若搭配 IPAM 的 **preAllocations** 功能，可以同時鎖定 IP：

- **Node Reuse**：確保同一台 BMH 被重用，跳過 deprovisioning 流程
- **IPAM preAllocations**：確保同一台 BMH 仍使用相同的 IP 位址

兩者組合的效果是：升級完成後，節點的 **BMH 不換、IP 不變**，只更新了 K8s 版本。

這對以下生產環境場景特別重要：
- DNS 記錄依賴 Control Plane 節點 IP
- 外部負載均衡器（如 HAProxy、Keepalived）依賴固定 CP IP
- 防火牆規則或 TLS 憑證綁定了特定 IP 位址

關於 preAllocations 的設定細節，請參閱 [IPAM 整合](/cluster-api-provider-metal3/ipam)。
