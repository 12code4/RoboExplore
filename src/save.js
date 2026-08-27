/* RoboExplore — persistent meta-progression via localStorage.
 * Everything is defensive: storage can throw or be empty in some contexts.
 */
(function (RE) {
  'use strict';
  const KEY = 'roboexplore.save.v1';

  function defaults() {
    return {
      coreShards: 0,
      runs: 0,
      bestSector: 0,
      bestScore: 0,
      totalKills: 0,
      unlocks: {},        // meta unlock id -> true
      logsFound: {},      // log id -> true
      settings: { muted: false, screenShake: 1, showFps: false },
      seenIntro: false,
    };
  }

  const Save = {
    data: defaults(),

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = Object.assign(defaults(), parsed);
          this.data.settings = Object.assign(defaults().settings, parsed.settings || {});
          this.data.unlocks = parsed.unlocks || {};
          this.data.logsFound = parsed.logsFound || {};
        }
      } catch (e) {
        this.data = defaults();
      }
      return this.data;
    },

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) { /* private mode / blocked — ignore */ }
    },

    reset() {
      this.data = defaults();
      this.save();
    },

    addShards(n) { this.data.coreShards += n; this.save(); },
    spendShards(n) {
      if (this.data.coreShards < n) return false;
      this.data.coreShards -= n; this.save(); return true;
    },
    isUnlocked(id) { return !!this.data.unlocks[id]; },
    unlock(id) { this.data.unlocks[id] = true; this.save(); },
    foundLog(id) { this.data.logsFound[id] = true; this.save(); },

    recordRun(stats) {
      this.data.runs++;
      if (stats.sector > this.data.bestSector) this.data.bestSector = stats.sector;
      if (stats.score > this.data.bestScore) this.data.bestScore = stats.score;
      this.data.totalKills += (stats.kills || 0);
      this.save();
    },
  };

  RE.Save = Save;
})(window.RE = window.RE || {});
