import fs from 'fs';
import { Server } from 'socket.io';
import http from 'http';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert the module URL into a file path
const __filename = fileURLToPath(import.meta.url);
// Derive the directory name from that file path
const __dirname  = path.dirname(__filename);

const LOG_PATH = path.resolve(__dirname, '..', '..', 'heap_frag.log');
console.log('Watching:', LOG_PATH);

const app = http.createServer();
const io  = new Server(app, { cors: { origin: '*' } });

io.on('connection', socket => {
    console.log('👤 Client connected:', socket.id);

    socket.on('disconnect', reason => {
        console.log('❌ Client disconnected:', socket.id, '– reason:', reason);
    });
});

let buffer = '';
let snapshots = [];
let delayed = false;

const FRAME_MS = 150;

// Watch for changes to heap_frag.log
chokidar.watch(LOG_PATH, { awaitWriteFinish: true })
  .on('change', (filePath) => {
    console.log("File changed:", filePath);

    // Read entire log, split on blank lines
    const data = fs.readFileSync(LOG_PATH,'utf8');
    snapshots = data.trim().split(/\n\s*\n/);

    if (snapshots.length >= 30) {
      delayed = true;
    }

    let snapshotCounter = 0;

    snapshots.forEach((snap, i) => {
        // schedule each emit i*FRAME_MS ms in the future
        setTimeout(() => {
          snapshotCounter += 1;

          const lines = snap.split('\n');
          const chunks = lines.map(line => {
            const [, size, alloc] = line.trim().split(/\s+/);
            return { size: +size, allocated: +alloc === 1 };
          });

          // console.log("sending snapshot..");
          io.emit('snapshot', {snapshotId: snapshotCounter, chunks});
        }, (delayed ? i * FRAME_MS : 0));
      });
      delayed = false;
  });

app.listen(3001, () => console.log('📡 WS server listening on 3001'));
