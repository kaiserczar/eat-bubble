/**
 * CameraManager - Handles webcam access and video stream
 */
class CameraManager {
    constructor(videoElement) {
        this.video = videoElement;
        this.stream = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user' // Front camera
                },
                audio: false
            });

            this.video.srcObject = this.stream;

            // Wait for video to be ready
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play()
                        .then(() => {
                            this.isRunning = true;
                            resolve({
                                width: this.video.videoWidth,
                                height: this.video.videoHeight
                            });
                        })
                        .catch(reject);
                };

                this.video.onerror = (error) => {
                    reject(new Error('Video element error: ' + error.message));
                };
            });
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera access denied. Please allow camera access and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera found. Please connect a webcam and refresh the page.');
            } else {
                throw new Error('Failed to access camera: ' + error.message);
            }
        }
    }

    getVideoElement() {
        return this.video;
    }

    getVideoDimensions() {
        return {
            width: this.video.videoWidth,
            height: this.video.videoHeight
        };
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.isRunning = false;
    }
}
