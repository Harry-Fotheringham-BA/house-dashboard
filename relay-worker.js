/**
 * Chiswick Board aircraft relay — a Cloudflare Worker.
 *
 * Why: the free ADS-B feeds don't send the browser header that lets a web
 * page on another site read them, so the TV's browser blocks the response.
 * This Worker fetches the feed server-side and hands it back with that header.
 *
 * Deploy (free plan, about 5 minutes):
 *   1. dash.cloudflare.com → Workers & Pages → Create → Create Worker
 *   2. Name it e.g. "chiswick-relay" → Deploy → Edit code
 *   3. Replace everything with this file → Deploy
 *   4. Copy the URL (https://chiswick-relay.<you>.workers.dev) into CONFIG.relay in config.js
 *   Test: open https://chiswick-relay.<you>.workers.dev/planes?lat=51.48&lon=-0.35&r=25
 *
 * It only serves aircraft near London and caches each answer for 5 seconds,
 * so it can't be used as a general-purpose proxy.
 */

const UPSTREAMS = [
  (lat, lon, r) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${r}`,
  (lat, lon, r) => `https://api.airplanes.live/v2/point/${lat}/${lon}/${r}`,
  (lat, lon, r) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${r}`,
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=5" },
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.pathname !== "/planes") return json({ error: "use /planes?lat=..&lon=..&r=.." }, 404);

    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const r = Math.min(40, Math.max(5, Number(url.searchParams.get("r")) || 25));

    // Only the London area: keeps the Worker from being reused for anything else
    if (!(lat > 50.5 && lat < 52.5 && lon > -2 && lon < 1.5)) {
      return json({ error: "lat/lon outside the London area" }, 400);
    }

    const la = lat.toFixed(3), lo = lon.toFixed(3);
    for (const make of UPSTREAMS) {
      const upstream = make(la, lo, r);
      try {
        const res = await fetch(upstream, {
          headers: { "User-Agent": "chiswick-board/1.0 (personal home TV dashboard)", Accept: "application/json" },
          cf: { cacheTtl: 5, cacheEverything: true },
        });
        if (!res.ok) continue;
        const data = await res.json();
        const ac = data.ac || data.aircraft || [];
        return json({ source: new URL(upstream).host, now: data.now || Date.now(), ac });
      } catch (e) {
        // try the next feed
      }
    }
    return json({ error: "all aircraft feeds failed" }, 502);
  },
};
