---
layout: doc
title: Cluster API — clusterctl 操作指南
---

# clusterctl 操作指南

:::info 相關章節
- [架構概覽](/cluster-api/architecture)
- [Machine 生命週期](/cluster-api/machine-lifecycle)
- [ClusterClass 與 Topology](/cluster-api/clusterclass-topology)
:::

## clusterctl 是什麼

`clusterctl` 是 Cluster API（CAPI）的官方 CLI 工具，負責管理整個 CAPI 生態系的核心操作：

- **Provider 管理**：安裝、升級、移除 Infrastructure / Bootstrap / ControlPlane Provider
- **工作叢集生命週期**：建立、升級、刪除、搬移 workload cluster
- **叢集診斷**：提供叢集狀態樹狀視圖與除錯功能

### 安裝方式

從 GitHub Release 下載二進位檔：

```bash
# 下載最新版本（Linux）
curl -L https://github.com/kubernetes-sigs/cluster-api/releases/latest/download/clusterctl-linux-amd64 -o clusterctl
chmod +x clusterctl
sudo mv clusterctl /usr/local/bin/
```

---

## clusterctl init — 安裝 Provider

`clusterctl init` 用於在 management cluster 上安裝 CAPI Provider。

```bash
# 安裝 CAPI core + Metal3 Provider
clusterctl init \
  --infrastructure metal3 \
  --bootstrap kubeadm \
  --control-plane kubeadm

# 安裝特定版本
clusterctl init \
  --infrastructure metal3:v1.6.0 \
  --bootstrap kubeadm:v1.6.0 \
  --control-plane kubeadm:v1.6.0

# 安裝 MAAS Provider
clusterctl init \
  --infrastructure maas:v1.0.0 \
  --bootstrap kubeadm \
  --control-plane kubeadm
```

### init 執行的步驟

1. 讀取 clusterctl 設定（`~/.cluster-api/clusterctl.yaml`）
2. 下載 Provider 的 manifest（從 GitHub Release 或自定義 URL）
3. 套用 CRD 和 RBAC 資源
4. 部署 Provider controller（Deployment）
5. 等待 Provider 就緒

### clusterctl.yaml 設定範例

若需使用自定義 Provider URL，可在設定檔中指定：

```yaml
# ~/.cluster-api/clusterctl.yaml
providers:
  - name: metal3
    url: https://github.com/metal3-io/cluster-api-provider-metal3/releases/v1.6.0/infrastructure-components.yaml
    type: InfrastructureProvider
  - name: maas
    url: https://github.com/spectrocloud/cluster-api-provider-maas/releases/v1.0.0/infrastructure-components.yaml
    type: InfrastructureProvider
```

---

## clusterctl generate cluster — 產生叢集 YAML

`clusterctl generate cluster` 根據 Provider 提供的模板產生叢集所需的 YAML 資源。

```bash
# 產生 Metal3 叢集 YAML
clusterctl generate cluster my-cluster \
  --infrastructure metal3 \
  --kubernetes-version v1.28.0 \
  --control-plane-machine-count 3 \
  --worker-machine-count 5 \
  > my-cluster.yaml

# 使用自定義 flavor
clusterctl generate cluster my-cluster \
  --infrastructure metal3:v1.6.0 \
  --flavor without-kube-vip \
  --kubernetes-version v1.28.0 \
  > my-cluster.yaml
```

### 環境變數替換

產生 YAML 時，clusterctl 會自動替換模板中的環境變數。使用前需先設定必要的環境變數：

```bash
export CLUSTER_NAME=my-cluster
export NAMESPACE=metal3
export KUBERNETES_VERSION=v1.28.0
export CONTROL_PLANE_MACHINE_COUNT=3
export WORKER_MACHINE_COUNT=5
# Metal3 特有變數
export IMAGE_URL=https://images.example.com/ubuntu-22.04.tar.gz
export IMAGE_CHECKSUM=sha256:abcdef...

clusterctl generate cluster my-cluster --infrastructure metal3 | kubectl apply -f -
```

若要查看某個 Provider 模板需要哪些變數，可使用 `--list-variables`：

```bash
clusterctl generate cluster my-cluster \
  --infrastructure metal3 \
  --list-variables
```

---

## clusterctl describe cluster — 查看叢集狀態

`clusterctl describe cluster` 以樹狀結構呈現叢集內所有 CAPI 資源的狀態，是診斷問題的第一步。

