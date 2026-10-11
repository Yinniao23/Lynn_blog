+++
date = '2026-10-11T11:00:00+08:00'
draft = false
title = 'Hugo 搭建个人博客指南'
summary = '从零开始使用 Hugo + Narrow 主题搭建个人博客，部署到 GitHub Pages 的完整流程。'
tags = ['Hugo', '教程', 'GitHub']
categories = ['技术']
cover = '/images/placeholder/2.jpg'
+++

本文记录使用 Hugo 搭建个人博客并在 GitHub Pages 部署的完整流程。

## 1. 安装 Hugo

在 Windows 上，推荐使用 `winget` 安装扩展版：

```powershell
winget install Hugo.Hugo.Extended
```

验证安装：

```bash
hugo version
```

## 2. 创建站点

```bash
hugo new site myblog
cd myblog
```

## 3. 添加主题

将 Narrow 主题作为 git submodule 添加：

```bash
git init
git submodule add https://github.com/tom2almighty/hugo-narrow themes/narrow
```

然后在 `hugo.toml` 中设置：

```toml
theme = "narrow"
```

## 4. 创建文章

```bash
hugo new posts/my-first-post/index.md
```

## 5. 本地预览

```bash
hugo server -D
```

打开 `http://localhost:1313` 即可预览。

## 6. 部署到 GitHub Pages

1. 在 GitHub 创建仓库 `<username>.github.io`
2. 配置 GitHub Actions 自动构建部署
3. 推送代码即可自动发布

## 小结

Hugo 构建速度极快，配合 Narrow 主题的 Tailwind CSS 4.0，可以轻松打造美观的个人博客。整个流程不到一小时就能上线。
