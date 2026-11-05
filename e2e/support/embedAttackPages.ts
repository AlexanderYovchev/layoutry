import http from "node:http";
import type { AddressInfo } from "node:net";

/*
 * BC-02.3 — deterministic hostile embed pages for the iframe escape specs.
 * Every page is generated here and served from loopback (or fulfilled by a
 * Playwright route on the editor's own origin); no public site is used.
 *
 * The attack page tries every way out of its frame. Each attempt reports
 * its outcome to the parent with postMessage (which a sandboxed frame may
 * still send), but the specs never rely on those reports alone: they check
 * that the editor's own URL and document are still there.
 */

export const LANDED_TITLE = "BC-02.3 escaped";

export interface AttackUrls {
  /** Where an escape would take the top window. */
  landed: string;
  /** An ordinary page inside the frame (in-frame navigation target). */
  next: string;
  /** The page a popup opens; it then tries to navigate its opener's top. */
  popup: string;
}

export function attackPage(urls: AttackUrls, options: { autoEscape?: boolean } = {}): string {
  const landed = JSON.stringify(urls.landed);
  return `<!doctype html><html><head><title>embed</title></head>
<body style="margin:0;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:4px">
<a id="link-top" href=${landed} target="_top">top link</a>
<a id="link-parent" href=${landed} target="_parent">parent link</a>
<button id="script-top">script top</button>
<button id="script-parent">script parent</button>
<button id="popup">popup</button>
<button id="read-parent">read parent</button>
<a id="in-frame" href=${JSON.stringify(urls.next)}>in-frame link</a>
<form action=${JSON.stringify(urls.next)} method="get"><button id="submit">submit</button></form>
<script>
  var report = function (attempt, outcome) { parent.postMessage({ bc023: true, attempt: attempt, outcome: outcome }, "*"); };
  var tryIt = function (attempt, action) {
    try { var value = action(); report(attempt, "ran:" + String(value)); }
    catch (error) { report(attempt, "threw:" + error.name); }
  };
  report("loaded", "origin:" + window.origin);
  document.getElementById("script-top").onclick = function () { tryIt("script-top", function () { top.location.href = ${landed}; }); };
  document.getElementById("script-parent").onclick = function () { tryIt("script-parent", function () { parent.location.href = ${landed}; }); };
  document.getElementById("popup").onclick = function () { tryIt("popup", function () { return !!window.open(${JSON.stringify(urls.popup)}); }); };
  document.getElementById("read-parent").onclick = function () { tryIt("read-parent", function () { return parent.document.title; }); };
  ${options.autoEscape ? `tryIt("auto-read", function () { return parent.document.title; });
  tryIt("auto-top", function () { top.location.href = ${landed}; });` : ""}
</script></body></html>`;
}

export function landedPage(): string {
  return `<!doctype html><title>${LANDED_TITLE}</title><h1 id="landed">escaped</h1>`;
}

export function nextPage(): string {
  return `<!doctype html><title>next</title><p id="next">in-frame navigation worked</p>
<script>parent.postMessage({ bc023: true, attempt: "next", outcome: "loaded:" + location.search }, "*");</script>`;
}

export function popupPage(landed: string): string {
  return `<!doctype html><title>popup</title><script>
  var outcome;
  try { opener.top.location.href = ${JSON.stringify(landed)}; outcome = "ran"; } catch (error) { outcome = "threw:" + error.name; }
  document.title = "popup " + outcome;
</script>`;
}


/**
 * A well-behaved embed (BC-02.3 compatibility): uses what real players,
 * maps and widgets rely on — its own storage and cookies, a same-origin
 * request, postMessage to the host, matchMedia — and reports the result.
 */
export function widgetPage(): string {
  return `<!doctype html><title>widget</title><p id="widget">widget</p><script>
  var results = [];
  try { localStorage.setItem("k", "v"); results.push("storage:" + (localStorage.getItem("k") === "v" ? "ok" : "bad")); } catch (error) { results.push("storage:" + error.name); }
  try { document.cookie = "bc023=1; SameSite=None; Secure"; document.cookie = "bc023lax=1"; results.push("cookie:" + (document.cookie.indexOf("bc023lax=1") >= 0 ? "ok" : "bad")); } catch (error) { results.push("cookie:" + error.name); }
  results.push("media-query:" + (typeof matchMedia("(min-width: 1px)").matches === "boolean" ? "ok" : "bad"));
  fetch("/next.html").then(function (response) { results.push("fetch:" + (response.ok ? "ok" : response.status)); }, function (error) { results.push("fetch:" + error.name); })
    .then(function () { parent.postMessage({ bc023: true, attempt: "widget", outcome: location.search + "|" + results.join(",") }, "*"); });
</script>`;
}

export interface AttackServer {
  origin: string;
  urls: AttackUrls;
  /** Serves `html` at `path` from now on (for example an exported page). */
  host: (path: string, html: string) => string;
  close: () => Promise<void>;
}

/**
 * One loopback origin serving the attack pages:
 *   /attack.html[?auto=1]  /landed.html  /next.html  /popup.html  /widget.html
 *   /redirect?to=<url>     302 to <url>
 */
export async function startAttackServer(): Promise<AttackServer> {
  let origin = "";
  const hosted = new Map<string, string>();
  const urls = (): AttackUrls => ({ landed: `${origin}/landed.html`, next: `${origin}/next.html`, popup: `${origin}/popup.html` });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", origin);
    const send = (body: string) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(body);
    };
    switch (url.pathname) {
      case "/attack.html":
        return send(attackPage(urls(), { autoEscape: url.searchParams.has("auto") }));
      case "/widget.html":
        return send(widgetPage());
      case "/landed.html":
        return send(landedPage());
      case "/next.html":
        return send(nextPage());
      case "/popup.html":
        return send(popupPage(urls().landed));
      case "/redirect": {
        response.writeHead(302, { Location: url.searchParams.get("to") ?? "/landed.html", "Cache-Control": "no-store" });
        return response.end();
      }
      default: {
        const page = hosted.get(url.pathname);
        if (page !== undefined) return send(page);
        response.writeHead(404).end();
      }
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const host = (path: string, html: string) => {
    hosted.set(path, html);
    return `${origin}${path}`;
  };
  return { origin, urls: urls(), host, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
