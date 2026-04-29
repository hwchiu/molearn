# AGENT.md — Kubernetes Learning Site

> **給所有 AI 工具看的操作手冊。** 讀完這份文件，你就知道這個 repo 是什麼、你可以動哪些檔案、以及如何完成所有常見任務。

---

## 這個 Repo 是什麼

一個 **多專案 Kubernetes 技術文件網站**，使用 **Next.js 14 App Router + MDX** 建置，內容以繁體中文（zh-TW）撰寫，專注於從原始碼深度分析各種 Kubernetes 周邊專案，並附帶互動式測驗讓工程師自我評測。

**目前涵蓋專案：** Cluster API（CAPI）、Cluster API Provider MAAS（CAPM）、Cluster API Provider Metal3（CAPM3）

**設計哲學：**
- GitHub 深色主題，工程師直接上手不需適應
- 靜態輸出（`output: 'export'`），部署零設定
- 框架程式碼與文件內容完全分離

---

## AI 的工作邊界

這個 repo 是「框架 + 內容」的組合。AI **只需要碰這 3 個地方**，其餘框架程式碼不需要理解也不需要修改：

```
框架（不動）              內容（你的工作範圍）
──────────────────        ───────────────────────────────────
next-site/app/            next-site/lib/projects.ts         ← 新增專案設定
next-site/components/     next-site/content/{project}/      ← 新增 .mdx 文件
next-site/lib/                                              ← 新增 quiz.json
  （除了 projects.ts）    next-site/public/diagrams/        ← 新增圖表（PNG）
```

| 要做什麼 | 改哪個檔案 |
|---------|-----------|
| 新增一個專案 | `next-site/lib/projects.ts` |
| 新增／修改文件頁面 | `next-site/content/{project}/features/*.mdx` |
| 新增／修改測驗題目 | `next-site/content/{project}/quiz.json` |

### 🚫 絕對禁止修改的路徑

以下路徑是**框架程式碼**。AI 沒有任何理由修改這些檔案。一旦改動，整個網站會壞掉：

| 禁止路徑 | 原因 |
|---------|------|
| `next-site/app/` | Next.js 路由與頁面邏輯 |
| `next-site/components/` | React 元件庫 |
| `next-site/lib/` **（除了 `projects.ts`）** | 共用工具函式 |
| `next-site/public/` **（除了 `diagrams/`）** | 靜態資源根目錄 |
| `next-site/next.config.*` | Next.js 設定 |
| `next-site/package.json` | 套件依賴 |
| `next-site/tailwind.config.*` | 設計系統 tokens |
| `next-site/tsconfig.*` | TypeScript 設定 |

> **驗證指令：** `make validate` 包含框架邊界檢查（CHECK 8），會自動偵測並報錯任何對框架檔案的修改。

---

## Skills（AI 工作流程模組）

所有工作流程皆封裝為 skills，位於 `skills/` 目錄。**遇到任何任務，先閱讀對應 skill 的 `SKILL.md`，再開始執行。**

| Skill | 用途 | 何時自動觸發 |
|-------|------|------------|
| `skills/site-bootstrap/` | **從零建立完整網站框架**（含所有元件程式碼、設計系統）| 從零建站 |
| `skills/analyzing-source-code/` | 加入新專案的完整分析流程（model-agnostic）| 分析新專案、產生文件 |
| `skills/quiz-generation/` | 從現有文件產生互動式測驗題目 | 產生或更新測驗 |
| `skills/fireworks-tech-graph/` | 產生文件用靜態 SVG/PNG 技術圖表 | **任何需要圖表的情況**（見下方）|

---

## 加入新專案（5 個步驟）

### Step 1：新增 git submodule

```bash
# 從 repo root 執行（不是 next-site/）
git submodule add https://github.com/{org}/{repo}.git {local-name}

# 確認預設 branch 名稱
git -C {local-name} remote show origin | grep 'HEAD branch'
git config -f .gitmodules submodule.{local-name}.branch <actual-default-branch>
```

