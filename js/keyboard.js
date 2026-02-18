/**
 * Keyboard navigation handler.
 */
const Keyboard = (() => {
  function init() {
    document.addEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    // Don't intercept when typing in search (except Escape)
    if (UI.isSearchFocused() && e.key !== 'Escape') {
      return;
    }

    // Close shortcuts modal on Escape
    if (e.key === 'Escape' && UI.isShortcutsModalOpen()) {
      e.preventDefault();
      UI.closeShortcutsModal();
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        if (Player.isOpen()) {
          Player.close();
        } else {
          UI.clearSearch();
        }
        break;

      case '/':
        if (!Player.isOpen()) {
          e.preventDefault();
          UI.focusSearch();
        }
        break;

      case 'f':
      case 'F':
        if (Player.isOpen()) {
          e.preventDefault();
          Player.toggleFullscreen();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (Player.isOpen()) {
          UI.playPrev();
        } else {
          UI.focusCard('up');
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (Player.isOpen()) {
          UI.playNext();
        } else {
          UI.focusCard('down');
        }
        break;

      case 'ArrowLeft':
        if (!Player.isOpen()) {
          e.preventDefault();
          UI.focusCard('left');
        }
        break;

      case 'ArrowRight':
        if (!Player.isOpen()) {
          e.preventDefault();
          UI.focusCard('right');
        }
        break;

      case 'Enter':
        if (!Player.isOpen()) {
          const idx = UI.getFocusedIndex();
          if (idx >= 0) {
            e.preventDefault();
            UI.playChannel(idx);
          }
        }
        break;
    }
  }

  return { init };
})();
