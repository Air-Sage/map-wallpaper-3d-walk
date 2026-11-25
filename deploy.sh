#!/bin/sh
# 把这个站点（可行走版）发布到 GitHub Pages：https://air-sage.github.io/map-wallpaper-3d-walk/
# （仓库 Air-Sage/map-wallpaper-3d-walk，main 分支，站点就是仓库根目录）。
# 第一版（环绕沙盘）冻结在另一个仓库 Air-Sage/map-wallpaper-3d，本地远端名叫 v1、标签 v1，
# 地址 https://air-sage.github.io/map-wallpaper-3d/ 。这个脚本只推 origin，不会覆盖第一版。
# 提交所有改动并推送。需要 macOS 钥匙串（在 Claude Code 的 Bash 沙盒外运行）。
set -e
cd "$(dirname "$0")"
GH="${GH:-$HOME/.local/bin/gh}"
# Xcode 许可协议没同意时 /usr/bin/git 不能用，改用命令行工具自带的 git
git --version >/dev/null 2>&1 || export DEVELOPER_DIR=/Library/Developer/CommandLineTools
case "$(git remote get-url origin)" in
  *map-wallpaper-3d-walk*) ;;
  *) echo "deploy: origin 不是 map-wallpaper-3d-walk，已停止，以免覆盖第一版"; exit 1;;
esac
touch .nojekyll
git add -A
if git diff --cached --quiet; then echo "deploy: nothing changed, nothing to publish"; exit 0; fi
git commit -q -m "Update site ($(date '+%Y-%m-%d %H:%M'))

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
git -c credential.helper= -c credential.helper="!$GH auth git-credential" push -q origin main
echo "deploy: pushed $(git rev-parse --short HEAD); GitHub Pages updates in about a minute"
echo "        https://air-sage.github.io/map-wallpaper-3d-walk/"