### Step 2：在 `projects.ts` 登錄

開啟 `next-site/lib/projects.ts`，在 `PROJECTS` 陣列新增：

```typescript
{
  id: 'my-project',           // URL slug（全小寫、用 -）
  name: 'My Project',         // 顯示名稱
  shortName: 'MP',            // header tab 縮寫（2-4 字母）
  description: '一句話說明',
  accentClass: 'border-green-500 text-green-400',  // 主題色
  repoUrl: 'https://github.com/...',
  features: [],               // 先留空，sidebar 自動從目錄生成
  story: { ... }              // 專案故事（見 analyzing-source-code SKILL.md）
}
```

### Step 3：建立內容目錄

```bash
mkdir -p next-site/content/my-project/features
echo '[]' > next-site/content/my-project/quiz.json

# 記錄分析的 commit 版本到 versions.json
git -C my-project rev-parse HEAD
```

### Step 4：新增 MDX 文件

每個文件主題建立一個 `.mdx` 檔案：

```
next-site/content/my-project/features/
├── overview.mdx         ← 必須有，作為第一頁
├── architecture.mdx
├── controllers.mdx
└── ...
```

每個 MDX 頁面的 frontmatter：

```mdx
---
title: My Project — 主題名稱
description: 一句話說明這頁的核心概念
---
```

### Step 5：確認 sidebar 自動生成

Sidebar 項目由 `content/{project}/features/` 目錄自動生成，**不需手動設定**。

```bash
cd next-site && npm run dev   # 確認頁面正常（localhost:3000）
```

> **完整分析流程**（含原始碼探索、Phase 2-6）請參閱 `skills/analyzing-source-code/SKILL.md`。

---

## 目錄結構

```
molearn/
├── AGENT.md                   ← 你在這裡
├── next-site/
│   ├── app/                   ← Next.js App Router（框架，勿動）
│   ├── components/            ← React 元件（框架，勿動）
│   ├── lib/
│   │   └── projects.ts        ← ★ 新增專案改這裡
│   ├── content/
│   │   └── {project}/
│   │       ├── features/      ← ★ 文件 .mdx 放這裡
│   │       └── quiz.json      ← ★ 測驗題目放這裡
│   └── public/diagrams/       ← 靜態圖表（PNG/SVG）
├── {project}/                 ← git submodule（原始碼）
├── scripts/
│   └── diagram-generators/    ← 圖表 generator（Python）
├── skills/                    ← AI workflow skills
└── versions.json              ← 各專案已分析的 commit 版本
```

---

## 文件寫作規範

### 語言規則

- 所有文件內容使用**繁體中文**，術語保留英文原名
- **以下詞彙一律不翻譯**（直接使用英文）：`bare-metal`、`node`、`cluster`、`controller`、`label`、`image`、`workload`、`gateway`、`scheduling`、`rolling update`、`namespace`、`container`
- **永遠保留英文（不翻譯）**：Controller、Reconciler、CRD、CR、Webhook、Operator、Pod、Node、Namespace、ConfigMap、Secret、Deployment、StatefulSet、DaemonSet、ReplicaSet、Service、Ingress、PersistentVolume、StorageClass、RBAC、ClusterRole、ServiceAccount、Finalizer、OwnerReference、Phase、Status、Spec、Annotation、Label、Selector

### 5 條 UX 規則（摘要）

詳見 `skills/analyzing-source-code/content-writing-guide.md`：

1. **場景優先** — 每頁先說「工程師遇到什麼問題」，再說機制。開頭不能是定義句。
2. **禁止流水帳** — 不能「函數 A 做 X，函數 B 做 Y」連續列舉；改用「先發生什麼、再發生什麼」的流程描述。
3. **圖先於程式碼** — 有架構圖就先放圖，讓讀者有全局感再看實作細節。
4. **程式碼前要有前置說明** — 每個 code block 前加一句說明讀者即將看到什麼。
5. **Progressive Disclosure** — 頁面結構：概述 → 為什麼需要 → 工作原理 → 實作細節 → 注意事項。

