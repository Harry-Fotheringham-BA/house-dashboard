/* ================== Chiswick Board — settings ==================
   Edit this file only. Both pages read it.
   ================================================================ */
var CONFIG = {
  // Free key from https://api-portal.tfl.gov.uk (optional; raises TfL's rate limit)
  tflKey: "",

  // Your Cloudflare Worker URL once relay-worker.js is deployed, e.g.
  // "https://chiswick-relay.harry.workers.dev"
  // Leave blank to try the aircraft feeds directly (often blocked by the browser).
  relay: "",

  home: { label: "Home", postcode: "W4 1SE", lat: 51.4952, lon: -0.2478 },

  people: [
    { id: "harry", name: "Harry",
      destLabel: "Vanguard House, Heathrow", pinLabel: "Vanguard Hse",
      to: "51.4725,-0.4258",            // TW6 2FH, BA pass office
      lat: 51.4725, lon: -0.4258 },
    { id: "savanna", name: "Savanna",
      destLabel: "Fifth Season, Beaumont Mews", pinLabel: "Fifth Season",
      to: "W1G 6EB",                    // 7 Beaumont Mews, Marylebone
      lat: 51.5207, lon: -0.1497 }
  ],

  // Weekday commute window. index.html sends the TV to the routes page
  // inside this window and to the aircraft page outside it.
  commute: { days: [1, 2, 3, 4, 5], start: "05:30", end: "09:00" },

  routeRefreshSec: 120,
  planeRefreshSec: 8,
  weatherRefreshSec: 900,
  planeRadiusNm: 25,

  // Lines always shown in the status strip (TfL line ids)
  watchLines: ["district", "piccadilly", "elizabeth", "jubilee", "bakerloo", "central", "circle", "hammersmith-city", "metropolitan"]
};
