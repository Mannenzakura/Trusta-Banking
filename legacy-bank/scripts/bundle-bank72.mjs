import {readFileSync, writeFileSync} from 'node:fs';
import {build} from 'esbuild';

// Keep the source modules editable, but ship one self-contained startup document.
// Deferred scripts otherwise wait for every pending stylesheet in embedded browsers.
export async function bundleBank72() {
  const root = new URL('../public/bank/', import.meta.url);
  let html = readFileSync(new URL('index.html', root), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"?]+)(?:\?[^\"]*)?">/g, (_, href) => {
    let css = readFileSync(new URL(href.replace('/bank/', ''), root), 'utf8');
    css = css.replace(/@import url\('\/bank\/type.css'\);/, readFileSync(new URL('type.css', root), 'utf8'));
    return '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>';
  });
  const result = await build({
    entryPoints: [new URL('app.js', root).pathname.replace(/^\/([A-Z]:)/i, '$1')],
    bundle: true, write: false, format: 'esm', target: 'es2022', minify: true,
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const loader = readFileSync(new URL('boot71.js', root), 'utf8')
    .replace(/import\('\/bank\/app.js\?v=boot71'\)\.then\(\(\) => clearTimeout\(timer\)\)\.catch\(\(\) => \{ clearTimeout\(timer\); show\(\); \}\);/, "window.addEventListener('bank-ready', () => clearTimeout(timer)); window.addEventListener('error', show);");
  html = html.replace(/<script src="\/bank\/boot71.js\?v=71" defer><\/script>/,
    () => '<script>' + loader + '</script><script>document.documentElement.dataset.bankBoot="executing";(async()=>{' + js + '\n})().catch(e=>{const p=document.querySelector("#app > .boot p");if(p)p.textContent="页面启动失败："+e.message;});</script>');
  writeFileSync(new URL('../dist/client/bank/index.html', import.meta.url), html);
  console.log(`Bank startup bundled: ${Buffer.byteLength(html)} bytes; no blocking external CSS or JS.`);
}