### MDX 可用元件（不需要 import）

`Callout` 和 `QuizQuestion` 都是全域 MDX 元件（在 `MDXComponents.tsx` 中註冊），直接使用即可：

```mdx
<Callout type="info" title="背景知識">
  補充說明文字
</Callout>

<Callout type="warning" title="注意">
  非直覺的行為或常見錯誤
</Callout>

<Callout type="tip" title="最佳實踐">
  實用建議
</Callout>

<Callout type="danger" title="警告">
  可能造成資料遺失或安全問題的事項
</Callout>
```

**不要**在 MDX 裡直接使用 `<QuizQuestion>` — 測驗透過 `quiz.json` 統一管理（見下方）。

---

## 測驗格式（quiz.json）

```json
[
  {
    "id": 1,
    "question": "題目文字（不含題號）",
    "options": [
      "選項 A — 正確答案",
      "選項 B — 似是而非的誘答",
      "選項 C — 明顯錯誤",
      "選項 D — 另一個誘答"
    ],
    "answer": 0,
    "explanation": "為什麼 A 是對的，以及其他選項錯在哪裡"
  }
]
```

- `id` 為整數，從 1 開始遞增（全域唯一）
- `answer` 是 0-indexed（第一個選項 = 0）
- `question` **不含題號** — 頁面渲染時自動補上 `1. ` `2. ` 等前綴，手動加會變成 `1. 1. 題目`
- 題目必須基於文件內容，**禁止杜撰**
- 每個主題建議 5–8 題

---

## 圖表規範

> ⚠️ **任何需要建立或修改圖表的情況，必須先閱讀 `skills/fireworks-tech-graph/SKILL.md` 再動手。** 不得自行用程式碼或文字描述替代圖表，也不得使用 Mermaid。

**以下情況視為「需要圖表」，AI 必須主動觸發：**
- 使用者要求「畫圖」、「架構圖」、「流程圖」
- 撰寫 Architecture 頁面（必備架構圖）
- 描述 3+ 個角色的多步驟流程（sequence 或 flow diagram）
- 描述資源生命週期狀態轉換（state machine diagram）
- MDX 文件裡有 `![...]()` 但對應 PNG 不存在

**輸出規範：**
- 格式：靜態 PNG（由 `skills/fireworks-tech-graph/` 生成）
- 存放位置：`next-site/public/diagrams/{project}/{name}.png`
- MDX 引用：`![說明文字](/diagrams/{project}/{name}.png)`
- 命名慣例：`architecture.png`、`state-machine.png`、`{feature}-flow.png`、`{feature}-sequence.png`
- Generator 腳本存放：`scripts/diagram-generators/{project}-{diagram}.py`

---

## 建置與驗證

```bash
cd next-site
npm install          # 第一次或更新套件後
npm run dev          # 開發預覽（localhost:3000）
npm run build        # 正式建置（靜態輸出到 out/）
```

**每次 commit 前必須執行 `make validate`（含 build，約 30 秒）：**

```bash
# 完整驗證（含 Next.js build）— commit 前必跑
make validate

# 快速驗證（不跑 build，僅靜態檢查）— 快速迭代時用
make validate-quick
```

`make validate` 自動檢查：
- MDX frontmatter（`title:` 必填）
- 所有 `![...]()` 圖片引用存在且非 1×1 placeholder
- quiz.json 格式（id、answer 索引）
- `projects.ts` 裡所有 slug 都有對應 MDX 檔
- **Next.js build 必須 exit 0**（含 TypeScript 型別）

若 build 出現 `Cannot find module './vendor-chunks/...'`：
```bash
rm -rf next-site/.next && make validate
```

---

## 更新現有專案

```bash
make check-updates                              # 查看哪些專案有新版本
make check-update-project PROJECT=cluster-api  # 單一專案差異分析
```

---

## Git 提交規範

```
docs({project}): {description}

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```
