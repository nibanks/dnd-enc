/**
 * Tests for the music service.
 *
 * The service drives a single HTMLAudioElement for chapter/encounter
 * background music. We don't have a real audio backend in jsdom, so we
 * inject a fake audio element that records play()/pause() calls and src
 * changes, and assert the right transitions happen when the chapter or
 * encounter overrides change.
 */

import { createMusicService } from '../../static/services/musicService.js';

/**
 * Build a minimal stub audio element with the surface our service uses.
 * `playBehavior` controls what the next play() call returns:
 *   'resolve' -> Promise that resolves
 *   'reject'  -> Promise that rejects (simulates blocked autoplay)
 */
function makeFakeAudio({ playBehavior = 'resolve' } = {}) {
    const listeners = {};
    const audio = {
        src: '',
        loop: false,
        preload: '',
        volume: 1,
        muted: false,
        paused: true,
        currentTime: 0,
        duration: NaN,
        _src: '',
        _playCalls: 0,
        _pauseCalls: 0,
        _loadCalls: 0,
        play: jest.fn(function () {
            this._playCalls += 1;
            this.paused = false;
            if (audio.playBehavior === 'reject') {
                return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
            }
            return Promise.resolve();
        }),
        pause: jest.fn(function () {
            this._pauseCalls += 1;
            this.paused = true;
        }),
        load: jest.fn(function () {
            this._loadCalls += 1;
        }),
        removeAttribute: jest.fn(function (name) {
            if (name === 'src') this.src = '';
        }),
        addEventListener: jest.fn(function (name, fn) {
            (listeners[name] = listeners[name] || []).push(fn);
        }),
        removeEventListener: jest.fn(function (name, fn) {
            if (!listeners[name]) return;
            listeners[name] = listeners[name].filter(f => f !== fn);
        }),
        // Test helper - simulate the browser firing an event on the
        // <audio> element after metadata loads / time advances.
        _fire(name) {
            (listeners[name] || []).forEach(fn => fn());
        },
        playBehavior,
    };
    return audio;
}

function makeStorage(initial = {}) {
    const store = { ...initial };
    return {
        getItem: jest.fn((k) => (k in store ? store[k] : null)),
        setItem: jest.fn((k, v) => { store[k] = String(v); }),
        removeItem: jest.fn((k) => { delete store[k]; }),
        _store: store,
    };
}

