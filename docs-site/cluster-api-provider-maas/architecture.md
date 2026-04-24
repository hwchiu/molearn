---
layout: doc
title: MAAS Provider — 架構設計
---

# MAAS Provider — 架構設計

本頁說明 Cluster API Provider MAAS（CAPM）的元件組成、控制器設計、CRD 定義與啟動配置。

## 整體架構概覽

MAAS Provider 以標準 CAPI Infrastructure Provider 模式運作，由以下核心元件構成：

- **CAPI core**（Cluster API manager）：在 management cluster 中運行，負責協調 Cluster、Machine 等 CAPI 物件
- **MaasClusterReconciler**：叢集層級控制器，管理 DNS 與 controlPlaneEndpoint
- **MaasMachineReconciler**：機器層級控制器，負責 MAAS 機器的完整生命週期
- **spectrocloud/maas-client-go SDK**：封裝 MAAS REST API，Provider 透過此 SDK 與 MAAS 端點溝通
- **三個 CRD**：`MaasCluster`、`MaasMachine`、`MaasMachineTemplate`

![架構元件圖](/diagrams/maas/architecture-components.png)

## 兩大 Controller

### MaasClusterReconciler

負責**叢集層級**資源的建立與回收：

- 管理 DNS FQDN，格式為 `<cluster-name>.<dnsDomain>`，作為 control plane 的對外存取位址
- 設定 `controlPlaneEndpoint`，讓 CAPI core 知道如何連接 kube-apiserver
- 持續監控 APIServer 可用性，在 APIServer 就緒後將 `MaasCluster.Status.Ready` 標記為 `true`
- Reconcile 結束時若叢集被刪除，負責清除 DNS 記錄與相關資源

### MaasMachineReconciler

負責**機器生命週期**的全程管理：

- 呼叫 MAAS allocate API，依照 `MaasMachine.spec` 條件（min CPU、min memory、資源池等）取得機器
- 呼叫 MAAS deploy API，部署指定 OS image 並注入 cloud-init userdata
- 透過 `ClusterCacheTracker` 取得 workload cluster 的 Kubernetes client，以便讀取 Node 狀態
- 部署完成後設定 `Node.spec.providerID`，格式為 `maas://<systemID>`
- 叢集刪除或 Machine 刪除時呼叫 MAAS release API，歸還機器至資源池

## 三個 CRD

| CRD | 用途 | 對應 CAPI 物件 |
|-----|------|----------------|
| `MaasCluster` | 叢集層級：DNS domain、CP endpoint、failure domains | `Cluster.spec.infrastructureRef` |
| `MaasMachine` | 機器層級：分配條件、image、部署參數 | `Machine.spec.infrastructureRef` |
| `MaasMachineTemplate` | 不可變模板，用於 MachineDeployment 批次建立機器 | `MachineDeployment` 的模板來源 |



## 目錄結構

以下為原始碼的主要目錄組織：

```
cluster-api-provider-maas/
├── api/v1beta1/          # CRD 定義（types、webhook、groupversion）
├── controllers/          # MaasCluster/MaasMachine reconcilers
├── pkg/maas/
│   ├── scope/            # Cluster/Machine scope objects（封裝 client 與 spec）
│   ├── machine/          # MAAS machine 操作邏輯（allocate、deploy、release）
│   ├── client/           # maas-client-go 封裝層
│   └── dns/              # DNS 資源管理
├── config/               # RBAC、webhook、CRD manifests（kustomize 格式）
├── templates/            # 部署模板（ClusterClass、MachineDeployment 等）
└── examples/             # 範例 YAML（快速起步用）
```

`pkg/maas/scope/` 中的 scope objects 是架構的關鍵抽象層，將 Kubernetes client、spec 資訊與 MAAS client 整合為單一物件，由 reconciler 傳入各操作函式使用。

## Provider 啟動流程

Manager 透過以下參數啟動，可在部署的 `Deployment` manifest 中覆寫預設值：

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `--machine-concurrency` | `2` | MaasMachine 並發 reconcile 數量 |
| `--sync-period` | `120m` | 定期 resync 的間隔時間 |
| `--metrics-bind-address` | `:8080` | Prometheus metrics 監聽位址 |
| `--health-probe-bind-address` | `:9440` | liveness/readiness probe 位址 |
| `--webhook-port` | `:9443` | Admission webhook 監聽埠 |
| `--leader-elect` | `false` | 啟用 leader election 以支援 HA 部署 |

::: tip 生產環境建議
正式環境部署時，建議啟用 `--leader-elect` 並部署多副本，以確保 Provider 的高可用性。
:::

## 環境變數與設定

::: warning 認證方式
MAAS Provider **不使用 kubeconfig** 認證 MAAS 端點，而是透過以下兩個環境變數進行認證。這兩個變數必須在 Provider 的 Pod 環境中存在，通常透過 Kubernetes Secret 掛載。
:::

| 環境變數 | 必填 | 說明 |
|----------|------|------|
| `MAAS_ENDPOINT` | ✅ | MAAS API endpoint URL，例：`http://maas.example.com/MAAS` |
| `MAAS_API_KEY` | ✅ | MAAS API 金鑰，格式：`consumer_key:token_key:token_secret` |

API 金鑰可從 MAAS UI 的使用者設定頁面產生，或透過 MAAS CLI 取得：

```bash
maas apikey --username <username>
```

## 已知限制

::: warning 使用前須知
以下為目前版本的已知限制，規劃部署前請先評估是否影響您的使用情境：

1. **固定 Pod CIDR**：Pod 網路使用 `192.168.0.0/16`，目前無法透過 `MaasCluster` spec 自訂，若與現有網路衝突需另行處理
2. **不支援原生升級**：Kubernetes 版本升級需透過 rolling MachineDeployment 進行——刪除舊機器並建立新機器，無法原地升級
3. **In-Memory 前提**：需要 MAAS 版本 ≥ 3.5.10，且目標機器至少具備 16GB RAM 以支援 in-memory 部署模式
4. **單一 MAAS 端點**：一個 Provider 部署實例僅對應一個 MAAS 端點，若需管理多個 MAAS 環境，需部署多個 Provider 實例
:::
