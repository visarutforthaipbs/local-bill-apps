const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = __dirname;
const sourceRoot = process.env.BILLNGAI_BRAND_SOURCE
  || '/Users/visarutsankham/Downloads/BillNgai_Master_All_Assets';
const outputRoot = path.join(projectRoot, 'assets', 'brand');

const magick = process.env.MAGICK_BIN
  || ['/opt/homebrew/bin/magick', '/usr/local/bin/magick'].find((p) => fs.existsSync(p))
  || 'magick'; // last resort: rely on PATH

// Dev-only tool: regenerates assets/brand from the master sheets. It must NEVER
// run implicitly in a packaging step — the committed assets/brand output is the
// source of truth for builds. Bail out BEFORE touching the output directory.
function preflight() {
  if (!fs.existsSync(sourceRoot)) {
    console.error(`prepare-brand-assets: source not found: ${sourceRoot}`);
    console.error('Set BILLNGAI_BRAND_SOURCE or place the master asset package there.');
    console.error('Nothing was deleted or changed.');
    process.exit(1);
  }
  try {
    execFileSync(magick, ['-version'], { stdio: 'ignore' });
  } catch (e) {
    console.error(`prepare-brand-assets: ImageMagick not runnable at "${magick}" (set MAGICK_BIN).`);
    console.error('Nothing was deleted or changed.');
    process.exit(1);
  }
}

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function run(args) {
  execFileSync(magick, args, { stdio: 'inherit' });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function cropSheet({ src, category, set, cols, rows, names, crop, transparent = true, size = 512 }) {
  const outDir = path.join(outputRoot, category);
  ensureDir(outDir);
  const items = [];
  const stepW = crop.stepW || (crop.w / cols);
  const stepH = crop.stepH || (crop.h / rows);
  const itemW = crop.itemW || stepW;
  const defaultItemH = crop.itemH || stepH;
  const itemOffsetX = crop.itemOffsetX || 0;
  const itemOffsetY = crop.itemOffsetY || 0;

  names.forEach((name, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = Math.round(crop.x + col * stepW + itemOffsetX);
    const y = Math.round(crop.y + row * stepH + itemOffsetY);
    const w = Math.round(itemW);
    const h = Math.round((crop.itemHByRow && crop.itemHByRow[row]) || defaultItemH);
    const filename = `${set}-${String(index + 1).padStart(2, '0')}-${slug(name)}.png`;
    const dest = path.join(outDir, filename);
    const args = [
      src,
      '-crop', `${w}x${h}+${x}+${y}`,
      '+repage',
      '-fuzz', '8%',
      '-trim',
      '+repage',
      '-background', 'none',
    ];

    if (transparent) {
      args.push('-transparent', '#fffaf4', '-transparent', '#fff9f3', '-transparent', 'white');
    }

    if (crop.pad) {
      args.push('-bordercolor', 'none', '-border', String(crop.pad));
    }

    args.push('-resize', `${size}x${size}>`, '-define', 'png:color-type=6', dest);
    run(args);
    items.push({
      name,
      category,
      set,
      path: path.relative(projectRoot, dest),
    });
  });

  return items;
}

function makeLogoAssets(manifest) {
  const logoSvg = path.join(projectRoot, 'logo.svg');
  if (!fs.existsSync(logoSvg)) return;

  copyFile(logoSvg, path.join(outputRoot, 'logo.svg'));
  for (const size of [32, 64, 128, 256, 512, 1024]) {
    const dest = path.join(outputRoot, 'logo', `logo-${size}.png`);
    ensureDir(path.dirname(dest));
    run([logoSvg, '-background', 'none', '-resize', `${size}x${size}`, dest]);
    manifest.logo.push({
      name: `logo-${size}`,
      size,
      path: path.relative(projectRoot, dest),
    });
  }
}

const iconSets = [
  {
    set: 'set-1',
    src: 'BillNgai_Asset_Library_Batch_01/03_UI_Icons_Set_1.png',
    names: ['Dashboard', 'Invoice', 'Client', 'Send', 'Paid', 'Draft', 'Reminder', 'Download', 'Edit', 'Delete', 'Wallet', 'Payment', 'Tax', 'Report', 'Settings', 'Search', 'Filter', 'Upload', 'Calendar', 'Notification'],
  },
  {
    set: 'set-2',
    src: 'BillNgai_Asset_Library_Batch_01/04_UI_Icons_Set_2.png',
    names: ['Home', 'List', 'Grid', 'Plus', 'Check', 'Close', 'Arrow Right', 'Arrow Left', 'Arrow Up', 'Arrow Down', 'Attachment', 'Email', 'Phone', 'Message', 'File', 'Folder', 'User', 'Team', 'Clock', 'Help'],
  },
  {
    set: 'set-3',
    src: 'BillNgai_Asset_Library_Batch_02/13_UI_Icons_Set_3.png',
    names: ['Analytics', 'Bookmark', 'Star', 'Heart', 'Share', 'Copy', 'Duplicate', 'Archive', 'Pin', 'Tag', 'Link', 'Eye', 'Eye Off', 'Lock', 'Unlock', 'Shield', 'Info', 'Logout', 'Refresh', 'Sync'],
  },
  {
    set: 'set-4',
    src: 'BillNgai_Asset_Library_Batch_02/14_UI_Icons_Set_4.png',
    names: ['Globe', 'Language', 'Location', 'Map Pin', 'Camera', 'Image', 'Video', 'Microphone', 'Print', 'QR Scan', 'Receipt', 'History', 'Sort', 'More', 'Expand', 'Collapse', 'Dark Mode', 'Light Mode', 'Security', 'Verified'],
  },
];

const objectSets = [
  {
    set: 'set-1',
    src: 'BillNgai_Asset_Library_Batch_01/01_Doodle_Objects_Set_1.png',
    names: ['Laptop', 'Smartphone', 'Tablet', 'Desktop Monitor', 'Keyboard', 'Mouse', 'Trackpad', 'Camera', 'Headphones', 'Coffee Mug', 'Takeaway Coffee Cup', 'Potted Plant', 'Desk Lamp', 'Notebook', 'Pencil', 'Pen', 'Ruler', 'Scissors', 'Tape Roll', 'Paper Clip', 'Stapler', 'Push Pin', 'Envelope', 'Folder', 'Backpack'],
  },
  {
    set: 'set-2',
    src: 'BillNgai_Asset_Library_Batch_01/02_Doodle_Objects_Set_2.png',
    names: Array.from({ length: 25 }, (_, i) => `Object ${i + 1}`),
  },
  {
    set: 'set-3',
    src: 'BillNgai_Asset_Library_Batch_02/11_Doodle_Objects_Set_3.png',
    names: Array.from({ length: 25 }, (_, i) => `Object ${i + 1}`),
  },
  {
    set: 'set-4',
    src: 'BillNgai_Asset_Library_Batch_02/12_Doodle_Objects_Set_4.png',
    names: Array.from({ length: 25 }, (_, i) => `Object ${i + 1}`),
  },
];

const characterSets = [
  {
    set: 'set-1',
    src: 'BillNgai_Asset_Library_Batch_01/05_Character_Poses_Set_1.png',
    names: ['Freelancer on Laptop', 'Freelancer Holding Invoice', 'Designer Sketching', 'Developer Coding', 'Photographer with Camera', 'Cafe Owner with Tablet', 'Consultant on Phone', 'Client Reviewing Bill', 'Small Business Owner at Desk', 'Creator Giving Thumbs Up'],
  },
  { set: 'set-2', src: 'BillNgai_Asset_Library_Batch_01/06_Character_Poses_Set_2.png', names: Array.from({ length: 10 }, (_, i) => `Character ${i + 1}`) },
  { set: 'set-3', src: 'BillNgai_Asset_Library_Batch_02/15_Character_Poses_Set_3.png', names: Array.from({ length: 10 }, (_, i) => `Character ${i + 1}`) },
  { set: 'set-4', src: 'BillNgai_Asset_Library_Batch_02/16_Character_Poses_Set_4.png', names: Array.from({ length: 10 }, (_, i) => `Character ${i + 1}`) },
  { set: 'set-5', src: 'BillNgai_Asset_Library_Batch_02/17_Character_Poses_Set_5.png', names: Array.from({ length: 10 }, (_, i) => `Character ${i + 1}`) },
];

const patternSets = [
  { set: 'set-1', src: 'BillNgai_Asset_Library_Batch_01/07_Pattern_Systems_Set_1.png' },
  { set: 'set-2', src: 'BillNgai_Asset_Library_Batch_01/08_Pattern_Systems_Set_2.png' },
  { set: 'set-3', src: 'BillNgai_Asset_Library_Batch_02/18_Pattern_Systems_Set_3.png' },
];

preflight();
cleanDir(outputRoot);

const manifest = {
  generatedAt: new Date().toISOString(),
  source: sourceRoot,
  logo: [],
  icons: [],
  objects: [],
  characters: [],
  patterns: [],
  sheets: [],
};

makeLogoAssets(manifest);

for (const config of iconSets) {
  manifest.icons.push(...cropSheet({
    ...config,
    src: path.join(sourceRoot, config.src),
    category: 'icons',
    cols: 5,
    rows: 4,
    crop: { x: 44, y: 202, stepW: 1358 / 5, stepH: 782 / 4, itemW: 1358 / 5, itemH: 145 },
    size: 256,
  }));
}

for (const config of objectSets) {
  manifest.objects.push(...cropSheet({
    ...config,
    src: path.join(sourceRoot, config.src),
    category: 'objects',
    cols: 5,
    rows: 5,
    crop: { x: 37, y: 200, stepW: 1374 / 5, stepH: 819 / 5, itemW: 1374 / 5, itemH: 112, itemHByRow: [138, 112, 112, 112, 112], pad: 14 },
    size: 512,
  }));
}

for (const config of characterSets) {
  manifest.characters.push(...cropSheet({
    ...config,
    src: path.join(sourceRoot, config.src),
    category: 'characters',
    cols: 5,
    rows: 2,
    crop: { x: 37, y: 217, stepW: 1376 / 5, stepH: 707 / 2, itemW: 1376 / 5, itemH: 285 },
    size: 768,
  }));
}

for (const config of patternSets) {
  manifest.patterns.push(...cropSheet({
    ...config,
    src: path.join(sourceRoot, config.src),
    category: 'patterns',
    cols: 5,
    rows: 2,
    names: Array.from({ length: 10 }, (_, i) => `Pattern ${i + 1}`),
    crop: { x: 31, y: 225, stepW: 1381 / 5, stepH: 710 / 2, itemW: 260, itemH: 302 },
    transparent: false,
    size: 768,
  }));
}

const sheetDir = path.join(outputRoot, 'sheets');
ensureDir(sheetDir);
for (const file of fs.readdirSync(sourceRoot, { recursive: true })) {
  if (!file.endsWith('.png')) continue;
  const src = path.join(sourceRoot, file);
  const dest = path.join(sheetDir, `${slug(file.replace(/\.png$/i, ''))}.webp`);
  run([src, '-resize', '1600x1600>', '-quality', '82', dest]);
  manifest.sheets.push({
    name: path.basename(file, '.png'),
    path: path.relative(projectRoot, dest),
  });
}

const guide = path.join(sourceRoot, 'BillNgai_Brand_Guideline_v1.pdf');
if (fs.existsSync(guide)) {
  copyFile(guide, path.join(outputRoot, 'BillNgai_Brand_Guideline_v1.pdf'));
}

fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(outputRoot, 'README.md'), `# BillNgai Brand Assets

Generated from \`${sourceRoot}\`.

Run this from the project root after changing the source sheets:

\`\`\`sh
npm run assets
\`\`\`

Use \`manifest.json\` for stable lookup paths.

- \`logo/\` contains PNG logo exports from \`logo.svg\`.
- \`icons/\` contains transparent UI icon PNGs.
- \`objects/\` contains transparent doodle object PNGs.
- \`characters/\` contains transparent character PNGs.
- \`patterns/\` contains pattern tiles.
- \`sheets/\` contains optimized WebP reference sheets.
`);
console.log(`Generated ${manifest.icons.length} icons, ${manifest.objects.length} objects, ${manifest.characters.length} characters, ${manifest.patterns.length} patterns.`);
