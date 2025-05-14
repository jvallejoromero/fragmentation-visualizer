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
let delayed = false;

let prevState = new Map();
let allocs = 0;
let frees = 0;
let snapshotCounter = 0;
let sentSnapshots = 0;
let lastPID = 0;

const FRAME_MS = 50;

// Watch for changes to heap_frag.log
chokidar.watch(LOG_PATH, { awaitWriteFinish: true })
  .on('change', (filePath) => {
    console.log("File changed:", filePath);

    // Read entire log, split on blank lines
    const data = fs.readFileSync(LOG_PATH,'utf8');

    const match = data.match(/^&PID=(\d+)/m);
    const pid = match ? match[1] : null;

    // detect new process run
    console.log("From pid:", pid); 
    if (pid && pid !== lastPID) {
      lastPID = pid;
      sentSnapshots = 0;
      snapshotCounter = 0;
      prevState.clear();
      allocs = 0;
      frees = 0;
    }

    const snapshots = data.trim().split(/\n\s*\n/);
    const newSnaps = snapshots.slice(sentSnapshots);
    const baseIndex = sentSnapshots; 

    if (snapshots.length >= 30) {
      delayed = true;
    }

    newSnaps.forEach((snap, i) => {
        // schedule each emit i*FRAME_MS ms in the future
        setTimeout(() => {
          let coalesced = false;
          snapshotCounter += 1;

          // parse chunks
          const lines = snap.split('\n');
          const chunks = lines.filter(line => {
            if (line.startsWith('&coalesced')) coalesced = true;
            return !line.startsWith('&');
          }).map(line => {
            const [addr, size, alloc] = line.trim().split(/\s+/);
            return {addr, size: +size, allocated: +alloc === 1 };
          });

          // update alloc/free counts
          chunks.forEach(({ addr, allocated }) => {
            if (!prevState.has(addr)) {
              if (allocated) allocs++;
            } else {
              const old = prevState.get(addr);
              if (!old && allocated) allocs++;
              if (old && !allocated) frees++;
            }
            prevState.set(addr, allocated);
          });

          console.log("coalesced=", coalesced)
          io.emit('snapshot', {pid: Number(pid), snapshotId: snapshotCounter, chunks, coalesced});
          io.emit('syscalls', {pid: Number(pid), snapshotId: snapshotCounter, allocs, frees});
        }, (delayed ? i * FRAME_MS : 0));
      });
      delayed = false;
      sentSnapshots = snapshots.length;
  });

app.listen(3001, () => console.log('📡 WS server listening on 3001'));
