/**
 * DOM rendering: country tabs, channel grid, category filters, search, events.
 */
const UI = (() => {
  // DOM references
  const els = {};

  // State
  let allChannels = [];
  let filteredChannels = [];
  let currentCountry = 'in';
  let currentCategory = 'all';
  let searchQuery = '';
  let focusedIndex = -1;
  let playingUrl = null;

  function init() {
    els.grid = document.getElementById('channel-grid');
    els.tabsScroll = document.getElementById('tabs-scroll');
    els.searchInput = document.getElementById('search-input');
    els.searchClear = document.getElementById('search-clear');
    els.channelCount = document.getElementById('channel-count');
    els.filters = document.getElementById('filters');
    els.loadingOverlay = document.getElementById('loading-overlay');
    els.errorBanner = document.getElementById('error-banner');
    els.errorText = document.getElementById('error-text');
    els.errorClose = document.getElementById('error-close');
    els.shortcutsModal = document.getElementById('shortcuts-modal');
    els.btnShortcuts = document.getElementById('btn-shortcuts');
    els.modalClose = document.getElementById('modal-close');

    bindEvents();
    renderCountryTabs();
  }

  function bindEvents() {
    // Search
    els.searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      els.searchClear.classList.toggle('visible', searchQuery.length > 0);
      applyFilters();
    });

    els.searchClear.addEventListener('click', () => {
      els.searchInput.value = '';
      searchQuery = '';
      els.searchClear.classList.remove('visible');
      applyFilters();
    });

    // Category filters
    els.filters.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      els.filters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.category;
      applyFilters();
    });

    // Error banner close
    els.errorClose.addEventListener('click', hideError);

    // Shortcuts modal
    els.btnShortcuts.addEventListener('click', () => {
      els.shortcutsModal.classList.add('visible');
    });

    els.modalClose.addEventListener('click', () => {
      els.shortcutsModal.classList.remove('visible');
    });

    els.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === els.shortcutsModal) {
        els.shortcutsModal.classList.remove('visible');
      }
    });
  }

  function renderCountryTabs() {
    const codes = Countries.getPopular();
    els.tabsScroll.innerHTML = '';

    codes.forEach(code => {
      const tab = document.createElement('button');
      tab.className = 'tab' + (code === currentCountry ? ' active' : '');
      tab.dataset.country = code;
      tab.innerHTML = `<span class="tab-flag">${Countries.flag(code)}</span>${Countries.name(code)}`;
      tab.addEventListener('click', () => selectCountry(code));
      els.tabsScroll.appendChild(tab);
    });
  }

  async function selectCountry(code) {
    if (code === currentCountry && allChannels.length > 0) return;

    currentCountry = code;
    currentCategory = 'all';
    searchQuery = '';
    els.searchInput.value = '';
    els.searchClear.classList.remove('visible');

    // Reset category pills
    els.filters.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.category === 'all');
    });

    // Update active tab
    els.tabsScroll.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.country === code);
    });

    // Scroll active tab into view
    const activeTab = els.tabsScroll.querySelector('.tab.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    await loadChannels(code);
  }

  async function loadChannels(code) {
    showLoading(true);
    hideError();

    try {
      allChannels = await ChannelStore.getChannels(code);
      applyFilters();
    } catch (err) {
      allChannels = [];
      filteredChannels = [];
      renderGrid([]);
      showError(`Failed to load channels for ${Countries.name(code)}. Check your connection.`);
    } finally {
      showLoading(false);
    }
  }

  function applyFilters() {
    filteredChannels = ChannelStore.filterChannels(allChannels, {
      search: searchQuery,
      category: currentCategory
    });
    focusedIndex = -1;
    renderGrid(filteredChannels);
    updateChannelCount();
  }

  function renderGrid(channels) {
    els.grid.innerHTML = '';

    if (channels.length === 0) {
      els.grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📡</div>
          <p class="empty-state-text">No channels found</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    channels.forEach((ch, i) => {
      const card = document.createElement('div');
      card.className = 'channel-card' + (ch.url === playingUrl ? ' playing' : '');
      card.tabIndex = 0;
      card.dataset.index = i;
      card.style.animationDelay = `${Math.min(i * 30, 600)}ms`;

      const broken = ChannelStore.isBroken(ch.url);
      if (broken) card.classList.add('broken');

      const logoContent = ch.logo
        ? `<img class="card-logo" src="${escapeAttr(ch.logo)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'card-letter\\'>${escapeHtml(ch.name.charAt(0).toUpperCase())}</span>'">`
        : `<span class="card-letter">${escapeHtml(ch.name.charAt(0).toUpperCase())}</span>`;

      card.innerHTML = `
        ${ch.url === playingUrl ? '<div class="card-playing-indicator"></div>' : ''}
        ${broken ? '<div class="card-broken-badge" title="Stream may be unavailable">offline</div>' : ''}
        <div class="card-logo-wrap">${logoContent}</div>
        <div class="card-name">${escapeHtml(ch.name)}</div>
        <span class="card-badge">${escapeHtml(ch.category)}</span>`;

      card.addEventListener('click', () => playChannel(i));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          playChannel(i);
        }
      });

      fragment.appendChild(card);
    });

    els.grid.appendChild(fragment);
  }

  function updateChannelCount() {
    const total = allChannels.length;
    const shown = filteredChannels.length;
    if (total === 0) {
      els.channelCount.textContent = '';
    } else if (shown === total) {
      els.channelCount.textContent = `${total} channels`;
    } else {
      els.channelCount.textContent = `${shown} / ${total} channels`;
    }
  }

  function playChannel(index) {
    if (index < 0 || index >= filteredChannels.length) return;
    const channel = filteredChannels[index];
    focusedIndex = index;
    playingUrl = channel.url;

    // Re-render to update playing indicator
    renderGrid(filteredChannels);

    Player.play(channel);
  }

  function playPrev() {
    if (filteredChannels.length === 0) return;
    const newIndex = focusedIndex <= 0 ? filteredChannels.length - 1 : focusedIndex - 1;
    playChannel(newIndex);
  }

  function playNext() {
    if (filteredChannels.length === 0) return;
    const newIndex = focusedIndex >= filteredChannels.length - 1 ? 0 : focusedIndex + 1;
    playChannel(newIndex);
  }

  function focusCard(direction) {
    const cards = els.grid.querySelectorAll('.channel-card');
    if (cards.length === 0) return;

    if (focusedIndex === -1) {
      focusedIndex = 0;
    } else {
      const cols = getGridColumns();
      switch (direction) {
        case 'left':
          focusedIndex = Math.max(0, focusedIndex - 1);
          break;
        case 'right':
          focusedIndex = Math.min(cards.length - 1, focusedIndex + 1);
          break;
        case 'up':
          focusedIndex = Math.max(0, focusedIndex - cols);
          break;
        case 'down':
          focusedIndex = Math.min(cards.length - 1, focusedIndex + cols);
          break;
      }
    }

    cards[focusedIndex]?.focus();
    cards[focusedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function getGridColumns() {
    const grid = els.grid;
    if (!grid.children.length) return 1;
    const gridStyle = window.getComputedStyle(grid);
    const cols = gridStyle.getPropertyValue('grid-template-columns').split(' ').length;
    return cols || 1;
  }

  function setPlayingUrl(url) {
    playingUrl = url;
    renderGrid(filteredChannels);
  }

  function showLoading(show) {
    els.loadingOverlay.classList.toggle('visible', show);
  }

  function showError(msg) {
    els.errorText.textContent = msg;
    els.errorBanner.classList.add('visible');
    setTimeout(hideError, 8000);
  }

  function hideError() {
    els.errorBanner.classList.remove('visible');
  }

  function focusSearch() {
    els.searchInput.focus();
  }

  function clearSearch() {
    if (searchQuery) {
      els.searchInput.value = '';
      searchQuery = '';
      els.searchClear.classList.remove('visible');
      applyFilters();
      return true;
    }
    return false;
  }

  function isSearchFocused() {
    return document.activeElement === els.searchInput;
  }

  function isShortcutsModalOpen() {
    return els.shortcutsModal.classList.contains('visible');
  }

  function closeShortcutsModal() {
    els.shortcutsModal.classList.remove('visible');
  }

  /**
   * Silently refresh current country from network.
   * Updates grid only if new channels were found. No loading spinner.
   */
  async function refreshCurrentCountry() {
    const updated = await ChannelStore.refreshChannels(currentCountry);
    if (updated && updated.length > 0) {
      const oldCount = allChannels.length;
      allChannels = updated;
      applyFilters();
      const newCount = allChannels.length;
      if (newCount > oldCount) {
        console.log(`[Refresh] ${Countries.name(currentCountry)}: ${oldCount} → ${newCount} channels (+${newCount - oldCount} new)`);
      }
    }
  }

  function markCardBroken(url) {
    const cards = els.grid.querySelectorAll('.channel-card');
    filteredChannels.forEach((ch, i) => {
      if (ch.url === url && cards[i] && !cards[i].classList.contains('broken')) {
        cards[i].classList.add('broken');
        const badge = document.createElement('div');
        badge.className = 'card-broken-badge';
        badge.title = 'Stream may be unavailable';
        badge.textContent = 'offline';
        cards[i].prepend(badge);
      }
    });
  }

  // Helpers
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    init,
    selectCountry,
    playChannel,
    playPrev,
    playNext,
    focusCard,
    setPlayingUrl,
    refreshCurrentCountry,
    markCardBroken,
    showError,
    focusSearch,
    clearSearch,
    isSearchFocused,
    isShortcutsModalOpen,
    closeShortcutsModal,
    getFilteredChannels: () => filteredChannels,
    getFocusedIndex: () => focusedIndex,
    getCurrentCountry: () => currentCountry
  };
})();
