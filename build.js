const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const isProd = args.includes("--prod");
const isDev = args.includes("--dev");

const distDir = path.resolve(__dirname, "dist");

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy index.html to dist/ with adjusted paths
function copyHTML() {
  const src = path.resolve(__dirname, "public", "index.html");
  const dest = path.resolve(distDir, "index.html");
  if (fs.existsSync(src)) {
    let html = fs.readFileSync(src, "utf-8");
    // Adjust CSS paths: css/foo.css -> foo.css (esbuild outputs to dist root)
    html = html.replace(/href="css\//g, 'href="');
    // Adjust JS path: js/bundle.js -> bundle.js
    html = html.replace('src="js/bundle.js"', 'src="bundle.js"');
    // Add cache-busting timestamp to asset references
    const timestamp = Date.now();
    html = html.replace(/href="([^"]+\.css)"/g, `href="$1?v=${timestamp}"`);
    html = html.replace('src="bundle.js"', `src="bundle.js?v=${timestamp}"`);
    fs.writeFileSync(dest, html);
    console.log("Copied index.html to dist/");
  } else {
    console.warn("Warning: public/index.html not found, skipping copy.");
  }

  // Copy favicon
  const faviconSrc = path.resolve(__dirname, "public", "favicon.svg");
  const faviconDest = path.resolve(distDir, "favicon.svg");
  if (fs.existsSync(faviconSrc)) {
    fs.copyFileSync(faviconSrc, faviconDest);
    console.log("Copied favicon.svg to dist/");
  }

  // Copy manifest.json
  const manifestSrc = path.resolve(__dirname, "public", "manifest.json");
  const manifestDest = path.resolve(distDir, "manifest.json");
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, manifestDest);
    console.log("Copied manifest.json to dist/");
  }

  // Copy service worker with cache-busting version
  const swSrc = path.resolve(__dirname, "public", "sw.js");
  const swDest = path.resolve(distDir, "sw.js");
  if (fs.existsSync(swSrc)) {
    let swContent = fs.readFileSync(swSrc, "utf-8");
    swContent = swContent.replace("focus-v1", `focus-${Date.now()}`);
    fs.writeFileSync(swDest, swContent);
    console.log("Copied sw.js to dist/ (with cache-busting)");
  }

  // Copy fonts
  const fontsSrc = path.resolve(__dirname, "public", "fonts");
  const fontsDest = path.resolve(distDir, "fonts");
  if (fs.existsSync(fontsSrc)) {
    if (!fs.existsSync(fontsDest)) {
      fs.mkdirSync(fontsDest, { recursive: true });
    }
    for (const file of fs.readdirSync(fontsSrc)) {
      fs.copyFileSync(path.join(fontsSrc, file), path.join(fontsDest, file));
    }
    console.log("Copied fonts to dist/fonts/");
  }

  // Generate PWA icons
  const generateIconsPath = path.resolve(__dirname, "scripts", "generate-icons.js");
  if (fs.existsSync(generateIconsPath)) {
    require(generateIconsPath);
  }
}

async function build() {
  const buildOptions = {
    entryPoints: ["public/js/main.ts"],
    bundle: true,
    format: "iife",
    outfile: "dist/bundle.js",
    sourcemap: isDev || !isProd,
    minify: isProd,
    logLevel: "info",
  };

  // Bundle CSS files if any exist
  const cssDir = path.resolve(__dirname, "public", "css");
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs
      .readdirSync(cssDir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => path.join("public/css", f));

    if (cssFiles.length > 0) {
      await esbuild.build({
        entryPoints: cssFiles,
        bundle: true,
        outdir: "dist",
        minify: isProd,
        sourcemap: isDev || !isProd,
        logLevel: "info",
        loader: { '.woff2': 'file' },
        assetNames: 'fonts/[name]',
      });
    }
  }

  if (isDev) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await esbuild.build(buildOptions);
  }

  copyHTML();
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
