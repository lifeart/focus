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
    fs.writeFileSync(dest, html);
    console.log("Copied index.html to dist/");
  } else {
    console.warn("Warning: public/index.html not found, skipping copy.");
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
