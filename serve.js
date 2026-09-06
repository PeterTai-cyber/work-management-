/* 本機／區網測試用的靜態伺服器。
   啟動:node serve.js
   電腦看:http://localhost:8080
   手機看:同一個 Wi-Fi 下,用它印出來的區網網址

   注意:區網用的是 http,不是安全來源,所以 Service Worker 不會註冊。
   手機上測得到「操作手感」,測不到「安裝到主畫面」和「離線開啟」——
   那兩件事要等部署到 GitHub Pages(https)才測得成。 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const PORT = 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png':  'image/png'
};

// 記下是哪台裝置連進來的,調版面時可以對照
const seen = new Set();
const device = ua => {
  if (/iPhone|iPad/.test(ua)) return 'iOS Safari 系';
  if (/Android/.test(ua))     return 'Android';
  if (/Windows/.test(ua))     return '電腦';
  return ua.slice(0, 60);
};

http.createServer((req, res) => {
  const ua = req.headers['user-agent'] || '';
  const who = `${req.socket.remoteAddress} ${device(ua)}`;
  if (!seen.has(who)) { seen.add(who); console.log('  ← 新裝置連入:' + who); }

  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(__dirname, url === '/' ? 'index.html' : url);
  if (!file.startsWith(__dirname)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('404'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'   // 改完重整就要看到新版,別被瀏覽器快取擋住
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter(n => n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log('\n  電腦  http://localhost:' + PORT);
  lan.forEach(ip => console.log('  手機  http://' + ip + ':' + PORT + '/?demo'));
  console.log('\n  手機要跟電腦連同一個 Wi-Fi。第一次看建議加 ?demo,有資料才看得出版面。\n');
});
