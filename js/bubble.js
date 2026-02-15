/**
 * Bubble class - handles individual bubble state, physics, and rendering
 */
class Bubble {
    constructor(x, y, radius, velocityX, velocityY, type = 'normal') {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.type = type;
        this.alive = true;
        this.popping = false;
        this.popProgress = 0;
        this.popParticles = [];

        // Visual properties
        if (this.type === 'poison') {
            this.hue = 90 + Math.random() * 30; // Sickly green (90-120)
            this.saturation = 70 + Math.random() * 20;
            this.trailParticles = [];
            this.trailSpawnTimer = 0;
        } else {
            this.hue = Math.random() * 360;
            this.saturation = 85 + Math.random() * 15; // 85-100% saturation for vibrancy
        }
        this.wobbleOffset = Math.random() * Math.PI * 2;
        this.wobbleSpeed = 0.02 + Math.random() * 0.02;
    }

    update(deltaTime, canvasWidth, canvasHeight) {
        if (this.popping) {
            this.popProgress += deltaTime * 0.004;

            // Update particles
            for (const particle of this.popParticles) {
                particle.x += particle.vx * deltaTime;
                particle.y += particle.vy * deltaTime;
                particle.vy += 0.0005 * deltaTime; // Gravity
                particle.life -= deltaTime * 0.003;
                particle.scale *= 0.98;
            }

            if (this.popProgress >= 1) {
                this.alive = false;
            }
            return;
        }

        // Update position
        this.x += this.velocityX * deltaTime;
        this.y += this.velocityY * deltaTime;

        // Update wobble
        this.wobbleOffset += this.wobbleSpeed * deltaTime;

        // Update poison gas trail
        if (this.type === 'poison') {
            this.trailSpawnTimer -= deltaTime;
            if (this.trailSpawnTimer <= 0) {
                this.trailSpawnTimer = 60 + Math.random() * 40; // Spawn every 60-100ms
                this.trailParticles.push({
                    x: this.x + (Math.random() - 0.5) * this.radius * 0.8,
                    y: this.y + (Math.random() - 0.5) * this.radius * 0.8,
                    vx: (Math.random() - 0.5) * 0.02,
                    vy: -0.01 - Math.random() * 0.02, // Drift upward
                    size: 2 + Math.random() * 3,
                    life: 1,
                    hue: 90 + Math.random() * 40
                });
            }
            for (const p of this.trailParticles) {
                p.x += p.vx * deltaTime;
                p.y += p.vy * deltaTime;
                p.life -= deltaTime * 0.002;
                p.size *= 0.999;
            }
            this.trailParticles = this.trailParticles.filter(p => p.life > 0);
        }

        // Remove if completely off screen (with buffer)
        const buffer = this.radius * 2;
        if (this.x < -buffer || this.x > canvasWidth + buffer ||
            this.y < -buffer || this.y > canvasHeight + buffer) {
            this.alive = false;
        }
    }

    pop() {
        if (!this.popping) {
            this.popping = true;
            this.popProgress = 0;
            this.createPopParticles();
        }
    }

