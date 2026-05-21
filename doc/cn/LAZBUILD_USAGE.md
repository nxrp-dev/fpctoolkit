# Lazbuild 使用指南

Nexus Pascal 使用 `lazbuild` 构建 Lazarus 项目。

## 概述

构建 Lazarus 项目（`.lpi` 或 `.lpk`）时，扩展会使用 `lazbuild` 并传递所选构建模式。非 Lazarus 项目仍通过专用 FPC 任务使用 FPC。

## Lazbuild 检测

扩展按以下顺序检测 `lazbuild`：

1. 检查系统 PATH 中是否有 `lazbuild`
2. 检查常见安装路径：
   - **Windows**: `C:\lazarus\lazbuild.exe`, `C:\Program Files\Lazarus\lazbuild.exe`
   - **macOS**: `/usr/local/bin/lazbuild`, `/Applications/Lazarus/lazbuild`
   - **Linux**: `/usr/bin/lazbuild`, `/usr/local/bin/lazbuild`
3. 检查 `LAZARUSDIR` 环境变量或 `nexusPascal.env.LAZARUSDIR` 设置

## 构建模式

使用 `lazbuild` 时，扩展会：

- 使用 `--build-mode=<mode>` 传递所选构建模式
- 对重新构建操作使用 `--build-all`
- 添加 `--quiet` 以减少输出噪音

## 故障排除

如果未检测到 `lazbuild`：

1. 确保 Lazarus 已安装
2. 将 Lazarus 安装目录添加到系统 PATH
3. 设置 `LAZARUSDIR` 环境变量
4. 在 VS Code 设置中配置 `nexusPascal.env.LAZARUSDIR`
