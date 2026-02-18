/**
 * HLS.js video player wrapper with Safari native fallback,
 * auto-skip on broken streams, and broken channel reporting.
 */
const Player = (() => {
  let hls = null;
  let currentChannel = null;
  let retryCount = 0;
  let autoSkipTimer = null;
  let playSessionId = 0; // guards against stale callbacks from previous streams
  const MAX_RETRIES = 2;

  const els = {};

  function init() {
    els.overlay = document.getElementById('player-overlay');
    els.video = document.getElementById('video-player');
    els.logo = document.getElementById('player-logo');
    els.name = document.getElementById('player-channel-name');
    els.category = document.getElementById('player-category');
    els.loading = document.getElementById('player-loading');
    els.error = document.getElementById('player-error');
    els.errorText = document.getElementById('player-error-text');
    els.autoSkipCountdown = document.getElementById('auto-skip-countdown');
    els.btnClose = document.getElementById('btn-close');
    els.btnPrev = document.getElementById('btn-prev');
    els.btnNext = document.getElementById('btn-next');
    els.btnFullscreen = document.getElementById('btn-fullscreen');
    els.btnRetry = document.getElementById('btn-retry');
    els.btnSkip = document.getElementById('btn-skip');

    bindEvents();
  }

  function bindEvents() {
    els.btnClose.addEventListener('click', close);
    els.btnPrev.addEventListener('click', () => UI.playPrev());
    els.btnNext.addEventListener('click', () => UI.playNext());
    els.btnFullscreen.addEventListener('click', toggleFullscreen);
    els.btnRetry.addEventListener('click', retry);
    els.btnSkip.addEventListener('click', () => {
      cancelAutoSkip();
      UI.playNext();
    });

    els.video.addEventListener('playing', () => {
      if (!currentChannel) return;
      cancelAutoSkip();
      hideLoading();
      hideError();
    });

    els.video.addEventListener('waiting', () => {
      if (!currentChannel) return;
      showLoading();
    });

    els.video.addEventListener('error', () => {
      if (!currentChannel) return; // player is closed, ignore stale error
      handlePlaybackError();
    });
  }

  function play(channel) {
    // Increment session ID — invalidates all callbacks from previous stream
    playSessionId++;
    cancelAutoSkip();
    currentChannel = channel;
    retryCount = 0;

    // Stop any existing playback immediately
    destroyHls();
    els.video.removeAttribute('src');
    els.video.load();

    // Update player UI
    els.name.textContent = channel.name;
    els.category.textContent = channel.category;
    if (channel.logo) {
      els.logo.src = channel.logo;
      els.logo.style.display = '';
    } else {
      els.logo.style.display = 'none';
    }

    // Show overlay
    els.overlay.classList.add('visible');
    showLoading();
    hideError();

    // Small delay to ensure old stream is fully torn down before starting new one
    const sessionAtStart = playSessionId;
    setTimeout(() => {
      if (playSessionId !== sessionAtStart) return; // user clicked another channel
      loadStream(channel.url, sessionAtStart);
    }, 50);
  }

  function loadStream(url, sessionId) {
    destroyHls();

    if (url.includes('.m3u8') || url.includes('.m3u') || url.includes('m3u')) {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startFragPrefetch: true,
          manifestLoadingTimeOut: 10000,
          levelLoadingTimeOut: 10000,
          fragLoadingTimeOut: 15000
        });

        hls.loadSource(url);
        hls.attachMedia(els.video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (playSessionId !== sessionId) return; // stale
          els.video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (playSessionId !== sessionId) return; // stale
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (retryCount < MAX_RETRIES) {
                  retryCount++;
                  hls.startLoad();
                } else {
                  handlePlaybackError();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                handlePlaybackError();
                break;
            }
          }
        });
      } else if (els.video.canPlayType('application/vnd.apple.mpegurl')) {
        els.video.src = url;
        els.video.play().catch(() => {
          if (playSessionId === sessionId) handlePlaybackError();
        });
      } else {
        handlePlaybackError();
      }
    } else {
      els.video.src = url;
      els.video.play().catch(() => {
        if (playSessionId === sessionId) handlePlaybackError();
      });
    }
  }

  function close() {
    playSessionId++; // invalidate any pending callbacks
    cancelAutoSkip();
    currentChannel = null; // null BEFORE load() so stale error events are ignored
    els.overlay.classList.remove('visible');
    destroyHls();
    els.video.removeAttribute('src');
    els.video.load();
    UI.setPlayingUrl(null);
  }

  function retry() {
    if (!currentChannel) return;
    playSessionId++;
    cancelAutoSkip();
    retryCount = 0;
    showLoading();
    hideError();
    loadStream(currentChannel.url, playSessionId);
  }

  function toggleFullscreen() {
    const container = els.video;
    if (!document.fullscreenElement) {
      (container.requestFullscreen || container.webkitRequestFullscreen || container.msRequestFullscreen)
        ?.call(container);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)
        ?.call(document);
    }
  }

  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  function showLoading() {
    els.loading.classList.add('visible');
    els.error.classList.remove('visible');
  }

  function hideLoading() {
    els.loading.classList.remove('visible');
  }

  function handlePlaybackError() {
    // Don't act if player was already closed
    if (!currentChannel || !isOpen()) return;

    els.error.classList.add('visible');
    els.loading.classList.remove('visible');

    // Mark channel as broken
    ChannelStore.markBroken(currentChannel.url);
    UI.markCardBroken(currentChannel.url);

    // Start auto-skip countdown
    startAutoSkip();
  }

  function hideError() {
    els.error.classList.remove('visible');
  }

  function startAutoSkip() {
    cancelAutoSkip();
    if (!currentChannel || !isOpen()) return;

    let remaining = 5;
    const sessionAtStart = playSessionId;
    updateCountdown(remaining);

    autoSkipTimer = setInterval(() => {
      // Stop if session changed or player was closed
      if (playSessionId !== sessionAtStart || !currentChannel || !isOpen()) {
        cancelAutoSkip();
        return;
      }
      remaining--;
      updateCountdown(remaining);
      if (remaining <= 0) {
        cancelAutoSkip();
        UI.playNext();
      }
    }, 1000);
  }

  function cancelAutoSkip() {
    if (autoSkipTimer) {
      clearInterval(autoSkipTimer);
      autoSkipTimer = null;
    }
  }

  function updateCountdown(seconds) {
    if (els.autoSkipCountdown) {
      els.autoSkipCountdown.textContent = `Skipping in ${seconds}s…`;
    }
  }

  function isOpen() {
    return els.overlay.classList.contains('visible');
  }

  function getCurrentChannel() {
    return currentChannel;
  }

  return { init, play, close, toggleFullscreen, isOpen, getCurrentChannel };
})();