```bash
# 查看叢集狀態
clusterctl describe cluster my-cluster -n metal3

# 輸出範例：
# NAME                                                          READY  SEVERITY  REASON  SINCE  MESSAGE
# Cluster/my-cluster                                            True                     5m
# ├─ClusterInfrastructure - Metal3Cluster/my-cluster           True                     5m
# ├─ControlPlane - KubeadmControlPlane/my-cluster-cp           True                     5m
# │ └─3 Machines...
# │   ├─Machine/my-cluster-cp-abc12                           True                     4m
# │   ├─Machine/my-cluster-cp-def34                           True                     4m
# │   └─Machine/my-cluster-cp-ghi56                           True                     4m
# └─Workers
#   └─MachineDeployment/my-cluster-workers                    True                     4m
#     └─5 Machines...
```

### 常用選項

```bash
clusterctl describe cluster my-cluster \
  --namespace metal3 \
  --show-conditions all \
  --grouping false
```

| 選項 | 說明 |
|------|------|
| `--show-conditions all` | 顯示所有 Condition（包含 True 狀態） |
| `--grouping false` | 不分組顯示 Machine，逐一列出 |
| `--all-namespaces` | 列出所有 namespace 中的叢集 |

---

## clusterctl get kubeconfig — 取得 kubeconfig

取得 workload cluster 的管理員 kubeconfig，讓你能直接操作 workload cluster：

```bash
# 取得 workload cluster 的 kubeconfig
clusterctl get kubeconfig my-cluster -n metal3 > my-cluster.kubeconfig

# 驗證連線
kubectl --kubeconfig=my-cluster.kubeconfig get nodes
```

---

## clusterctl upgrade — 升級 Provider

`clusterctl upgrade` 用於規劃並執行 CAPI Provider 的版本升級。

### 查看可用升級

```bash
clusterctl upgrade plan

# 輸出範例：
# Latest release available for the v1beta1 API Version of Cluster API (contract):
#
# NAME                    NAMESPACE     TYPE                     CURRENT VERSION   NEXT VERSION
# bootstrap-kubeadm       capi-system   BootstrapProvider        v1.5.0            v1.6.0
# control-plane-kubeadm   capi-system   ControlPlaneProvider     v1.5.0            v1.6.0
# cluster-api             capi-system   CoreProvider             v1.5.0            v1.6.0
# infrastructure-metal3   capm3-system  InfrastructureProvider   v1.5.0            v1.6.0
```

### 執行升級

```bash
clusterctl upgrade apply \
  --contract v1beta1 \
  --core capi-system/cluster-api:v1.6.0 \
  --bootstrap capi-system/kubeadm:v1.6.0 \
  --control-plane capi-system/kubeadm:v1.6.0 \
  --infrastructure capm3-system/metal3:v1.6.0
```

:::warning 升級前注意事項
升級 Provider 前，建議先備份 management cluster 的 etcd。Provider 升級通常不影響 workload cluster，但需確認新版本的 Provider 與現有 workload cluster 版本相容。
:::

---

## clusterctl move — 搬移叢集

`clusterctl move` 用於將 management cluster 中的 CAPI 資源搬移至另一個叢集，常見於 pivot 流程。

```bash
# 將資源從 bootstrap cluster 搬到 management cluster（pivot）
clusterctl move \
  --to-kubeconfig=management-cluster.kubeconfig \
  --namespace metal3

# 搬移特定叢集
clusterctl move \
  --to-kubeconfig=new-management.kubeconfig \
  --namespace metal3 \
  --filter-cluster my-cluster
```

### move 的適用場景

| 場景 | 說明 |
|------|------|
| Bootstrap → 永久 management cluster | 初始部署完成後的 pivot 操作 |
| Management cluster 遷移 | 將管理權轉移至新叢集 |
| 災難復原 | 從備份重建 management cluster 後還原管理資源 |

:::info move 操作前置條件
move 操作前，確保目標叢集已安裝相同版本的 Provider（`clusterctl init`），且 workload cluster 正常運行。move 只搬移管理資源，不影響 workload cluster 本身的運行。
:::

---

## 常用診斷指令

**查看已安裝 Provider 狀態：**

```bash
clusterctl describe provider -n capi-system
```

**列出所有叢集（跨 namespace）：**

```bash
clusterctl describe cluster --all-namespaces
```

**查看 Provider 模板所需的環境變數：**

```bash
clusterctl generate cluster my-cluster \
  --infrastructure metal3 \
  --list-variables
```
