/**
 * Music Service
 *
 * Plays background music for chapters and encounters using a single
 * <audio> element. Implements the simple state machine the UI expects:
 *
 *     +-----------------+      startEncounter(track)     +-----------------+
 *     |  Chapter track  |  ─────────────────────────▶   | Encounter track |
 *     |  (or silent)    |  ◀──────────────────────────  |   (override)    |
 *     +-----------------+      end/reset/clear          +-----------------+
 *
 * Rules:
 *   - When a chapter is selected, its track plays (looped).
 *   - When an encounter starts AND has its own track, it overrides the
 *     chapter track until the encounter ends/resets, then we revert.
 *   - When an encounter starts but has NO music set, the chapter track
 *     keeps playing (no override).
 *   - Volume / mute persist across reloads via localStorage.
 *   - Browsers block autoplay before any user gesture; if play() rejects
 *     we expose a `needsUnlock` flag so the UI can show a "click to enable"
 *     prompt. We also retry on the next document click as a fallback.
 *
 * The service is intentionally framework-free: it manipulates one <audio>
 * element and notifies subscribers when state changes. The global player
 * UI in app.js subscribes and re-renders.
 */

const VOLUME_STORAGE_KEY = 'dndEncMusicVolume';
const MUTED_STORAGE_KEY = 'dndEncMusicMuted';

// Encounters typically open with a 10-15s ambient build before the
// actual combat hook lands. Skip that intro so combat music drops in
// at full intensity. Looped playback after the first cycle plays the
// whole track normally - this skip only applies on encounter start.
export const ENCOUNTER_INTRO_SKIP_SECONDS = 15;

/**
 * Build the URL we should hand to the <audio> element for a given filename.
 * Handles `null` (no track) and properly URI-encodes filenames.
 */
function trackUrl(filename) {
    if (!filename) return null;
    return `/music/${encodeURIComponent(filename)}`;
}

/**
 * Create a music service instance.
 *
 * @param {Object} deps
 * @param {Function} [deps.fetchImpl=fetch] - injectable fetch (for tests)
 * @param {Storage}  [deps.storage=localStorage] - injectable storage
 * @param {HTMLAudioElement} [deps.audio] - injectable audio element (for tests)
 * @returns {Object} the service API
 */
