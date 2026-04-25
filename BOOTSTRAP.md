# BOOTSTRAP.md — AI 快速上手指南

> **給 AI 看的說明。** 這份文件告訴你在這個 repo 裡，**你只需要動哪些檔案**，其餘的框架程式碼不需要理解也不需要修改。

---

## 框架概念

這個 repo 是一個 **文件網站框架 + 內容** 的組合：

```
框架（不動）           內容（你的工作範圍）
─────────────────      ──────────────────────────────
next-site/app/         next-site/lib/projects.ts        ← 新增專案設定
next-site/components/  next-site/content/{project}/     ← 新增 .mdx 文件
next-site/lib/         next-site/content/{project}/     ← 新增 quiz.json
  （除了 projects.ts）  next-site/public/diagrams/      ← 新增圖表（PNG）
```

**AI 只需要碰這 3 個地方：**

| 要做什麼 | 改哪個檔案 |
|---------|-----------|
| 新增一個專案 | `next-site/lib/projects.ts` |
| 新增/修改文件頁面 | `next-site/content/{project}/features/*.mdx` |
| 新增/修改測驗題目 | `next-site/content/{project}/quiz.json` |

---

## 加入新專案（5 個步驟）

### Step 1：新增 git submodule

```bash
git submodule add https://github.com/{org}/{repo}.git {local-name}
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
  features: [],               // 先留空，下一步自動填入
  story: { ... }              // 專案故事（見下方說明）
}
```

### Step 3：建立內容目錄

```bash
mkdir -p next-site/content/my-project/features
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

MDX 格式：

```mdx
---
layout: doc
title: My Project — 主題名稱
description: 一句話說明這頁的核心概念
---

## 場景

工程師面臨什麼問題...（先說場景，再說機制）

## 架構

![架構圖](/diagrams/my-project/architecture.png)

<Callout type="info" title="重點">
  關鍵洞察說明（Callout 是全域元件，不需要 import）
</Callout>

## 程式碼細節

...
```

> **注意：** `Callout` 和 `QuizQuestion` 都是全域 MDX 元件（在 `MDXComponents.tsx` 中註冊），**不需要在 MDX 檔案中 import**，直接使用即可。

### Step 5：確認 sidebar 自動生成

Sidebar 項目由 `content/{project}/features/` 目錄自動生成，**不需手動設定**。

執行 `cd next-site && npm run dev` 確認頁面正常。

---

## 文件寫作規則（5 條）

詳見 `skills/analyzing-source-code/content-writing-guide.md`，摘要如下：

1. **場景優先** — 每頁先說「工程師遇到什麼問題」，再說機制
2. **禁止流水帳** — 不能「函數 A 做 X，函數 B 做 Y」連續列舉
3. **圖先於文字** — 有架構就先放圖，讓讀者有全局感
4. **程式碼要有前置說明** — 每個 code block 前加一句「接下來的程式碼展示...」
5. **一頁一主題** — 超過 5 分鐘讀完的內容就拆頁

---

## 測驗格式（quiz.json）

```json
[
  {
    "id": 1,
    "question": "題目文字（不含題號，題號由頁面自動加上）",
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

- `id` 為整數，從 1 開始遞增（整個陣列全域唯一）
- `answer` 是 0-indexed（第一個選項 = 0）
- `question` **不含題號** — 頁面渲染時自動補上 `1. ` `2. ` 等前綴，若手動加會變成 `1. 1. 題目`
- 題目必須基於文件內容，**禁止杜撰**
- 每個主題至少 3 題，建議 5-8 題

---

## 圖表

- 所有圖表使用靜態 PNG，**不使用 Mermaid**
- 存放位置：`next-site/public/diagrams/{project}/{name}.png`
- MDX 引用：`![說明文字](/diagrams/{project}/{name}.png)`
- 如需 AI 生成圖表，使用 `skills/fireworks-tech-graph/SKILL.md` 流程

---

## 建置與驗證

```bash
cd next-site
npm install          # 第一次或更新套件後
npm run dev          # 開發預覽（localhost:3000）
npm run build        # 正式建置（靜態輸出到 out/）
```

建置成功 = 0 TypeScript 錯誤 + 0 broken link。

---

## 想從零建立相同風格的網站？

讀 `skills/site-bootstrap/SKILL.md` — 裡面有完整的元件程式碼、設計系統、目錄結構，任何 AI 讀完就能重建。