    createPopParticles() {
        const particleCount = 12 + Math.floor(Math.random() * 8);
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
            const speed = 0.1 + Math.random() * 0.15;
            const size = 3 + Math.random() * 6;

            this.popParticles.push({
                x: this.x + Math.cos(angle) * this.radius * 0.5,
                y: this.y + Math.sin(angle) * this.radius * 0.5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: size,
                life: 1,
                scale: 1,
                hue: this.type === 'poison'
                    ? 90 + Math.random() * 40  // Green range for poison
                    : this.hue + (Math.random() - 0.5) * 40
            });
        }
    }

    /**
     * Future: Apply bounce force from a flat hand
     * @param {number} forceX - X component of bounce force
     * @param {number} forceY - Y component of bounce force
     */
    bounce(forceX, forceY) {
        this.velocityX += forceX;
        this.velocityY += forceY;
    }

    draw(ctx) {
        ctx.save();

        if (this.popping) {
            // Draw expanding ring
            const ringScale = 1 + this.popProgress * 1.5;
            const ringAlpha = (1 - this.popProgress) * 0.6;

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * ringScale, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${this.hue}, ${this.saturation}%, 70%, ${ringAlpha})`;
            ctx.lineWidth = 3 * (1 - this.popProgress);
            ctx.stroke();

            // Draw secondary ring
            const ring2Scale = 1 + this.popProgress * 0.8;
            const ring2Alpha = (1 - this.popProgress) * 0.4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * ring2Scale, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${this.hue + 30}, ${this.saturation}%, 80%, ${ring2Alpha})`;
            ctx.lineWidth = 2 * (1 - this.popProgress);
            ctx.stroke();

            // Draw flash
            if (this.popProgress < 0.3) {
                const flashAlpha = (0.3 - this.popProgress) * 2;
                const flashGradient = ctx.createRadialGradient(
                    this.x, this.y, 0,
                    this.x, this.y, this.radius * (1 + this.popProgress)
                );
                flashGradient.addColorStop(0, `hsla(${this.hue}, 100%, 90%, ${flashAlpha * 0.8})`);
                flashGradient.addColorStop(1, `hsla(${this.hue}, 100%, 70%, 0)`);
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * (1 + this.popProgress), 0, Math.PI * 2);
                ctx.fillStyle = flashGradient;
                ctx.fill();
            }

            // Draw particles
            for (const particle of this.popParticles) {
                if (particle.life > 0) {
                    const particleAlpha = particle.life * 0.9;
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, particle.size * particle.scale, 0, Math.PI * 2);

                    const particleGradient = ctx.createRadialGradient(
                        particle.x, particle.y, 0,
                        particle.x, particle.y, particle.size * particle.scale
                    );
                    particleGradient.addColorStop(0, `hsla(${particle.hue}, 90%, 80%, ${particleAlpha})`);
                    particleGradient.addColorStop(0.5, `hsla(${particle.hue}, 85%, 60%, ${particleAlpha * 0.6})`);
                    particleGradient.addColorStop(1, `hsla(${particle.hue}, 80%, 50%, 0)`);

                    ctx.fillStyle = particleGradient;
                    ctx.fill();
                }
            }
        } else {
            // Draw poison gas trail behind bubble
            if (this.type === 'poison' && this.trailParticles) {
                for (const p of this.trailParticles) {
                    const alpha = p.life * 0.4;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${p.hue}, 60%, 50%, ${alpha})`;
                    ctx.fill();
                }
            }

            // Normal bubble with slight wobble
            const wobbleX = Math.sin(this.wobbleOffset) * 2;
            const wobbleY = Math.cos(this.wobbleOffset * 0.7) * 2;
            this.drawBubbleShape(ctx, this.x + wobbleX, this.y + wobbleY);
        }

        ctx.restore();
    }

    drawBubbleShape(ctx, x, y) {
        const r = this.radius;
        const isPoison = this.type === 'poison';

        // Opacity: poison bubbles are more opaque
        const baseAlpha = isPoison ? 0.65 : 0.5;
        const midAlpha = isPoison ? 0.5 : 0.35;
        const edgeAlpha = isPoison ? 0.35 : 0.2;

        // Main bubble body - translucent with gradient
        const gradient = ctx.createRadialGradient(
            x - r * 0.3, y - r * 0.3, 0,
            x, y, r
        );
        gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, 85%, ${baseAlpha})`);
        gradient.addColorStop(0.5, `hsla(${this.hue}, ${this.saturation - 5}%, 65%, ${midAlpha})`);
        gradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation - 10}%, 50%, ${edgeAlpha})`);

        if (isPoison) {
            // Wavy, distorted edge path for poison bubbles
            const segments = 60;
            const distortAmount = r * 0.06;
            ctx.beginPath();
            for (let i = 0; i <= segments; i++) {
                const angle = (Math.PI * 2 * i) / segments;
                const distort = Math.sin(angle * 9 + this.wobbleOffset * 1.2) * distortAmount
                              + Math.sin(angle * 6 - this.wobbleOffset * 0.8) * distortAmount * 0.6;
                const pr = r + distort;
                const px = x + Math.cos(angle) * pr;
                const py = y + Math.sin(angle) * pr;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        } else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
        }

        ctx.fillStyle = gradient;
        ctx.fill();

        // Bubble outline
        ctx.strokeStyle = `hsla(${this.hue}, ${this.saturation}%, 65%, 0.7)`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Highlight reflection (top-left)
        const highlightGradient = ctx.createRadialGradient(
            x - r * 0.4, y - r * 0.4, 0,
            x - r * 0.4, y - r * 0.4, r * 0.4
        );
        if (isPoison) {
            highlightGradient.addColorStop(0, 'rgba(200, 255, 200, 0.5)');
            highlightGradient.addColorStop(1, 'rgba(200, 255, 200, 0)');
        } else {
            highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = highlightGradient;
        ctx.fill();

        // Small secondary highlight
        ctx.beginPath();
        ctx.arc(x + r * 0.3, y + r * 0.2, r * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = isPoison ? 'rgba(200, 255, 200, 0.3)' : 'rgba(255, 255, 255, 0.4)';
        ctx.fill();

        // Rainbow sheen effect (normal bubbles only)
        if (!isPoison) {
            const sheenGradient = ctx.createLinearGradient(
                x - r, y - r, x + r, y + r
            );
            sheenGradient.addColorStop(0, 'rgba(255, 0, 0, 0.1)');
            sheenGradient.addColorStop(0.2, 'rgba(255, 165, 0, 0.1)');
            sheenGradient.addColorStop(0.4, 'rgba(255, 255, 0, 0.1)');
            sheenGradient.addColorStop(0.6, 'rgba(0, 255, 0, 0.1)');
            sheenGradient.addColorStop(0.8, 'rgba(0, 0, 255, 0.1)');
            sheenGradient.addColorStop(1, 'rgba(128, 0, 128, 0.1)');

            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = sheenGradient;
            ctx.fill();
        }
    }
}

/**
 * BubbleManager - handles spawning and managing multiple bubbles
 */
class BubbleManager {
    constructor(canvasWidth, canvasHeight) {
        this.bubbles = [];
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.targetBubbleCount = 20;
        this.minRadius = 30;
        this.maxRadius = 60;
        this.minSpeed = 0.06;
        this.maxSpeed = 0.18;
        this.spawnCooldown = 0;
        this.spawnDelay = 500; // ms between spawns
    }

    resize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
    }

    spawnBubble() {
        // Choose a random edge to spawn from
        const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
        const radius = this.minRadius + Math.random() * (this.maxRadius - this.minRadius);
        const speed = this.minSpeed + Math.random() * (this.maxSpeed - this.minSpeed);

        let x, y, velocityX, velocityY;

        switch (edge) {
            case 0: // Top
                x = Math.random() * this.canvasWidth;
                y = -radius;
                velocityX = (Math.random() - 0.5) * speed;
                velocityY = speed * (0.5 + Math.random() * 0.5);
                break;
            case 1: // Right
                x = this.canvasWidth + radius;
                y = Math.random() * this.canvasHeight;
                velocityX = -speed * (0.5 + Math.random() * 0.5);
                velocityY = (Math.random() - 0.5) * speed;
                break;
            case 2: // Bottom
                x = Math.random() * this.canvasWidth;
                y = this.canvasHeight + radius;
                velocityX = (Math.random() - 0.5) * speed;
                velocityY = -speed * (0.5 + Math.random() * 0.5);
                break;
            case 3: // Left
                x = -radius;
                y = Math.random() * this.canvasHeight;
                velocityX = speed * (0.5 + Math.random() * 0.5);
                velocityY = (Math.random() - 0.5) * speed;
                break;
        }

        const type = Math.random() < 0.125 ? 'poison' : 'normal';
        this.bubbles.push(new Bubble(x, y, radius, velocityX, velocityY, type));
    }

    update(deltaTime) {
        // Update spawn cooldown
        this.spawnCooldown -= deltaTime;

        // Spawn new bubbles if needed
        if (this.bubbles.length < this.targetBubbleCount && this.spawnCooldown <= 0) {
            this.spawnBubble();
            this.spawnCooldown = this.spawnDelay;
        }

        // Update all bubbles
        for (const bubble of this.bubbles) {
            bubble.update(deltaTime, this.canvasWidth, this.canvasHeight);
        }

        // Remove dead bubbles
        this.bubbles = this.bubbles.filter(b => b.alive);
    }

    draw(ctx) {
        for (const bubble of this.bubbles) {
            bubble.draw(ctx);
        }
    }

    getBubbles() {
        return this.bubbles.filter(b => !b.popping);
    }
}
