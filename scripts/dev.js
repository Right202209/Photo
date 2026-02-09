const { spawn } = require('child_process');
const chokidar = require('chokidar');

// Run build initially
runBuild();

// Start server
const server = spawn('npx', ['serve', 'public'], { stdio: 'inherit', shell: true });

// Watch for changes
const watcher = chokidar.watch('src', {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
});

watcher.on('all', (event, path) => {
    console.log(`[${event}] ${path}`);
    runBuild();
});

let isBuilding = false;

function runBuild() {
    if (isBuilding) return;
    isBuilding = true;

    const build = spawn('node', ['scripts/build.js'], { stdio: 'inherit' });

    build.on('close', (code) => {
        isBuilding = false;
        if (code !== 0) {
            console.error(`Build process exited with code ${code}`);
        }
    });
}
