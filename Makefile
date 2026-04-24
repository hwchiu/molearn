.PHONY: dev build preview install clean setup check-deps init-submodules check-updates

check-deps:
	@echo "🔍 檢查必要工具..."
	@command -v node >/dev/null 2>&1 || { echo "❌ Node.js 未安裝"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "❌ npm 未安裝"; exit 1; }
	@command -v git >/dev/null 2>&1 || { echo "❌ git 未安裝"; exit 1; }
	@echo "✅ 所有必要工具已安裝"

init-submodules:
	@echo "📦 初始化 git submodules..."
	git submodule update --init --recursive
	@echo "✅ Submodules 已初始化"

setup: check-deps init-submodules install
	@echo ""
	@echo "🎉 專案設置完成！"
	@echo "   執行 make dev 啟動開發伺服器"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

clean:
	rm -rf docs-site/.vitepress/dist docs-site/.vitepress/cache node_modules

check-updates:
	@echo "🔍 檢查各專案 submodule 更新..."
	@git submodule foreach 'echo "📦 $$name: $$(git log --oneline -1)"'
