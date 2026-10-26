/* Shared helpers for Chiswick Board pages. Written in plain ES5-ish JS so
   older LG webOS browsers run it. */
var U = (function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function toMin(s) { var p = s.split(":"); return (+p[0]) * 60 + (+p[1]); }
  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function tflUrl(path, params) {
    params = params || {};
    if (CONFIG.tflKey) params.app_key = CONFIG.tflKey;
    var q = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    return "https://api.tfl.gov.uk" + path + (q ? "?" + q : "");
  }

  var LINE_COLOURS = {
    "bakerloo": "#B36305", "central": "#E32017", "circle": "#FFD300", "district": "#00A04A",
    "hammersmith-city": "#F3A9BB", "jubilee": "#A0A5A9", "metropolitan": "#9B0056", "northern": "#8796a5",
    "piccadilly": "#4a6fe0", "victoria": "#0098D4", "waterloo-city": "#95CDBA", "elizabeth": "#9378e0",
    "dlr": "#00A4A7", "liberty": "#EE7C0E", "lioness": "#EE7C0E", "mildmay": "#EE7C0E", "suffragette": "#EE7C0E",
    "weaver": "#EE7C0E", "windrush": "#EE7C0E", "tram": "#84B817"
  };
  var MODE_COLOURS = { "bus": "#E8392F", "national-rail": "#d0d8e0", "overground": "#EE7C0E",
    "elizabeth-line": "#9378e0", "dlr": "#00A4A7", "walking": "#7d8c9b", "coach": "#d0d8e0", "tube": "#8796a5" };

  /* ---- commute window & page switching ---- */
  function inCommute(now) {
    if (qs("commute") === "1") return true;
    if (qs("commute") === "0") return false;
    var c = CONFIG.commute, m = now.getHours() * 60 + now.getMinutes();
    return c.days.indexOf(now.getDay()) >= 0 && m >= toMin(c.start) && m < toMin(c.end);
  }
  // On a page opened with ?auto=1, hop to the other page when the window changes.
  function autoSwitch(wantCommute, otherPage) {
    if (qs("auto") !== "1") return;
    setInterval(function () {
      if (inCommute(new Date()) !== wantCommute) location.replace(otherPage + "?auto=1");
    }, 30000);
  }

  /* ---- clock ---- */
  function clock(clockEl, dateEl) {
    function t() {
      var now = new Date();
      clockEl.innerHTML = hhmm(now) + '<span class="s">' + pad(now.getSeconds()) + "</span>";
      if (dateEl) dateEl.textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    }
    t(); setInterval(t, 1000);
  }
  // Nudge the whole layout a couple of pixels every few minutes (OLED care)
  function drift(el) {
    var s = [[0, 0], [2, 1], [-1, 2], [1, -2], [-2, -1]], i = 0;
    setInterval(function () { i = (i + 1) % s.length; el.style.transform = "translate(" + s[i][0] + "px," + s[i][1] + "px)"; }, 180000);
  }
  // Reload at 03:00 so edits to config.js get picked up
  function nightlyReload() {
    setInterval(function () { var n = new Date(); if (n.getHours() === 3 && n.getMinutes() === 0 && n.getSeconds() < 2) location.reload(); }, 1000);
  }
  function resolveHome() {
    return getJSON("https://api.postcodes.io/postcodes/" + encodeURIComponent(CONFIG.home.postcode)).then(function (d) {
      if (d && d.result) { CONFIG.home.lat = d.result.latitude; CONFIG.home.lon = d.result.longitude; }
    })["catch"](function () {});
  }

  /* ---- weather (Open-Meteo: free, no key) ---- */
  function weather(lat, lon, windUnit) {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,apparent_temperature,is_day,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation" +
      "&hourly=temperature_2m,precipitation_probability,weather_code,is_day" +
      "&wind_speed_unit=" + (windUnit || "mph") + "&timezone=Europe%2FLondon&forecast_days=2";
    return getJSON(url);
  }
  function hourIndex(w, date) {
    var d = date || new Date();
    var key = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":00";
    var i = w.hourly.time.indexOf(key);
    return i < 0 ? 0 : i;
  }
  function wxText(c) {
    if (c === 0) return "Clear";
    if (c === 1) return "Mostly clear";
    if (c === 2) return "Partly cloudy";
    if (c === 3) return "Overcast";
    if (c === 45 || c === 48) return "Fog";
    if (c >= 51 && c <= 57) return "Drizzle";
    if (c === 61 || c === 80) return "Light rain";
    if (c === 63 || c === 81) return "Rain";
    if (c === 65 || c === 82) return "Heavy rain";
    if (c === 66 || c === 67) return "Freezing rain";
    if (c >= 71 && c <= 77) return "Snow";
    if (c === 85 || c === 86) return "Snow showers";
    if (c >= 95) return "Thunderstorm";
    return "—";
  }
  function wxKind(c) {
    if (c <= 1) return "sun";
    if (c === 2) return "part";
    if (c === 3) return "cloud";
    if (c === 45 || c === 48) return "fog";
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
    if (c >= 95) return "storm";
    return "rain";
  }
  function wxIcon(code, isDay, size) {
    var k = wxKind(code), s = size || 28;
    var cloud = '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 11 3.5 3.5 0 0 0 7 18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
    var sun = isDay === 0
      ? '<path d="M15 4a7 7 0 1 0 5 12A8 8 0 0 1 15 4z" fill="none" stroke="#c9d4ff" stroke-width="1.6" stroke-linejoin="round"/>'
      : '<circle cx="12" cy="12" r="4" fill="none" stroke="#ffc94a" stroke-width="1.8"/><g stroke="#ffc94a" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g>';
    var smallSun = isDay === 0
      ? '<path d="M10 2.5a4.5 4.5 0 1 0 4 7 5 5 0 0 1-4-7z" fill="none" stroke="#c9d4ff" stroke-width="1.4"/>'
      : '<circle cx="9" cy="8" r="3" fill="none" stroke="#ffc94a" stroke-width="1.6"/><g stroke="#ffc94a" stroke-width="1.4" stroke-linecap="round"><path d="M9 2v1.4M3 8h1.4M4.8 3.8l1 1M13.2 3.8l-1 1"/></g>';
    var inner;
    if (k === "sun") inner = sun;
    else if (k === "part") inner = smallSun + '<g transform="translate(2,2)">' + cloud + "</g>";
    else if (k === "cloud") inner = cloud;
    else if (k === "fog") inner = '<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 9h16M3 13h18M5 17h14"/></g>';
    else if (k === "snow") inner = '<g transform="translate(0,-3)">' + cloud + '</g><g fill="currentColor"><circle cx="8" cy="20" r="1"/><circle cx="12" cy="21.5" r="1"/><circle cx="16" cy="20" r="1"/></g>';
    else if (k === "storm") inner = '<g transform="translate(0,-3)">' + cloud + '</g><path d="M12.5 15.5l-2 3.5h3l-2 3.5" fill="none" stroke="#ffc94a" stroke-width="1.6" stroke-linejoin="round"/>';
    else inner = '<g transform="translate(0,-3)">' + cloud + '</g><g stroke="#7cc4ff" stroke-width="1.6" stroke-linecap="round"><path d="M8.5 18.5l-1 2.5M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5"/></g>';
    return '<svg class="wx" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true">' + inner + "</svg>";
  }
  function compass(deg) {
    var p = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return p[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  }

  /* ---- map tiles ---- */
  function baseMap(id, opts) {
    var map = L.map(id, {
      zoomControl: false, attributionControl: true, keyboard: false, dragging: false,
      scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, touchZoom: false, zoomSnap: 0.25
    });
    var extra = (opts && opts.extraAttribution) || "";
    if (!CONFIG.cartoKey) {
      // No CARTO key: OpenStreetMap's own tiles, darkened in CSS to match the board
      map.getContainer().className += " osm-dark";
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" + extra }).addTo(map);
      if (opts && opts.noAttribution) map.attributionControl.remove();
      return map;
    }
    map.getContainer().className += " carto";
    var k = "?key=" + encodeURIComponent(CONFIG.cartoKey);
    var base = "https://basemaps.cartocdn.com/rastertiles/";
    var attr = "&copy; OpenStreetMap &copy; CARTO" + extra;
    if (opts && opts.labelsOnTop) {
      // streets underneath, route lines in the middle, place names on top
      L.tileLayer(base + "dark_nolabels/{z}/{x}/{y}.png" + k, {
        maxZoom: 19, attribution: attr }).addTo(map);
      map.createPane("labels");
      map.getPane("labels").style.zIndex = 450;
      map.getPane("labels").style.pointerEvents = "none";
      L.tileLayer(base + "dark_only_labels/{z}/{x}/{y}.png" + k, {
        maxZoom: 19, pane: "labels" }).addTo(map);
      if (opts.noAttribution) map.attributionControl.remove();
    } else {
      L.tileLayer(base + "dark_all/{z}/{x}/{y}.png" + k, {
        maxZoom: 18, attribution: attr }).addTo(map);
    }
    return map;
  }
  function pin(map, lat, lon, label, colour) {
    return L.marker([lat, lon], { interactive: false, zIndexOffset: 1000, icon: L.divIcon({
      className: "", iconSize: [14, 14], iconAnchor: [7, 7],
      html: '<div class="pin" style="color:' + colour + '"></div><div class="pinlabel">' + esc(label) + "</div>"
    }) }).addTo(map);
  }

  return { $: $, esc: esc, pad: pad, hhmm: hhmm, toMin: toMin, qs: qs, getJSON: getJSON, tflUrl: tflUrl,
    LINE_COLOURS: LINE_COLOURS, MODE_COLOURS: MODE_COLOURS, inCommute: inCommute, autoSwitch: autoSwitch,
    clock: clock, drift: drift, nightlyReload: nightlyReload, resolveHome: resolveHome,
    weather: weather, hourIndex: hourIndex, wxText: wxText, wxIcon: wxIcon, compass: compass,
    baseMap: baseMap, pin: pin };
})();
