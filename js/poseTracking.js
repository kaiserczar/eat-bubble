/**
 * PoseTracking - Wraps MediaPipe Pose for full body detection
 * Supports up to 2 people
 *
 * MediaPipe Pose provides 33 landmarks per person:
 * 0: Nose
 * 1-4: Left/Right eye inner, outer
 * 5-6: Left/Right ear
 * 7-8: Mouth left/right
 * 9-10: Left/Right shoulder
 * 11-12: Left/Right elbow
 * 13-14: Left/Right wrist
 * 15-18: Left/Right pinky, index (hand)
 * 19-20: Left/Right thumb
 * 21-22: Left/Right hip
 * 23-24: Left/Right knee
 * 25-26: Left/Right ankle
 * 27-28: Left/Right heel
 * 29-30: Left/Right foot index
 *
 * Perfect for drawing stick figures!
 */
class PoseTracking {
    constructor() {
        this.pose = null;
        this.results = null;
        this.isReady = false;
        this.onResultsCallback = null;

        // Smoothing settings
        this.smoothingFactor = 0.4;
        this.persistenceFrames = 10;
        this.previousPose = null;
        this.lastSeenTime = 0;

        // Landmark indices for easy reference
        this.LANDMARKS = {
            NOSE: 0,
            LEFT_EYE_INNER: 1,
            LEFT_EYE: 2,
            LEFT_EYE_OUTER: 3,
            RIGHT_EYE_INNER: 4,
            RIGHT_EYE: 5,
            RIGHT_EYE_OUTER: 6,
            LEFT_EAR: 7,
            RIGHT_EAR: 8,
            MOUTH_LEFT: 9,
            MOUTH_RIGHT: 10,
            LEFT_SHOULDER: 11,
            RIGHT_SHOULDER: 12,
            LEFT_ELBOW: 13,
            RIGHT_ELBOW: 14,
            LEFT_WRIST: 15,
            RIGHT_WRIST: 16,
            LEFT_PINKY: 17,
            RIGHT_PINKY: 18,
            LEFT_INDEX: 19,
            RIGHT_INDEX: 20,
            LEFT_THUMB: 21,
            RIGHT_THUMB: 22,
            LEFT_HIP: 23,
            RIGHT_HIP: 24,
            LEFT_KNEE: 25,
            RIGHT_KNEE: 26,
            LEFT_ANKLE: 27,
            RIGHT_ANKLE: 28,
            LEFT_HEEL: 29,
            RIGHT_HEEL: 30,
            LEFT_FOOT_INDEX: 31,
            RIGHT_FOOT_INDEX: 32
        };

        // Connections for drawing stick figure
        this.CONNECTIONS = [
            // Face
            [this.LANDMARKS.LEFT_EAR, this.LANDMARKS.LEFT_EYE],
            [this.LANDMARKS.LEFT_EYE, this.LANDMARKS.NOSE],
            [this.LANDMARKS.NOSE, this.LANDMARKS.RIGHT_EYE],
            [this.LANDMARKS.RIGHT_EYE, this.LANDMARKS.RIGHT_EAR],
            // Torso
            [this.LANDMARKS.LEFT_SHOULDER, this.LANDMARKS.RIGHT_SHOULDER],
            [this.LANDMARKS.LEFT_SHOULDER, this.LANDMARKS.LEFT_HIP],
            [this.LANDMARKS.RIGHT_SHOULDER, this.LANDMARKS.RIGHT_HIP],
            [this.LANDMARKS.LEFT_HIP, this.LANDMARKS.RIGHT_HIP],
            // Left arm
            [this.LANDMARKS.LEFT_SHOULDER, this.LANDMARKS.LEFT_ELBOW],
            [this.LANDMARKS.LEFT_ELBOW, this.LANDMARKS.LEFT_WRIST],
            // Right arm
            [this.LANDMARKS.RIGHT_SHOULDER, this.LANDMARKS.RIGHT_ELBOW],
            [this.LANDMARKS.RIGHT_ELBOW, this.LANDMARKS.RIGHT_WRIST],
            // Left leg
            [this.LANDMARKS.LEFT_HIP, this.LANDMARKS.LEFT_KNEE],
            [this.LANDMARKS.LEFT_KNEE, this.LANDMARKS.LEFT_ANKLE],
            // Right leg
            [this.LANDMARKS.RIGHT_HIP, this.LANDMARKS.RIGHT_KNEE],
            [this.LANDMARKS.RIGHT_KNEE, this.LANDMARKS.RIGHT_ANKLE]
        ];
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                this.pose = new Pose({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                    }
                });

