const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 100, height: 100, show: false });
  const pngPath = path.join(__dirname, 'build', 'icon.png');
  const base64Img = fs.readFileSync(pngPath).toString('base64');
  
  const html = `<!DOCTYPE html><html><body>
    <canvas id="c" width="10" height="10"></canvas>
    <script>
      const img = new Image();
      img.onload = () => {
        const c = document.getElementById('c');
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        console.log('PIXEL:' + JSON.stringify(Array.from(data)));
      };
      img.src = 'data:image/png;base64,' + ${JSON.stringify(base64Img)};
    </script>
  </body></html>`;
  
  win.webContents.on('console-message', (event, level, message) => {
    if (message.startsWith('PIXEL:')) {
      console.log(message);
      app.quit();
    }
  });
  
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
});
