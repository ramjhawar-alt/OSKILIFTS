// Runs after `expo export` (see "web:build"): adds the description and link-preview
// tags to dist/index.html so a shared oskilifts.com link shows a title, text and image.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(target)) {
  console.warn(`[inject-seo] ${target} not found; skipping.`);
  process.exit(0);
}

const ORIGIN = 'https://oskilifts.com';
const TITLE = 'OSKILIFTS: the gym app for Berkeley lifters';
const DESCRIPTION = 'Log workouts, follow friends, see how busy the RSF is, and find out who is playing hoops. Built for UC Berkeley students.';
const tags = [
  `<meta name="description" content="${DESCRIPTION}" />`,
  '<meta name="theme-color" content="#003262" />',
  '<meta property="og:type" content="website" />',
  '<meta property="og:site_name" content="OSKILIFTS" />',
  `<meta property="og:title" content="${TITLE}" />`,
  `<meta property="og:description" content="${DESCRIPTION}" />`,
  `<meta property="og:image" content="${ORIGIN}/og-image.png" />`,
  '<meta property="og:image:width" content="1200" />',
  '<meta property="og:image:height" content="630" />',
  '<meta name="twitter:card" content="summary_large_image" />',
  `<meta name="twitter:title" content="${TITLE}" />`,
  `<meta name="twitter:description" content="${DESCRIPTION}" />`,
  `<meta name="twitter:image" content="${ORIGIN}/og-image.png" />`,
].join('\n    ');

let html = fs.readFileSync(target, 'utf8');
if (html.includes('property="og:title"')) {
  console.log('[inject-seo] tags already present; skipping.');
  process.exit(0);
}
html = html.replace('<title>OSKILIFTS</title>', `<title>OSKILIFTS</title>\n    ${tags}`);
fs.writeFileSync(target, html);
console.log('[inject-seo] Added description and link-preview tags to index.html');