                this.pose.setOptions({
                    modelComplexity: 0, // 0=lite, 1=full, 2=heavy
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.3
                });

                this.pose.onResults((results) => {
                    this.results = results;
                    if (this.onResultsCallback) {
                        this.onResultsCallback(this.processResults(results));
                    }
                });

                this.pose.initialize().then(() => {
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

        if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
            // Check persistence
            if (this.previousPose) {
                const framesSinceSeen = (currentTime - this.lastSeenTime) / 16.67;
                if (framesSinceSeen < this.persistenceFrames) {
                    return {
                        pose: this.previousPose,
                        isPersisted: true,
                        confidence: 1 - (framesSinceSeen / this.persistenceFrames)
                    };
                } else {
                    this.previousPose = null;
                }
            }
            return { pose: null };
        }

        // Smooth landmarks
        const smoothedLandmarks = this.previousPose
            ? this.smoothLandmarks(results.poseLandmarks, this.previousPose.landmarks)
            : results.poseLandmarks;

        const poseData = {
            landmarks: smoothedLandmarks,
            worldLandmarks: results.poseWorldLandmarks || null,
            connections: this.CONNECTIONS,
            // Key body points for easy access
            keyPoints: {
                head: smoothedLandmarks[this.LANDMARKS.NOSE],
                leftShoulder: smoothedLandmarks[this.LANDMARKS.LEFT_SHOULDER],
                rightShoulder: smoothedLandmarks[this.LANDMARKS.RIGHT_SHOULDER],
                leftElbow: smoothedLandmarks[this.LANDMARKS.LEFT_ELBOW],
                rightElbow: smoothedLandmarks[this.LANDMARKS.RIGHT_ELBOW],
                leftWrist: smoothedLandmarks[this.LANDMARKS.LEFT_WRIST],
                rightWrist: smoothedLandmarks[this.LANDMARKS.RIGHT_WRIST],
                leftHip: smoothedLandmarks[this.LANDMARKS.LEFT_HIP],
                rightHip: smoothedLandmarks[this.LANDMARKS.RIGHT_HIP],
                leftKnee: smoothedLandmarks[this.LANDMARKS.LEFT_KNEE],
                rightKnee: smoothedLandmarks[this.LANDMARKS.RIGHT_KNEE],
                leftAnkle: smoothedLandmarks[this.LANDMARKS.LEFT_ANKLE],
                rightAnkle: smoothedLandmarks[this.LANDMARKS.RIGHT_ANKLE]
            }
        };

        this.previousPose = poseData;
        this.lastSeenTime = currentTime;

        return { pose: poseData, isPersisted: false, confidence: 1 };
    }

    smoothLandmarks(current, previous) {
        const factor = this.smoothingFactor;
        return current.map((landmark, i) => ({
            x: previous[i].x + (landmark.x - previous[i].x) * factor,
            y: previous[i].y + (landmark.y - previous[i].y) * factor,
            z: previous[i].z + (landmark.z - previous[i].z) * factor,
            visibility: landmark.visibility
        }));
    }

    async send(image) {
        if (this.pose && this.isReady) {
            await this.pose.send({ image });
        }
    }

    onResults(callback) {
        this.onResultsCallback = callback;
    }

    getResults() {
        return this.results;
    }

    getLandmarkIndices() {
        return this.LANDMARKS;
    }

    getConnections() {
        return this.CONNECTIONS;
    }
}
