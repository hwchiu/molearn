---
layout: doc
title: MAAS Provider — 互動式測驗
---

<script setup>
import QuizQuestion from '../.vitepress/theme/components/QuizQuestion.vue'
</script>

# MAAS Provider — 互動式測驗

本測驗涵蓋 Cluster API Provider MAAS（CAPM）的核心概念，包括架構設計、CRD 規格、機器生命週期管理，以及控制器與 CAPI 框架的整合方式。適合已閱讀文件的工程師自我評測。

## 架構與 CRD

<QuizQuestion
  question="Q1. MAAS Provider 的 API group 為何？"
  :options='[
    "infrastructure.cluster.x-k8s.io",
    "cluster.x-k8s.io",
    "maas.cluster.x-k8s.io",
    "bootstrap.cluster.x-k8s.io",
  ]'
  :answer="0"
  explanation="MAAS Provider 實作 CAPI 的 Infrastructure Provider 合約，使用 infrastructure.cluster.x-k8s.io API group，版本為 v1beta1。"
/>

<QuizQuestion
  question="Q2. MaasCluster 的 dnsDomain 欄位用途為何？"
  :options='[
    "定義 Control Plane 的 DNS FQDN 域名（如 k8s.example.com）",
    "設定 MAAS API endpoint 的網域",
    "指定 worker 節點的 DNS 搜尋域",
    "設定 coreDNS 的上游伺服器",
  ]'
  :answer="0"
  explanation="dnsDomain 用於組成 Control Plane 的 FQDN，格式為 &lt;cluster-name&gt;.&lt;dnsDomain&gt;。MAAS Provider 會在 MAAS 中為 CP 節點建立對應的 DNS A record。"
/>

<QuizQuestion
  question="Q3. MaasMachine 的 ProviderID 格式為何？"
  :options='[
    "maas://<systemID>",
    "maas://<namespace>/<systemID>",
    "maas://<hostname>",
    "maas://<ipAddress>",
  ]'
  :answer="0"
  explanation="MAAS Provider 的 ProviderID 格式為 maas://&lt;systemID&gt;，systemID 是 MAAS 為每台機器分配的唯一識別碼。此格式由 MaasMachineReconciler 在機器部署完成後設定。"
/>

<QuizQuestion
  question="Q4. deployInMemory 模式需要哪些前提條件？"
  :options='[
    "MAAS 版本 >= 3.5.10 且目標機器至少 16GB RAM",
    "MAAS 版本 >= 2.9 且機器有 SSD 磁碟",
    "任何 MAAS 版本均可，只需機器有 32GB RAM",
    "需要 MAAS 開啟 experimental 功能旗標",
  ]'
  :answer="0"
  explanation="deployInMemory 模式讓 OS 在 RAM 中運行，需要 MAAS 版本 >= 3.5.10 以及目標機器至少 16GB RAM。此模式適合 CI/CD 或需要快速節點上線的場景。"
/>

<QuizQuestion
  question="Q5. MAAS Provider 透過什麼方式向 MAAS API 認證？"
  :options='[
    "MAAS_ENDPOINT 和 MAAS_API_KEY 環境變數",
    "Kubernetes Secret 中的 kubeconfig",
    "OAuth2 Bearer Token",
    "MAAS 用戶名稱和密碼",
  ]'
  :answer="0"
  explanation="MAAS Provider 透過兩個環境變數認證：MAAS_ENDPOINT（MAAS API URL）和 MAAS_API_KEY（格式：consumer_key:token_key:token_secret）。這些通常從 Kubernetes Secret 掛載到 controller pod。"
/>

## 機器生命週期

<QuizQuestion
  question="Q6. MaasMachine Reconciler 在哪個步驟會暫停等待 Bootstrap Provider 完成？"
  :options='[
    "在 Allocate 之前，檢查 Machine.Spec.Bootstrap.DataSecretName",
    "在 Deploy 之後，等待 cloud-init 完成",
    "在設定 ProviderID 之前，等待 Node 加入叢集",
    "在 DNS 登記之後，等待 CP endpoint 就緒",
  ]'
  :answer="0"
  explanation="這是 CAPI 的 Bootstrap Guard 模式。MaasMachineReconciler 首先檢查 Machine.Spec.Bootstrap.DataSecretName 是否已設定，若未設定代表 Bootstrap Provider 尚未完成，controller 直接返回等待。"
/>

<QuizQuestion
  question="Q7. MAAS machine 的正常建立狀態流程為何？"
  :options='[
    "New -> Allocated -> Deploying -> Deployed -> Ready",
    "Allocated -> Deploying -> Deployed -> Running -> Ready",
    "New -> Provisioning -> Provisioned -> Running",
    "Registering -> Inspecting -> Available -> Deploying -> Deployed",
  ]'
  :answer="0"
  explanation="MAAS machine 的建立流程：New（已登記）-> Allocated（已分配）-> Deploying（安裝中）-> Deployed（安裝完成）-> Ready（正常運行）。CAPM3 在 Deployed 狀態設定 ProviderID 並標記機器就緒。"
/>

