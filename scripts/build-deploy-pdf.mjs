/**
 * Renders the operator guides in docs/ to PDF.
 *   npm run docs:pdf        (set CHROMIUM_PATH to use a specific Chromium)
 */
import { readFileSync } from 'node:fs'
import { marked } from 'marked'
import { chromium } from 'playwright'

const GUIDES = [
  { src: 'docs/DEPLOYMENT-CPANEL.md', out: 'docs/Eye-TV-cPanel-Deployment-Guide.pdf', title: 'cPanel deployment guide' },
  { src: 'docs/MUX-SETUP.md', out: 'docs/Eye-TV-Mux-Setup-Guide.pdf', title: 'Mux setup guide' },
  { src: 'docs/LIVE-STREAMING.md', out: 'docs/Eye-TV-Live-Streaming-Guide.pdf', title: 'Live streaming guide' },
]
const generated = new Date().toISOString().slice(0, 10)
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

for (const { src, out, title } of GUIDES) {
const body = marked.parse(readFileSync(src, 'utf8'))

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #111; font-size: 10.5pt; line-height: 1.5; }
  .cover { border-left: 6px solid #E10600; padding: 4px 0 4px 14px; margin-bottom: 18px; }
  .cover .brand { font-weight: 800; letter-spacing: .12em; font-size: 9pt; color: #A31111; }
  h1 { font-size: 20pt; margin: 4px 0 6px; }
  h2 { font-size: 13.5pt; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #E10600; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 16px 0 6px; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9.5pt; break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; }
  pre { background: #f3f3f3; padding: 10px 12px; font-size: 8.5pt; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  code { background: #f3f3f3; padding: 1px 4px; border-radius: 3px; font-size: 9pt; }
  blockquote { margin: 10px 0; padding: 8px 12px; background: #fff4f3; border-left: 4px solid #E10600; }
  li { margin: 3px 0; }
  hr { border: 0; border-top: 1px solid #ddd; margin: 18px 0; }
  .meta { color: #666; font-size: 9pt; }
</style></head><body>
<div class="cover"><div class="brand">EYE MEDIA GROUP · EYE TV</div><div class="meta">Generated ${generated} from ${src}</div></div>
${body}
</body></html>`

const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    `<div style="font-size:8px;width:100%;text-align:center;color:#888">Eye TV — ${title} · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
})
await page.close()
console.log(`Wrote ${out}`)
}
await browser.close()
