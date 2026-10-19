"use strict";

/*
 * love-toolbox-ext — static data: unit tables and the text-tool list.
 * Plain script (no modules); shared by the popup and the test harness.
 */

(function () {
  // Linear units: value-in-unit * factor = value in the category base unit.
  var LENGTH = {
    label: "Length",
    base: "m",
    units: {
      m: 1,
      km: 1000,
      cm: 0.01,
      mm: 0.001,
      mi: 1609.344,
      yd: 0.9144,
      ft: 0.3048,
      in: 0.0254
    }
  };

  var MASS = {
    label: "Mass",
    base: "g",
    units: {
      g: 1,
      kg: 1000,
      mg: 0.001,
      t: 1000000,
      lb: 453.59237,
      oz: 28.349523125
    }
  };

  // Temperature is non-linear, so it is handled by explicit converters.
  var TEMPERATURE = {
    label: "Temperature",
    base: "C",
    units: { C: 1, F: 1, K: 1 },
    toBase: {
      C: function (v) { return v; },
      F: function (v) { return (v - 32) * 5 / 9; },
      K: function (v) { return v - 273.15; }
    },
    fromBase: {
      C: function (v) { return v; },
      F: function (v) { return v * 9 / 5 + 32; },
      K: function (v) { return v + 273.15; }
    }
  };

  var UNITS = { length: LENGTH, mass: MASS, temperature: TEMPERATURE };

  var TEXT_TOOLS = [
    { id: "upper", label: "UPPER" },
    { id: "lower", label: "lower" },
    { id: "title", label: "Title Case" },
    { id: "sentence", label: "Sentence case" },
    { id: "camel", label: "camelCase" },
    { id: "snake", label: "snake_case" },
    { id: "kebab", label: "kebab-case" },
    { id: "reverse", label: "Reverse" },
    { id: "trimLines", label: "Trim lines" },
    { id: "removeEmpty", label: "Drop empty lines" },
    { id: "dedupe", label: "Unique lines" },
    { id: "sortLines", label: "Sort lines" },
    { id: "reverseLines", label: "Reverse lines" }
  ];

  var NOTES_KEY = "mena-toolbox-notes";
  var PREFS_KEY = "mena-toolbox-prefs";

  globalThis.MenaToolboxData = {
    LENGTH: LENGTH,
    MASS: MASS,
    TEMPERATURE: TEMPERATURE,
    UNITS: UNITS,
    TEXT_TOOLS: TEXT_TOOLS,
    NOTES_KEY: NOTES_KEY,
    PREFS_KEY: PREFS_KEY
  };
})();
