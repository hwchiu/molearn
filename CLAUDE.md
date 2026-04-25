# CLAUDE.md — Kubernetes Learning Site

## 什麼是這個專案

這是一個 **多專案 Kubernetes 技術文件網站**，使用 **Next.js 14 App Router + MDX** 建置，內容以繁體中文（zh-TW）撰寫，專注於從原始碼深度分析各種 Kubernetes 周邊專案，並附帶互動式測驗讓工程師自我評測。

**目前涵蓋專案：**
Cluster API（CAPI）、Cluster API Provider MAAS（CAPM）、Cluster API Provider Metal3（CAPM3）

**設計哲學：**
- GitHub 深色主題，工程師直接上手不需適應
- 靜態輸出（`output: 'export'`），部署到 GitHub Pages 零設定
- 框架程式碼與文件內容完全分離

---

## 技能模組（Skills）

本專案所有工作流程皆封裝為 skills，位於 `skills/` 目錄：

| Skill | 用途 |
|-------|------|
| `skills/site-bootstrap/` | **從零建立完整網站框架**（含所有元件程式碼、設計系統）|
| `skills/analyzing-source-code/` | 加入新專案的完整分析流程（model-agnostic）|
| `skills/quiz-generation/` | 從現有文件產生互動式測驗題目 |
| `skills/fireworks-tech-graph/` | 產生文件用靜態 SVG/PNG 技術圖表 |

**遇到任何任務，先閱讀對應 skill 的 `SKILL.md`，再開始執行。**

另見 `BOOTSTRAP.md`（根目錄）：給 AI 看的快速上手說明，明確告知「只需要動哪些檔案」。

---

## 關鍵技術慣例

### 建置指令
```bash
cd next-site
npm run dev          # 開發伺服器（localhost:3000）
npm run build        # 靜態輸出到 next-site/out/
```
- 建置失敗先查 TypeScript 型別錯誤，其次查 MDX frontmatter 格式
- 路由型式：`/[project]/features/[slug]`，slug 由 content 目錄檔名決定

### 目錄結構

```
molearn/
├── CLAUDE.md                  ← 你在這裡
├── BOOTSTRAP.md               ← AI 快速上手（只需碰這 2 個地方）
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

### 文件格式規範

每個 `.mdx` 頁面 frontmatter：
```yaml
---
title: {專案} — {主題}
description: 一句話說明這頁的核心概念
---
```

- 所有文件內容使用**繁體中文**，術語保留英文原名
- **以下詞彙一律不翻譯**（直接使用英文）：`bare-metal`、`node`、`cluster`、`controller`、`label`、`image`、`workload`、`gateway`、`scheduling`、`rolling update`、`namespace`、`container`
- **不要使用 Mermaid**，改用 `skills/fireworks-tech-graph/` 產生靜態 PNG
- 圖檔放在 `next-site/public/diagrams/{project}/`，文件內以 `![說明](/diagrams/{project}/name.png)` 引用
- 圖表 generator 腳本放在 `scripts/diagram-generators/`

### QuizQuestion 元件

測驗題目以 JSON 格式存放，**不是**直接寫在 MDX 裡：

```json
// content/{project}/quiz.json
[
  {
    "id": 1,
    "question": "題目文字（不含題號）",
    "options": ["選項 A", "選項 B", "選項 C", "選項 D"],
    "answer": 0,
    "explanation": "解釋文字..."
  }
]
```

- `id` 為整數，從 1 起遞增（全域唯一）
- `question` **不含題號** — `app/[project]/quiz/page.tsx` 在渲染時自動補上 `${i+1}. ` 前綴
- quiz 路由是 `app/[project]/quiz/page.tsx`（Server Component，用 `readFileSync` 讀取 quiz.json）
- **不要** 在 MDX 裡直接使用 `<QuizQuestion>` 元件

### 新增專案 Sidebar

在 `lib/projects.ts` 的 `PROJECTS` 陣列新增專案設定後，sidebar 會自動從 `content/{project}/features/` 目錄生成，**不需手動設定** sidebar 項目。

---

## 常用操作

### 加入新專案
→ 使用 `skills/analyzing-source-code/SKILL.md` 的完整流程

### 產生團隊測驗
→ 使用 `skills/quiz-generation/SKILL.md` 的流程

### 重繪或新增圖表
→ 使用 `skills/fireworks-tech-graph/SKILL.md`，輸出靜態 PNG，不使用 Mermaid

### 更新現有專案文件
```bash
make check-updates                          # 查看哪些專案有新版本
make check-update-project PROJECT=cluster-api  # 單一專案差異分析
```

### 驗證 & 建置

**每次 commit 前必須執行 `make validate`（含 build，約 30 秒）。**

```bash
# 完整驗證（含 Next.js build）— 預設，commit 前必跑
make validate

# 快速驗證（不跑 build，僅靜態檢查）— 只在快速迭代時使用
make validate-quick
```

`make validate` 自動檢查：
- MDX frontmatter（`layout: doc` + `title:`）
- 所有 `![...]()` 圖片引用存在且非 1×1 placeholder
- QuizQuestion 語法（quotes、answer 格式）
- quiz.json 格式（id、answer 索引）
- `projects.ts` 裡所有 slug 都有對應 MDX 檔
- 無 VitePress 遺留產物
- **Next.js build 必須 exit 0**（含 vendor chunks、TypeScript 型別）

若 build 出現 `Cannot find module './vendor-chunks/...'`：
```bash
rm -rf next-site/.next && make validate
```

---

## Git 提交規範

```
docs({project}): {description}

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```
