(function () {
  "use strict";

  let searchModal = null;
  let searchOverlay = null;
  let searchInput = null;
  let searchClear = null;
  let searchClose = null;
  let searchEmpty = null;
  let searchLoading = null;
  let searchNoResults = null;
  let searchResultsList = null;
  let searchStats = null;
  let searchItems = null;

  let isModalVisible = false;
  let searchData = null;
  let searchDataPromise = null;
  let currentResults = [];
  let selectedIndex = -1;
  let searchTimeout = null;
  let lastFocusedElement = null;

  function readJSONConfig(id) {
    const configElement = document.getElementById(id);
    if (!configElement?.textContent) return null;

    try {
      const parsed = JSON.parse(configElement.textContent);
      return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    } catch (_) {
      return null;
    }
  }

  function getUIBridge() {
    return window.HugoNarrowUI || null;
  }

  function lockScroll() {
    const ui = getUIBridge();
    if (ui?.lockScroll) {
      ui.lockScroll("search");
      return;
    }

    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    const ui = getUIBridge();
    if (ui?.unlockScroll) {
      ui.unlockScroll("search");
      return;
    }

    document.body.style.overflow = "";
  }

  function init() {
    searchModal = document.getElementById("search-modal");
    searchOverlay = document.getElementById("search-overlay");
    searchInput = document.getElementById("search-input");
    searchClear = document.getElementById("search-clear");
    searchClose = document.getElementById("search-close");
    searchEmpty = document.getElementById("search-empty");
    searchLoading = document.getElementById("search-loading");
    searchNoResults = document.getElementById("search-no-results");
    searchResultsList = document.getElementById("search-results-list");
    searchStats = document.getElementById("search-stats");
    searchItems = document.getElementById("search-items");

    if (!searchModal) return;

    bindEvents();
  }

  function bindEvents() {
    searchClose?.addEventListener("click", hideSearch);
    searchClear?.addEventListener("click", clearSearch);
    searchOverlay?.addEventListener("click", hideSearch);

    if (searchInput) {
      searchInput.addEventListener("input", handleInput);
      searchInput.addEventListener("keydown", handleInputKeydown);
    }

    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("search:open", handleSearchOpenEvent);
    document.addEventListener("search:close", handleSearchCloseEvent);
    document.addEventListener("search:toggle", handleSearchToggleEvent);
  }

  function handleSearchOpenEvent(event) {
    if (event?.detail) event.detail.handled = true;
    if (event?.detail?.origin === "search-module") return;
    showSearch();
  }

  function handleSearchCloseEvent(event) {
    if (event?.detail) event.detail.handled = true;
    if (event?.detail?.origin === "search-module") return;
    hideSearch();
  }

  function handleSearchToggleEvent(event) {
    if (event?.detail) event.detail.handled = true;
    if (event?.detail?.origin === "search-module") return;
    toggleSearch();
  }

  function handleGlobalKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      showSearch();
      return;
    }

    if (!isModalVisible) return;

    if (event.key === "Escape") {
      event.preventDefault();
      hideSearch();
      return;
    }

    if (event.key === "Tab") {
      trapFocus(event);
    }
  }

  function handleInputKeydown(event) {
    if (!isModalVisible) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        navigateResults(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        navigateResults(-1);
        break;
      case "Enter":
        if (selectedIndex >= 0) {
          event.preventDefault();
          selectResult();
        }
        break;
      default:
        break;
    }
  }

  function getFocusableElements() {
    if (!searchModal) return [];

    const selector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    return [...searchModal.querySelectorAll(selector)].filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.hasAttribute("hidden")) return false;
      return !element.classList.contains("pointer-events-none");
    });
  }

  function trapFocus(event) {
    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function showSearch() {
    if (!searchModal || isModalVisible) return;

    isModalVisible = true;
    lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    getUIBridge()?.closeAllMenus?.({ restoreFocus: false });

    searchOverlay?.classList.remove("opacity-0", "pointer-events-none");
    searchOverlay?.classList.add("opacity-100");

    searchModal.classList.remove("opacity-0", "scale-95", "pointer-events-none");
    searchModal.classList.add("opacity-100", "scale-100");
    searchModal.setAttribute("aria-hidden", "false");

    lockScroll();

    window.setTimeout(() => {
      searchInput?.focus();
    }, 50);

    ensureSearchData().catch(() => {});

    document.dispatchEvent(
      new CustomEvent("search:open", {
        detail: { origin: "search-module" },
      })
    );
  }

  function hideSearch() {
    if (!searchModal || !isModalVisible) return;

    isModalVisible = false;

    searchOverlay?.classList.add("opacity-0", "pointer-events-none");
    searchOverlay?.classList.remove("opacity-100");

    searchModal.classList.add("opacity-0", "scale-95", "pointer-events-none");
    searchModal.classList.remove("opacity-100", "scale-100");
    searchModal.setAttribute("aria-hidden", "true");

    unlockScroll();
    clearSearchContent();
    lastFocusedElement?.focus();
    lastFocusedElement = null;

    document.dispatchEvent(
      new CustomEvent("search:close", {
        detail: { origin: "search-module" },
      })
    );
  }

  function toggleSearch() {
    if (isModalVisible) {
      hideSearch();
    } else {
      showSearch();
    }

    document.dispatchEvent(
      new CustomEvent("search:toggle", {
        detail: { origin: "search-module" },
      })
    );
  }

  function clearSearch() {
    clearSearchContent();
    searchInput?.focus();
  }

  function clearSearchContent() {
    if (searchInput) {
      searchInput.value = "";
    }

    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }

    currentResults = [];
    resetNavigation();
    toggleClearButton(false);
    showEmptyState();
  }

  function toggleClearButton(show) {
    if (!searchClear) return;

    if (show) {
      searchClear.classList.remove("opacity-0", "pointer-events-none");
      searchClear.classList.add("opacity-100");
    } else {
      searchClear.classList.add("opacity-0", "pointer-events-none");
      searchClear.classList.remove("opacity-100");
    }
  }

  function resetNavigation() {
    selectedIndex = -1;
    syncSelectedResult();
  }

  function showEmptyState() {
    hideAllStates();
    searchEmpty && (searchEmpty.hidden = false);
  }

  function showLoadingState() {
    hideAllStates();
    searchLoading && (searchLoading.hidden = false);
  }

  function showNoResultsState() {
    hideAllStates();
    searchNoResults && (searchNoResults.hidden = false);
  }

  function showResultsList() {
    hideAllStates();
    searchResultsList && (searchResultsList.hidden = false);
  }

  function hideAllStates() {
    [searchEmpty, searchLoading, searchNoResults, searchResultsList].forEach((element) => {
      if (element) element.hidden = true;
    });
  }

  async function ensureSearchData() {
    if (searchData) return searchData;
    if (searchDataPromise) return searchDataPromise;

    const searchConfig = readJSONConfig("search-config");
    const indexURL = searchConfig?.searchIndexURL || "/index.json";

    searchDataPromise = fetch(indexURL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        searchData = Array.isArray(data) ? data : [];
        return searchData;
      })
      .catch((error) => {
        searchData = [];
        throw error;
      })
      .finally(() => {
        searchDataPromise = null;
      });

    return searchDataPromise;
  }

  function handleInput(event) {
    const query = event.target.value.trim();
    toggleClearButton(query.length > 0);
    resetNavigation();

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = window.setTimeout(() => {
      if (!query) {
        currentResults = [];
        showEmptyState();
        return;
      }

      performSearch(query);
    }, 200);
  }

  async function performSearch(query) {
    showLoadingState();

    try {
      const data = await ensureSearchData();
      currentResults = searchRecords(data, query);

      if (currentResults.length === 0) {
        showNoResultsState();
        return;
      }

      renderResults(currentResults, query);
      showResultsList();
    } catch (_) {
      currentResults = [];
      showNoResultsState();
    }
  }

  function parseKeywords(query) {
    return query
      .toLowerCase()
      .split(/\s+/)
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  function normalizeText(value) {
    if (Array.isArray(value)) {
      return value.join(" ").toLowerCase();
    }

    return String(value || "").toLowerCase();
  }

  function scoreRecord(record, keywords) {
    const title = normalizeText(record.title);
    const summary = normalizeText(record.summary);
    const content = normalizeText(record.content);
    const tags = normalizeText(record.tags);
    const categories = normalizeText(record.categories);

    let score = 0;

    for (const keyword of keywords) {
      let keywordMatched = false;

      if (title.includes(keyword)) {
        score += 40;
        keywordMatched = true;
      }

      if (tags.includes(keyword)) {
        score += 18;
        keywordMatched = true;
      }

      if (categories.includes(keyword)) {
        score += 16;
        keywordMatched = true;
      }

      if (summary.includes(keyword)) {
        score += 10;
        keywordMatched = true;
      }

      if (content.includes(keyword)) {
        score += 4;
        keywordMatched = true;
      }

      if (!keywordMatched) {
        return -1;
      }
    }

    return score;
  }

  function searchRecords(records, query) {
    const keywords = parseKeywords(query);
    if (keywords.length === 0) return [];

    return records
      .map((record) => {
        const score = scoreRecord(record, keywords);
        return { ...record, keywords, score };
      })
      .filter((record) => record.score >= 0)
      .sort((left, right) => right.score - left.score);
  }

  function renderResults(results, query) {
    if (!searchItems || !searchStats) return;

    updateSearchStats(results.length);
    searchItems.replaceChildren();

    const fragment = document.createDocumentFragment();
    results.forEach((result, index) => {
      fragment.appendChild(createResultElement(result, query, index));
    });

    searchItems.appendChild(fragment);
    syncSelectedResult();
  }

  function updateSearchStats(count) {
    const template =
      searchStats?.dataset.countOther || searchStats?.textContent || `Found ${count} results`;

    searchStats.textContent = template.replace("%d", count);
  }

  /* ---------------- 结果渲染：标题 + 段落定位 + and more ---------------- */

  function createResultElement(result, query, index) {
    const item = document.createElement("div");
    item.dataset.index = String(index);
    item.className =
      "search-result-item block rounded-lg p-4 transition-colors duration-200 hover:bg-primary/10";
    item.setAttribute("role", "listitem");

    const container = document.createElement("div");
    container.className = "flex flex-col gap-2";

    // 标题：点击跳转到文章
    const title = document.createElement("h3");
    title.className = "text-base font-semibold";
    const titleLink = document.createElement("a");
    titleLink.href = result.permalink;
    titleLink.className = "search-result-title text-foreground transition-colors";
    titleLink.appendChild(createHighlightedFragment(result.title || "", result.keywords));
    title.appendChild(titleLink);
    container.appendChild(title);

    // 正文命中：可跳转到具体段落
    const occurrences = collectOccurrences(result, result.keywords);

    if (occurrences.length > 0) {
      const first = occurrences[0];
      const snippetLink = document.createElement("a");
      snippetLink.href = occurrenceUrl(result.permalink, first.anchor);
      snippetLink.className =
        "search-result-snippet block text-sm text-muted-foreground transition-colors";
      snippetLink.appendChild(buildContextFragment(first, result.keywords));
      container.appendChild(snippetLink);

      // 关键词出现多次时，左下角给一个 "and more"
      if (occurrences.length > 1) {
        const moreWrap = document.createElement("div");
        moreWrap.className = "search-result-more-wrap mt-1 flex items-center";

        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.className = "search-result-more text-primary text-xs font-medium";
        moreBtn.textContent = "and more";
        moreWrap.appendChild(moreBtn);
        container.appendChild(moreWrap);

        const moreList = document.createElement("div");
        moreList.className = "search-result-more-list mt-2 hidden flex flex-col gap-1";
        occurrences.forEach((occurrence) => {
          const link = document.createElement("a");
          link.href = occurrenceUrl(result.permalink, occurrence.anchor);
          link.className =
            "search-result-snippet block text-xs text-muted-foreground transition-colors";
          link.appendChild(buildContextFragment(occurrence, result.keywords));
          moreList.appendChild(link);
        });
        container.appendChild(moreList);

        moreBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const nowHidden = moreList.classList.toggle("hidden");
          moreBtn.textContent = nowHidden ? "and more" : "show less";
        });
      }
    } else {
      // 正文未命中的回退：显示摘要
      const summary = document.createElement("p");
      summary.className = "text-muted-foreground line-clamp-2 text-sm";
      summary.appendChild(
        createExcerptFragment(result.summary || result.content || "", result.keywords, 140)
      );
      container.appendChild(summary);
    }

    // 元信息
    const meta = document.createElement("div");
    meta.className = "text-muted-foreground flex flex-wrap items-center gap-2 text-xs";

    const metaParts = [];
    if (result.date) metaParts.push(result.date);
    if (result.section) metaParts.push(result.section);
    if (Array.isArray(result.categories) && result.categories[0]) {
      metaParts.push(result.categories[0]);
    }

    metaParts.forEach((part) => {
      const span = document.createElement("span");
      span.textContent = part;
      meta.appendChild(span);
    });

    if (metaParts.length > 0) {
      container.appendChild(meta);
    }

    item.appendChild(container);
    return item;
  }

  function occurrenceUrl(permalink, anchor) {
    if (!anchor) return permalink;
    const base = String(permalink || "").split("#")[0];
    return `${base}#${anchor}`;
  }

  function buildContextFragment(occurrence, keywords) {
    const text = occurrence.text || "";
    const before = 30;
    const after = 70;
    const start = Math.max(0, occurrence.index - before);
    const end = Math.min(text.length, occurrence.index + occurrence.length + after);
    const excerpt = text.slice(start, end);
    const fragment = createHighlightedFragment(excerpt, keywords);

    if (start > 0) fragment.prepend(document.createTextNode("… "));
    if (end < text.length) fragment.append(document.createTextNode(" …"));

    return fragment;
  }

  function collectOccurrences(result, keywords) {
    const html = result.contentHtml;
    if (!html || !Array.isArray(keywords) || keywords.length === 0) return [];

    let doc;
    try {
      doc = new DOMParser().parseFromString(html, "text/html");
    } catch (_) {
      return [];
    }
    if (!doc || !doc.body) return [];

    const segments = buildTextSegments(doc.body);
    const occurrences = [];

    segments.forEach((segment) => {
      const lower = segment.text.toLowerCase();
      let from = 0;

      while (from < lower.length) {
        let matchIndex = -1;
        let matchLength = 0;

        for (let i = 0; i < keywords.length; i += 1) {
          const keyword = keywords[i];
          if (!keyword) continue;
          const found = lower.indexOf(keyword, from);
          if (found !== -1 && (matchIndex === -1 || found < matchIndex)) {
            matchIndex = found;
            matchLength = keyword.length;
          }
        }

        if (matchIndex === -1) break;

        occurrences.push({
          anchor: segment.anchor,
          text: segment.text,
          index: matchIndex,
          length: matchLength,
        });

        from = matchIndex + Math.max(matchLength, 1);
      }
    });

    return occurrences;
  }

  // 把文章 HTML 按标题切分为带锚点的文本片段，用于定位到具体段落
  function buildTextSegments(root) {
    const segments = [];
    let currentAnchor = "";
    const headingTags = { H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1 };
    const blockTags = {
      H1: 1,
      H2: 1,
      H3: 1,
      H4: 1,
      H5: 1,
      H6: 1,
      P: 1,
      LI: 1,
      BLOCKQUOTE: 1,
      PRE: 1,
      TD: 1,
      TH: 1,
      DT: 1,
      DD: 1,
      FIGCAPTION: 1,
    };

    function walk(element) {
      const tag = element.tagName;
      if (!tag) return;

      if (headingTags[tag] && element.id) {
        currentAnchor = element.id;
      }

      if (blockTags[tag]) {
        const text = (element.textContent || "").replace(/\s+/g, " ").trim();
        if (text) segments.push({ anchor: currentAnchor, text });
        return;
      }

      const children = element.children;
      for (let i = 0; i < children.length; i += 1) {
        walk(children[i]);
      }
    }

    const topChildren = root.children;
    for (let i = 0; i < topChildren.length; i += 1) {
      walk(topChildren[i]);
    }

    return segments;
  }

  function createExcerptFragment(text, keywords, maxLength) {
    if (!text) return document.createTextNode("");

    const ranges = findHighlightRanges(text, keywords);
    if (ranges.length === 0) {
      return document.createTextNode(text.slice(0, maxLength));
    }

    const start = Math.max(0, ranges[0][0] - 30);
    const end = Math.min(text.length, Math.max(ranges[0][1] + 80, start + maxLength));
    const excerpt = text.slice(start, end);
    const fragment = createHighlightedFragment(excerpt, keywords);

    if (start > 0) {
      fragment.prepend(document.createTextNode("..."));
    }

    if (end < text.length) {
      fragment.append(document.createTextNode("..."));
    }

    return fragment;
  }

  function createHighlightedFragment(text, keywords) {
    const fragment = document.createDocumentFragment();
    const ranges = findHighlightRanges(text, keywords);

    if (ranges.length === 0) {
      fragment.append(document.createTextNode(text));
      return fragment;
    }

    let cursor = 0;
    ranges.forEach(([start, end]) => {
      if (start > cursor) {
        fragment.append(document.createTextNode(text.slice(cursor, start)));
      }

      const mark = document.createElement("mark");
      mark.className = "bg-primary/20 text-primary rounded px-1 font-medium";
      mark.textContent = text.slice(start, end);
      fragment.append(mark);
      cursor = end;
    });

    if (cursor < text.length) {
      fragment.append(document.createTextNode(text.slice(cursor)));
    }

    return fragment;
  }

  function findHighlightRanges(text, keywords) {
    if (!text || !Array.isArray(keywords) || keywords.length === 0) {
      return [];
    }

    const lowerText = text.toLowerCase();
    const ranges = [];

    keywords.forEach((keyword) => {
      if (!keyword) return;

      let fromIndex = 0;
      while (fromIndex < lowerText.length) {
        const matchIndex = lowerText.indexOf(keyword.toLowerCase(), fromIndex);
        if (matchIndex === -1) break;

        ranges.push([matchIndex, matchIndex + keyword.length]);
        fromIndex = matchIndex + keyword.length;
      }
    });

    ranges.sort((left, right) => left[0] - right[0]);

    return ranges.reduce((merged, range) => {
      const lastRange = merged[merged.length - 1];
      if (!lastRange || range[0] > lastRange[1]) {
        merged.push([...range]);
        return merged;
      }

      lastRange[1] = Math.max(lastRange[1], range[1]);
      return merged;
    }, []);
  }

  function navigateResults(direction) {
    if (!currentResults.length || !searchItems) return;

    if (selectedIndex === -1) {
      selectedIndex = direction > 0 ? 0 : currentResults.length - 1;
    } else {
      selectedIndex += direction;

      if (selectedIndex < 0) {
        selectedIndex = currentResults.length - 1;
      } else if (selectedIndex >= currentResults.length) {
        selectedIndex = 0;
      }
    }

    syncSelectedResult();

    const selectedElement = searchItems.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function syncSelectedResult() {
    if (!searchItems) return;

    searchItems.querySelectorAll(".search-result-item").forEach((element, index) => {
      const isSelected = index === selectedIndex;
      element.classList.toggle("bg-primary/10", isSelected);
      element.classList.toggle("text-primary", isSelected);
      element.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function selectResult() {
    if (selectedIndex < 0 || selectedIndex >= currentResults.length || !searchItems) return;

    const selectedElement = searchItems.querySelector(`[data-index="${selectedIndex}"]`);
    // 结果项本身不是链接，回车时点击其中第一个链接（标题）
    const link = selectedElement ? selectedElement.querySelector("a[href]") : null;
    if (link) link.click();
  }

  window.Search = {
    show: showSearch,
    hide: hideSearch,
    toggle: toggleSearch,
    isVisible: () => isModalVisible,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();