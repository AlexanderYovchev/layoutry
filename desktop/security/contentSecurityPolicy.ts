/**
 * Content Security Policy for every app://layoutry/ response (ADR-0002).
 *
 * Allowances, each required by verified behavior:
 * - script-src 'unsafe-inline': the Next.js static export emits inline
 *   bootstrap <script> blocks. Scripts may otherwise only come from the
 *   bundle itself — never from a remote host, and never via eval.
 * - style-src 'unsafe-inline': React `style` props and Next's font CSS.
 * - img-src / media-src http: https: data: blob:: user-authored images,
 *   backgrounds, video and audio may point anywhere; they are passive
 *   content and simply fail to load offline.
 * - frame-src http: https:: user-authored iframes. Framed pages run in
 *   their own site-isolated process and cannot script this document.
 *
 * Residual risk: authored content shares the editor's DOM, so this CSP
 * does not isolate it from the editor — it only stops remote script and
 * plugin loading. The Canvas never renders authored raw HTML (no
 * dangerouslySetInnerHTML), which is what keeps authored data from
 * becoming script.
 */
const DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: http: https:",
  "media-src 'self' data: blob: http: https:",
  "frame-src http: https:",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
] as const;

export const CONTENT_SECURITY_POLICY = DIRECTIVES.join("; ");
