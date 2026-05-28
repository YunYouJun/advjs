import type { IFileSystem } from '../utils/fs'

/**
 * Build a "standalone" portable project bundle for static hosting.
 *
 * The bundle reuses {@link exportProject}'s project file collection but layers
 * on a deployable shell:
 *
 * - `index.html` — minimal landing page that links to `ADV.JS Play` (a hosted
 *   viewer) with the project pre-loaded. Includes Open Graph metadata.
 * - `_redirects` — Netlify SPA fallback.
 * - `vercel.json` — Vercel rewrites equivalent of the above.
 * - `README.md` — instructions for the author on what to do with the folder.
 * - All project files under `adv/` (text + binary).
 *
 * Until a hosted viewer exists at `play.advjs.org` (or similar), the landing
 * page double-serves as an "open in Studio" deep-link target so the bundle is
 * still useful — authors can share it on GitHub Pages / Netlify / Vercel and
 * collaborators can import it into their own Studio.
 */
export async function buildStandaloneBundle(
  fs: IFileSystem,
  projectName: string,
  options: { description?: string, cover?: string, viewerUrl?: string } = {},
): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  let allFiles: { path: string, content: string }[]
  try {
    allFiles = await fs.collectAllFiles('adv')
  }
  catch {
    throw new Error('No adv/ directory found in project')
  }

  for (const { path, content } of allFiles)
    zip.file(path, content)

  // Best-effort binary collection (mirrors exportProject).
  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp3', '.wav', '.ogg', '.m4a']
  for (const ext of binaryExts) {
    try {
      const binaryFiles = await fs.listFilesByExts('adv', [ext])
      for (const binaryPath of binaryFiles) {
        if (zip.file(binaryPath))
          continue
        try {
          const blobUrl = await fs.readBlobUrl(binaryPath)
          const resp = await fetch(blobUrl)
          const blob = await resp.blob()
          URL.revokeObjectURL(blobUrl)
          zip.file(binaryPath, blob)
        }
        catch { /* skip */ }
      }
    }
    catch { /* no files */ }
  }

  const viewer = options.viewerUrl?.replace(/\/$/, '') ?? 'https://studio.advjs.org'
  const safeName = escapeHtml(projectName)
  const safeDesc = escapeHtml(options.description ?? `${projectName} — built with ADV.JS`)
  const coverImg = options.cover ? `<img src="${escapeAttr(options.cover)}" alt="${safeName}" class="cover">` : ''
  const ogImageTag = options.cover ? `<meta property="og:image" content="${escapeAttr(options.cover)}">` : ''

  zip.file('index.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName} — ADV.JS</title>
  <meta name="description" content="${safeDesc}">
  <meta property="og:title" content="${safeName}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:type" content="website">
  ${ogImageTag}
  <link rel="manifest" href="./manifest.webmanifest">
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 560px;
      width: 100%;
      background: #1e293b;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }
    .cover {
      width: 100%;
      max-height: 280px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p.desc { color: #94a3b8; margin: 0 0 24px; line-height: 1.5; }
    .actions { display: flex; flex-direction: column; gap: 12px; }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    a.primary { background: #6366f1; color: white; }
    a.primary:hover { background: #4f46e5; }
    a.secondary { background: transparent; color: #94a3b8; border: 1px solid #334155; }
    a.secondary:hover { background: #334155; }
    footer { margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <main class="card">
    ${coverImg}
    <h1>${safeName}</h1>
    <p class="desc">${safeDesc}</p>
    <div class="actions">
      <a class="btn primary" href="${viewer}?import=${encodeURIComponent(typeof location !== 'undefined' ? location.href : './')}" target="_blank" rel="noopener">
        Open in ADV.JS Studio
      </a>
      <a class="btn secondary" href="./adv/" rel="noopener">
        Browse project files
      </a>
    </div>
    <footer>
      Powered by <a href="https://advjs.org" style="color:#94a3b8">ADV.JS</a>. This bundle is portable — host it on any static service.
    </footer>
  </main>
</body>
</html>
`)

  zip.file('_redirects', '/*  /index.html  200\n')
  zip.file('vercel.json', JSON.stringify({
    rewrites: [
      { source: '/(.*)', destination: '/index.html' },
    ],
  }, null, 2))

  zip.file('manifest.webmanifest', JSON.stringify({
    name: projectName,
    short_name: projectName,
    description: options.description ?? '',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#6366f1',
    icons: options.cover ? [{ src: options.cover, sizes: '512x512', type: 'image/png' }] : [],
  }, null, 2))

  zip.file('README.md', `# ${projectName}

Built with [ADV.JS](https://advjs.org) Studio.

## Deploy

Upload this folder to any static host:

- **Netlify** — drag-drop the unzipped folder onto netlify.com.
- **Vercel** — \`vercel --prod\` (vercel.json included).
- **GitHub Pages** — push to a repo, enable Pages.
- **Cloudflare Pages** — point at the unzipped folder.

\`_redirects\` (Netlify) and \`vercel.json\` are pre-configured for SPA routing.

## Layout

- \`adv/\` — your project's source files (chapters, characters, scenes, audio).
- \`index.html\` — landing page with a link to play in ADV.JS Studio.

> Standalone offline playback is a Phase 17b deliverable — currently the
> landing page deep-links into a hosted Studio. Re-export after the runtime
> ships to get a fully self-contained bundle.
`)

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(str: string): string {
  return escapeHtml(str)
}
