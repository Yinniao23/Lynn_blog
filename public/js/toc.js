(() => {
  // <stdin>
  var TOC_SPACE_WIDE = 13;
  var TOC_SPACE_TIGHT = 2;
  var TOC_MIN_VIEWPORT = 64;
  var TOC_SEGMENT_WEIGHT = { 1: 3, 2: 2, 3: 1.5 };
  function tocHashOf(link) {
    const raw = link.hash ? link.hash.substring(1) : "";
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch (e) {
      return raw;
    }
  }
  var TOCManager = class {
    constructor() {
      this.container = document.getElementById("toc-container");
      if (!this.container) return;
      this.position = this.container.dataset.position || "center";
      this.headings = [];
      this.tocLinks = [];
      this.entries = [];
      this.activeParam = null;
      this.initialized = false;
      this.init();
    }
    init() {
      if (this.initialized) return;
      this.setupElements();
      if (this.tocLinks.length === 0) return;
      this.setupObserver();
      this.bindEvents();
      if (this.position === "side") {
        this.setupSpaceTracking();
        this.buildRail();
        this.updateRail();
        this.setupScrollSync();
        this.syncPin();
      }
      this.initialized = true;
      this.exposeAPI();
    }
    setupElements() {
      Object.assign(this, {
        centerDropdown: document.getElementById("toc-center-dropdown"),
        centerToggle: document.getElementById("toc-center-toggle"),
        centerTitle: document.getElementById("toc-center-title"),
        side: document.getElementById("toc-side"),
        rail: document.getElementById("toc-rail"),
        panel: document.getElementById("toc-panel"),
        pinBtn: document.getElementById("toc-pin"),
        closeBtn: document.getElementById("toc-close"),
        sideToggle: document.getElementById("toc-trigger"),
        sideTitle: document.getElementById("toc-trigger-title")
      });
      const links = this.container.querySelectorAll("nav#TableOfContents a");
      links.forEach((link) => {
        const id = tocHashOf(link);
        if (!id) return;
        this.tocLinks.push(link);
        let depth = 0;
        let el = link.parentElement;
        while (el && el.id !== "TableOfContents") {
          if (el.tagName === "UL") depth++;
          el = el.parentElement;
        }
        this.entries.push({ link, id, depth });
        const heading = document.getElementById(id);
        if (heading) this.headings.push(heading);
      });
    }
    setupObserver() {
      const callback = (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          let topEntry = visibleEntries[0];
          visibleEntries.forEach((entry) => {
            if (entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          });
          this.setActive(topEntry.target.id);
        }
      };
      this.observer = new IntersectionObserver(callback, {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0, 1]
      });
      this.headings.forEach((heading) => {
        this.observer.observe(heading);
      });
    }
    setActive(id) {
      if (!id) return;
      this.activeParam = id;
      let activeText = "";
      this.entries.forEach(({ link, id: linkId }) => {
        const parentLi = link.closest("li");
        if (linkId === id) {
          link.classList.add("active", "font-medium");
          if (parentLi) parentLi.classList.add("active");
          activeText = link.textContent;
        } else {
          link.classList.remove("active", "font-medium");
          if (parentLi) parentLi.classList.remove("active");
        }
      });
      if (activeText) {
        if (this.centerTitle) this.centerTitle.textContent = activeText;
        if (this.sideTitle) this.sideTitle.textContent = activeText;
      }
      this.updateRail();
    }
    /* ---------------- Side 模式：分段竖条 ---------------- */
    buildRail() {
      if (!this.rail) return;
      this.rail.innerHTML = "";
      this.entries.forEach(({ link, id, depth }) => {
        const segment = document.createElement("span");
        segment.className = "toc-seg";
        segment.dataset.target = id;
        segment.style.setProperty("--toc-seg-weight", String(TOC_SEGMENT_WEIGHT[depth] || 1));
        segment.addEventListener("click", (e) => {
          if (!window.matchMedia("(hover: hover)").matches) return;
          e.stopPropagation();
          this.scrollToTarget(link.hash);
        });
        this.rail.appendChild(segment);
      });
      this.rail.style.setProperty("--toc-seg-count", String(this.entries.length));
    }
    updateRail() {
      if (!this.rail) return;
      this.rail.querySelectorAll(".toc-seg").forEach((segment) => {
        segment.classList.toggle("is-active", segment.dataset.target === this.activeParam);
      });
    }
    /* ---------------- Side 模式：竖条与面板同步滚动 ---------------- */
    // 两者行高不同，按滚动进度比例映射；写入时上锁，避免互相触发形成回环
    setupScrollSync() {
      if (!this.rail || !this.panel) return;
      let syncing = false;
      const sync = (from, to) => {
        if (syncing) return;
        const fromMax = from.scrollHeight - from.clientHeight;
        const toMax = to.scrollHeight - to.clientHeight;
        if (fromMax <= 0 || toMax <= 0) return;
        syncing = true;
        to.scrollTop = from.scrollTop / fromMax * toMax;
        requestAnimationFrame(() => {
          syncing = false;
        });
      };
      this.panel.addEventListener("scroll", () => sync(this.panel, this.rail), { passive: true });
      this.rail.addEventListener("scroll", () => sync(this.rail, this.panel), { passive: true });
    }
    // 展开时把当前标题带进可视区域，否则长目录每次都从头开始
    revealActive() {
      if (!this.panel || !this.activeParam) return;
      const entry = this.entries.find(({ id }) => id === this.activeParam);
      if (!entry) return;
      const link = entry.link;
      const max = this.panel.scrollHeight - this.panel.clientHeight;
      if (max <= 0) return;
      const centered = link.offsetTop + link.offsetHeight / 2 - this.panel.clientHeight / 2;
      this.panel.scrollTop = Math.min(Math.max(centered, 0), max);
    }
    /* ---------------- Side 模式：可用留白探测 ---------------- */
    setupSpaceTracking() {
      this.pageContainer = document.getElementById("page-container");
      this.rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      this.updateSpace();
      if (this.pageContainer && "ResizeObserver" in window) {
        this.spaceObserver = new ResizeObserver(() => this.updateSpace());
        this.spaceObserver.observe(this.pageContainer);
      }
      window.addEventListener("resize", () => this.updateSpace(), { passive: true });
    }
    updateSpace() {
      const root = document.documentElement;
      const rem = this.rootFontSize;
      const viewport = root.clientWidth;
      const pageWidth = this.pageContainer ? this.pageContainer.getBoundingClientRect().width : viewport;
      const gutter = Math.max(0, (viewport - Math.min(pageWidth, viewport)) / 2);
      let space = "narrow";
      if (viewport >= TOC_MIN_VIEWPORT * rem) {
        if (gutter >= TOC_SPACE_WIDE * rem) space = "wide";
        else if (gutter >= TOC_SPACE_TIGHT * rem) space = "tight";
      }
      if (root.dataset.tocSpace !== space) {
        root.dataset.tocSpace = space;
        this.setOpen(false);
      }
      root.style.setProperty("--toc-gutter", `${Math.round(gutter)}px`);
    }
    /* ---------------- Side 模式：展开与常显 ---------------- */
    setOpen(open) {
      if (this.position !== "side") return;
      this.container.dataset.open = open ? "true" : "false";
      const expanded = open ? "true" : "false";
      if (this.rail) this.rail.setAttribute("aria-expanded", expanded);
      if (this.sideToggle) this.sideToggle.setAttribute("aria-expanded", expanded);
      if (open) requestAnimationFrame(() => this.revealActive());
    }
    toggleSide() {
      this.setOpen(this.container.dataset.open !== "true");
    }
    isPinned() {
      return document.documentElement.dataset.tocPinned === "true";
    }
    // 常显状态写在 <html> 上，首屏前由 theme-init.js 预置，避免面板闪动
    applyPin(pinned, persist) {
      document.documentElement.dataset.tocPinned = pinned ? "true" : "false";
      if (persist) {
        localStorage.setItem("tocPinned", pinned ? "true" : "false");
      }
      if (this.pinBtn) {
        this.pinBtn.setAttribute("aria-pressed", pinned ? "true" : "false");
        const label = pinned ? this.pinBtn.dataset.labelUnpin : this.pinBtn.dataset.labelPin;
        if (label) {
          this.pinBtn.setAttribute("aria-label", label);
          this.pinBtn.title = label;
        }
      }
      if (pinned) {
        this.setOpen(false);
        requestAnimationFrame(() => this.revealActive());
      }
    }
    syncPin() {
      this.applyPin(this.isPinned(), false);
    }
    scrollToTarget(hash) {
      let targetId = hash.substring(1);
      try {
        targetId = decodeURIComponent(targetId);
      } catch (e) {
      }
      const target = document.getElementById(targetId);
      if (target) {
        const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 100;
        window.scrollTo({
          top: offsetTop,
          behavior: "smooth"
        });
        this.closeAll();
      }
    }
    bindEvents() {
      const toggleDropdown = (parent, dropdown) => {
        if (!dropdown) return;
        const isHidden = dropdown.classList.contains("hidden");
        if (isHidden) {
          dropdown.classList.remove("hidden");
          void dropdown.offsetWidth;
          dropdown.classList.remove("opacity-0", "scale-95");
          dropdown.classList.add("opacity-100", "scale-100");
        } else {
          dropdown.classList.add("opacity-0", "scale-95");
          dropdown.classList.remove("opacity-100", "scale-100");
          setTimeout(() => {
            dropdown.classList.add("hidden");
          }, 300);
        }
      };
      if (this.centerToggle) {
        let hideTimeout = null;
        this.centerToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleDropdown(this.centerToggle.parentElement, this.centerDropdown);
        });
        this.centerToggle.parentElement.addEventListener("mouseenter", () => {
          if (window.matchMedia("(hover: hover)").matches) {
            clearTimeout(hideTimeout);
            if (this.centerDropdown.classList.contains("hidden")) {
              toggleDropdown(this.centerToggle.parentElement, this.centerDropdown);
            }
          }
        });
        this.centerToggle.parentElement.addEventListener("mouseleave", () => {
          if (window.matchMedia("(hover: hover)").matches) {
            hideTimeout = setTimeout(() => {
              if (!this.centerDropdown.classList.contains("hidden")) {
                toggleDropdown(this.centerToggle.parentElement, this.centerDropdown);
              }
            }, 200);
          }
        });
      }
      if (this.side && this.panel) {
        let sideHideTimeout = null;
        const canHover = () => window.matchMedia("(hover: hover)").matches && document.documentElement.dataset.tocSpace !== "narrow";
        this.side.addEventListener("mouseenter", () => {
          if (!canHover()) return;
          clearTimeout(sideHideTimeout);
          this.setOpen(true);
        });
        this.side.addEventListener("mouseleave", () => {
          if (!canHover()) return;
          sideHideTimeout = setTimeout(() => this.setOpen(false), 200);
        });
      }
      if (this.rail) {
        this.rail.addEventListener("click", (e) => {
          if (window.matchMedia("(hover: hover)").matches) return;
          e.stopPropagation();
          this.toggleSide();
        });
        this.rail.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          this.toggleSide();
        });
      }
      if (this.sideToggle) {
        this.sideToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleSide();
        });
      }
      if (this.closeBtn) {
        this.closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.setOpen(false);
        });
      }
      if (this.pinBtn) {
        this.pinBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.applyPin(!this.isPinned(), true);
        });
      }
      document.addEventListener("toc:toggle", () => this.toggle());
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.closeAll();
      });
      document.addEventListener("click", (e) => {
        let clickedInside = false;
        if (this.centerDropdown && this.centerToggle) {
          if (this.centerToggle.parentElement.contains(e.target)) clickedInside = true;
        }
        if (this.side && this.side.contains(e.target)) clickedInside = true;
        if (!clickedInside) {
          this.closeAll();
        }
      });
      this.container.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (link && link.hash) {
          e.preventDefault();
          this.scrollToTarget(link.hash);
        }
      });
    }
    toggle() {
      if (this.position === "side") {
        this.toggleSide();
      } else if (this.centerToggle) {
        this.centerToggle.click();
      }
    }
    closeAll() {
      [this.centerDropdown].forEach((dropdown) => {
        if (dropdown && !dropdown.classList.contains("hidden")) {
          dropdown.classList.add("opacity-0", "scale-95");
          dropdown.classList.remove("opacity-100", "scale-100");
          setTimeout(() => {
            dropdown.classList.add("hidden");
          }, 300);
        }
      });
      this.setOpen(false);
    }
    exposeAPI() {
      window.TOC = {
        toggle: () => this.toggle(),
        hide: () => this.closeAll(),
        pin: (pinned) => this.applyPin(pinned !== false, true),
        initialized: true
      };
    }
  };
  function initTOC() {
    if (window.tocManagerInstance) return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        if (!window.tocManagerInstance) window.tocManagerInstance = new TOCManager();
      });
    } else {
      setTimeout(() => {
        if (!window.tocManagerInstance) window.tocManagerInstance = new TOCManager();
      }, 50);
    }
  }
  document.addEventListener("pjax:complete", () => {
    window.tocManagerInstance = null;
    initTOC();
  });
  initTOC();
})();