<QuizQuestion
  question="Q8. 機器刪除時，MaasMachineReconciler 呼叫的 MAAS API 操作為何？"
  :options='[
    "ReleaseMachine，讓機器回到 MAAS 資源池",
    "DeleteMachine，永久移除機器",
    "PowerOff，關閉機器電源",
    "CommissionMachine，重新 commission 機器",
  ]'
  :answer="0"
  explanation="刪除時呼叫 ReleaseMachine API，MAAS 會進行 disk erasing（DiskErasing 狀態）後將機器釋放回資源池（New 狀態），讓機器可被再次分配給其他叢集。"
/>

<QuizQuestion
  question="Q9. 只有哪種類型的節點會在 MAAS DNS 中登記 A record？"
  :options='[
    "Control Plane 節點",
    "Worker 節點",
    "所有節點",
    "帶有特定 tag 的節點",
  ]'
  :answer="0"
  explanation="MAAS Provider 只為 Control Plane 節點登記 DNS A record，FQDN 為 &lt;cluster-name&gt;.&lt;dnsDomain&gt;。Worker 節點不登記 DNS，因為它們不需要被外部直接存取。"
/>

<QuizQuestion
  question="Q10. 若 MaasMachine.spec.minCPU 設為 4，MAAS 的 Allocate API 如何處理？"
  :options='[
    "作為篩選條件傳入 MAAS API，只分配 CPU >= 4 的機器",
    "MAAS 會優先選擇 CPU 最少的機器",
    "此欄位不影響分配，只是記錄用途",
    "分配後 MAAS 會動態設定 CPU 核心數",
  ]'
  :answer="0"
  explanation="minCPU 作為 allocate 篩選條件（min_cpu_count 參數）傳給 MAAS API，MAAS 只會分配 CPU 核心數 >= 4 的機器。同理，minMemoryInMB、tags、resourcePool、failureDomain 都作為篩選條件。"
/>

## 控制器與整合

<QuizQuestion
  question="Q11. MaasClusterReconciler 在 reconcileDelete 時，何時才會移除 finalizer？"
  :options='[
    "確認所有相關的 MaasMachine 物件都已被刪除後",
    "立即移除，無需等待",
    "等待 DNS FQDN 被刪除後",
    "等待 MAAS 叢集資源被清理後",
  ]'
  :answer="0"
  explanation="MaasClusterReconciler 在 reconcileDelete 時會等待所有相關的 MaasMachine 物件都已刪除（確認無任何 MaasMachine 的 OwnerRef 指向此 Cluster），才移除 finalizer。這確保機器資源在叢集資源之前被清理完畢。"
/>

<QuizQuestion
  question="Q12. MaasMachineReconciler 如何取得 workload cluster 的 client 以設定 Node ProviderID？"
  :options='[
    "透過 ClusterCacheTracker 取得 workload cluster client",
    "直接使用 management cluster 的 kubeconfig",
    "透過 MAAS API 取得 kubeconfig",
    "從 Cluster.status.kubeconfig 欄位讀取",
  ]'
  :answer="0"
  explanation="MaasMachineReconciler 透過 CAPI 的 ClusterCacheTracker 取得 workload cluster 的 Kubernetes client，再 patch workload cluster 中對應 Node 的 Spec.ProviderID 欄位。"
/>

<QuizQuestion
  question="Q13. MAAS Provider 的已知限制中，哪一項是關於網路設定的？"
  :options='[
    "固定 Pod CIDR 為 192.168.0.0/16，無法透過 MaasCluster spec 自訂",
    "不支援 IPv6 雙棧網路",
    "每個叢集最多只能有一個 failure domain",
    "不支援 NodePort 類型的 Service",
  ]'
  :answer="0"
  explanation="MAAS Provider 目前固定使用 192.168.0.0/16 作為 Pod CIDR，無法透過 MaasCluster spec 自訂。這是已知限制之一，在規劃網路時需要注意避免與現有網路衝突。"
/>

<QuizQuestion
  question="Q14. 以下哪個命令可以查看 MAAS Provider controller 的運行日誌？"
  :options='[
    "kubectl logs -n capi-maas-system deployment/capm-controller-manager",
    "kubectl logs -n kube-system deployment/maas-controller",
    "kubectl logs -n capi-system deployment/capi-controller-manager",
    "kubectl describe maascluster my-cluster",
  ]'
  :answer="0"
  explanation="MAAS Provider controller 運行在 capi-maas-system namespace 中，deployment 名稱為 capm-controller-manager。使用 kubectl logs 可查看 reconcile 日誌、MAAS API 呼叫記錄和錯誤訊息。"
/>

<QuizQuestion
  question="Q15. 下列何者正確描述 MaasCluster.spec.failureDomains 的用途？"
  :options='[
    "列出可用的 MAAS zone 清單，讓 MachineDeployment 可將機器分散到不同 zone",
    "設定 MAAS 的高可用模式",
    "定義哪些機器可以成為 Control Plane",
    "指定 MAAS resource pool 的優先順序",
  ]'
  :answer="0"
  explanation="failureDomains 列出可用的 MAAS zone 清單（字串陣列），CAPI core 的 MachineDeployment controller 會讀取這個清單，在建立機器時自動選擇 Machine 數量最少的 zone，實現跨 zone 均衡分配。"
/>
