"use strict";

/*
 * love-toolbox-ext — MV3 background script.
 *
 * The toolbox is almost entirely popup-local, so the worker only keeps a tiny
 * bit of housekeeping: seed defaults on install/update.
 */

const api = globalThis.browser || globalThis.chrome;

const DEFAULTS = {
  "mena-toolbox-prefs": { category: "length" }
};

function seedDefaults() {
  if (!api || !api.storage || !api.storage.local) return;
  api.storage.local.get(Object.keys(DEFAULTS), (res) => {
    const patch = {};
    Object.keys(DEFAULTS).forEach((key) => {
      const current = res ? res[key] : undefined;
      if (current === undefined || current === null) patch[key] = DEFAULTS[key];
    });
    if (Object.keys(patch).length) api.storage.local.set(patch);
  });
}

if (api && api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener(seedDefaults);
}
