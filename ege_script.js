(function () {
  var APP_ID = "egeApp";
  var root = document.getElementById(APP_ID);
  if (!root || root.dataset.inited === "1") return;
  root.dataset.inited = "1";

  var API_BASE = "https://script.google.com/macros/s/AKfycbwVUeIAJRvitdc3UMP-C3dZPSjVJ4zMqTn7NwBPd4-2dXl8fqryIzgdPAjJ9NOAdZCVKA/exec";

  // TODO: replace with real links
  var BOT_PAY_LINK = "https://t.me/your_pay_bot";
  var BOT_SUPPORT_LINK = "https://t.me/your_support_bot";
  var BOT_ESSAY_LINK = "https://t.me/your_essay_bot";
  var STUDENTS_CHAT_LINK = "https://t.me/stasy_lova_bot";

  // TODO: replace with real links
  function BUY_BLOCK_LINK(blockId, platformId) {
    return "https://t.me/your_pay_bot?start=buy_block_" + blockId + "_" + encodeURIComponent(platformId || "");
  }

  // TODO: replace with real links
  function RENEW_BLOCK_LINK(blockId, platformId) {
    return "https://t.me/your_pay_bot?start=renew_block_" + blockId + "_" + encodeURIComponent(platformId || "");
  }

  var LESSONS_PER_BLOCK = { 1: 7, 2: 7, 3: 9, 4: 7, 5: 4, 6: 3 };
  var BLOCK_COUNT = 6;
  var AUTHOR = {
    name: "Анастасия Ловина",
    description: "Преподаватель русского языка. Помогаю выстроить системную подготовку к ЕГЭ и уверенно сдать экзамен.",
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80"
  };

  var BLOCK_META = {
    1: { title: "работа с текстами", subtitle: "задания 1–3, 23, 24, 26", cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80" },
    2: { title: "языковое чутьё", subtitle: "задания 4, 5, 6, 7, 25", cover: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80" },
    3: { title: "орфография, задания на знание правописания", subtitle: "задания 9–15", cover: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80" },
    4: { title: "работа с пунктуацией, знаки препинания", subtitle: "задания 16–21", cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80" },
    5: { title: "средства выразительности и грамматические нормы", subtitle: "задания 8, 22", cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80" },
    6: { title: "интенсив по сочинениям", subtitle: "задание 27", cover: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=1200&q=80" }
  };



  function getBlockFullTitle(blockId) {
    var meta = BLOCK_META[blockId] || { title: "", subtitle: "" };
    var full = "Блок " + blockId + " — " + (meta.title || "");
    if (meta.subtitle) full += " (" + meta.subtitle + ")";
    return full;
  }

  var state = {
    loading: true,
    error: "",
    platformId: "",
    access: null,
    view: "cabinet",
    selectedBlock: null,
    mobileMenuOpen: false,
    modal: { open: false, blockId: null, lessonIndex: 0 }
  };

  function parseDateStrict(ddmmyyyy) {
    if (!ddmmyyyy || typeof ddmmyyyy !== "string") return null;
    var parts = ddmmyyyy.split(".");
    if (parts.length !== 3) return null;
    var d = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var y = parseInt(parts[2], 10);
    if (!d || !m || !y) return null;
    var dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function todayStart() {
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  function getPlatformId() {
    var p = new URLSearchParams(window.location.search).get("platform_id");
    return (p || "").trim();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function initTelegramWebApp() {
    if (!window.Telegram || !window.Telegram.WebApp) return;
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      if (window.Telegram.WebApp.requestFullscreen) window.Telegram.WebApp.requestFullscreen();
      if (window.Telegram.WebApp.setHeaderColor) window.Telegram.WebApp.setHeaderColor("#609EF5");
      if (window.Telegram.WebApp.setBackgroundColor) window.Telegram.WebApp.setBackgroundColor("#EFF8FF");
    } catch (e) {
      // ignore tg webapp init failures
    }
  }

  function jsonpAccess(platformId) {
    return new Promise(function (resolve, reject) {
      var callbackName = "__ege_cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      var script = document.createElement("script");
      var done = false;
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error("timeout"));
      }, 8000);

      function cleanup() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (script.parentNode) script.parentNode.removeChild(script);
        try {
          delete window[callbackName];
        } catch (e) {
          window[callbackName] = undefined;
        }
      }

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error("jsonp_error"));
      };

      script.src = API_BASE + "?action=access&platform_id=" + encodeURIComponent(platformId) + "&callback=" + encodeURIComponent(callbackName);
      document.head.appendChild(script);
    });
  }

  function normalizeBlocks(access) {
    var blocks = {};
    var now = todayStart();
    for (var i = 1; i <= BLOCK_COUNT; i++) {
      var raw = access && access.blocks && access.blocks[String(i)] ? access.blocks[String(i)] : {};
      var untilDate = parseDateStrict(raw.until || "");
      var isExpired = !!untilDate && untilDate < now;
      var allowed = !!raw.allowed;
      var active = !!raw.active && allowed && !isExpired;
      blocks[i] = {
        id: i,
        allowed: allowed,
        active: active,
        until: raw.until || "",
        untilDate: untilDate,
        daysLeft: typeof raw.days_left === "number" ? raw.days_left : null,
        expired: isExpired || (allowed && !!untilDate && !active)
      };
    }
    return blocks;
  }

  function countActive(blocks) {
    var count = 0;
    for (var i = 1; i <= BLOCK_COUNT; i++) if (blocks[i] && blocks[i].active) count++;
    return count;
  }

  function hasSoonEnding(blocks) {
    for (var i = 1; i <= BLOCK_COUNT; i++) {
      var b = blocks[i];
      if (b && b.active && typeof b.daysLeft === "number" && b.daysLeft <= 3) return true;
    }
    return false;
  }

  function hasAnyActive(blocks) {
    for (var i = 1; i <= BLOCK_COUNT; i++) if (blocks[i] && blocks[i].active) return true;
    return false;
  }

  function buildLessons(blockId) {
    var count = LESSONS_PER_BLOCK[blockId] || 0;
    var list = [];
    for (var i = 1; i <= count; i++) {
      list.push({ title: "Название", videoUrl: "https://kinescope.io/3zrN3JYGZQXeYrTiYyhtZM", description: "Описание урока", homework: "Домашнее задание будет добавлено", num: i });
    }
    return list;
  }

  function render() {
    if (state.loading) {
      root.innerHTML = '<div class="ege-wrap"><div class="ege-loader">Загрузка...</div></div>';
      return;
    }

    if (state.error) {
      root.innerHTML = '<div class="ege-wrap"><div class="ege-card ege-empty"><h2>Ошибка загрузки</h2><p>' + escapeHtml(state.error) + '</p><a class="ege-btn" target="_blank" rel="noopener" href="' + BOT_SUPPORT_LINK + '">Написать в поддержку</a></div></div>';
      return;
    }

    if (state.view === "no_access") {
      root.innerHTML = renderNoAccess();
      return;
    }

    root.innerHTML = renderCabinet();
  }

  function renderNoAccess() {
    return (
      '<div class="ege-wrap">' +
      renderHeader() +
      '<div class="ege-card ege-empty">' +
      '<h2>Доступа нет</h2>' +
      '<p>Мы не нашли активный доступ к блокам для этого аккаунта.</p>' +
      '<div class="ege-block-actions" style="justify-content:center">' +
      '<a class="ege-btn" target="_blank" rel="noopener" href="' + BOT_PAY_LINK + '">Оплатить доступ</a>' +
      '<a class="ege-link-btn" target="_blank" rel="noopener" href="' + BOT_SUPPORT_LINK + '">Написать в поддержку</a>' +
      '</div></div>' +
      renderAuthorBlock() +
      renderBanner() +
      renderFooter() +
      '</div>'
    );
  }

  function renderHeader() {
    return (
      '<header class="ege-header">' +
      '<div class="ege-header-top">' +
      '<div class="ege-logo">Подготовка к ЕГЭ по Русскому</div>' +
      '<button class="ege-mobile-menu-btn" data-action="toggle-mobile-menu" aria-expanded="' + (state.mobileMenuOpen ? "true" : "false") + '" aria-label="Открыть меню"><span></span><span></span><span></span></button>' +
      '</div>' +
      '<nav class="ege-menu">' +
      '<a href="#" class="ege-menu-link" data-nav="blocks">Блоки</a>' +
      '<a href="' + BOT_ESSAY_LINK + '" target="_blank" rel="noopener" class="ege-menu-link">Проверка сочинения</a>' +
      '<a href="' + BOT_SUPPORT_LINK + '" target="_blank" rel="noopener" class="ege-menu-link">Поддержка</a>' +
      '<a href="' + STUDENTS_CHAT_LINK + '" target="_blank" rel="noopener" class="ege-menu-link">Общий чат</a>' +
      '</nav>' +
      '<div class="ege-mobile-menu' + (state.mobileMenuOpen ? ' ege-mobile-menu--open' : '') + '">' +
      '<a href="#" class="ege-menu-link" data-nav="blocks" data-action="close-mobile-menu">Блоки</a>' +
      '<a href="' + BOT_ESSAY_LINK + '" target="_blank" rel="noopener" class="ege-menu-link" data-action="close-mobile-menu">Проверка сочинения</a>' +
      '<a href="' + BOT_SUPPORT_LINK + '" target="_blank" rel="noopener" class="ege-menu-link" data-action="close-mobile-menu">Поддержка</a>' +
      '<a href="' + STUDENTS_CHAT_LINK + '" target="_blank" rel="noopener" class="ege-menu-link" data-action="close-mobile-menu">Общий чат</a>' +
      '</div>' +
      '</header>'
    );
  }

  function renderCabinet() {
    var access = state.access;
    var blocks = normalizeBlocks(access);
    var availableCount = countActive(blocks);
    var soon = hasSoonEnding(blocks);
    var lessonsHtml = state.selectedBlock ? renderLessons(state.selectedBlock, blocks[state.selectedBlock]) : "";

    var cards = "";
    for (var i = 1; i <= BLOCK_COUNT; i++) cards += renderBlockCard(blocks[i], !!access.purchase_window);

    return (
      '<div class="ege-wrap">' +
      renderHeader() +
      renderAuthorBlock() +
      '<section class="ege-card ege-hero">' +
      '<h1 class="ege-title">Привет, ' + escapeHtml(access.name || "ученик") + '</h1>' +
      '<div class="ege-badges">' +
      '<span class="ege-badge">Telegram ID: ' + escapeHtml(state.platformId) + '</span>' +
      '<span class="ege-badge">Доступные блоки: ' + availableCount + ' из 6</span>' +
      (soon ? '<span class="ege-badge ege-badge--warn">Скоро заканчивается доступ</span>' : '') +
      '</div></section>' +
      '<section class="ege-grid">' + cards + '</section>' +
      lessonsHtml +
      renderBanner() +
      renderFooter() +
      renderModal() +
      '</div>'
    );
  }

  function renderBlockCard(block, purchaseWindow) {
    var meta = BLOCK_META[block.id] || { title: "", subtitle: "", cover: "" };
    var status = "Нет доступа";
    var actions = "";

    if (block.active) {
      status = "Доступ до: " + escapeHtml(block.until || "—");
      actions += '<button class="ege-btn" data-action="open-lessons" data-block-id="' + block.id + '">Открыть уроки</button>';
      if (typeof block.daysLeft === "number" && block.daysLeft <= 3) {
        actions += '<a class="ege-link-btn" target="_blank" rel="noopener" href="' + RENEW_BLOCK_LINK(block.id, state.platformId) + '">Продлить блок</a>';
      }
    } else if (block.expired && block.until) {
      status = "Истёк: " + escapeHtml(block.until);
      if (purchaseWindow) {
        actions += '<a class="ege-link-btn" target="_blank" rel="noopener" href="' + RENEW_BLOCK_LINK(block.id, state.platformId) + '">Докупить/Продлить</a>';
      }
    } else {
      actions += '<a class="ege-link-btn" target="_blank" rel="noopener" href="' + BUY_BLOCK_LINK(block.id, state.platformId) + '">Купить блок</a>';
    }

    return (
      '<article class="ege-card ege-block-card">' +
      '<div class="ege-block-cover" aria-hidden="true"><img src="' + escapeHtml(meta.cover) + '" alt="" loading="lazy" /></div>' +
      '<h3 class="ege-block-title">Блок ' + block.id + ' — ' + escapeHtml(meta.title) + '</h3>' +
      '<p class="ege-block-subtitle">' + escapeHtml(meta.subtitle) + '</p>' +
      '<p class="ege-block-status">' + status + '</p>' +
      '<div class="ege-block-actions">' + actions + '</div>' +
      '</article>'
    );
  }

  function renderLessons(blockId, blockMeta) {
    if (!blockMeta || !blockMeta.active) return "";
    var lessons = buildLessons(blockId);
    var items = lessons.map(function (lesson, idx) {
      return '<button class="ege-lesson-btn" data-action="open-lesson-modal" data-block-id="' + blockId + '" data-lesson-index="' + idx + '">Урок ' + lesson.num + '</button>';
    }).join('');

    return (
      '<section class="ege-card ege-lessons" id="ege-lessons">' +
      '<h2>' + escapeHtml(getBlockFullTitle(blockId)) + ': уроки</h2>' +
      '<div class="ege-lessons-grid">' + items + '</div>' +
      '</section>'
    );
  }

  function renderAuthorBlock() {
    return (
      '<section class="ege-card ege-author">' +
      '<div class="ege-author-photo-wrap"><img class="ege-author-photo" src="' + escapeHtml(AUTHOR.photo) + '" alt="' + escapeHtml(AUTHOR.name) + '" loading="lazy" /></div>' +
      '<div class="ege-author-content">' +
      '<h3 class="ege-author-title">Автор курса — ' + escapeHtml(AUTHOR.name) + '</h3>' +
      '<p class="ege-author-text">' + escapeHtml(AUTHOR.description) + '</p>' +
      '</div>' +
      '</section>'
    );
  }

  function renderBanner() {
    return (
      '<section class="ege-banner">' +
      '<div><strong>Проверка сочинения по критериям ЕГЭ</strong></div>' +
      '<a class="ege-btn" target="_blank" rel="noopener" href="' + BOT_ESSAY_LINK + '">Заказать проверку</a>' +
      '</section>'
    );
  }

  function renderFooter() {
    return (
      '<footer class="ege-footer">' +
      '<p>© ' + new Date().getFullYear() + ' Подготовка к ЕГЭ по Русскому. Все права защищены.</p>' +
      '<p class="ege-footer-links">Документы: <a href="#" target="_blank" rel="noopener">Политика конфиденциальности</a> · <a href="#" target="_blank" rel="noopener">Пользовательское соглашение</a> (добавите позже)</p>' +
      '</footer>'
    );
  }

  function renderModal() {
    if (!state.modal.open) return "";
    var lessons = buildLessons(state.modal.blockId);
    var lesson = lessons[state.modal.lessonIndex];
    if (!lesson) return "";

    var prevDisabled = state.modal.lessonIndex <= 0;
    var nextDisabled = state.modal.lessonIndex >= lessons.length - 1;
    var safeBlockTitle = escapeHtml(getBlockFullTitle(state.modal.blockId));
    var safeLessonBadge = escapeHtml("Урок " + lesson.num);
    var safeDesc = escapeHtml(lesson.description);
    var safeHomework = escapeHtml(lesson.homework || "Домашнее задание будет добавлено");

    return (
      '<div class="ege-modal ege-modal--open" data-modal="true">' +
      '<div class="ege-modal-dialog" role="dialog" aria-modal="true" aria-label="Урок">' +
      '<div class="ege-modal-head"><button class="ege-modal-close" data-action="close-modal" aria-label="Закрыть">Закрыть</button></div>' +
      '<div class="ege-modal-content">' +
      '<div class="ege-modal-video-col">' +
      '<h3 class="ege-modal-block-title">' + safeBlockTitle + '</h3>' +
      '<div class="ege-lesson-chip">' + safeLessonBadge + '</div>' +
      '<div class="ege-video-wrap">' +
      // TODO: if Kinescope embed URL provided, replace src below with real embed-url
      '<iframe src="https://kinescope.io/3zrN3JYGZQXeYrTiYyhtZM" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>' +
      '</div>' +
      '<div class="ege-modal-footer">' +
      '<button class="ege-btn" data-action="prev-lesson"' + (prevDisabled ? ' disabled' : '') + '>Предыдущий</button>' +
      '<button class="ege-btn" data-action="next-lesson"' + (nextDisabled ? ' disabled' : '') + '>Следующий</button>' +
      '</div>' +
      '<div class="ege-lesson-details">' +
      '<p><strong>Описание урока:</strong> ' + safeDesc + '</p>' +
      '<p><strong>Домашнее задание:</strong> ' + safeHomework + '</p>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function openModal(blockId, lessonIndex) {
    state.modal.open = true;
    state.modal.blockId = blockId;
    state.modal.lessonIndex = lessonIndex;
    document.body.style.overflow = "hidden";
    render();
  }

  function closeModal() {
    state.modal.open = false;
    document.body.style.overflow = "";
    render();
  }

  function onRootClick(e) {
    var actionEl = e.target.closest("[data-action]");
    if (actionEl && root.contains(actionEl)) {
      var action = actionEl.getAttribute("data-action");

      if (action === "toggle-mobile-menu") {
        state.mobileMenuOpen = !state.mobileMenuOpen;
        render();
        return;
      }

      if (action === "close-mobile-menu") {
        state.mobileMenuOpen = false;
        render();
        return;
      }

      if (action === "open-lessons") {
        var blockId = parseInt(actionEl.getAttribute("data-block-id"), 10);
        state.selectedBlock = blockId;
        state.mobileMenuOpen = false;
        render();
        var section = root.querySelector("#ege-lessons");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (action === "open-lesson-modal") {
        var bId = parseInt(actionEl.getAttribute("data-block-id"), 10);
        var idx = parseInt(actionEl.getAttribute("data-lesson-index"), 10);
        openModal(bId, idx);
        return;
      }

      if (action === "close-modal") {
        closeModal();
        return;
      }

      if (action === "prev-lesson" || action === "next-lesson") {
        var lessons = buildLessons(state.modal.blockId);
        var max = lessons.length - 1;
        var nextIdx = state.modal.lessonIndex + (action === "next-lesson" ? 1 : -1);
        if (nextIdx >= 0 && nextIdx <= max) {
          state.modal.lessonIndex = nextIdx;
          render();
        }
        return;
      }
    }

    if (state.modal.open && e.target.classList.contains("ege-modal")) {
      closeModal();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape" && state.modal.open) closeModal();
  }

  function init() {
    initTelegramWebApp();
    root.addEventListener("click", onRootClick);
    document.addEventListener("keydown", onKeyDown);

    state.platformId = getPlatformId();
    if (!state.platformId) {
      state.loading = false;
      state.view = "no_access";
      render();
      return;
    }

    render();
    jsonpAccess(state.platformId)
      .then(function (resp) {
        state.loading = false;
        if (!resp || !resp.ok || !resp.found) {
          state.view = "no_access";
          render();
          return;
        }

        state.access = resp;
        state.view = hasAnyActive(normalizeBlocks(resp)) ? "cabinet" : "no_access";
        render();
      })
      .catch(function () {
        state.loading = false;
        state.error = "Не удалось проверить доступ. Попробуйте позже.";
        render();
      });
  }

  init();
})();
