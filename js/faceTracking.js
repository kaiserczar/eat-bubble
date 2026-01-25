/**
 * FaceTracking - Wraps MediaPipe Face Mesh for face detection
 * Tracks 468 facial landmarks including detailed mouth positions
 *
 * Key mouth landmarks used for "eating" detection:
 * - Upper lip: 13, 14, 312, 311, 82, 81
 * - Lower lip: 17, 15, 316, 402, 87, 14
 * - Mouth center: ~13 (upper), ~14 (lower)
 */
class FaceTracking {
    constructor() {
        this.faceMesh = null;
        this.results = null;
        this.isReady = false;
        this.onResultsCallback = null;

        // Smoothing settings
        this.smoothingFactor = 0.5;
        this.persistenceFrames = 8;
        this.previousFaces = [];
        this.lastSeenTime = 0;

        // Key landmark indices
        this.LANDMARKS = {
            // Mouth corners and key points
            MOUTH_LEFT: 61,
            MOUTH_RIGHT: 291,
            UPPER_LIP_TOP: 13,
            LOWER_LIP_BOTTOM: 14,
            UPPER_LIP_CENTER: 0,
            LOWER_LIP_CENTER: 17,

            // For mouth openness calculation
            UPPER_INNER_LIP: 13,
            LOWER_INNER_LIP: 14,

            // Face outline for debug
            NOSE_TIP: 4,
            FOREHEAD: 10,
            CHIN: 152,
            LEFT_CHEEK: 234,
            RIGHT_CHEEK: 454,

            // Eyes for expression
            LEFT_EYE_CENTER: 159,
            RIGHT_EYE_CENTER: 386
        };

        // Mouth outline indices for drawing
        this.MOUTH_OUTLINE = [
            61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
            409, 270, 269, 267, 0, 37, 39, 40, 185, 61
        ];

        // Inner mouth (for open detection)
        this.INNER_MOUTH = [
            78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
            415, 310, 311, 312, 13, 82, 81, 80, 191, 78
        ];
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                this.faceMesh = new FaceMesh({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                    }
                });

                this.faceMesh.setOptions({
                    maxNumFaces: 4,
                    refineLandmarks: true, // Better lip tracking
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.3
                });

                this.faceMesh.onResults((results) => {
                    this.results = results;
                    if (this.onResultsCallback) {
                        this.onResultsCallback(this.processResults(results));
                    }
                });

                this.faceMesh.initialize().then(() => {
                    this.isReady = true;
                    resolve();
                }).catch(reject);

            } catch (error) {
                reject(error);
            }
        });
    }

    processResults(results) {
        const currentTime = performance.now();

        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            // Check persistence
            if (this.previousFaces.length > 0) {
                const framesSinceSeen = (currentTime - this.lastSeenTime) / 16.67;
                if (framesSinceSeen < this.persistenceFrames) {
                    return {
                        faces: this.previousFaces.map(face => ({
                            ...face,
                            isPersisted: true,
                            confidence: 1 - (framesSinceSeen / this.persistenceFrames)
                        }))
                    };
                } else {
                    this.previousFaces = [];
                }
            }
            return { faces: [] };
        }

        const processedFaces = results.multiFaceLandmarks.map((landmarks, index) => {
            // Get previous face for smoothing (match by approximate position)
            const faceCenter = landmarks[this.LANDMARKS.NOSE_TIP];
            const prevFace = this.findPreviousFace(faceCenter);

            // Smooth landmarks
            const smoothedLandmarks = prevFace
                ? this.smoothLandmarks(landmarks, prevFace.landmarks)
                : landmarks;

            // Calculate mouth metrics
            const mouthData = this.calculateMouthData(smoothedLandmarks);

            // Calculate face bounds for debug
            const bounds = this.calculateFaceBounds(smoothedLandmarks);

            return {
                landmarks: smoothedLandmarks,
                mouth: mouthData,
                bounds: bounds,
                center: {
                    x: smoothedLandmarks[this.LANDMARKS.NOSE_TIP].x,
                    y: smoothedLandmarks[this.LANDMARKS.NOSE_TIP].y
                },
                isPersisted: false,
                confidence: 1
            };
        });

        this.previousFaces = processedFaces;
        this.lastSeenTime = currentTime;

        return { faces: processedFaces };
    }

    findPreviousFace(currentCenter) {
        if (this.previousFaces.length === 0) return null;

        let closest = null;
        let closestDist = Infinity;

        for (const face of this.previousFaces) {
            const dx = face.center.x - currentCenter.x;
            const dy = face.center.y - currentCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < closestDist && dist < 0.2) { // Max 20% screen distance
                closestDist = dist;
                closest = face;
            }
        }

        return closest;
    }

    calculateMouthData(landmarks) {
        // Get key mouth points
        const upperLip = landmarks[this.LANDMARKS.UPPER_INNER_LIP];
        const lowerLip = landmarks[this.LANDMARKS.LOWER_INNER_LIP];
        const leftCorner = landmarks[this.LANDMARKS.MOUTH_LEFT];
        const rightCorner = landmarks[this.LANDMARKS.MOUTH_RIGHT];

        // Calculate outer mouth bounds from outline landmarks
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const idx of this.MOUTH_OUTLINE) {
            const point = landmarks[idx];
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }

        // Outer mouth dimensions
        const outerWidth = maxX - minX;
        const outerHeight = maxY - minY;

        // Mouth center (center of outer mouth bounds)
        const center = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: (upperLip.z + lowerLip.z) / 2
        };

        // Inner mouth dimensions (for openness calculation)
        const innerWidth = Math.abs(rightCorner.x - leftCorner.x);
        const innerHeight = Math.abs(lowerLip.y - upperLip.y);

        // Openness ratio (height / width) - higher means more open
        const openness = innerHeight / (innerWidth || 0.001);

        // Is mouth open enough to "eat"? (threshold tuned for natural eating motion)
        const isOpen = openness > 0.15;

        // Collision radius = half of outer mouth width (stable regardless of mouth openness)
        const collisionRadius = outerWidth / 2;

        return {
            center: center,
            upperLip: upperLip,
            lowerLip: lowerLip,
            leftCorner: leftCorner,
            rightCorner: rightCorner,
            outerWidth: outerWidth,
            outerHeight: outerHeight,
            innerWidth: innerWidth,
            innerHeight: innerHeight,
            openness: openness,
            isOpen: isOpen,
            collisionRadius: collisionRadius
        };
    }

    calculateFaceBounds(landmarks) {
        let minX = 1, maxX = 0, minY = 1, maxY = 0;

        for (const landmark of landmarks) {
            minX = Math.min(minX, landmark.x);
            maxX = Math.max(maxX, landmark.x);
            minY = Math.min(minY, landmark.y);
            maxY = Math.max(maxY, landmark.y);
        }

        return { minX, maxX, minY, maxY };
    }

    smoothLandmarks(current, previous) {
        const factor = this.smoothingFactor;
        return current.map((landmark, i) => ({
            x: previous[i].x + (landmark.x - previous[i].x) * factor,
            y: previous[i].y + (landmark.y - previous[i].y) * factor,
            z: previous[i].z + (landmark.z - previous[i].z) * factor
        }));
    }

    async send(image) {
        if (this.faceMesh && this.isReady) {
            await this.faceMesh.send({ image });
        }
    }

    onResults(callback) {
        this.onResultsCallback = callback;
    }

    getResults() {
        return this.results;
    }

    getMouthOutline() {
        return this.MOUTH_OUTLINE;
    }

    getInnerMouth() {
        return this.INNER_MOUTH;
    }
}
