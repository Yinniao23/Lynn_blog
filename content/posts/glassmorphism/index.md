+++
date = '2026-10-11T12:00:00+08:00'
draft = false
title = '毛玻璃设计美学'
summary = 'Glassmorphism 毛玻璃效果的设计原理与 CSS 实现，让界面通透而有层次。'
tags = ['设计', 'CSS', 'UI']
categories = ['设计']
cover = '/images/placeholder/3.jpg'
+++

**Glassmorphism**（毛玻璃效果）是近年来流行的 UI 设计风格，通过半透明背景与背景模糊营造出通透、有层次的视觉感受。

## 核心要素

毛玻璃效果的三要素：

1. **半透明背景** — `background: rgba(...)`
2. **背景模糊** — `backdrop-filter: blur()`
3. **细微边框** — 模拟玻璃边缘的光影

## CSS 实现

```css
.glass-card {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}
```

## 关键细节

### `backdrop-filter` vs `filter`

- `filter: blur()` 模糊**元素自身**及其内容
- `backdrop-filter: blur()` 模糊**元素背后**的内容

毛玻璃效果需要的是后者。

### `saturate(180%)`

增加饱和度让模糊后的颜色更鲜艳，避免发灰。这是让毛玻璃「通透」而非「雾蒙蒙」的关键。

### 兼容性

`backdrop-filter` 在 Safari 中需要 `-webkit-` 前缀。Firefox 在 103+ 版本已默认支持。

## 在本博客中的应用

本博客的文章卡片、作者区域、页头导航都应用了毛玻璃效果，配合 `color-mix()` 函数实现明暗主题自适应：

```css
background: color-mix(in srgb, var(--color-card) 50%, transparent);
```

这样在浅色和深色主题下都能保持恰当的透明度。

## 小结

毛玻璃效果让界面在保持信息密度的同时增加视觉层次。适度使用，避免过度——毕竟，**设计是为内容服务的**。
