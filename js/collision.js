/**
 * CollisionDetector - Handles collision detection between mouths and bubbles
 *
 * Bubbles are "eaten" when they overlap with an open mouth
 */
class CollisionDetector {
    constructor() {
        // Minimum mouth openness required to eat bubbles (0-1 scale)
        this.minMouthOpenness = 0.12;
    }

    /**
     * Check collisions between faces (mouths) and bubbles
     *
     * @param {Array} faces - Processed face data from FaceTracking
     * @param {Array} bubbles - Array of Bubble objects
     * @param {Function} coordConverter - Function to convert normalized coords to canvas coords
     * @param {Function} sizeConverter - Function to convert normalized size to canvas pixels
     * @returns {Array} Array of collision events
     */
    checkCollisions(faces, bubbles, coordConverter, sizeConverter) {
        const collisions = [];

        for (const face of faces) {
            const mouth = face.mouth;

            // Only detect eating when mouth is open
            if (!mouth.isOpen && mouth.openness < this.minMouthOpenness) {
                continue;
            }

            // Convert mouth center to canvas coordinates
            const mouthPos = coordConverter(mouth.center.x, mouth.center.y);

            // Mouth collision radius based on outer mouth size
            const mouthRadius = sizeConverter(mouth.collisionRadius);

            for (const bubble of bubbles) {
                if (bubble.popping) continue;

                // Circle-circle collision detection
                const dx = mouthPos.x - bubble.x;
                const dy = mouthPos.y - bubble.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const collisionDistance = mouthRadius + bubble.radius * 0.5; // Bubble needs to be mostly inside

                if (distance < collisionDistance) {
                    collisions.push({
                        bubble: bubble,
                        bubbleType: bubble.type,
                        face: face,
                        mouthCenter: mouthPos,
                        mouthOpenness: mouth.openness,
                        action: 'eat'
                    });
                }
            }
        }

        return collisions;
    }

    /**
     * Apply collision effects (eat the bubbles!)
     *
     * @param {Array} collisions - Array of collision events from checkCollisions
     */
    applyCollisions(collisions) {
        for (const collision of collisions) {
            collision.bubble.pop();
        }
    }
}