describe('musicService', () => {
    describe('chapter <-> encounter state machine', () => {
        let audio;
        let service;

        beforeEach(() => {
            audio = makeFakeAudio();
            service = createMusicService({
                fetchImpl: jest.fn().mockResolvedValue({ json: async () => [] }),
                storage: makeStorage(),
                audio,
            });
        });

        test('setChapterTrack loads and plays the chapter track', async () => {
            service.setChapterTrack('forest.mp3');

            expect(audio.src).toBe('/music/forest.mp3');
            expect(audio.play).toHaveBeenCalledTimes(1);

            const status = service.getStatus();
            expect(status.chapterTrack).toBe('forest.mp3');
            expect(status.currentTrack).toBe('forest.mp3');
            expect(status.encounterTrack).toBeNull();
        });

        test('encounter override switches the playing track', async () => {
            service.setChapterTrack('forest.mp3');
            audio.play.mockClear();

            service.setEncounterTrack('battle.mp3');

            expect(audio.src).toBe('/music/battle.mp3');
            expect(audio.play).toHaveBeenCalledTimes(1);

            const status = service.getStatus();
            expect(status.encounterTrack).toBe('battle.mp3');
            expect(status.currentTrack).toBe('battle.mp3');
            // The chapter track is preserved so we know what to revert to.
            expect(status.chapterTrack).toBe('forest.mp3');
        });

        test('clearEncounterTrack reverts to the chapter track', async () => {
            service.setChapterTrack('forest.mp3');
            service.setEncounterTrack('battle.mp3');
            audio.play.mockClear();

            service.clearEncounterTrack();

            expect(audio.src).toBe('/music/forest.mp3');
            expect(audio.play).toHaveBeenCalledTimes(1);
            expect(service.getStatus().encounterTrack).toBeNull();
            expect(service.getStatus().currentTrack).toBe('forest.mp3');
        });

        test('setEncounterTrack(null) is a no-op (chapter keeps playing)', async () => {
            service.setChapterTrack('forest.mp3');
            const srcBefore = audio.src;
            audio.play.mockClear();

            // Encounter has no music: per the spec, chapter track keeps playing,
            // not silenced.
            service.setEncounterTrack(null);

            expect(audio.src).toBe(srcBefore);
            expect(audio.play).not.toHaveBeenCalled();
        });

        test('setChapterTrack while encounter override is active does not interrupt combat music', async () => {
            service.setChapterTrack('forest.mp3');
            service.setEncounterTrack('battle.mp3');
            audio.play.mockClear();

            // DM picks a new chapter track mid-combat - it should be remembered
            // for after combat, but combat music keeps playing now.
            service.setChapterTrack('cave.mp3');

            expect(audio.src).toBe('/music/battle.mp3');
            expect(audio.play).not.toHaveBeenCalled();

            // When combat ends, we revert to the *new* chapter track.
            service.clearEncounterTrack();
            expect(audio.src).toBe('/music/cave.mp3');
        });

        test('setChapterTrack(null) silences playback when no override', async () => {
            service.setChapterTrack('forest.mp3');
            audio.pause.mockClear();
            audio.removeAttribute.mockClear();

            service.setChapterTrack(null);

            expect(audio.pause).toHaveBeenCalled();
            expect(audio.removeAttribute).toHaveBeenCalledWith('src');
            expect(service.getStatus().currentTrack).toBeNull();
        });

        test('setSameChapterTrack twice does not restart playback', async () => {
            service.setChapterTrack('forest.mp3');
            audio.play.mockClear();

            service.setChapterTrack('forest.mp3');

            expect(audio.play).not.toHaveBeenCalled();
        });

        test('stopAll clears every track and pauses the element', async () => {
            service.setChapterTrack('forest.mp3');
            service.setEncounterTrack('battle.mp3');

            service.stopAll();

            const status = service.getStatus();
            expect(status.chapterTrack).toBeNull();
            expect(status.encounterTrack).toBeNull();
            expect(status.currentTrack).toBeNull();
            expect(audio.pause).toHaveBeenCalled();
        });
    });

    describe('volume / mute persistence', () => {
        test('reads persisted volume on init', () => {
            const audio = makeFakeAudio();
            const service = createMusicService({
                storage: makeStorage({ dndEncMusicVolume: '0.25' }),
                audio,
            });
            expect(service.getStatus().volume).toBeCloseTo(0.25);
            // applyAudioSettings ran on construction
            expect(audio.volume).toBeCloseTo(0.25);
        });

        test('setVolume clamps to [0, 1] and persists', () => {
            const audio = makeFakeAudio();
            const storage = makeStorage();
            const service = createMusicService({ storage, audio });

            service.setVolume(2.5);
            expect(service.getStatus().volume).toBe(1);
            expect(storage.setItem).toHaveBeenCalledWith('dndEncMusicVolume', '1');

            service.setVolume(-0.5);
            expect(service.getStatus().volume).toBe(0);
            expect(storage.setItem).toHaveBeenCalledWith('dndEncMusicVolume', '0');
        });

        test('setMuted persists across instances', () => {
            const storage = makeStorage();
            const audio = makeFakeAudio();
            const a = createMusicService({ storage, audio });
            a.setMuted(true);
            expect(storage.setItem).toHaveBeenCalledWith('dndEncMusicMuted', '1');

            const audio2 = makeFakeAudio();
            const b = createMusicService({ storage, audio: audio2 });
            expect(b.getStatus().muted).toBe(true);
            expect(audio2.muted).toBe(true);
        });
    });

    describe('autoplay unlock', () => {
        test('flags needsUnlock when play() rejects', async () => {
            const audio = makeFakeAudio({ playBehavior: 'reject' });
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setChapterTrack('forest.mp3');
            // Wait microtask so the rejected promise rejection has fired
            await Promise.resolve();
            await Promise.resolve();

            expect(service.getStatus().needsUnlock).toBe(true);
        });

        test('unlocks on next document click', async () => {
            const audio = makeFakeAudio({ playBehavior: 'reject' });
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setChapterTrack('forest.mp3');
            await Promise.resolve();
            await Promise.resolve();
            expect(service.getStatus().needsUnlock).toBe(true);

            // Now flip the audio to allow play, simulate a user click, and
            // verify the service retried.
            audio.playBehavior = 'resolve';
            audio.play.mockClear();
            document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await Promise.resolve();

            expect(audio.play).toHaveBeenCalled();
        });
    });

    describe('refreshAvailable', () => {
        test('fetches the catalog and exposes it', async () => {
            const fetchImpl = jest.fn().mockResolvedValue({
                json: async () => ['a.mp3', 'b.ogg'],
            });
            const service = createMusicService({
                fetchImpl,
                storage: makeStorage(),
                audio: makeFakeAudio(),
            });

            await service.refreshAvailable();

            expect(fetchImpl).toHaveBeenCalledWith('/api/music', expect.any(Object));
            expect(service.getStatus().available).toEqual(['a.mp3', 'b.ogg']);
        });

        test('survives a failed fetch', async () => {
            const fetchImpl = jest.fn().mockRejectedValue(new Error('boom'));
            const service = createMusicService({
                fetchImpl,
                storage: makeStorage(),
                audio: makeFakeAudio(),
            });

            await service.refreshAvailable();

            expect(service.getStatus().available).toEqual([]);
        });
    });

    describe('encounter intro-skip', () => {
        test('encounter track seeks past the first 15s once metadata loads', async () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setChapterTrack('forest.mp3');
            // Chapter track shouldn't queue an intro-skip.
            audio.duration = 600;
            audio._fire('loadedmetadata');
            expect(audio.currentTime).toBe(0);

            service.setEncounterTrack('battle.mp3');
            audio.duration = 240;
            audio._fire('loadedmetadata');

            expect(audio.currentTime).toBe(15);
        });

        test('skip is clamped if the track is shorter than 15s', async () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setEncounterTrack('short-stinger.mp3');
            audio.duration = 8;
            audio._fire('loadedmetadata');

            // Should clamp to (duration - 0.1) = 7.9
            expect(audio.currentTime).toBeCloseTo(7.9, 5);
        });

        test('clearEncounterTrack does not seek into the chapter track', async () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setChapterTrack('forest.mp3');
            audio.duration = 600;
            audio._fire('loadedmetadata');
            // Encounter starts then ends.
            service.setEncounterTrack('battle.mp3');
            audio.duration = 240;
            audio._fire('loadedmetadata');
            expect(audio.currentTime).toBe(15);

            // Reset for clarity, then end the encounter.
            audio.currentTime = 0;
            service.clearEncounterTrack();
            audio.duration = 600;
            audio._fire('loadedmetadata');

            // No skip - chapter starts from the top again.
            expect(audio.currentTime).toBe(0);
        });

        test('a manual seek cancels a pending intro-skip', async () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setEncounterTrack('battle.mp3');
            // User scrubs before metadata even loads.
            audio.duration = 240;
            service.seek(60);
            expect(audio.currentTime).toBe(60);

            // Now metadata fires - the pending skip should already be
            // consumed and shouldn't override the user's scrub.
            audio._fire('loadedmetadata');
            expect(audio.currentTime).toBe(60);
        });
    });

    describe('progress reporting', () => {
        test('getStatus exposes currentTime and duration', () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setChapterTrack('forest.mp3');
            audio.duration = 240;
            audio.currentTime = 42;

            const s = service.getStatus();
            expect(s.currentTime).toBe(42);
            expect(s.duration).toBe(240);
        });

        test('seek clamps to track duration', () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });

            service.setChapterTrack('forest.mp3');
            audio.duration = 100;

            service.seek(99999);
            expect(audio.currentTime).toBeCloseTo(99.9, 5);

            service.seek(-50);
            expect(audio.currentTime).toBe(0);
        });

        test('seek is a no-op when nothing is loaded', () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });

            service.seek(30);
            expect(audio.currentTime).toBe(0);
        });

        test('timeupdate events notify subscribers', () => {
            const audio = makeFakeAudio();
            const service = createMusicService({ storage: makeStorage(), audio });
            const listener = jest.fn();
            service.subscribe(listener);

            service.setChapterTrack('forest.mp3');
            listener.mockClear();

            audio.currentTime = 12;
            audio._fire('timeupdate');

            expect(listener).toHaveBeenCalled();
            const last = listener.mock.calls[listener.mock.calls.length - 1][0];
            expect(last.currentTime).toBe(12);
        });
    });

    describe('subscribe', () => {
        test('calls listener on every status change', () => {
            const listener = jest.fn();
            const service = createMusicService({
                storage: makeStorage(),
                audio: makeFakeAudio(),
            });
            service.subscribe(listener);

            service.setChapterTrack('a.mp3');
            service.setEncounterTrack('b.mp3');
            service.setVolume(0.4);

            expect(listener).toHaveBeenCalled();
            // At least 3 distinct snapshots should have flowed through.
            expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
        });

        test('returns an unsubscribe function', () => {
            const listener = jest.fn();
            const service = createMusicService({
                storage: makeStorage(),
                audio: makeFakeAudio(),
            });
            const unsub = service.subscribe(listener);

            unsub();
            service.setChapterTrack('a.mp3');

            expect(listener).not.toHaveBeenCalled();
        });
    });
});
