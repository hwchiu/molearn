# Kubernetes Source Deep Dive

> 從原始碼深度分析 Kubernetes 生態系專案的技術文件網站，附帶互動式測驗讓工程師自我評測。

**Live site:** https://hwchiu.github.io/molearn

---

## 這是什麼

這個 repo 是一個**文件網站框架 + 內容**的組合，使用 Next.js 14 App Router 靜態輸出，GitHub Dark 設計風格。

目前涵蓋三個 CAPI 生態系專案：

| 專案 | 說明 |
|------|------|
| [Cluster API](https://github.com/kubernetes-sigs/cluster-api) | 宣告式叢集生命週期管理 |
| [Cluster API Provider MAAS](https://github.com/spectrocloud/cluster-api-provider-maas) | 整合 Canonical MAAS 裸機佈建 |
| [Cluster API Provider Metal3](https://github.com/metal3-io/cluster-api-provider-metal3) | 整合 Metal3 裸機管理 |

---

## 架構概念

這個 repo 把「框架程式碼」與「文件內容」完全分離：

```
框架（維護一次，不常動）          文件內容（AI 持續產出）
────────────────────────         ─────────────────────────────
next-site/app/                   next-site/lib/projects.ts
next-site/components/            next-site/content/{project}/features/*.mdx
next-site/lib/（除 projects.ts）  next-site/content/{project}/quiz.json
```

**AI 只需要碰三個地方：**
1. `lib/projects.ts` — 新增專案設定
2. `content/{project}/features/` — 新增 MDX 文件
3. `content/{project}/quiz.json` — 新增測驗題目

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router (`output: 'export'`) |
| Language | TypeScript |
| Styling | Tailwind CSS (GitHub dark design tokens) |
| MDX | next-mdx-remote + remark-gfm + rehype-slug |
| Syntax highlighting | shiki |
| Icons | lucide-react |
| Deployment | 靜態輸出（`next-site/out/`），手動部署 |

---

## 快速上手

### 本地開發

```bash
git clone https://github.com/hwchiu/molearn.git
cd molearn

# 初始化 source code submodules
git submodule update --init --recursive

# 安裝依賴與啟動開發伺服器
cd next-site
npm install
npm run dev
# → http://localhost:3000
```

### 建置靜態輸出

```bash
cd next-site
npm run build
# 輸出到 next-site/out/
```

---

## 加入新專案

完整流程見 [`AGENT.md`](./AGENT.md)，摘要如下：

```bash
# 1. 加入 source code submodule
git submodule add https://github.com/{org}/{repo}.git {name}

# 2. 在 lib/projects.ts 登錄專案設定

# 3. 建立內容目錄
mkdir -p next-site/content/{name}/features

# 4. 新增 .mdx 文件（AI 工作範圍）
# 5. npm run dev 確認
```

---

## 帶到公司內部使用

這套設計可以完整移植到任何組織，AI 工具可以是 Cursor、GitHub Copilot、內部 LLM，都適用。

### 方法一：Fork 現有 repo（快速啟動）

適合：你想保留現有三個 CAPI 專案文件，並在此基礎上加入新專案。

```bash
# 1. Fork 或 clone 到公司內部 Git
git clone https://github.com/hwchiu/molearn.git my-company-docs
cd my-company-docs
git remote set-url origin https://your-company.git/my-company-docs.git

# 2. 初始化 submodules（現有三個專案的原始碼）
git submodule update --init --recursive

# 3. 安裝依賴
cd next-site && npm install
```

然後直接按 `AGENT.md` 步驟加入你的公司專案。

---

### 方法二：清空內容，重新開始（推薦給全新環境）

適合：你想使用同樣的框架風格，但內容完全換成自己的專案。

**Step 1：Fork 或 clone**
```bash
git clone https://github.com/hwchiu/molearn.git my-company-docs
cd my-company-docs
```

**Step 2：移除現有三個專案的 submodules**
```bash
# 逐一移除每個 submodule
git submodule deinit -f cluster-api
git rm -f cluster-api
rm -rf .git/modules/cluster-api

git submodule deinit -f cluster-api-provider-maas
git rm -f cluster-api-provider-maas
rm -rf .git/modules/cluster-api-provider-maas

git submodule deinit -f cluster-api-provider-metal3
git rm -f cluster-api-provider-metal3
rm -rf .git/modules/cluster-api-provider-metal3
```

**Step 3：清空文件內容**
```bash
# 刪除現有三個專案的內容
rm -rf next-site/content/cluster-api
rm -rf next-site/content/cluster-api-provider-maas
rm -rf next-site/content/cluster-api-provider-metal3

# 刪除現有的靜態圖表
rm -rf next-site/public/diagrams/cluster-api
rm -rf next-site/public/diagrams/cluster-api-provider-maas
rm -rf next-site/public/diagrams/cluster-api-provider-metal3
```

**Step 4：清空 projects.ts**

開啟 `next-site/lib/projects.ts`，把 `PROJECTS` 陣列改為空陣列：
```typescript
export const PROJECTS: Project[] = []
export const PROJECT_IDS = PROJECTS.map(p => p.id)
```

**Step 5：清空 versions.json**
```bash
echo '{}' > versions.json
```

**Step 6：驗證框架可以正常建置**
```bash
cd next-site && npm install && npm run build
# 應該成功，只是首頁沒有任何專案卡片
```

**Step 7：按照 `AGENT.md` 加入你的第一個專案**

---

### 方法三：完全從零建立（不需要 clone 這個 repo）

適合：公司有安全限制無法使用外部 repo，或需要完全自定義框架。

把 [`skills/site-bootstrap/SKILL.md`](./skills/site-bootstrap/SKILL.md) 的內容貼給你的 AI，AI 會從 `npx create-next-app` 開始，完整 scaffold 出相同風格的網站（所有元件程式碼都嵌在 SKILL.md 裡）。

---

### 給 AI 的工作說明

指令範本請參閱下方 [如何對 AI 下指令](#如何對-ai-下指令) 章節。

AI 需要讀取的核心文件：
1. [`AGENT.md`](./AGENT.md) — 工作邊界、目錄結構、所有慣例（**必讀，先讀**）
2. [`skills/analyzing-source-code/SKILL.md`](./skills/analyzing-source-code/SKILL.md) — 完整分析流程（分析新專案時自動觸發）
3. [`skills/analyzing-source-code/content-writing-guide.md`](./skills/analyzing-source-code/content-writing-guide.md) — 文件寫作的 5 條 UX 規則

---

## Skills（AI 工作流程）

所有工作流程封裝為 skills，位於 `skills/` 目錄：

| Skill | 用途 |
|-------|------|
| [`skills/site-bootstrap/`](./skills/site-bootstrap/SKILL.md) | 從零建立完整框架（含所有元件程式碼）|
| [`skills/analyzing-source-code/`](./skills/analyzing-source-code/SKILL.md) | 加入新專案的完整分析流程 |
| [`skills/quiz-generation/`](./skills/quiz-generation/SKILL.md) | 從文件產生互動式測驗 |
| [`skills/fireworks-tech-graph/`](./skills/fireworks-tech-graph/SKILL.md) | 產生靜態 SVG/PNG 架構圖 |

所有 skills 均為 **model-agnostic** — 可以把 prompt 貼給任何 AI 工具使用。

---

## 如何對 AI 下指令

所有任務只需要一個開場句，讓 AI 先讀 `AGENT.md`，它就會自己知道邊界、工具和流程。

### 開場指令（每次新對話都貼這句）

```
請先閱讀這個 repo 根目錄的 AGENT.md，讀完後告訴我你理解了哪些工作邊界，再開始執行任何任務。
```

---

### 任務指令範本

**分析新專案並產生文件：**
```
請閱讀 AGENT.md，然後為 {project-name}/ 目錄執行完整的分析與文件撰寫流程。
```

**為現有專案補充某個功能頁面：**
```
請閱讀 AGENT.md，然後為 {project-name} 補充一頁關於 {功能名稱} 的說明文件。
```

**產生或更新測驗：**
```
請閱讀 AGENT.md，然後為 {project-name} 產生測驗題目。
```

**產生架構圖：**
```
請閱讀 AGENT.md，然後為 {project-name} 的 {功能名稱} 產生架構圖。
```

**更新已有文件（新版本發佈後）：**
```
請閱讀 AGENT.md，{project-name} 有新版本，請分析差異並更新相關文件。
```

---

### 完成後務必請 AI 執行驗證

```
請執行 make validate 確認沒有破壞任何東西，並回報結果。
```

> `make validate` 包含框架邊界檢查（CHECK 8）— 若 AI 意外改動了框架程式碼，這個指令會立刻報錯並告訴你哪些檔案要還原。

---

## 專案目錄結構

```
molearn/
├── README.md                      ← 你在這裡
├── AGENT.md                       ← AI 操作手冊（工作邊界、流程、所有慣例）
├── next-site/                     ← 網站主體
│   ├── app/                       ← Next.js App Router（框架）
│   │   ├── [project]/
│   │   │   ├── page.tsx           ← 專案首頁（含 ProjectStory）
│   │   │   ├── features/[slug]/   ← 文件頁
│   │   │   └── quiz/              ← 測驗頁
│   │   └── page.tsx               ← 網站首頁
│   ├── components/                ← React 元件（框架）
│   │   ├── SiteHeader.tsx         ← 頂部導覽 + 專案切換器
│   │   ├── ProjectSidebar.tsx     ← 左側 sidebar
│   │   ├── TableOfContents.tsx    ← 右側 ToC（含 IntersectionObserver）
│   │   ├── ProjectStory.tsx       ← 專案故事 timeline
│   │   ├── QuizQuestion.tsx       ← 互動式測驗元件
│   │   ├── Callout.tsx            ← 提示框元件
│   │   └── MDXComponents.tsx      ← MDX 元件映射
│   ├── lib/
│   │   ├── projects.ts            ← ★ 專案設定（AI 改這裡）
│   │   ├── content-loader.ts      ← MDX 載入與 frontmatter 解析
│   │   └── extract-headings.ts    ← ToC heading 提取（Unicode-aware）
│   └── content/                   ← ★ 文件內容（AI 改這裡）
│       ├── cluster-api/
│       ├── cluster-api-provider-maas/
│       └── cluster-api-provider-metal3/
├── cluster-api/                   ← git submodule（原始碼）
├── cluster-api-provider-maas/     ← git submodule（原始碼）
├── cluster-api-provider-metal3/   ← git submodule（原始碼）
├── scripts/
│   └── diagram-generators/        ← 圖表 generator（Python）
├── skills/                        ← AI workflow skills
└── versions.json                  ← 各專案已分析的 commit 版本
```

---

## Design System

設計原則：GitHub Dark，降低工程師的認知摩擦。

```css
--background: #0d1117   /* 頁面底色 */
--surface:    #161b22   /* 卡片/面板 */
--surface-2:  #21262d   /* 程式碼區塊 */
--border:     #30363d   /* 邊框 */
--muted:      #8b949e   /* 次要文字 */
--accent:     #2f81f7   /* 藍色強調 */
--foreground: #e6edf3   /* 主要文字 */
```

各專案有獨立主題色：
- Cluster API → 藍色 (`border-blue-500`)
- MAAS → 橘色 (`border-orange-500`)
- Metal3 → 紫色 (`border-purple-500`)

---

## 貢獻指南

### 新增文件頁面

1. 閱讀 [`skills/analyzing-source-code/content-writing-guide.md`](./skills/analyzing-source-code/content-writing-guide.md)
2. 在 `next-site/content/{project}/features/` 新增 `.mdx` 檔案
3. `npm run build` 確認無誤
4. Commit message 格式：`docs({project}): {description}`

### 新增測驗題目

1. 閱讀 [`skills/quiz-generation/SKILL.md`](./skills/quiz-generation/SKILL.md)
2. 更新 `next-site/content/{project}/quiz.json`

### 新增架構圖

1. 閱讀 [`skills/fireworks-tech-graph/SKILL.md`](./skills/fireworks-tech-graph/SKILL.md)
2. 輸出 PNG 到 `next-site/public/diagrams/{project}/`
3. MDX 引用：`![說明](/diagrams/{project}/{name}.png)`

---

## License

MIT