export function createMusicService(deps = {}) {
    const fetchImpl = deps.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    const storage = deps.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    // Lazily create the audio element so the module can be imported in
    // jsdom without an HTMLAudioElement being available at import time.
    let audio = deps.audio || null;
    let listenersAttached = false;
    function ensureAudio() {
        if (!audio) {
            if (typeof Audio === 'undefined') return null;
            audio = new Audio();
            audio.loop = true;
            audio.preload = 'auto';
        }
        attachAudioListeners(audio);
        return audio;
    }

    /**
     * Wire up listeners we use to surface playback progress to subscribers
     * and to apply pending intro-skips once the new track's metadata
     * (including duration) has loaded.
     */
    function attachAudioListeners(a) {
        if (!a || listenersAttached) return;
        if (typeof a.addEventListener !== 'function') return;
        listenersAttached = true;
        a.addEventListener('loadedmetadata', handleLoadedMetadata);
        a.addEventListener('timeupdate', notify);
        a.addEventListener('play', notify);
        a.addEventListener('pause', notify);
        a.addEventListener('ended', notify);
    }

    function handleLoadedMetadata() {
        const a = audio;
        if (!a) return;
        if (internalState.pendingSeek != null && Number.isFinite(a.duration)) {
            // Clamp so we never seek past the (almost) end of short tracks.
            const limit = Math.max(0, a.duration - 0.1);
            const target = Math.min(limit, Math.max(0, internalState.pendingSeek));
            try {
                a.currentTime = target;
            } catch (e) {
                // Some browsers throw if metadata isn't fully ready yet.
                console.warn('musicService: could not seek to', target, e);
            }
        }
        internalState.pendingSeek = null;
        notify();
    }

    // ─── Persistent settings ─────────────────────────────────────────────
    function loadVolume() {
        if (!storage) return 0.6;
        const raw = storage.getItem(VOLUME_STORAGE_KEY);
        const parsed = raw === null ? 0.6 : parseFloat(raw);
        if (!Number.isFinite(parsed)) return 0.6;
        return Math.max(0, Math.min(1, parsed));
    }
    function loadMuted() {
        if (!storage) return false;
        return storage.getItem(MUTED_STORAGE_KEY) === '1';
    }
    function persistVolume(v) {
        if (storage) storage.setItem(VOLUME_STORAGE_KEY, String(v));
    }
    function persistMuted(m) {
        if (storage) storage.setItem(MUTED_STORAGE_KEY, m ? '1' : '0');
    }

    // ─── Internal state ──────────────────────────────────────────────────
    const internalState = {
        // Catalog of available files in /music
        available: [],
        // Track currently selected for the active chapter (the "background")
        chapterTrack: null,
        // Track that overrides the chapter track during an active encounter
        encounterTrack: null,
        // Whichever of the two is actually loaded into <audio> right now
        currentTrack: null,
        // True if we want it to be playing (whether or not the browser allowed it)
        wantPlaying: false,
        // True if play() rejected and we're waiting for a user gesture
        needsUnlock: false,
        // Seconds to seek to once the next loadedmetadata event fires.
        // Set when an encounter track is loaded; consumed once.
        pendingSeek: null,
        volume: loadVolume(),
        muted: loadMuted(),
    };

    // Apply persisted volume/mute as soon as we have an audio element.
    function applyAudioSettings() {
        const a = ensureAudio();
        if (!a) return;
        a.volume = internalState.volume;
        a.muted = internalState.muted;
    }

    // ─── Subscribers ─────────────────────────────────────────────────────
    const listeners = new Set();
    function notify() {
        const snapshot = getStatus();
        listeners.forEach(l => {
            try { l(snapshot); } catch (e) { console.error('musicService listener error:', e); }
        });
    }

    // ─── Playback ────────────────────────────────────────────────────────
    /**
     * Resolve which track should currently be playing based on whether an
     * encounter override is set, and load it into the <audio> element if
     * different. Then attempt to play (subject to browser autoplay rules).
     */
    function syncPlayback() {
        const a = ensureAudio();
        if (!a) return;

        const desired = internalState.encounterTrack || internalState.chapterTrack || null;

        if (desired !== internalState.currentTrack) {
            internalState.currentTrack = desired;
            if (desired) {
                a.src = trackUrl(desired);
                applyAudioSettings();
            } else {
                a.pause();
                a.removeAttribute('src');
                a.load();
                internalState.wantPlaying = false;
                internalState.needsUnlock = false;
                notify();
                return;
            }
        }

        // We have a track loaded; ensure it's playing.
        internalState.wantPlaying = true;
        const playPromise = a.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise
                .then(() => {
                    if (internalState.needsUnlock) {
                        internalState.needsUnlock = false;
                        notify();
                    }
                })
                .catch(() => {
                    // Autoplay blocked - flag for the UI and arm a one-shot
                    // unlock on the next user click anywhere in the page.
                    internalState.needsUnlock = true;
                    armUnlockListener();
                    notify();
                });
        }
        notify();
    }

    let unlockArmed = false;
    function armUnlockListener() {
        if (unlockArmed) return;
        if (typeof document === 'undefined') return;
        unlockArmed = true;
        const handler = () => {
            document.removeEventListener('click', handler, true);
            document.removeEventListener('keydown', handler, true);
            unlockArmed = false;
            // Try again now that we have a user gesture.
            if (internalState.wantPlaying && internalState.currentTrack) {
                syncPlayback();
            }
        };
        document.addEventListener('click', handler, true);
        document.addEventListener('keydown', handler, true);
    }

    // ─── Public API ──────────────────────────────────────────────────────

    /**
     * Fetch the catalog of available music files. Idempotent; safe to call
     * after the user adds files and clicks "refresh" in the player.
     */
    async function refreshAvailable() {
        if (!fetchImpl) return [];
        try {
            const res = await fetchImpl('/api/music', { credentials: 'same-origin' });
            const list = await res.json();
            internalState.available = Array.isArray(list) ? list : [];
        } catch (err) {
            console.warn('Could not load music catalog:', err);
            internalState.available = [];
        }
        notify();
        return internalState.available;
    }

    /**
     * Set the chapter (background) track. If no encounter override is
     * currently active, this becomes the playing track immediately.
     * Pass null/empty to silence the chapter track.
     */
    function setChapterTrack(filename) {
        const next = filename || null;
        if (next === internalState.chapterTrack) return;
        internalState.chapterTrack = next;
        // Only sync playback if no encounter override is masking it.
        if (!internalState.encounterTrack) {
            syncPlayback();
        } else {
            notify();
        }
    }

    /**
     * Set an encounter override track (called from startEncounter). If
     * filename is null/empty, the chapter track keeps playing - this is
     * NOT the same as `clearEncounterTrack`, which actively reverts to
     * the chapter track even if we previously had an override.
     *
     * When a non-null encounter track is set, we queue a one-shot seek
     * past the slow intro so combat music drops in at full intensity.
     */
    function setEncounterTrack(filename) {
        const next = filename || null;
        if (next === internalState.encounterTrack) return;
        internalState.encounterTrack = next;
        if (next !== null) {
            internalState.pendingSeek = ENCOUNTER_INTRO_SKIP_SECONDS;
        }
        syncPlayback();
    }

    /**
     * Clear any encounter override and revert to the chapter track (called
     * from endEncounter / resetEncounter).
     */
    function clearEncounterTrack() {
        if (internalState.encounterTrack === null) return;
        internalState.encounterTrack = null;
        syncPlayback();
    }

    /**
     * Stop playback entirely - used when an adventure is unloaded or the
     * user navigates back to the selection screen.
     */
    function stopAll() {
        internalState.chapterTrack = null;
        internalState.encounterTrack = null;
        const a = ensureAudio();
        if (a) {
            a.pause();
            a.removeAttribute('src');
            a.load();
        }
        internalState.currentTrack = null;
        internalState.wantPlaying = false;
        internalState.needsUnlock = false;
        notify();
    }

    /**
     * Manually pause/resume (driven by the global player play/pause button).
     */
    function pause() {
        const a = ensureAudio();
        if (!a) return;
        a.pause();
        internalState.wantPlaying = false;
        notify();
    }
    function resume() {
        const a = ensureAudio();
        if (!a || !internalState.currentTrack) return;
        syncPlayback();
    }

    function setVolume(v) {
        const clamped = Math.max(0, Math.min(1, Number(v) || 0));
        internalState.volume = clamped;
        persistVolume(clamped);
        applyAudioSettings();
        notify();
    }

    function setMuted(m) {
        internalState.muted = !!m;
        persistMuted(internalState.muted);
        applyAudioSettings();
        notify();
    }

    /**
     * Jump to a specific time in the current track, in seconds. Used by
     * the global player's progress bar (click-to-scrub). Clamped to the
     * track duration when known. Cancels any pending intro-skip so a
     * deliberate seek isn't immediately overridden.
     */
    function seek(seconds) {
        const a = ensureAudio();
        if (!a || !internalState.currentTrack) return;
        const num = Number(seconds);
        if (!Number.isFinite(num)) return;
        let target = Math.max(0, num);
        if (Number.isFinite(a.duration) && a.duration > 0) {
            target = Math.min(a.duration - 0.1, target);
        }
        try {
            a.currentTime = target;
        } catch (e) {
            console.warn('musicService: seek failed', e);
            return;
        }
        internalState.pendingSeek = null;
        notify();
    }

    function getStatus() {
        const a = audio;
        const ct = a && Number.isFinite(a.currentTime) ? a.currentTime : 0;
        const dur = a && Number.isFinite(a.duration) ? a.duration : 0;
        return {
            available: [...internalState.available],
            chapterTrack: internalState.chapterTrack,
            encounterTrack: internalState.encounterTrack,
            currentTrack: internalState.currentTrack,
            isPlaying: !!(a && !a.paused && internalState.currentTrack),
            wantPlaying: internalState.wantPlaying,
            needsUnlock: internalState.needsUnlock,
            volume: internalState.volume,
            muted: internalState.muted,
            currentTime: ct,
            duration: dur,
        };
    }

    function subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    /**
     * Briefly play a preview of a track without affecting the main playback
     * state (used by the small ▶ buttons next to selectors). Returns a
     * function the UI can call to stop the preview.
     */
    function preview(filename, durationMs = 8000) {
        if (!filename || typeof Audio === 'undefined') return () => {};
        const previewer = new Audio(trackUrl(filename));
        previewer.volume = internalState.muted ? 0 : internalState.volume;
        previewer.play().catch(() => {});
        const stopId = setTimeout(() => previewer.pause(), durationMs);
        return () => {
            clearTimeout(stopId);
            previewer.pause();
        };
    }

    // Apply persisted settings if an audio element is already attached
    applyAudioSettings();

    return {
        refreshAvailable,
        setChapterTrack,
        setEncounterTrack,
        clearEncounterTrack,
        stopAll,
        pause,
        resume,
        setVolume,
        setMuted,
        seek,
        getStatus,
        subscribe,
        preview,
    };
}

// Singleton for the running app. Tests can construct their own via createMusicService.
export const musicService = createMusicService();
