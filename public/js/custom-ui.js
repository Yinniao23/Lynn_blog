(() => {
  // <stdin>
  (function() {
    "use strict";
    function setupHoverDropdowns() {
      var types = ["theme", "color-scheme"];
      types.forEach(function(type) {
        var toggles = document.querySelectorAll(
          '.dropdown-toggle[data-dropdown-type="' + type + '"]'
        );
        toggles.forEach(function(toggle) {
          var wrapper = toggle.closest(".relative") || toggle.parentElement;
          if (!wrapper) return;
          var dropdown = wrapper.querySelector(
            '.dropdown-menu[data-dropdown-type="' + type + '"]'
          );
          if (!dropdown) return;
          var hideTimer = null;
          var showTimer = null;
          wrapper.addEventListener("mouseenter", function() {
            clearTimeout(hideTimer);
            clearTimeout(showTimer);
            showTimer = setTimeout(function() {
              document.querySelectorAll(".dropdown-menu:not(.hidden)").forEach(function(d) {
                if (d !== dropdown) d.classList.add("hidden");
              });
              dropdown.classList.remove("hidden");
              toggle.setAttribute("aria-expanded", "true");
            }, 80);
          });
          wrapper.addEventListener("mouseleave", function() {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
            hideTimer = setTimeout(function() {
              dropdown.classList.add("hidden");
              toggle.setAttribute("aria-expanded", "false");
            }, 150);
          });
        });
      });
    }
    function applyPersistedTheme() {
      var root = document.documentElement;
      var theme = localStorage.getItem("theme") || "system";
      var colorScheme = localStorage.getItem("colorScheme");
      var isDark = theme === "dark" || theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
      if (colorScheme) {
        root.setAttribute("data-theme", colorScheme);
      }
      var sunIcons = document.querySelectorAll(".sun-icon, #sun-icon");
      var moonIcons = document.querySelectorAll(".moon-icon, #moon-icon");
      var systemIcons = document.querySelectorAll(".system-icon, #system-icon");
      [].concat(
        Array.from(sunIcons),
        Array.from(moonIcons),
        Array.from(systemIcons)
      ).forEach(function(icon) {
        icon.classList.add("hidden");
      });
      if (theme === "light") {
        sunIcons.forEach(function(i) {
          i.classList.remove("hidden");
        });
      } else if (theme === "dark") {
        moonIcons.forEach(function(i) {
          i.classList.remove("hidden");
        });
      } else {
        systemIcons.forEach(function(i) {
          i.classList.remove("hidden");
        });
      }
    }
    function setupScrollReveal() {
      var revealSelectors = [
        ".friend-card",
        ".prose > *",
        ".post-meta",
        "section.guestbook-section",
        ".utterances-wrapper",
        "header.mb-8",
        ".bg-card.border-border.rounded-xl"
      ];
      var elements = [];
      revealSelectors.forEach(function(sel) {
        document.querySelectorAll(sel).forEach(function(el) {
          var rect = el.getBoundingClientRect();
          if (rect.top > window.innerHeight * 0.85) {
            el.classList.add("scroll-reveal");
            elements.push(el);
          }
        });
      });
      if (elements.length === 0) return;
      if ("IntersectionObserver" in window) {
        var observer = new IntersectionObserver(
          function(entries) {
            entries.forEach(function(entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
        );
        elements.forEach(function(el) {
          observer.observe(el);
        });
      } else {
        elements.forEach(function(el) {
          el.classList.add("is-visible");
        });
      }
    }
    function init() {
      setupHoverDropdowns();
      setupScrollReveal();
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
    window.addEventListener("pageshow", function(event) {
      applyPersistedTheme();
    });
  })();
})();
