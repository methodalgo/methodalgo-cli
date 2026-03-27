#!/bin/bash
# 🚀 Methodalgo CLI Screenshot Optimizer
# 基于 macOS 自带的 sips 工具，将 PNG 转换为高压缩率的 JPG
# 并自动更新 README.md 中的引用

SCREENSHOT_DIR="$(dirname "$0")/../screenshot"
README_FILE="$(dirname "$0")/../README.md"

if [ ! -d "$SCREENSHOT_DIR" ]; then
  echo "❌ 错误: 找不到截图目录 $SCREENSHOT_DIR"
  exit 1
fi

echo "🔍 正在优化 $SCREENSHOT_DIR 中的截图..."

shopt -s nullglob
files=("$SCREENSHOT_DIR"/*.png)

if [ ${#files[@]} -eq 0 ]; then
  echo "💡 没有找到需要处理的 PNG 图片。"
  exit 0
fi

for file in "${files[@]}"; do
  filename=$(basename "$file")
  basename="${filename%.*}"
  target_file="$SCREENSHOT_DIR/$basename.jpg"
  
  old_size=$(wc -c < "$file")
  
  echo "📦 正在转换并压缩 $filename -> $basename.jpg..."
  
  # 转换为 80% 质量的 JPEG，并进行宽度限制（终端截图不需要超高分辨率）
  sips -s format jpeg -s formatOptions 80 --resampleWidth 1600 "$file" --out "$target_file" > /dev/null 2>&1
  
  new_size=$(wc -c < "$target_file")
  
  echo "✅ 处理完成: $((new_size / 1024)) KB (节省了大约 $(((old_size - new_size) / 1024)) KB)"
  
  # 更新 README.md
  if [ -f "$README_FILE" ]; then
    sed -i '' "s/$filename/$basename.jpg/g" "$README_FILE"
    echo "📝 已更新 README.md 中的引用: $filename -> $basename.jpg"
  fi
  
  # 删除原 PNG 文件
  rm "$file"
  echo "🗑️ 已删除原始文件 $filename"
done

echo "🎉 所有截图已优化完毕！"
