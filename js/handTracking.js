/**
 * HandTracking - Wraps MediaPipe Hands for hand detection
 * Supports up to 4 hands (2 players)
 *
 * MediaPipe Hands provides 21 landmarks per hand:
 * 0: Wrist
 * 1-4: Thumb (CMC, MCP, IP, TIP)
 * 5-8: Index finger (MCP, PIP, DIP, TIP)
 * 9-12: Middle finger (MCP, PIP, DIP, TIP)
 * 13-16: Ring finger (MCP, PIP, DIP, TIP)
 * 17-20: Pinky (MCP, PIP, DIP, TIP)
 *
 * This structure enables future gesture detection (flat vs pointed hand)
 */
class HandTracking {
    constructor() {
        this.hands = null;
        this.results = null;
        this.isReady = false;
        this.onResultsCallback = null;

        // Smoothing and persistence settings
        this.smoothingFactor = 0.4; // Lower = smoother but more lag, higher = responsive but jittery
        this.persistenceFrames = 8; // Keep hand visible for N frames after losing tracking
        this.previousHands = new Map(); // Track hands across frames by handedness
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                this.hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                this.hands.setOptions({
                    maxNumHands: 4,
                    modelComplexity: 0, // Faster processing (0=lite, 1=full)
                    minDetectionConfidence: 0.5, // Lower to catch smaller/distant hands
                    minTrackingConfidence: 0.3 // Lower to maintain tracking
                });

                this.hands.onResults((results) => {
                    this.results = results;
                    if (this.onResultsCallback) {
                        this.onResultsCallback(this.processResults(results));
                    }
                });

                // Initialize the model
                this.hands.initialize().then(() => {
                    this.isReady = true;
                    resolve();
                }).catch(reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Process MediaPipe results into a more usable format
     */
    processResults(results) {
        const currentTime = performance.now();
        const detectedHandKeys = new Set();

        let processedHands = [];

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            processedHands = results.multiHandLandmarks.map((landmarks, index) => {
                const handedness = results.multiHandedness[index];
                // Create unique key for this hand (handedness + approximate position)
                const palmX = landmarks[0].x;
                const handKey = `${handedness.label}_${palmX < 0.5 ? 'L' : 'R'}`;
                detectedHandKeys.add(handKey);

                // Get previous hand data for smoothing
                const prevHand = this.previousHands.get(handKey);

                // Smooth landmarks if we have previous data
                const smoothedLandmarks = prevHand
                    ? this.smoothLandmarks(landmarks, prevHand.landmarks)
                    : landmarks;

                // Get key points for collision detection
                const fingertips = [
                    smoothedLandmarks[4],   // Thumb tip
                    smoothedLandmarks[8],   // Index tip
                    smoothedLandmarks[12],  // Middle tip
                    smoothedLandmarks[16],  // Ring tip
                    smoothedLandmarks[20]   // Pinky tip
                ];

                // Calculate palm center (average of wrist and finger bases)
                const palmPoints = [
                    smoothedLandmarks[0], smoothedLandmarks[5], smoothedLandmarks[9],
                    smoothedLandmarks[13], smoothedLandmarks[17]
                ];
                const palmCenter = {
                    x: palmPoints.reduce((sum, p) => sum + p.x, 0) / palmPoints.length,
                    y: palmPoints.reduce((sum, p) => sum + p.y, 0) / palmPoints.length,
                    z: palmPoints.reduce((sum, p) => sum + p.z, 0) / palmPoints.length
                };

                // Calculate hand gesture type for future use
                const gestureInfo = this.analyzeGesture(smoothedLandmarks);

                const handData = {
                    landmarks: smoothedLandmarks,
                    handedness: handedness.label,
                    confidence: handedness.score,
                    fingertips: fingertips,
                    palmCenter: palmCenter,
                    gesture: gestureInfo,
                    collisionPoints: [...fingertips, palmCenter],
                    lastSeen: currentTime,
                    handKey: handKey
                };

                // Store for next frame
                this.previousHands.set(handKey, handData);

                return handData;
            });
        }

        // Add persisted hands that weren't detected this frame
        for (const [handKey, prevHand] of this.previousHands) {
            if (!detectedHandKeys.has(handKey)) {
                const framesSinceSeen = (currentTime - prevHand.lastSeen) / 16.67; // Assume ~60fps
                if (framesSinceSeen < this.persistenceFrames) {
                    // Fade out confidence as hand persists
                    const fadeMultiplier = 1 - (framesSinceSeen / this.persistenceFrames);
                    processedHands.push({
                        ...prevHand,
                        confidence: prevHand.confidence * fadeMultiplier,
                        isPersisted: true
                    });
                } else {
                    // Hand has been gone too long, remove it
                    this.previousHands.delete(handKey);
                }
            }
        }

        return { hands: processedHands };
    }

    /**
     * Smooth landmarks using exponential moving average
     */
    smoothLandmarks(current, previous) {
        const factor = this.smoothingFactor;
        return current.map((landmark, i) => ({
            x: previous[i].x + (landmark.x - previous[i].x) * factor,
            y: previous[i].y + (landmark.y - previous[i].y) * factor,
            z: previous[i].z + (landmark.z - previous[i].z) * factor
        }));
    }

    /**
     * Analyze hand gesture - preparation for flat hand vs pointed hand detection
     *
     * Flat hand: Fingers extended and spread
     * Pointed hand: Fingers together, pointing in one direction
     *
     * @param {Array} landmarks - 21 hand landmarks
     * @returns {Object} Gesture information
     */
    analyzeGesture(landmarks) {
        // Calculate finger extension (how straight each finger is)
        const fingerExtensions = this.calculateFingerExtensions(landmarks);

        // Calculate finger spread (angle between adjacent fingers)
        const fingerSpread = this.calculateFingerSpread(landmarks);

        // Determine if hand is flat or pointed
        const avgExtension = fingerExtensions.reduce((a, b) => a + b, 0) / fingerExtensions.length;
        const avgSpread = fingerSpread.reduce((a, b) => a + b, 0) / fingerSpread.length;

        // Thresholds (can be tuned later)
        const isExtended = avgExtension > 0.7;
        const isSpread = avgSpread > 15; // degrees

        let gestureType = 'unknown';
        if (isExtended && isSpread) {
            gestureType = 'flat'; // Open palm, fingers spread
        } else if (isExtended && !isSpread) {
            gestureType = 'pointed'; // Fingers together, pointing
        } else {
            gestureType = 'other'; // Fist, partial closure, etc.
        }

        return {
            type: gestureType,
            fingerExtensions: fingerExtensions,
            fingerSpread: fingerSpread,
            avgExtension: avgExtension,
            avgSpread: avgSpread
        };
    }

    /**
     * Calculate how extended each finger is (0 = fully bent, 1 = fully straight)
     */
    calculateFingerExtensions(landmarks) {
        const fingers = [
            [1, 2, 3, 4],     // Thumb
            [5, 6, 7, 8],     // Index
            [9, 10, 11, 12],  // Middle
            [13, 14, 15, 16], // Ring
            [17, 18, 19, 20]  // Pinky
        ];

        return fingers.map(fingerIndices => {
            // Calculate the straightness using the angle at the middle joint
            const base = landmarks[fingerIndices[0]];
            const mid = landmarks[fingerIndices[2]];
            const tip = landmarks[fingerIndices[3]];

            // Vector from base to mid
            const v1 = {
                x: mid.x - base.x,
                y: mid.y - base.y,
                z: mid.z - base.z
            };

            // Vector from mid to tip
            const v2 = {
                x: tip.x - mid.x,
                y: tip.y - mid.y,
                z: tip.z - mid.z
            };

            // Calculate angle between vectors (dot product)
            const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
            const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

            if (mag1 === 0 || mag2 === 0) return 0;

            const cosAngle = dot / (mag1 * mag2);
            // Convert to extension value (1 = straight, 0 = bent 90 degrees)
            return Math.max(0, Math.min(1, (cosAngle + 1) / 2));
        });
    }

    /**
     * Calculate spread angle between adjacent fingers (in degrees)
     */
    calculateFingerSpread(landmarks) {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerBases = [2, 5, 9, 13, 17];
        const spreads = [];

        for (let i = 0; i < fingerTips.length - 1; i++) {
            const base1 = landmarks[fingerBases[i]];
            const tip1 = landmarks[fingerTips[i]];
            const base2 = landmarks[fingerBases[i + 1]];
            const tip2 = landmarks[fingerTips[i + 1]];

            // Direction vectors for each finger
            const dir1 = {
                x: tip1.x - base1.x,
                y: tip1.y - base1.y
            };
            const dir2 = {
                x: tip2.x - base2.x,
                y: tip2.y - base2.y
            };

            // Angle between fingers
            const dot = dir1.x * dir2.x + dir1.y * dir2.y;
            const mag1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
            const mag2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);

            if (mag1 === 0 || mag2 === 0) {
                spreads.push(0);
                continue;
            }

            const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
            const angle = Math.acos(cosAngle) * (180 / Math.PI);
            spreads.push(angle);
        }

        return spreads;
    }

    async send(image) {
        if (this.hands && this.isReady) {
            await this.hands.send({ image });
        }
    }

    onResults(callback) {
        this.onResultsCallback = callback;
    }

    getResults() {
        return this.results;
    }
}
