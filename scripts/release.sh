#!/bin/bash

# 获取版本号参数
VERSION=$1

if [ -z "$VERSION" ]; then
  echo "⚠️ 未指定版本号，将自动增加 Patch 版本..."
  # npm version patch 会返回带 v 的版本号，如 v1.0.4
  FULL_VERSION=$(npm version patch --no-git-tag-version)
  CLEAN_VERSION=${FULL_VERSION#v}
else
  # 确保版本号不带 v 前缀
  CLEAN_VERSION=${VERSION#v}
  # 更新 package.json 版本 (不自动打 git tag，由脚本统一处理)
  npm version $CLEAN_VERSION --no-git-tag-version
fi

echo "📦 准备发布版本: v$CLEAN_VERSION"

# 1. 运行 lint 或测试 (可选，确保发布质量)
# npm run lint

# 3. Git 提交
git add .
git commit -m "chore: release v$CLEAN_VERSION"

# 4. 打标签
git tag "v$CLEAN_VERSION"

# 5. 推送到远程 (包含 tag)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🚀 正在推送代码并触发 GitHub Actions 发布流水线..."
git push origin "$CURRENT_BRANCH" --tags

echo "✅ 发布指令已发出！版本: v$CLEAN_VERSION"
echo "💡 请前往 GitHub 仓库的 'Actions' 页面查看跨平台二进制文件的构建状态。"
