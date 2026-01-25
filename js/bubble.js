/**
 * Bubble class - handles individual bubble state, physics, and rendering
 */
class Bubble {
    constructor(x, y, radius, velocityX, velocityY) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.alive = true;
        this.popping = false;
        this.popProgress = 0;
        this.popParticles = [];

        // Visual properties for realistic bubble look
        this.hue = Math.random() * 360;
        this.saturation = 85 + Math.random() * 15; // 85-100% saturation for vibrancy
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
                hue: this.hue + (Math.random() - 0.5) * 40
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
            // Normal bubble with slight wobble
            const wobbleX = Math.sin(this.wobbleOffset) * 2;
            const wobbleY = Math.cos(this.wobbleOffset * 0.7) * 2;
            this.drawBubbleShape(ctx, this.x + wobbleX, this.y + wobbleY);
        }

        ctx.restore();
    }

    drawBubbleShape(ctx, x, y) {
        const r = this.radius;

        // Main bubble body - translucent with gradient (more vibrant)
        const gradient = ctx.createRadialGradient(
            x - r * 0.3, y - r * 0.3, 0,
            x, y, r
        );
        gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, 85%, 0.5)`);
        gradient.addColorStop(0.5, `hsla(${this.hue}, ${this.saturation - 5}%, 65%, 0.35)`);
        gradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation - 10}%, 50%, 0.2)`);

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Bubble outline (more vibrant)
        ctx.strokeStyle = `hsla(${this.hue}, ${this.saturation}%, 65%, 0.7)`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Highlight reflection (top-left)
        const highlightGradient = ctx.createRadialGradient(
            x - r * 0.4, y - r * 0.4, 0,
            x - r * 0.4, y - r * 0.4, r * 0.4
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = highlightGradient;
        ctx.fill();

        // Small secondary highlight
        ctx.beginPath();
        ctx.arc(x + r * 0.3, y + r * 0.2, r * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();

        // Rainbow sheen effect (more visible)
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

        this.bubbles.push(new Bubble(x, y, radius, velocityX, velocityY));
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
