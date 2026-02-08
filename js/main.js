/**
 * Main game controller - coordinates all game components
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.videoElement = document.getElementById('camera-feed');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.errorOverlay = document.getElementById('error-overlay');
        this.errorMessage = document.getElementById('error-message');
        this.retryBtn = document.getElementById('retry-btn');

        this.camera = new CameraManager(this.videoElement);
        this.faceTracking = new FaceTracking();
        this.bubbleManager = null;
        this.collisionDetector = new CollisionDetector();

        this.lastTime = 0;
        this.isRunning = false;
        this.currentFaces = [];

        // Debug mode - set to true to see tracking visualization
        this.debugMode = false;

        // Score tracking
        this.totalPopped = 0;
        this.popTimestamps = [];
        this.scoreTotal = document.getElementById('score-total');
        this.scoreRate = document.getElementById('score-rate');

        // Video to canvas coordinate mapping (for object-fit: cover)
        this.videoTransform = { scale: 1, offsetX: 0, offsetY: 0 };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Retry button
        this.retryBtn.addEventListener('click', () => {
            this.hideError();
            this.initialize();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') {
                this.debugMode = !this.debugMode;
                console.log('Debug mode:', this.debugMode);
            }
        });

        // Tap/click to toggle debug mode
        this.canvas.addEventListener('click', () => {
            this.debugMode = !this.debugMode;
            console.log('Debug mode:', this.debugMode);
        });
    }

    async initialize() {
        try {
            this.showLoading();

            // Initialize camera
            const videoDimensions = await this.camera.initialize();
            console.log('Camera initialized:', videoDimensions);

            // Set up canvas
            this.resizeCanvas();

            // Initialize face tracking
            await this.faceTracking.initialize();
            console.log('Face tracking initialized');

            // Set up face tracking callback
            this.faceTracking.onResults((results) => {
                this.currentFaces = results.faces;
            });

            // Initialize bubble manager
            this.bubbleManager = new BubbleManager(this.canvas.width, this.canvas.height);

            // Spawn initial bubbles
            for (let i = 0; i < 10; i++) {
                this.bubbleManager.spawnBubble();
            }

            // Hide loading and start game
            this.hideLoading();
            this.start();

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError(error.message);
        }
    }

    resizeCanvas() {
        // Match canvas to window size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Calculate video transform for object-fit: cover
        this.updateVideoTransform();

        if (this.bubbleManager) {
            this.bubbleManager.resize(this.canvas.width, this.canvas.height);
        }
    }

    updateVideoTransform() {
        const video = this.videoElement;
        if (!video.videoWidth || !video.videoHeight) return;

        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = this.canvas.width / this.canvas.height;

        let scale, offsetX, offsetY;

        if (canvasAspect > videoAspect) {
            // Canvas is wider - video is scaled to match width, cropped top/bottom
            scale = this.canvas.width / video.videoWidth;
            const scaledHeight = video.videoHeight * scale;
            offsetX = 0;
            offsetY = (this.canvas.height - scaledHeight) / 2;
        } else {
            // Canvas is taller - video is scaled to match height, cropped left/right
            scale = this.canvas.height / video.videoHeight;
            const scaledWidth = video.videoWidth * scale;
            offsetX = (this.canvas.width - scaledWidth) / 2;
            offsetY = 0;
        }

        this.videoTransform = { scale, offsetX, offsetY };
    }

    /**
     * Convert normalized video coordinates (0-1) to canvas coordinates
     * Accounts for object-fit: cover scaling and offset
     */
    videoToCanvas(normX, normY) {
        const video = this.videoElement;
        const t = this.videoTransform;

        return {
            x: normX * video.videoWidth * t.scale + t.offsetX,
            y: normY * video.videoHeight * t.scale + t.offsetY
        };
    }

    /**
     * Convert a normalized size to canvas pixels
     */
    videoSizeToCanvas(normSize) {
        const video = this.videoElement;
        return normSize * Math.max(video.videoWidth, video.videoHeight) * this.videoTransform.scale;
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
        this.trackingLoop();
    }

    stop() {
        this.isRunning = false;
        this.camera.stop();
    }

    async trackingLoop() {
        if (!this.isRunning) return;

        // Send current frame to face tracking
        await this.faceTracking.send(this.videoElement);

        // Continue tracking
        requestAnimationFrame(() => this.trackingLoop());
    }

    gameLoop() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        // Update bubbles
        this.bubbleManager.update(deltaTime);

        // Check collisions with faces (eating bubbles)
        if (this.currentFaces.length > 0) {
            const bubbles = this.bubbleManager.getBubbles();
            const collisions = this.collisionDetector.checkCollisions(
                this.currentFaces,
                bubbles,
                (x, y) => this.videoToCanvas(x, y),
                (s) => this.videoSizeToCanvas(s)
            );

            if (collisions.length > 0) {
                this.collisionDetector.applyCollisions(collisions);
                this.totalPopped += collisions.length;
                const now = performance.now();
                for (let i = 0; i < collisions.length; i++) {
                    this.popTimestamps.push(now);
                }
            }
        }
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw bubbles
        this.bubbleManager.draw(this.ctx);

        // Debug: Draw face tracking overlay
        if (this.debugMode) {
            this.drawDebugOverlay();
        }

        // Update score display
        this.updateScoreDisplay();
    }

    updateScoreDisplay() {
        this.scoreTotal.textContent = this.totalPopped + (this.totalPopped === 1 ? ' bubble' : ' bubbles');

        // Calculate rate from pops in the last 60 seconds
        const now = performance.now();
        const windowMs = 60000;
        while (this.popTimestamps.length > 0 && now - this.popTimestamps[0] > windowMs) {
            this.popTimestamps.shift();
        }
        const rate = this.popTimestamps.length; // pops in last 60s = pops/min
        this.scoreRate.textContent = rate.toFixed(1) + '/min';
    }

    drawDebugOverlay() {
        for (const face of this.currentFaces) {
            this.drawFaceDebug(face);
        }
    }

    drawFaceDebug(face) {
        const ctx = this.ctx;

        // Draw face mesh points in light blue
        ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
        for (let i = 0; i < face.landmarks.length; i++) {
            const landmark = face.landmarks[i];
            const pos = this.videoToCanvas(landmark.x, landmark.y);

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw mouth outline in orange
        const mouthOutline = this.faceTracking.getMouthOutline();
        ctx.beginPath();
        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 2;
        for (let i = 0; i < mouthOutline.length; i++) {
            const landmark = face.landmarks[mouthOutline[i]];
            const pos = this.videoToCanvas(landmark.x, landmark.y);
            if (i === 0) {
                ctx.moveTo(pos.x, pos.y);
            } else {
                ctx.lineTo(pos.x, pos.y);
            }
        }
        ctx.stroke();

        // Draw inner mouth in red/green based on open state
        const innerMouth = this.faceTracking.getInnerMouth();
        ctx.beginPath();
        ctx.strokeStyle = face.mouth.isOpen ? 'lime' : 'red';
        ctx.lineWidth = 3;
        for (let i = 0; i < innerMouth.length; i++) {
            const landmark = face.landmarks[innerMouth[i]];
            const pos = this.videoToCanvas(landmark.x, landmark.y);
            if (i === 0) {
                ctx.moveTo(pos.x, pos.y);
            } else {
                ctx.lineTo(pos.x, pos.y);
            }
        }
        ctx.stroke();

        // Draw mouth center and collision radius
        const mouthPos = this.videoToCanvas(face.mouth.center.x, face.mouth.center.y);
        const collisionRadius = this.videoSizeToCanvas(face.mouth.collisionRadius);

        // Collision zone circle
        ctx.beginPath();
        ctx.arc(mouthPos.x, mouthPos.y, collisionRadius, 0, Math.PI * 2);
        ctx.strokeStyle = face.mouth.isOpen ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Mouth center dot
        ctx.beginPath();
        ctx.arc(mouthPos.x, mouthPos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = face.mouth.isOpen ? 'lime' : 'red';
        ctx.fill();

        // Draw mouth status text
        ctx.fillStyle = 'white';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
            face.mouth.isOpen ? 'MOUTH OPEN' : 'mouth closed',
            mouthPos.x,
            mouthPos.y - collisionRadius - 10
        );
        ctx.fillText(
            `openness: ${(face.mouth.openness * 100).toFixed(1)}%`,
            mouthPos.x,
            mouthPos.y - collisionRadius - 28
        );
        ctx.textAlign = 'left';
    }

    showLoading() {
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    showError(message) {
        this.hideLoading();
        this.errorMessage.textContent = message;
        this.errorOverlay.classList.remove('hidden');
    }

    hideError() {
        this.errorOverlay.classList.add('hidden');
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.initialize();
});
