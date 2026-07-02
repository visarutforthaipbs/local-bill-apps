const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SIZE = 1024;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: SIZE, height: SIZE, show: false });
  const buildDir = path.join(__dirname, 'build');
  const srcPng = path.join(buildDir, 'icon_source.png');
  
  if (!fs.existsSync(srcPng)) {
    console.error('Error: build/icon_source.png not found. Please run the image generation step first.');
    app.quit();
    return;
  }
  
  const base64Img = fs.readFileSync(srcPng).toString('base64');
  
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>html,body{margin:0;padding:0;background:transparent}</style></head>
  <body><canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
  <script>
  const S=${SIZE}, c=document.getElementById('c'), x=c.getContext('2d');
  const img = new Image();
  img.onload = () => {
    x.drawImage(img, 0, 0);
    const imgData = x.getImageData(0, 0, S, S);
    const data = imgData.data;
    
    // Process pixels to remove the outer white background while keeping the shadow
    for (let y = 0; y < S; y++) {
      for (let xCoord = 0; xCoord < S; xCoord++) {
        const idx = (y * S + xCoord) * 4;
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];
        
        // Calculate distance from center (512, 512)
        const dx = xCoord - 512;
        const dy = y - 512;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // If it is a white background pixel outside the squircle area
        if (dist > 350 && r > 240 && g > 240 && b > 240) {
          data[idx+3] = 0; // Set alpha to 0 (fully transparent)
        }
      }
    }
    x.putImageData(imgData, 0, 0);
    window.__png = c.toDataURL('image/png');
  };
  img.src = 'data:image/png;base64,' + ${JSON.stringify(base64Img)};
  </script></body></html>`;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  
  // Wait for image to load and process
  let dataUrl;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 100));
    dataUrl = await win.webContents.executeJavaScript('window.__png');
    if (dataUrl) break;
  }
  
  if (!dataUrl) {
    console.error('Failed to process image');
    app.quit();
    return;
  }
  
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const png = path.join(buildDir, 'icon.png');
  fs.writeFileSync(png, Buffer.from(b64, 'base64'));
  console.log('wrote build/icon.png');

  // Convert PNG -> .icns (macOS sips + iconutil)
  try {
    const set = path.join(buildDir, 'icon.iconset');
    fs.rmSync(set, { recursive: true, force: true });
    fs.mkdirSync(set, { recursive: true });
    for (const s of [16, 32, 128, 256, 512]) {
      execSync(`sips -z ${s} ${s} "${png}" --out "${set}/icon_${s}x${s}.png"`, { stdio: 'ignore' });
      const d = s * 2;
      execSync(`sips -z ${d} ${d} "${png}" --out "${set}/icon_${s}x${s}@2x.png"`, { stdio: 'ignore' });
    }
    execSync(`iconutil -c icns "${set}" -o "${path.join(buildDir, 'icon.icns')}"`);
    fs.rmSync(set, { recursive: true, force: true });
    console.log('wrote build/icon.icns');
  } catch (e) {
    console.warn('icns conversion skipped:', e.message);
  }
  app.quit();
});
