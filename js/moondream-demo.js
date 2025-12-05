/**
 * ============================================================================
 * PTZOptics Visual Reasoning Playground
 * ============================================================================
 *
 * A comprehensive interactive demonstration suite showcasing MoonDream's
 * visual reasoning AI capabilities for video production applications.
 *
 * @author      PTZOptics / Matthew Davis
 * @version     1.0.0
 * @license     MIT
 * @repository  https://github.com/matthewidavis/PTZOpticsVRP
 * @demo        https://matthewidavis.github.io/PTZOpticsVRP/
 *
 * ============================================================================
 * ARCHITECTURE OVERVIEW
 * ============================================================================
 *
 * This application follows a modular widget-based architecture:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                              MoonDemo                                    │
 * │  (Global namespace exposed to window, entry point for initialization)   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                             Dashboard                                    │
 * │  (Main UI controller - handles navigation, modals, card grid)           │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                    ┌───────────────┼───────────────┐
 *                    ▼               ▼               ▼
 *              ┌──────────┐   ┌──────────┐   ┌──────────┐
 *              │ Widget 1 │   │ Widget 2 │   │ Widget N │
 *              │ (extends │   │ (extends │   │ (extends │
 *              │ WidgetBa │   │ WidgetBa │   │ WidgetBa │
 *              └──────────┘   └──────────┘   └──────────┘
 *
 * ============================================================================
 * MODULE BREAKDOWN
 * ============================================================================
 *
 * 1. CONFIG          - Global configuration constants
 * 2. Utils           - DOM utilities, storage, clipboard helpers
 * 3. CanvasUtils     - Drawing utilities for bounding boxes, points, zones
 * 4. Strings         - UI text strings for easy localization
 * 5. ApiClient       - MoonDream API communication layer
 * 6. MediaCapture    - Webcam/camera and image file handling
 * 7. WidgetBase      - Base class all widgets inherit from
 * 8. Widgets         - Individual feature implementations:
 *    - ObjectDetectorWidget   : Zero-shot object detection
 *    - SmartCounterWidget     : Object counting with point markers
 *    - SceneAnalyzerWidget    : Image captioning and visual Q&A
 *    - PersonTrackerWidget    : People/face detection
 *    - ZoneMonitorWidget      : Custom zone monitoring with alerts
 *    - ProductionMonitorWidget: Video production quality dashboard
 *    - PTZTrackerWidget       : PTZ camera auto-tracking
 * 9. WidgetRegistry  - Maps widget IDs to their constructors
 * 10. WidgetList     - Metadata for UI card display
 * 11. WidgetInfo     - Help content for each widget
 * 12. Dashboard      - Main application controller
 * 13. MoonDemo       - Public API exposed to window
 *
 * ============================================================================
 * DATA FLOW
 * ============================================================================
 *
 * 1. User starts webcam → MediaCapture.startWebcam() → stream to <video>
 * 2. User clicks action → Widget captures frame → MediaCapture.captureFrame()
 * 3. Frame sent to API → ApiClient._request() → MoonDream cloud
 * 4. Results returned → Widget.display*() → CanvasUtils draws on overlay
 *
 * ============================================================================
 * WIDGETS (7 Total)
 * ============================================================================
 *
 * 1. Object Detector   - Detect any object by name with bounding boxes
 * 2. Smart Counter     - Count objects with numbered point markers
 * 3. Scene Analyzer    - AI captions and visual question answering
 * 4. Person Tracker    - Track faces, bodies, or hands
 * 5. Zone Monitor      - Draw custom zones, alert when objects enter
 * 6. Production Monitor- Real-time video quality analysis dashboard
 * 7. PTZ Auto-Tracker  - AI-powered PTZ camera tracking control
 *
 * ============================================================================
 */
(function(global) {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    /**
     * Global configuration object for the application.
     * Modify these values to customize behavior.
     *
     * @property {string} apiBaseUrl     - MoonDream API endpoint base URL
     * @property {string} apiKey         - User's API key (set at runtime)
     * @property {number} jpegQuality    - Quality for frame capture (0-1)
     * @property {number} requestTimeout - API request timeout in milliseconds
     * @property {number} maxVideoSizeMB - Maximum video file size for upload
     * @property {string} storageKey     - sessionStorage key for API key
     * @property {object} colors         - Color palette for UI elements
     */
    var CONFIG = {
        apiBaseUrl: 'https://api.moondream.ai/v1',  // MoonDream API endpoint
        apiKey: null,                                // Set by user via UI
        jpegQuality: 0.85,                           // Balance quality vs size
        requestTimeout: 30000,                       // 30 second timeout
        maxVideoSizeMB: 200,                         // Max upload size
        storageKey: 'moondream_api_key',             // sessionStorage key
        colors: {
            primary: '#6366f1',      // Main brand color (indigo)
            secondary: '#8b5cf6',    // Secondary actions (purple)
            success: '#10b981',      // Success states (green)
            warning: '#f59e0b',      // Warning states (amber)
            error: '#ef4444',        // Error states (red)
            detect: '#00ff88',       // Object detection boxes (bright green)
            point: '#ff6b6b',        // Point markers (coral)
            zone: '#ffd93d',         // Zone boundaries (yellow)
            person: '#6bcfff'        // Person tracking (light blue)
        }
    };

    // ============================================================
    // UTILITIES
    // ============================================================
    /**
     * Utils - General utility functions for DOM manipulation and helpers.
     *
     * This module provides common functionality used throughout the application
     * including element creation, security (HTML escaping), clipboard operations,
     * and API key storage management.
     */
    var Utils = {
        /**
         * Create a DOM element with optional class and attributes.
         * This is the primary method for building UI elements programmatically.
         *
         * @param {string} tag       - HTML tag name (e.g., 'div', 'button')
         * @param {string} className - CSS class(es) to apply
         * @param {object} attrs     - Key-value pairs for attributes
         *                             Special keys: 'textContent', 'innerHTML'
         * @returns {HTMLElement}    - The created DOM element
         *
         * @example
         * // Create a button with class and text
         * Utils.createElement('button', 'moon-btn', { textContent: 'Click Me' });
         *
         * @example
         * // Create an input with multiple attributes
         * Utils.createElement('input', 'moon-input', { type: 'text', placeholder: 'Enter text...' });
         */
        createElement: function(tag, className, attrs) {
            var el = document.createElement(tag);
            if (className) el.className = className;
            if (attrs) {
                Object.keys(attrs).forEach(function(key) {
                    if (key === 'textContent') {
                        el.textContent = attrs[key];
                    } else if (key === 'innerHTML') {
                        el.innerHTML = attrs[key];
                    } else {
                        el.setAttribute(key, attrs[key]);
                    }
                });
            }
            return el;
        },

        /**
         * Generate a unique ID string for DOM elements.
         * Uses random base-36 characters for uniqueness.
         *
         * @param {string} prefix - Optional prefix (default: 'moon')
         * @returns {string}      - Unique ID like 'moon-x7k2m9p4q'
         */
        uniqueId: function(prefix) {
            return (prefix || 'moon') + '-' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * Escape HTML special characters to prevent XSS attacks.
         * IMPORTANT: Always use this when displaying user-generated content!
         *
         * @param {string} str - Raw string that may contain HTML
         * @returns {string}   - Safe string with escaped characters
         *
         * @example
         * Utils.escapeHTML('<script>alert("xss")</script>');
         * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
         */
        escapeHTML: function(str) {
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        /**
         * Copy text to the system clipboard.
         * Uses modern Clipboard API with fallback for older browsers.
         *
         * @param {string} text - Text to copy
         * @returns {Promise}   - Resolves when copy completes
         */
        copyToClipboard: function(text) {
            // Modern Clipboard API (preferred)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
            // Fallback for older browsers using hidden textarea
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(textarea);
            return Promise.resolve();
        },

        /**
         * Store the API key in sessionStorage.
         * Using sessionStorage (not localStorage) ensures the key is cleared
         * when the browser tab is closed for better security.
         *
         * @param {string|null} key - API key to store, or null to remove
         */
        storeApiKey: function(key) {
            try {
                if (key) {
                    sessionStorage.setItem(CONFIG.storageKey, key);
                } else {
                    sessionStorage.removeItem(CONFIG.storageKey);
                }
            } catch (e) {
                // sessionStorage may be disabled in some browsers/modes
            }
        },

        /**
         * Retrieve the stored API key from sessionStorage.
         *
         * @returns {string|null} - The stored API key or null if not found
         */
        getStoredApiKey: function() {
            try {
                return sessionStorage.getItem(CONFIG.storageKey);
            } catch (e) {
                return null;
            }
        },

        /**
         * Get a color from the palette for visual variety.
         * Colors cycle through the array for multiple detections.
         *
         * @param {number} index - Index to select color (wraps around)
         * @returns {string}     - Hex color code
         */
        getColor: function(index) {
            var colors = ['#00ff88', '#ff6b6b', '#6bcfff', '#ffd93d', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3'];
            return colors[index % colors.length];
        }
    };

    // ============================================================
    // CANVAS DRAWING UTILITIES
    // ============================================================
    /**
     * CanvasUtils - Drawing utilities for visualization overlays.
     *
     * All detection results are drawn on a transparent canvas overlay that sits
     * on top of the video element. This allows real-time visualization without
     * modifying the actual video stream.
     *
     * Coordinate System:
     * - MoonDream API returns normalized coordinates (0.0 to 1.0)
     * - These are converted to pixel coordinates using canvas dimensions
     * - (0,0) is top-left, (1,1) is bottom-right
     */
    var CanvasUtils = {
        /**
         * Draw a bounding box rectangle with optional label.
         * Used by: Object Detector, Person Tracker, PTZ Tracker
         *
         * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
         * @param {object} box          - Box coordinates {x_min, y_min, x_max, y_max} (0-1 normalized)
         * @param {string} color        - Stroke/fill color (hex)
         * @param {string} label        - Optional text label to display above box
         * @param {number} canvasWidth  - Canvas width in pixels
         * @param {number} canvasHeight - Canvas height in pixels
         */
        drawBoundingBox: function(ctx, box, color, label, canvasWidth, canvasHeight) {
            var x = box.x_min * canvasWidth;
            var y = box.y_min * canvasHeight;
            var w = (box.x_max - box.x_min) * canvasWidth;
            var h = (box.y_max - box.y_min) * canvasHeight;

            // Draw box
            ctx.strokeStyle = color || CONFIG.colors.detect;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);

            // Draw label background
            if (label) {
                ctx.font = 'bold 14px system-ui, sans-serif';
                var textWidth = ctx.measureText(label).width;
                ctx.fillStyle = color || CONFIG.colors.detect;
                ctx.fillRect(x, y - 22, textWidth + 10, 22);

                // Draw label text
                ctx.fillStyle = '#000';
                ctx.fillText(label, x + 5, y - 6);
            }
        },

        /**
         * Draw a numbered point marker (filled circle with number).
         * Used by: Smart Counter
         *
         * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
         * @param {object} point        - Point coordinates {x, y} (0-1 normalized)
         * @param {string} color        - Fill color (hex)
         * @param {number} index        - Zero-based index for numbering display
         * @param {number} canvasWidth  - Canvas width in pixels
         * @param {number} canvasHeight - Canvas height in pixels
         */
        drawPoint: function(ctx, point, color, index, canvasWidth, canvasHeight) {
            var x = point.x * canvasWidth;
            var y = point.y * canvasHeight;
            var radius = 12;

            // Outer circle
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color || CONFIG.colors.point;
            ctx.fill();

            // Inner circle (white)
            ctx.beginPath();
            ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            // Number label
            if (typeof index === 'number') {
                ctx.fillStyle = '#000';
                ctx.font = 'bold 12px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(index + 1), x, y);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            }
        },

        /**
         * Draw a polygon zone with semi-transparent fill.
         * Used by: Zone Monitor for defining monitoring areas
         *
         * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
         * @param {Array} points  - Array of {x, y} pixel coordinates
         * @param {string} color  - Base color (hex) - transparency added automatically
         * @param {string} label  - Optional label to display at zone center
         * @param {boolean} isActive - Whether zone is currently triggered (more opaque)
         */
        drawZone: function(ctx, points, color, label, isActive) {
            if (points.length < 2) return;

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (var i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();

            // Fill with transparency
            ctx.fillStyle = (color || CONFIG.colors.zone) + (isActive ? '40' : '20');
            ctx.fill();

            // Stroke
            ctx.strokeStyle = color || CONFIG.colors.zone;
            ctx.lineWidth = isActive ? 3 : 2;
            ctx.setLineDash(isActive ? [] : [5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            if (label && points.length > 0) {
                var centerX = points.reduce(function(sum, p) { return sum + p.x; }, 0) / points.length;
                var centerY = points.reduce(function(sum, p) { return sum + p.y; }, 0) / points.length;

                ctx.font = 'bold 14px system-ui, sans-serif';
                ctx.fillStyle = color || CONFIG.colors.zone;
                ctx.textAlign = 'center';
                ctx.fillText(label, centerX, centerY);
                ctx.textAlign = 'left';
            }
        },

        /**
         * Check if a point is inside a polygon using ray casting algorithm.
         * Used by: Zone Monitor to determine if detected objects are inside zones
         *
         * @param {object} point   - Point to test {x, y}
         * @param {Array} polygon  - Array of polygon vertices {x, y}
         * @returns {boolean}      - True if point is inside polygon
         */
        pointInPolygon: function(point, polygon) {
            var x = point.x, y = point.y;
            var inside = false;
            for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                var xi = polygon[i].x, yi = polygon[i].y;
                var xj = polygon[j].x, yj = polygon[j].y;
                if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }
            return inside;
        },

        /**
         * Clear the entire canvas (remove all drawings).
         *
         * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
         * @param {number} width  - Canvas width
         * @param {number} height - Canvas height
         */
        clear: function(ctx, width, height) {
            ctx.clearRect(0, 0, width, height);
        }
    };

    // ============================================================
    // API CLIENT
    // ============================================================
    /**
     * ApiClient - MoonDream API communication layer.
     *
     * Handles all HTTP requests to the MoonDream cloud API.
     * API documentation: https://docs.moondream.ai
     *
     * Authentication:
     * - API key is sent via 'X-Moondream-Auth' header
     * - Key is stored in CONFIG.apiKey at runtime
     *
     * Endpoints used:
     * - /query   : Visual question answering
     * - /detect  : Object detection with bounding boxes
     * - /point   : Object location with point coordinates
     * - /caption : Image description generation
     */
    var ApiClient = {
        /**
         * Check if an API key has been configured.
         * @returns {boolean} - True if API key is set
         */
        hasApiKey: function() {
            return !!CONFIG.apiKey;
        },

        /**
         * Internal method to make API requests.
         * All public methods use this for consistent error handling.
         *
         * @param {string} endpoint - API endpoint path (e.g., '/detect')
         * @param {object} body     - Request body to send as JSON
         * @returns {Promise}       - Resolves with parsed JSON response
         * @private
         */
        _request: function(endpoint, body) {
            return new Promise(function(resolve, reject) {
                if (!CONFIG.apiKey) {
                    reject(new Error('API key not configured. Please enter your MoonDream API key.'));
                    return;
                }

                var xhr = new XMLHttpRequest();
                xhr.open('POST', CONFIG.apiBaseUrl + endpoint, true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('X-Moondream-Auth', CONFIG.apiKey);
                xhr.timeout = CONFIG.requestTimeout;

                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else if (xhr.status === 401) {
                        reject(new Error('Invalid API key. Please check your MoonDream API key.'));
                    } else if (xhr.status === 429) {
                        reject(new Error('Rate limit exceeded. Please wait a moment.'));
                    } else {
                        reject(new Error('Request failed (' + xhr.status + ')'));
                    }
                };

                xhr.onerror = function() { reject(new Error('Network error')); };
                xhr.ontimeout = function() { reject(new Error('Request timed out')); };
                xhr.send(JSON.stringify(body));
            });
        },

        /**
         * Visual Question Answering - Ask questions about an image.
         * Used by: Scene Analyzer
         *
         * @param {string} imageData - Base64 data URL of the image
         * @param {string} question  - Natural language question about the image
         * @returns {Promise}        - Resolves with {answer: string}
         *
         * @example
         * ApiClient.query(frame, "How many people are in this image?")
         *   .then(response => console.log(response.answer));
         */
        query: function(imageData, question) {
            return this._request('/query', {
                image_url: imageData,
                question: question
            });
        },

        /**
         * Object Detection - Find objects and return bounding boxes.
         * Used by: Object Detector, Person Tracker, Zone Monitor, PTZ Tracker
         *
         * @param {string} imageData  - Base64 data URL of the image
         * @param {string} objectName - What to detect (e.g., "person", "car", "face")
         * @returns {Promise}         - Resolves with {objects: [{x_min, y_min, x_max, y_max}, ...]}
         *
         * @example
         * ApiClient.detect(frame, "person")
         *   .then(response => response.objects.forEach(drawBox));
         */
        detect: function(imageData, objectName) {
            return this._request('/detect', {
                image_url: imageData,
                object: objectName
            });
        },

        /**
         * Point Detection - Find objects and return center point coordinates.
         * Used by: Smart Counter
         *
         * @param {string} imageData  - Base64 data URL of the image
         * @param {string} objectName - What to count (e.g., "person", "chair")
         * @returns {Promise}         - Resolves with {points: [{x, y}, ...]}
         *
         * @example
         * ApiClient.point(frame, "chair")
         *   .then(response => console.log("Found " + response.points.length + " chairs"));
         */
        point: function(imageData, objectName) {
            return this._request('/point', {
                image_url: imageData,
                object: objectName
            });
        },

        /**
         * Image Captioning - Generate a natural language description.
         * Used by: Scene Analyzer, Production Monitor
         *
         * @param {string} imageData - Base64 data URL of the image
         * @param {string} length    - Caption length: 'short', 'normal', or 'long'
         * @returns {Promise}        - Resolves with {caption: string}
         *
         * @example
         * ApiClient.caption(frame, "normal")
         *   .then(response => console.log(response.caption));
         */
        caption: function(imageData, length) {
            return this._request('/caption', {
                image_url: imageData,
                length: length || 'normal',
                stream: false
            });
        }
    };

    // ============================================================
    // MEDIA CAPTURE
    // ============================================================
    /**
     * MediaCapture - Webcam and image file handling.
     *
     * Manages video stream from user's camera and provides frame capture
     * functionality for sending to the API.
     *
     * Features:
     * - Camera enumeration and selection
     * - Resolution detection and switching
     * - Frame capture to base64 data URL
     * - Image file loading
     *
     * Browser APIs used:
     * - navigator.mediaDevices.getUserMedia() - Access camera
     * - navigator.mediaDevices.enumerateDevices() - List cameras
     * - HTMLCanvasElement.toDataURL() - Capture frames
     */
    var MediaCapture = {
        stream: null,
        videoElement: null,
        currentResolution: null,
        currentDeviceId: null,
        supportedResolutions: [],
        availableCameras: [],

        // Common resolutions to test
        standardResolutions: [
            { width: 1920, height: 1080, label: '1080p (16:9)' },
            { width: 1280, height: 720, label: '720p (16:9)' },
            { width: 640, height: 480, label: '480p (4:3)' },
            { width: 640, height: 360, label: '360p (16:9)' },
            { width: 320, height: 240, label: '240p (4:3)' }
        ],

        isWebcamSupported: function() {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        },

        // Get list of available cameras
        getCameras: function() {
            var self = this;
            return new Promise(function(resolve) {
                if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                    resolve([]);
                    return;
                }

                navigator.mediaDevices.enumerateDevices().then(function(devices) {
                    var cameras = devices.filter(function(device) {
                        return device.kind === 'videoinput';
                    }).map(function(device, index) {
                        return {
                            deviceId: device.deviceId,
                            label: device.label || ('Camera ' + (index + 1))
                        };
                    });
                    self.availableCameras = cameras;
                    resolve(cameras);
                }).catch(function() {
                    resolve([]);
                });
            });
        },

        // Probe camera for supported resolutions
        getSupportedResolutions: function() {
            var self = this;
            return new Promise(function(resolve) {
                if (!self.stream) {
                    resolve([]);
                    return;
                }

                var track = self.stream.getVideoTracks()[0];
                if (!track) {
                    resolve([]);
                    return;
                }

                var capabilities = track.getCapabilities ? track.getCapabilities() : null;
                var supported = [];

                if (capabilities && capabilities.width && capabilities.height) {
                    // Filter standard resolutions to those within camera capabilities
                    self.standardResolutions.forEach(function(res) {
                        if (res.width <= capabilities.width.max &&
                            res.height <= capabilities.height.max &&
                            res.width >= capabilities.width.min &&
                            res.height >= capabilities.height.min) {
                            supported.push(res);
                        }
                    });
                }

                // If no capabilities API, just offer standard resolutions
                if (supported.length === 0) {
                    supported = self.standardResolutions.slice(0, 3); // Top 3
                }

                self.supportedResolutions = supported;
                resolve(supported);
            });
        },

        startWebcam: function(videoElement, resolution, deviceId) {
            var self = this;
            return new Promise(function(resolve, reject) {
                if (!self.isWebcamSupported()) {
                    reject(new Error('Webcam not supported'));
                    return;
                }

                // Build constraints - use exact if resolution specified
                var videoConstraints = {};
                if (deviceId) {
                    videoConstraints.deviceId = { exact: deviceId };
                }
                if (resolution) {
                    videoConstraints.width = { exact: resolution.width };
                    videoConstraints.height = { exact: resolution.height };
                }

                var constraints = {
                    video: Object.keys(videoConstraints).length > 0 ? videoConstraints : true,
                    audio: false
                };

                navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
                    self.stream = stream;
                    self.videoElement = videoElement;
                    self.currentResolution = resolution || null;
                    self.currentDeviceId = deviceId || null;
                    videoElement.srcObject = stream;

                    // Wait for video to be ready before resolving
                    videoElement.onloadedmetadata = function() {
                        videoElement.play().then(function() {
                            // Store actual resolution if not specified
                            if (!self.currentResolution && videoElement.videoWidth) {
                                self.currentResolution = {
                                    width: videoElement.videoWidth,
                                    height: videoElement.videoHeight,
                                    label: videoElement.videoWidth + 'x' + videoElement.videoHeight
                                };
                            }
                            resolve(stream);
                        }).catch(function(playErr) {
                            reject(new Error('Could not start video playback'));
                        });
                    };

                    videoElement.onerror = function() {
                        reject(new Error('Video element error'));
                    };
                }).catch(function(err) {
                    console.error('Webcam error:', err.name, err.message);
                    if (err.name === 'NotAllowedError') {
                        reject(new Error('Camera permission denied. Please allow camera access and try again.'));
                    } else if (err.name === 'NotFoundError') {
                        reject(new Error('No camera found. Please connect a webcam and try again.'));
                    } else if (err.name === 'NotReadableError') {
                        reject(new Error('Camera is in use by another application. Please close other apps using the camera.'));
                    } else if (err.name === 'OverconstrainedError') {
                        // Resolution not supported, try without constraints
                        if (resolution) {
                            self.startWebcam(videoElement, null).then(resolve).catch(reject);
                        } else {
                            reject(new Error('Camera does not support requested settings.'));
                        }
                    } else {
                        reject(new Error('Camera error: ' + (err.message || err.name)));
                    }
                });
            });
        },

        // Change resolution by restarting stream
        changeResolution: function(videoElement, resolution) {
            var self = this;
            var deviceId = self.currentDeviceId; // Preserve current camera
            return new Promise(function(resolve, reject) {
                self.stopWebcam();
                self.startWebcam(videoElement, resolution, deviceId).then(resolve).catch(reject);
            });
        },

        // Change to a different camera
        changeCamera: function(videoElement, deviceId) {
            var self = this;
            return new Promise(function(resolve, reject) {
                self.stopWebcam();
                self.startWebcam(videoElement, null, deviceId).then(resolve).catch(reject);
            });
        },

        stopWebcam: function() {
            if (this.stream) {
                this.stream.getTracks().forEach(function(track) { track.stop(); });
                this.stream = null;
            }
            if (this.videoElement) {
                this.videoElement.srcObject = null;
                this.videoElement = null;
            }
            this.currentResolution = null;
        },

        captureFrame: function(videoElement, quality) {
            var canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth || 640;
            canvas.height = videoElement.videoHeight || 480;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', quality || CONFIG.jpegQuality);
        },

        loadImageFile: function(file) {
            return new Promise(function(resolve, reject) {
                // Validate file type
                var validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!validTypes.includes(file.type) && !file.type.startsWith('image/')) {
                    reject(new Error(Strings.errors.fileType));
                    return;
                }

                // Validate file size (10MB max)
                var maxSize = 10 * 1024 * 1024;
                if (file.size > maxSize) {
                    reject(new Error(Strings.errors.fileTooLarge));
                    return;
                }

                var reader = new FileReader();
                reader.onload = function(e) { resolve(e.target.result); };
                reader.onerror = function() { reject(new Error('Failed to read file. Please try another image.')); };
                reader.readAsDataURL(file);
            });
        }
    };

    // ============================================================
    // STRINGS & HELP TEXT
    // ============================================================
    /**
     * Strings - Localized UI text and messages.
     *
     * All user-facing text is centralized here for:
     * - Easy localization/translation
     * - Consistent messaging across widgets
     * - Simple updates without code changes
     *
     * Categories:
     * - common: Shared button labels and actions
     * - errors: Error messages with user-friendly explanations
     * - help: Helpful tips and hints
     * - welcome: Onboarding text
     */
    var Strings = {
        common: {
            startWebcam: 'Start Webcam',
            stopWebcam: 'Stop Webcam',
            uploadImage: 'Upload Image',
            analyzing: 'Analyzing...',
            detecting: 'Detecting...',
            noWebcam: 'Webcam not supported. Please upload an image.',
            apiKeyRequired: 'API Key Required',
            apiKeyPlaceholder: 'Enter your MoonDream API key',
            saveKey: 'Save & Continue',
            copy: 'Copy',
            copied: 'Copied!',
            clear: 'Clear',
            continuous: 'Continuous',
            stop: 'Stop'
        },
        errors: {
            noImage: 'Please start your webcam or upload an image first.',
            noInput: 'Please enter what you want to detect.',
            apiKey: 'API key is required. Click to add your MoonDream API key.',
            apiKeyInvalid: 'Your API key appears to be invalid. Please check it and try again.',
            networkError: 'Unable to connect. Please check your internet connection and try again.',
            timeout: 'The request took too long. Please try again with a simpler image.',
            rateLimit: 'Too many requests. Please wait a few seconds and try again.',
            cameraPermission: 'Camera access was denied. Please allow camera access in your browser settings and refresh the page.',
            noCamera: 'No camera was found. Please connect a camera or upload an image instead.',
            cameraInUse: 'Your camera may be in use by another application. Please close other apps using the camera.',
            fileType: 'Please select an image file (JPG, PNG, GIF, or WebP).',
            fileTooLarge: 'Image is too large. Please use an image under 10MB.',
            generic: 'Something went wrong. Please try again.'
        },
        help: {
            webcamTip: 'Tip: Good lighting improves detection accuracy',
            uploadTip: 'Supported: JPG, PNG, GIF, WebP (max 10MB)',
            detectTip: 'Enter any object name like "person", "car", "dog", "coffee cup"',
            countTip: 'Works best with clearly visible, separated objects',
            zoneTip: 'Click to place points, then click "Finish Zone" to complete',
            continuousTip: 'Continuously analyzes your webcam feed every 1.5 seconds',
            apiKeyTip: 'Your API key is stored for this session only and clears when you close the tab'
        },
        welcome: {
            title: 'Welcome to PTZOptics Visual Reasoning',
            subtitle: 'AI Vision Demos',
            step1: '1. Enter your MoonDream API key',
            step2: '2. Start your webcam or upload an image',
            step3: '3. Try out the AI vision features!',
            getKey: 'Get your free API key at moondream.ai'
        }
    };

    // ============================================================
    // ERROR HELPER - Friendly error messages
    // ============================================================
    /**
     * ErrorHelper - Transforms technical errors into user-friendly messages.
     *
     * This module provides two key functions:
     * - getFriendlyMessage(): Converts error objects to readable text
     * - getRecoveryAction(): Suggests actions users can take to resolve issues
     *
     * Error categories handled:
     * - API key issues (invalid, missing)
     * - Network problems (connection, timeout)
     * - Rate limiting (429 errors)
     * - Camera permissions
     * - File upload errors
     */
    var ErrorHelper = {
        getFriendlyMessage: function(error) {
            var msg = error.message || error.toString();
            var lower = msg.toLowerCase();

            if (lower.includes('api key') && lower.includes('invalid')) {
                return Strings.errors.apiKeyInvalid;
            }
            if (lower.includes('api key')) {
                return Strings.errors.apiKey;
            }
            if (lower.includes('network') || lower.includes('failed to fetch')) {
                return Strings.errors.networkError;
            }
            if (lower.includes('timeout') || lower.includes('timed out')) {
                return Strings.errors.timeout;
            }
            if (lower.includes('rate limit') || lower.includes('429')) {
                return Strings.errors.rateLimit;
            }
            if (lower.includes('permission denied') || lower.includes('notallowed')) {
                return Strings.errors.cameraPermission;
            }
            if (lower.includes('not found') || lower.includes('no camera')) {
                return Strings.errors.noCamera;
            }
            if (lower.includes('in use') || lower.includes('notreadable')) {
                return Strings.errors.cameraInUse;
            }

            return msg;
        },

        getRecoveryAction: function(error) {
            var msg = error.message || error.toString();
            var lower = msg.toLowerCase();

            if (lower.includes('api key')) {
                return { text: 'Add API Key', action: 'showApiKeyModal' };
            }
            if (lower.includes('permission') || lower.includes('notallowed')) {
                return { text: 'How to Enable', action: 'showCameraHelp' };
            }
            if (lower.includes('network') || lower.includes('timeout')) {
                return { text: 'Retry', action: 'retry' };
            }
            return null;
        }
    };

    // ============================================================
    // API KEY MODAL - Enhanced with validation and guidance
    // ============================================================
    /**
     * ApiKeyModal - Modal dialog for API key entry and validation.
     *
     * This modal handles the critical first-time setup experience:
     * 1. Shows step-by-step instructions for obtaining a key
     * 2. Validates the key format before accepting
     * 3. Tests the key against the API before storing
     * 4. Provides clear error feedback for invalid keys
     *
     * Security:
     * - Key input is masked by default (password field)
     * - Toggle to show/hide for verification
     * - Key stored in sessionStorage (cleared on tab close)
     */
    var ApiKeyModal = {
        modal: null,
        onSuccess: null,
        isValidating: false,

        show: function(onSuccess) {
            this.onSuccess = onSuccess;
            this.render();
        },

        hide: function() {
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            this.modal = null;
        },

        render: function() {
            var self = this;
            if (this.modal) this.hide();

            this.modal = Utils.createElement('div', 'moon-modal-overlay');
            var content = Utils.createElement('div', 'moon-modal');

            content.innerHTML =
                '<div class="moon-modal-header">' +
                    '<span class="moon-modal-icon">🔑</span>' +
                    '<h2>API Key Required</h2>' +
                '</div>' +
                '<div class="moon-modal-body">' +
                    '<p class="moon-modal-desc">To use these AI vision demos, you\'ll need a free MoonDream API key.</p>' +
                    '<div class="moon-modal-steps">' +
                        '<div class="moon-modal-step">' +
                            '<span class="moon-step-num">1</span>' +
                            '<span>Visit <a href="https://moondream.ai" target="_blank" rel="noopener">moondream.ai</a> and create a free account</span>' +
                        '</div>' +
                        '<div class="moon-modal-step">' +
                            '<span class="moon-step-num">2</span>' +
                            '<span>Copy your API key from your dashboard</span>' +
                        '</div>' +
                        '<div class="moon-modal-step">' +
                            '<span class="moon-step-num">3</span>' +
                            '<span>Paste it below and click Save</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="moon-form-group">' +
                        '<label class="moon-label">Your API Key</label>' +
                        '<input type="password" class="moon-input moon-api-key-input" placeholder="Paste your MoonDream API key here" autocomplete="off">' +
                        '<div class="moon-input-hint">Your key is stored for this session only and clears when you close the tab.</div>' +
                        '<div class="moon-input-error-msg" style="display:none;"></div>' +
                    '</div>' +
                    '<div class="moon-modal-toggle">' +
                        '<label><input type="checkbox" class="moon-show-key-toggle"> Show API key</label>' +
                    '</div>' +
                '</div>' +
                '<div class="moon-modal-footer">' +
                    '<button class="moon-btn moon-btn-secondary moon-btn-cancel">Cancel</button>' +
                    '<button class="moon-btn moon-btn-primary moon-btn-save-key">Save & Continue</button>' +
                '</div>';

            this.modal.appendChild(content);
            document.body.appendChild(this.modal);

            var input = content.querySelector('.moon-api-key-input');
            var saveBtn = content.querySelector('.moon-btn-save-key');
            var cancelBtn = content.querySelector('.moon-btn-cancel');
            var showToggle = content.querySelector('.moon-show-key-toggle');
            var errorMsg = content.querySelector('.moon-input-error-msg');

            setTimeout(function() { input.focus(); }, 100);

            // Show/hide password toggle
            showToggle.onchange = function() {
                input.type = showToggle.checked ? 'text' : 'password';
            };

            // Real-time validation feedback
            input.oninput = function() {
                input.classList.remove('moon-input-error');
                errorMsg.style.display = 'none';
            };

            saveBtn.onclick = function() { self.validateAndSave(input, saveBtn, errorMsg); };
            cancelBtn.onclick = function() { self.hide(); };
            input.onkeypress = function(e) {
                if (e.key === 'Enter') self.validateAndSave(input, saveBtn, errorMsg);
            };
            this.modal.onclick = function(e) {
                if (e.target === self.modal) self.hide();
            };
        },

        validateAndSave: function(input, saveBtn, errorMsg) {
            var self = this;
            var key = input.value.trim();

            // Basic validation
            if (!key) {
                this.showInputError(input, errorMsg, 'Please enter your API key');
                return;
            }

            if (key.length < 10) {
                this.showInputError(input, errorMsg, 'This doesn\'t look like a valid API key. Please check and try again.');
                return;
            }

            // Disable button and show loading
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="moon-spinner moon-active"></span> Validating...';

            // Test the API key with a simple request
            this.testApiKey(key).then(function(valid) {
                if (valid) {
                    CONFIG.apiKey = key;
                    Utils.storeApiKey(key);
                    self.hide();
                    if (self.onSuccess) self.onSuccess();
                } else {
                    self.showInputError(input, errorMsg, 'This API key doesn\'t appear to be valid. Please check it and try again.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save & Continue';
                }
            }).catch(function(err) {
                // Network error - save anyway and let actual request handle it
                CONFIG.apiKey = key;
                Utils.storeApiKey(key);
                self.hide();
                if (self.onSuccess) self.onSuccess();
            });
        },

        showInputError: function(input, errorMsg, message) {
            input.classList.add('moon-input-error');
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
            input.focus();
        },

        testApiKey: function(key) {
            return new Promise(function(resolve) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', CONFIG.apiBaseUrl + '/caption', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('X-Moondream-Auth', key);
                xhr.timeout = 10000;

                xhr.onload = function() {
                    // 401 means invalid key, anything else means key format is ok
                    resolve(xhr.status !== 401);
                };
                xhr.onerror = function() { resolve(true); }; // Network error, assume key is ok
                xhr.ontimeout = function() { resolve(true); }; // Timeout, assume key is ok

                // Send minimal test request
                xhr.send(JSON.stringify({
                    image_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                    length: 'short'
                }));
            });
        }
    };

    // ============================================================
    // WIDGET BASE
    // ============================================================
    /**
     * WidgetBase - Base class that all widget modules extend.
     *
     * This class provides the foundational functionality shared by all 7 widgets:
     * - Lifecycle management (mount, unmount, render)
     * - Error handling with friendly messages and recovery actions
     * - Toast notifications for success/error feedback
     * - Media section creation (video, canvas, controls)
     * - Overlay canvas for drawing detections
     * - Continuous detection mode support
     *
     * INHERITANCE PATTERN:
     * Each widget inherits from WidgetBase using prototype chain:
     *   function MyWidget() { WidgetBase.call(this, id, label, icon, desc); }
     *   MyWidget.prototype = Object.create(WidgetBase.prototype);
     *   MyWidget.prototype.render = function() { ... };
     *
     * LIFECYCLE:
     * 1. Widget instantiated by Dashboard when user clicks card
     * 2. mount() called with root element → clears content, sets classes
     * 3. render() called → widget builds its specific UI
     * 4. User interacts → widget handles detection/analysis
     * 5. unmount() called when modal closes → cleanup, stop webcam
     *
     * KEY PROPERTIES:
     * @property {string} id          - Unique identifier (e.g., 'object-detector')
     * @property {string} label       - Display name (e.g., 'Object Detector')
     * @property {string} icon        - Emoji icon for UI (e.g., '🔍')
     * @property {string} description - Short description for card/header
     * @property {HTMLElement} rootEl - Root DOM element for widget content
     * @property {HTMLCanvasElement} overlayCanvas - Canvas for drawing detections
     * @property {CanvasRenderingContext2D} overlayCtx - 2D context for drawing
     *
     * @constructor
     * @param {string} id          - Widget unique identifier
     * @param {string} label       - Widget display name
     * @param {string} icon        - Widget icon (emoji)
     * @param {string} description - Widget description
     */
    function WidgetBase(id, label, icon, description) {
        this.id = id;
        this.label = label;
        this.icon = icon;
        this.description = description;
        this.rootEl = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
        this._continuousInterval = null;
    }

    /**
     * Mount the widget into a DOM element.
     * Called by Dashboard when opening a widget modal.
     *
     * @param {HTMLElement} rootEl - Container element to render into
     * @param {object} context     - Dashboard context with shared methods
     */
    WidgetBase.prototype.mount = function(rootEl, context) {
        this.rootEl = rootEl;
        this.context = context;
        rootEl.innerHTML = '';
        // Preserve existing classes (like moon-widget-modal-body) when mounting in modal
        var existingClasses = rootEl.className;
        rootEl.className = existingClasses + ' moon-widget moon-widget-' + this.id;
        this.render();
    };

    /**
     * Cleanup and remove the widget.
     * Called by Dashboard when closing the modal.
     * Stops webcam, clears intervals, removes DOM content.
     */
    WidgetBase.prototype.unmount = function() {
        this.stopContinuous();
        MediaCapture.stopWebcam();
        if (this.rootEl) this.rootEl.innerHTML = '';
        this.rootEl = null;
    };

    /**
     * Render the widget UI. Override in subclasses.
     * This is where each widget builds its specific interface.
     * @abstract
     */
    WidgetBase.prototype.render = function() {};

    /**
     * Display an error to the user.
     * Critical errors (API key, permissions) show inline banners with recovery actions.
     * Non-critical errors show as toast notifications.
     *
     * @param {string} message - Error message to display
     * @param {Error} error    - Optional error object for smart message conversion
     */
    WidgetBase.prototype.showError = function(message, error) {
        var self = this;
        var friendlyMessage = error ? ErrorHelper.getFriendlyMessage(error) : message;
        var recovery = error ? ErrorHelper.getRecoveryAction(error) : null;

        // Use inline banner for critical errors, toast for others
        var isCritical = friendlyMessage.toLowerCase().includes('api key') ||
                        friendlyMessage.toLowerCase().includes('permission');

        if (isCritical) {
            // Show inline banner for critical errors that need action
            var errorEl = this.rootEl.querySelector('.moon-error-banner');
            if (!errorEl) {
                errorEl = Utils.createElement('div', 'moon-error-banner');
                var header = this.rootEl.querySelector('.moon-widget-header');
                if (header && header.nextSibling) {
                    header.parentNode.insertBefore(errorEl, header.nextSibling);
                }
            }

            var content = '<span class="moon-error-message">' + Utils.escapeHTML(friendlyMessage) + '</span>';
            if (recovery) {
                content += '<button class="moon-btn moon-btn-sm moon-error-action" data-action="' + recovery.action + '">' + recovery.text + '</button>';
            }
            content += '<button class="moon-btn moon-btn-sm moon-error-dismiss">×</button>';
            errorEl.innerHTML = content;
            errorEl.style.display = 'flex';

            // Handle recovery actions
            var actionBtn = errorEl.querySelector('.moon-error-action');
            if (actionBtn) {
                actionBtn.onclick = function() {
                    var action = actionBtn.dataset.action;
                    if (action === 'showApiKeyModal') {
                        ApiKeyModal.show(function() { self.hideError(); });
                    } else if (action === 'showCameraHelp') {
                        self.showCameraHelp();
                    }
                };
            }

            var dismissBtn = errorEl.querySelector('.moon-error-dismiss');
            if (dismissBtn) {
                dismissBtn.onclick = function() { self.hideError(); };
            }

            // Auto-show API key modal
            if (friendlyMessage.toLowerCase().includes('api key')) {
                ApiKeyModal.show(function() { self.hideError(); });
            }
        } else {
            // Use toast for non-critical errors (no layout shift)
            this.showToast(friendlyMessage, 'error');
        }
    };

    WidgetBase.prototype.showCameraHelp = function() {
        var helpModal = Utils.createElement('div', 'moon-modal-overlay');
        var content = Utils.createElement('div', 'moon-modal');
        content.innerHTML =
            '<div class="moon-modal-header">' +
                '<span class="moon-modal-icon">📷</span>' +
                '<h2>Enable Camera Access</h2>' +
            '</div>' +
            '<div class="moon-modal-body">' +
                '<p class="moon-modal-desc">To use your webcam with these demos, you\'ll need to allow camera access in your browser.</p>' +
                '<div class="moon-modal-steps">' +
                    '<div class="moon-modal-step">' +
                        '<span class="moon-step-num">1</span>' +
                        '<span>Click the camera/lock icon in your browser\'s address bar</span>' +
                    '</div>' +
                    '<div class="moon-modal-step">' +
                        '<span class="moon-step-num">2</span>' +
                        '<span>Select "Allow" for camera permissions</span>' +
                    '</div>' +
                    '<div class="moon-modal-step">' +
                        '<span class="moon-step-num">3</span>' +
                        '<span>Refresh this page and try again</span>' +
                    '</div>' +
                '</div>' +
                '<p class="moon-modal-help">Alternatively, you can upload an image instead of using your webcam.</p>' +
            '</div>' +
            '<div class="moon-modal-footer">' +
                '<button class="moon-btn moon-btn-primary moon-btn-close">Got it</button>' +
            '</div>';

        helpModal.appendChild(content);
        document.body.appendChild(helpModal);

        content.querySelector('.moon-btn-close').onclick = function() {
            document.body.removeChild(helpModal);
        };
        helpModal.onclick = function(e) {
            if (e.target === helpModal) document.body.removeChild(helpModal);
        };
    };

    /** Hide any visible error banner. */
    WidgetBase.prototype.hideError = function() {
        var errorEl = this.rootEl.querySelector('.moon-error-banner');
        if (errorEl) errorEl.style.display = 'none';
    };

    /**
     * Show a toast notification that auto-dismisses.
     * @param {string} message - Message to display
     * @param {string} type    - 'info', 'success', or 'error'
     */
    WidgetBase.prototype.showToast = function(message, type) {
        type = type || 'info';
        var toast = Utils.createElement('div', 'moon-toast moon-toast-' + type);
        toast.innerHTML = '<span class="moon-toast-message">' + Utils.escapeHTML(message) + '</span>';

        // Add to page
        var container = document.querySelector('.moon-toast-container');
        if (!container) {
            container = Utils.createElement('div', 'moon-toast-container');
            document.body.appendChild(container);
        }
        container.appendChild(toast);

        // Animate in
        setTimeout(function() { toast.classList.add('moon-toast-visible'); }, 10);

        // Auto remove after 3 seconds
        setTimeout(function() {
            toast.classList.remove('moon-toast-visible');
            setTimeout(function() {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    };

    /** Show a success toast notification. */
    WidgetBase.prototype.showSuccess = function(message) {
        this.showToast(message, 'success');
    };

    /**
     * Toggle loading state on the primary action button.
     * Shows spinner and custom message while processing.
     *
     * @param {boolean} isLoading - True to show loading, false to restore
     * @param {string} message    - Optional loading message (default: 'Processing...')
     */
    WidgetBase.prototype.setLoading = function(isLoading, message) {
        var btn = this.rootEl.querySelector('.moon-btn-action');
        if (btn) {
            btn.disabled = isLoading;
            if (isLoading) {
                btn.dataset.originalText = btn.textContent;
                btn.innerHTML = '<span class="moon-spinner moon-active"></span> ' + (message || 'Processing...');
            } else if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
            }
        }
    };

    /**
     * Ensure API key is set before executing callback.
     * Shows API key modal if not configured, then calls callback.
     *
     * @param {function} callback - Function to call once API key is available
     */
    WidgetBase.prototype.ensureApiKey = function(callback) {
        if (ApiClient.hasApiKey()) {
            callback();
        } else {
            ApiKeyModal.show(callback);
        }
    };

    /**
     * Create the standard media section with video, canvas, and controls.
     * This is the core UI component used by most widgets.
     *
     * Creates:
     * - Video element for webcam feed
     * - Overlay canvas for drawing detections
     * - Image canvas for uploaded images
     * - Placeholder when no media active
     * - Camera selector dropdown (shown when multiple cameras)
     * - Resolution selector dropdown
     * - Start/Stop Webcam button
     * - Upload Image button with file input
     *
     * @param {object} options - Configuration options (reserved for future use)
     * @returns {HTMLElement}  - The media section container element
     */
    WidgetBase.prototype.createMediaSection = function(options) {
        var self = this;
        options = options || {};

        var container = Utils.createElement('div', 'moon-media-section');

        // Video container with overlay canvas
        var videoContainer = Utils.createElement('div', 'moon-video-container');

        var video = Utils.createElement('video', 'moon-video', {
            autoplay: '', playsinline: '', muted: ''
        });
        video.id = Utils.uniqueId('video');
        videoContainer.appendChild(video);

        // Overlay canvas for drawing detections
        var overlay = Utils.createElement('canvas', 'moon-overlay-canvas');
        videoContainer.appendChild(overlay);

        // Image display canvas (for uploaded images)
        var imageCanvas = Utils.createElement('canvas', 'moon-image-canvas');
        imageCanvas.style.display = 'none';
        videoContainer.appendChild(imageCanvas);

        var placeholder = Utils.createElement('div', 'moon-video-placeholder');
        placeholder.innerHTML = '<div class="moon-placeholder-content">' +
            '<span class="moon-placeholder-icon">📷</span>' +
            '<span class="moon-placeholder-text">Start webcam or upload an image to begin</span>' +
            '<span class="moon-placeholder-hint">' + Strings.help.webcamTip + '</span>' +
            '</div>';
        videoContainer.appendChild(placeholder);

        container.appendChild(videoContainer);

        // Controls
        var controls = Utils.createElement('div', 'moon-media-controls');

        // Camera selector (populated when cameras are enumerated)
        var cameraSelect = Utils.createElement('select', 'moon-select moon-camera-select');
        cameraSelect.disabled = true;
        var defaultCameraOption = document.createElement('option');
        defaultCameraOption.value = '';
        defaultCameraOption.textContent = 'Select Camera...';
        cameraSelect.appendChild(defaultCameraOption);

        cameraSelect.onchange = function() {
            var deviceId = cameraSelect.value;
            if (!deviceId || !MediaCapture.stream) return;

            cameraSelect.disabled = true;
            resolutionSelect.disabled = true;
            MediaCapture.changeCamera(video, deviceId).then(function() {
                cameraSelect.disabled = false;
                self._syncOverlaySize();

                // Update resolution dropdown for new camera
                MediaCapture.getSupportedResolutions().then(function(resolutions) {
                    if (resolutions.length > 0) {
                        resolutionSelect.innerHTML = '';
                        var currentRes = MediaCapture.currentResolution;

                        resolutions.forEach(function(res, index) {
                            var option = document.createElement('option');
                            option.value = index;
                            option.textContent = res.label;
                            if (currentRes && res.width === currentRes.width && res.height === currentRes.height) {
                                option.selected = true;
                            }
                            resolutionSelect.appendChild(option);
                        });
                        resolutionSelect.disabled = false;
                    }
                });
            }).catch(function(err) {
                cameraSelect.disabled = false;
                resolutionSelect.disabled = false;
                self.showError('Could not switch camera: ' + err.message);
            });
        };

        // Resolution selector (visible but disabled until webcam starts)
        var resolutionSelect = Utils.createElement('select', 'moon-select moon-resolution-select');
        resolutionSelect.disabled = true;
        // Pre-populate with standard resolutions
        MediaCapture.standardResolutions.forEach(function(res, index) {
            var option = document.createElement('option');
            option.value = index;
            option.textContent = res.label;
            resolutionSelect.appendChild(option);
        });
        resolutionSelect.onchange = function() {
            var selectedIndex = resolutionSelect.selectedIndex;
            if (selectedIndex < 0) return;

            var resolutions = MediaCapture.supportedResolutions;
            var resolution = resolutions[selectedIndex];

            if (resolution && MediaCapture.stream) {
                resolutionSelect.disabled = true;
                MediaCapture.changeResolution(video, resolution).then(function() {
                    resolutionSelect.disabled = false;
                    self._syncOverlaySize();
                }).catch(function(err) {
                    resolutionSelect.disabled = false;
                    self.showError('Could not change resolution: ' + err.message);
                });
            }
        };

        if (MediaCapture.isWebcamSupported()) {
            var webcamBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary moon-btn-webcam', {
                textContent: Strings.common.startWebcam
            });
            webcamBtn.onclick = function() {
                if (MediaCapture.stream) {
                    MediaCapture.stopWebcam();
                    webcamBtn.textContent = Strings.common.startWebcam;
                    webcamBtn.classList.remove('moon-btn-active');
                    video.style.display = 'none';
                    placeholder.style.display = 'flex';
                    resolutionSelect.disabled = true;
                    cameraSelect.disabled = true;
                    self.clearOverlay();
                } else {
                    MediaCapture.startWebcam(video).then(function() {
                        webcamBtn.textContent = Strings.common.stopWebcam;
                        webcamBtn.classList.add('moon-btn-active');
                        video.style.display = 'block';
                        imageCanvas.style.display = 'none';
                        placeholder.style.display = 'none';
                        self.hideError();
                        self._syncOverlaySize();

                        // Enumerate cameras and populate dropdown
                        MediaCapture.getCameras().then(function(cameras) {
                            if (cameras.length > 1) {
                                cameraSelect.innerHTML = '';
                                cameras.forEach(function(cam) {
                                    var option = document.createElement('option');
                                    option.value = cam.deviceId;
                                    option.textContent = cam.label;
                                    // Select current camera
                                    if (MediaCapture.currentDeviceId === cam.deviceId) {
                                        option.selected = true;
                                    }
                                    cameraSelect.appendChild(option);
                                });
                                cameraSelect.disabled = false;
                            } else {
                                // Only one camera, no need to show selector
                                cameraSelect.style.display = 'none';
                            }
                        });

                        // Update resolution dropdown with supported resolutions
                        MediaCapture.getSupportedResolutions().then(function(resolutions) {
                            if (resolutions.length > 0) {
                                resolutionSelect.innerHTML = '';
                                var currentRes = MediaCapture.currentResolution;

                                resolutions.forEach(function(res, index) {
                                    var option = document.createElement('option');
                                    option.value = index;
                                    option.textContent = res.label;
                                    // Select current resolution
                                    if (currentRes && res.width === currentRes.width && res.height === currentRes.height) {
                                        option.selected = true;
                                    }
                                    resolutionSelect.appendChild(option);
                                });

                                resolutionSelect.disabled = false;
                            }
                        });
                    }).catch(function(err) {
                        self.showError(err.message);
                    });
                }
            };
            controls.appendChild(webcamBtn);
            controls.appendChild(cameraSelect);
            controls.appendChild(resolutionSelect);
        }

        // File upload
        var fileInput = Utils.createElement('input', 'moon-file-input', { type: 'file', accept: 'image/*' });
        fileInput.style.display = 'none';

        var uploadBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary', {
            textContent: Strings.common.uploadImage
        });
        uploadBtn.onclick = function() { fileInput.click(); };

        fileInput.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;

            MediaCapture.loadImageFile(file).then(function(dataUrl) {
                self._currentImage = dataUrl;
                var img = new Image();
                img.onload = function() {
                    // Get container dimensions for scaling
                    var containerRect = videoContainer.getBoundingClientRect();
                    var maxWidth = containerRect.width;
                    var maxHeight = containerRect.height;

                    // Calculate scaled dimensions to fit within container
                    var scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
                    var canvasWidth = Math.floor(img.width * scale);
                    var canvasHeight = Math.floor(img.height * scale);

                    // Set canvas to scaled size for display
                    imageCanvas.width = canvasWidth;
                    imageCanvas.height = canvasHeight;
                    imageCanvas.getContext('2d').drawImage(img, 0, 0, canvasWidth, canvasHeight);
                    imageCanvas.style.display = 'block';
                    video.style.display = 'none';
                    placeholder.style.display = 'none';
                    self._syncOverlaySize();

                    // Stop webcam if running
                    if (MediaCapture.stream) {
                        MediaCapture.stopWebcam();
                        var wcBtn = controls.querySelector('.moon-btn-webcam');
                        if (wcBtn) {
                            wcBtn.textContent = Strings.common.startWebcam;
                            wcBtn.classList.remove('moon-btn-active');
                        }
                        var resSelect = controls.querySelector('.moon-resolution-select');
                        if (resSelect) {
                            resSelect.disabled = true;
                        }
                    }
                };
                img.src = dataUrl;
            }).catch(function(err) {
                self.showError(err.message);
            });
        };

        controls.appendChild(fileInput);
        controls.appendChild(uploadBtn);

        container.appendChild(controls);

        // Store references
        this._media = {
            container: container,
            videoContainer: videoContainer,
            video: video,
            overlay: overlay,
            imageCanvas: imageCanvas,
            placeholder: placeholder
        };

        this.overlayCanvas = overlay;
        this.overlayCtx = overlay.getContext('2d');

        return container;
    };

    /**
     * Synchronize overlay canvas size with the active video/image source.
     * Called after webcam start, resolution change, or image upload.
     * Ensures detection boxes are drawn at correct positions.
     * @private
     */
    WidgetBase.prototype._syncOverlaySize = function() {
        if (!this._media) return;
        var video = this._media.video;
        var imageCanvas = this._media.imageCanvas;
        var overlay = this._media.overlay;
        var container = this._media.videoContainer;

        var width, height, sourceEl;
        if (video.style.display !== 'none' && video.videoWidth) {
            width = video.videoWidth;
            height = video.videoHeight;
            sourceEl = video;
        } else if (imageCanvas.style.display !== 'none') {
            width = imageCanvas.width;
            height = imageCanvas.height;
            sourceEl = imageCanvas;
        } else {
            return;
        }

        overlay.width = width;
        overlay.height = height;

        // Position overlay to match the source element within the container
        if (sourceEl && container) {
            var containerRect = container.getBoundingClientRect();
            var sourceRect = sourceEl.getBoundingClientRect();

            // Calculate offset from container
            var offsetLeft = sourceRect.left - containerRect.left;
            var offsetTop = sourceRect.top - containerRect.top;

            overlay.style.left = offsetLeft + 'px';
            overlay.style.top = offsetTop + 'px';
            overlay.style.width = sourceRect.width + 'px';
            overlay.style.height = sourceRect.height + 'px';
        }
    };

    /**
     * Get the current frame from webcam or uploaded image.
     * Returns base64 data URL ready for API calls.
     *
     * @returns {string|null} - Base64 data URL or null if no media
     */
    WidgetBase.prototype.getCurrentFrame = function() {
        if (!this._media) return null;

        if (MediaCapture.stream && this._media.video) {
            this._syncOverlaySize();
            return MediaCapture.captureFrame(this._media.video);
        }

        if (this._currentImage) {
            return this._currentImage;
        }

        return null;
    };

    /** Clear all drawings from the overlay canvas. */
    WidgetBase.prototype.clearOverlay = function() {
        if (this.overlayCtx && this.overlayCanvas) {
            CanvasUtils.clear(this.overlayCtx, this.overlayCanvas.width, this.overlayCanvas.height);
        }
    };

    /**
     * Start continuous detection mode.
     * Repeatedly calls callback at specified interval while webcam is active.
     * Used for live monitoring features.
     *
     * @param {function} callback - Detection function to call
     * @param {number} interval   - Milliseconds between calls (default: 2000)
     */
    WidgetBase.prototype.startContinuous = function(callback, interval) {
        var self = this;
        this.stopContinuous();
        this._continuousInterval = setInterval(function() {
            if (MediaCapture.stream) {
                callback();
            }
        }, interval || 2000);
    };

    /** Stop continuous detection mode and clear interval. */
    WidgetBase.prototype.stopContinuous = function() {
        if (this._continuousInterval) {
            clearInterval(this._continuousInterval);
            this._continuousInterval = null;
        }
    };

    // ============================================================
    // WIDGET 1: UNIVERSAL OBJECT DETECTOR
    // ============================================================
    /**
     * ObjectDetectorWidget - Zero-shot object detection with bounding boxes.
     *
     * This widget lets users detect any object by typing its name.
     * No pre-training required - just describe what you want to find.
     *
     * Features:
     * - Free-form text input for object name
     * - Bounding box visualization with color-coded results
     * - Single-shot and continuous detection modes
     * - Works with webcam or uploaded images
     *
     * API used: /detect endpoint
     *
     * @extends WidgetBase
     */
    function ObjectDetectorWidget() {
        WidgetBase.call(this,
            'object-detector',
            'Universal Object Detector',
            '🔍',
            'Detect any object in your scene with bounding boxes. Great for industrial inspection, inventory, and monitoring.'
        );
    }
    ObjectDetectorWidget.prototype = Object.create(WidgetBase.prototype);

    ObjectDetectorWidget.prototype.render = function() {
        var self = this;

        var header = Utils.createElement('div', 'moon-widget-header');
        header.innerHTML = '<span class="moon-widget-icon">' + this.icon + '</span>' +
            '<h2 class="moon-widget-title">' + this.label + '</h2>' +
            '<p class="moon-widget-desc">' + this.description + '</p>';
        this.rootEl.appendChild(header);

        var body = Utils.createElement('div', 'moon-widget-body');
        var grid = Utils.createElement('div', 'moon-grid moon-grid-2');

        // Left column - media
        var leftCol = Utils.createElement('div', 'moon-col');
        leftCol.appendChild(this.createMediaSection());
        grid.appendChild(leftCol);

        // Right column - controls & results
        var rightCol = Utils.createElement('div', 'moon-col');

        // Detection input
        var inputGroup = Utils.createElement('div', 'moon-input-group');
        inputGroup.innerHTML = '<label class="moon-label">What to detect:</label>';

        var input = Utils.createElement('input', 'moon-input moon-detect-input', {
            type: 'text',
            placeholder: 'e.g., person, car, forklift, package, chair...'
        });
        input.value = 'person';
        inputGroup.appendChild(input);

        // Quick detect buttons
        var quickBtns = Utils.createElement('div', 'moon-quick-btns');
        ['person', 'face', 'car', 'package', 'chair', 'screen'].forEach(function(item) {
            var btn = Utils.createElement('button', 'moon-btn moon-btn-sm moon-btn-quick', { textContent: item });
            btn.onclick = function() {
                input.value = item;
                self.detect();
            };
            quickBtns.appendChild(btn);
        });
        inputGroup.appendChild(quickBtns);

        rightCol.appendChild(inputGroup);

        // Action buttons
        var actions = Utils.createElement('div', 'moon-actions');

        var detectBtn = Utils.createElement('button', 'moon-btn moon-btn-primary moon-btn-lg moon-btn-action', {
            textContent: 'Detect Objects'
        });
        detectBtn.onclick = function() {
            self.ensureApiKey(function() { self.detect(); });
        };
        actions.appendChild(detectBtn);

        var continuousBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary moon-btn-continuous', {
            textContent: '▶ Continuous'
        });
        continuousBtn.onclick = function() {
            self.toggleContinuous(continuousBtn);
        };
        actions.appendChild(continuousBtn);

        var clearBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary', {
            textContent: 'Clear'
        });
        clearBtn.onclick = function() {
            self.clearOverlay();
            self.clearResults();
        };
        actions.appendChild(clearBtn);

        rightCol.appendChild(actions);

        // Results
        var results = Utils.createElement('div', 'moon-results moon-detect-results');
        results.innerHTML = '<div class="moon-results-header"><h3>Detections</h3><span class="moon-count">0 found</span></div>' +
            '<div class="moon-results-list"></div>';
        rightCol.appendChild(results);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);

        this._input = input;
        this._results = results;
    };

    ObjectDetectorWidget.prototype.detect = function() {
        var self = this;
        var frame = this.getCurrentFrame();
        var objectName = this._input.value.trim();

        if (!frame) {
            this.showError('Please start webcam or upload an image first');
            return;
        }
        if (!objectName) {
            this.showError('Please enter what to detect');
            return;
        }

        this.hideError();
        this.setLoading(true, 'Detecting...');

        ApiClient.detect(frame, objectName).then(function(response) {
            self.setLoading(false);
            self.displayDetections(response.objects || [], objectName);
        }).catch(function(err) {
            self.setLoading(false);
            self.showError(err.message);
        });
    };

    ObjectDetectorWidget.prototype.displayDetections = function(objects, objectName) {
        var self = this;
        this.clearOverlay();

        var countEl = this._results.querySelector('.moon-count');
        var listEl = this._results.querySelector('.moon-results-list');

        countEl.textContent = objects.length + ' found';
        listEl.innerHTML = '';

        if (objects.length === 0) {
            listEl.innerHTML = '<p class="moon-no-results">No "' + Utils.escapeHTML(objectName) + '" detected in scene</p>';
            return;
        }

        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        objects.forEach(function(obj, index) {
            var color = Utils.getColor(index);
            var label = objectName + ' #' + (index + 1);

            // Draw on canvas
            CanvasUtils.drawBoundingBox(ctx, obj, color, label, w, h);

            // Add to list
            var item = Utils.createElement('div', 'moon-result-item');
            item.innerHTML = '<span class="moon-result-color" style="background:' + color + '"></span>' +
                '<span class="moon-result-label">' + label + '</span>' +
                '<span class="moon-result-coords">(' + Math.round(obj.x_min * 100) + '%, ' + Math.round(obj.y_min * 100) + '%)</span>';

            item.onmouseenter = function() {
                self.highlightDetection(index, objects, objectName);
            };
            listEl.appendChild(item);
        });
    };

    ObjectDetectorWidget.prototype.highlightDetection = function(highlightIndex, objects, objectName) {
        this.clearOverlay();
        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        objects.forEach(function(obj, index) {
            var color = index === highlightIndex ? '#ffffff' : Utils.getColor(index);
            var lineWidth = index === highlightIndex ? 4 : 2;
            ctx.lineWidth = lineWidth;
            CanvasUtils.drawBoundingBox(ctx, obj, color, objectName + ' #' + (index + 1), w, h);
        });
    };

    ObjectDetectorWidget.prototype.toggleContinuous = function(btn) {
        var self = this;
        if (this._continuousInterval) {
            this.stopContinuous();
            btn.textContent = '▶ Continuous';
            btn.classList.remove('moon-btn-active');
        } else {
            if (!MediaCapture.stream) {
                this.showError('Start webcam for continuous mode');
                return;
            }
            btn.textContent = '■ Stop';
            btn.classList.add('moon-btn-active');
            this.startContinuous(function() {
                self.detect();
            }, 1500);
        }
    };

    ObjectDetectorWidget.prototype.clearResults = function() {
        var countEl = this._results.querySelector('.moon-count');
        var listEl = this._results.querySelector('.moon-results-list');
        countEl.textContent = '0 found';
        listEl.innerHTML = '';
    };

    // ============================================================
    // WIDGET 2: SMART COUNTER
    // ============================================================
    /**
     * SmartCounterWidget - Count objects with numbered point markers.
     *
     * Unlike simple counting, this widget shows exactly WHERE each
     * counted item is located with visual markers.
     *
     * Features:
     * - Numbered point markers on each detected item
     * - Total count displayed prominently
     * - Single-shot and continuous counting modes
     * - Great for verification (see what was counted)
     *
     * API used: /point endpoint
     *
     * @extends WidgetBase
     */
    function SmartCounterWidget() {
        WidgetBase.call(this,
            'smart-counter',
            'Smart Counter',
            '🔢',
            'Count objects with visual proof. Each item is marked with a numbered point. Perfect for inventory and manufacturing.'
        );
    }
    SmartCounterWidget.prototype = Object.create(WidgetBase.prototype);

    SmartCounterWidget.prototype.render = function() {
        var self = this;

        var header = Utils.createElement('div', 'moon-widget-header');
        header.innerHTML = '<span class="moon-widget-icon">' + this.icon + '</span>' +
            '<h2 class="moon-widget-title">' + this.label + '</h2>' +
            '<p class="moon-widget-desc">' + this.description + '</p>';
        this.rootEl.appendChild(header);

        var body = Utils.createElement('div', 'moon-widget-body');
        var grid = Utils.createElement('div', 'moon-grid moon-grid-2');

        var leftCol = Utils.createElement('div', 'moon-col');
        leftCol.appendChild(this.createMediaSection());
        grid.appendChild(leftCol);

        var rightCol = Utils.createElement('div', 'moon-col');

        // Input
        var inputGroup = Utils.createElement('div', 'moon-input-group');
        inputGroup.innerHTML = '<label class="moon-label">What to count:</label>';

        var input = Utils.createElement('input', 'moon-input moon-count-input', {
            type: 'text',
            placeholder: 'e.g., people, boxes, bottles, screws...'
        });
        input.value = 'person';
        inputGroup.appendChild(input);

        var quickBtns = Utils.createElement('div', 'moon-quick-btns');
        ['person', 'chair', 'bottle', 'box', 'car', 'light'].forEach(function(item) {
            var btn = Utils.createElement('button', 'moon-btn moon-btn-sm moon-btn-quick', { textContent: item });
            btn.onclick = function() {
                input.value = item;
                self.count();
            };
            quickBtns.appendChild(btn);
        });
        inputGroup.appendChild(quickBtns);

        rightCol.appendChild(inputGroup);

        // Actions
        var actions = Utils.createElement('div', 'moon-actions');

        var countBtn = Utils.createElement('button', 'moon-btn moon-btn-primary moon-btn-lg moon-btn-action', {
            textContent: 'Count'
        });
        countBtn.onclick = function() {
            self.ensureApiKey(function() { self.count(); });
        };
        actions.appendChild(countBtn);

        var continuousBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary moon-btn-continuous', {
            textContent: '▶ Continuous'
        });
        continuousBtn.onclick = function() {
            self.toggleContinuous(continuousBtn);
        };
        actions.appendChild(continuousBtn);

        rightCol.appendChild(actions);

        // Big count display
        var countDisplay = Utils.createElement('div', 'moon-count-display');
        countDisplay.innerHTML = '<div class="moon-count-number">0</div>' +
            '<div class="moon-count-label">items detected</div>';
        rightCol.appendChild(countDisplay);

        // Points list
        var results = Utils.createElement('div', 'moon-results moon-points-results');
        results.innerHTML = '<div class="moon-results-list"></div>';
        rightCol.appendChild(results);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);

        this._input = input;
        this._countDisplay = countDisplay;
        this._results = results;
    };

    SmartCounterWidget.prototype.count = function() {
        var self = this;
        var frame = this.getCurrentFrame();
        var objectName = this._input.value.trim();

        if (!frame) {
            this.showError('Please start webcam or upload an image first');
            return;
        }
        if (!objectName) {
            this.showError('Please enter what to count');
            return;
        }

        this.hideError();
        this.setLoading(true, 'Counting...');

        ApiClient.point(frame, objectName).then(function(response) {
            self.setLoading(false);
            self.displayPoints(response.points || [], objectName);
        }).catch(function(err) {
            self.setLoading(false);
            self.showError(err.message);
        });
    };

    SmartCounterWidget.prototype.displayPoints = function(points, objectName) {
        this.clearOverlay();

        var numberEl = this._countDisplay.querySelector('.moon-count-number');
        var labelEl = this._countDisplay.querySelector('.moon-count-label');
        var listEl = this._results.querySelector('.moon-results-list');

        numberEl.textContent = points.length;
        labelEl.textContent = objectName + (points.length === 1 ? '' : 's') + ' detected';
        listEl.innerHTML = '';

        if (points.length === 0) {
            listEl.innerHTML = '<p class="moon-no-results">No "' + Utils.escapeHTML(objectName) + '" found</p>';
            return;
        }

        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        points.forEach(function(point, index) {
            var color = Utils.getColor(index);
            CanvasUtils.drawPoint(ctx, point, color, index, w, h);

            var item = Utils.createElement('div', 'moon-result-item');
            item.innerHTML = '<span class="moon-result-number">' + (index + 1) + '</span>' +
                '<span class="moon-result-label">' + objectName + '</span>' +
                '<span class="moon-result-coords">(' + Math.round(point.x * 100) + '%, ' + Math.round(point.y * 100) + '%)</span>';
            listEl.appendChild(item);
        });
    };

    SmartCounterWidget.prototype.toggleContinuous = function(btn) {
        var self = this;
        if (this._continuousInterval) {
            this.stopContinuous();
            btn.textContent = '▶ Continuous';
            btn.classList.remove('moon-btn-active');
        } else {
            if (!MediaCapture.stream) {
                this.showError('Start webcam for continuous mode');
                return;
            }
            btn.textContent = '■ Stop';
            btn.classList.add('moon-btn-active');
            this.startContinuous(function() {
                self.count();
            }, 1500);
        }
    };

    // ============================================================
    // WIDGET 3: SCENE ANALYZER
    // ============================================================
    /**
     * SceneAnalyzerWidget - AI image captioning and visual Q&A.
     *
     * This widget showcases MoonDream's visual reasoning capabilities
     * by generating natural language descriptions and answering questions.
     *
     * Features:
     * - Auto-generate image captions (short/normal/long)
     * - Ask free-form questions about the scene
     * - Conversation history display
     * - Copy answers to clipboard
     *
     * API used: /caption and /query endpoints
     *
     * @extends WidgetBase
     */
    function SceneAnalyzerWidget() {
        WidgetBase.call(this,
            'scene-analyzer',
            'Scene Analyzer',
            '🎬',
            'Get AI descriptions and ask questions about any scene. Ideal for accessibility, broadcast, and monitoring.'
        );
    }
    SceneAnalyzerWidget.prototype = Object.create(WidgetBase.prototype);

    SceneAnalyzerWidget.prototype.render = function() {
        var self = this;

        var header = Utils.createElement('div', 'moon-widget-header');
        header.innerHTML = '<span class="moon-widget-icon">' + this.icon + '</span>' +
            '<h2 class="moon-widget-title">' + this.label + '</h2>' +
            '<p class="moon-widget-desc">' + this.description + '</p>';
        this.rootEl.appendChild(header);

        var body = Utils.createElement('div', 'moon-widget-body');
        var grid = Utils.createElement('div', 'moon-grid moon-grid-2');

        var leftCol = Utils.createElement('div', 'moon-col');
        leftCol.appendChild(this.createMediaSection());
        grid.appendChild(leftCol);

        var rightCol = Utils.createElement('div', 'moon-col');

        // Caption section
        var captionSection = Utils.createElement('div', 'moon-section');
        captionSection.innerHTML = '<h3 class="moon-section-title">Scene Description</h3>';

        var captionBtn = Utils.createElement('button', 'moon-btn moon-btn-primary moon-btn-action', {
            textContent: 'Describe Scene'
        });
        captionBtn.onclick = function() {
            self.ensureApiKey(function() { self.captionScene(); });
        };
        captionSection.appendChild(captionBtn);

        var captionResult = Utils.createElement('div', 'moon-caption-result');
        captionResult.innerHTML = '<p class="moon-caption-text">Click "Describe Scene" to get an AI description</p>';
        captionSection.appendChild(captionResult);

        rightCol.appendChild(captionSection);

        // Q&A section
        var qaSection = Utils.createElement('div', 'moon-section');
        qaSection.innerHTML = '<h3 class="moon-section-title">Ask a Question</h3>';

        var qaInputRow = Utils.createElement('div', 'moon-input-row');
        var qaInput = Utils.createElement('input', 'moon-input moon-qa-input', {
            type: 'text',
            placeholder: 'e.g., How many people are there? What color is the car?'
        });

        // Bind Enter key to ask
        qaInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                self.ensureApiKey(function() { self.askQuestion(); });
            }
        };
        qaInputRow.appendChild(qaInput);

        var askBtn = Utils.createElement('button', 'moon-btn moon-btn-primary', {
            textContent: 'Ask'
        });
        askBtn.onclick = function() {
            self.ensureApiKey(function() { self.askQuestion(); });
        };
        qaInputRow.appendChild(askBtn);
        qaSection.appendChild(qaInputRow);

        var quickQs = Utils.createElement('div', 'moon-quick-btns');
        ['How many people?', 'What is happening?', 'What objects are visible?', 'Is anyone wearing glasses?'].forEach(function(q) {
            var btn = Utils.createElement('button', 'moon-btn moon-btn-sm moon-btn-quick', { textContent: q });
            btn.onclick = function() {
                qaInput.value = q;
                self.ensureApiKey(function() { self.askQuestion(); });
            };
            quickQs.appendChild(btn);
        });
        qaSection.appendChild(quickQs);

        // Tabbed results area
        var tabContainer = Utils.createElement('div', 'moon-tabs');

        var tabNav = Utils.createElement('div', 'moon-tab-nav');
        var tabAnswer = Utils.createElement('button', 'moon-tab-btn moon-tab-active', { textContent: 'Answer' });
        var tabHistory = Utils.createElement('button', 'moon-tab-btn', { textContent: 'History' });
        tabNav.appendChild(tabAnswer);
        tabNav.appendChild(tabHistory);
        tabContainer.appendChild(tabNav);

        var tabContent = Utils.createElement('div', 'moon-tab-content');

        var answerPanel = Utils.createElement('div', 'moon-tab-panel moon-tab-panel-active moon-qa-result');
        answerPanel.innerHTML = '<p class="moon-qa-placeholder">Ask a question to see the AI response</p>';
        tabContent.appendChild(answerPanel);

        var historyPanel = Utils.createElement('div', 'moon-tab-panel moon-history-list');
        tabContent.appendChild(historyPanel);

        tabContainer.appendChild(tabContent);
        qaSection.appendChild(tabContainer);

        // Tab switching
        tabAnswer.onclick = function() {
            tabAnswer.classList.add('moon-tab-active');
            tabHistory.classList.remove('moon-tab-active');
            answerPanel.classList.add('moon-tab-panel-active');
            historyPanel.classList.remove('moon-tab-panel-active');
        };
        tabHistory.onclick = function() {
            tabHistory.classList.add('moon-tab-active');
            tabAnswer.classList.remove('moon-tab-active');
            historyPanel.classList.add('moon-tab-panel-active');
            answerPanel.classList.remove('moon-tab-panel-active');
        };

        rightCol.appendChild(qaSection);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);

        this._captionResult = captionResult;
        this._qaInput = qaInput;
        this._qaResult = answerPanel;
        this._historyList = historyPanel;
    };

    SceneAnalyzerWidget.prototype.captionScene = function() {
        var self = this;
        var frame = this.getCurrentFrame();

        if (!frame) {
            this.showError('Please start webcam or upload an image first');
            return;
        }

        this.hideError();
        this._captionResult.innerHTML = '<p class="moon-caption-text moon-loading-text">Analyzing scene...</p>';

        ApiClient.caption(frame, 'normal').then(function(response) {
            var caption = response.caption || 'No description available';
            self._captionResult.innerHTML = '<p class="moon-caption-text">' + Utils.escapeHTML(caption) + '</p>';
            self.addToHistory('Describe this scene', caption);
        }).catch(function(err) {
            self._captionResult.innerHTML = '<p class="moon-caption-text moon-error-text">' + err.message + '</p>';
        });
    };

    SceneAnalyzerWidget.prototype.askQuestion = function() {
        var self = this;
        var frame = this.getCurrentFrame();
        var question = this._qaInput.value.trim();

        if (!frame) {
            this.showError('Please start webcam or upload an image first');
            return;
        }
        if (!question) {
            this.showError('Please enter a question');
            return;
        }

        this.hideError();
        this._qaResult.innerHTML = '<p class="moon-loading-text">Thinking...</p>';

        ApiClient.query(frame, question).then(function(response) {
            var answer = response.answer || 'No answer available';
            self._qaResult.innerHTML = '<p class="moon-qa-answer">' + Utils.escapeHTML(answer) + '</p>';
            self.addToHistory(question, answer);
            // Keep question in input for follow-up refinement
        }).catch(function(err) {
            self._qaResult.innerHTML = '<p class="moon-error-text">' + err.message + '</p>';
        });
    };

    SceneAnalyzerWidget.prototype.addToHistory = function(question, answer) {
        var item = Utils.createElement('div', 'moon-history-item');
        item.innerHTML = '<div class="moon-history-q"><strong>Q:</strong> ' + Utils.escapeHTML(question) + '</div>' +
            '<div class="moon-history-a"><strong>A:</strong> ' + Utils.escapeHTML(answer) + '</div>';
        this._historyList.insertBefore(item, this._historyList.firstChild);
    };

    // ============================================================
    // WIDGET 4: PERSON TRACKER
    // ============================================================
    /**
     * PersonTrackerWidget - Detect and track people with bounding boxes.
     *
     * Specialized detection for people with multiple detection modes
     * for different use cases.
     *
     * Features:
     * - Detection modes: All People, Face Only, Hands
     * - Color-coded bounding boxes
     * - Single-shot and continuous tracking modes
     * - Person count display
     *
     * API used: /detect endpoint with mode-specific queries
     *
     * @extends WidgetBase
     */
    function PersonTrackerWidget() {
        WidgetBase.call(this,
            'person-tracker',
            'Person Tracker',
            '👤',
            'Track and locate people in your scene with bounding boxes. Useful for broadcast framing, security, and attendance.'
        );
    }
    PersonTrackerWidget.prototype = Object.create(WidgetBase.prototype);

    PersonTrackerWidget.prototype.render = function() {
        var self = this;

        var header = Utils.createElement('div', 'moon-widget-header');
        header.innerHTML = '<span class="moon-widget-icon">' + this.icon + '</span>' +
            '<h2 class="moon-widget-title">' + this.label + '</h2>' +
            '<p class="moon-widget-desc">' + this.description + '</p>';
        this.rootEl.appendChild(header);

        var body = Utils.createElement('div', 'moon-widget-body');
        var grid = Utils.createElement('div', 'moon-grid moon-grid-2');

        var leftCol = Utils.createElement('div', 'moon-col');
        leftCol.appendChild(this.createMediaSection());
        grid.appendChild(leftCol);

        var rightCol = Utils.createElement('div', 'moon-col');

        // Detection mode selector
        var modeGroup = Utils.createElement('div', 'moon-input-group');
        modeGroup.innerHTML = '<label class="moon-label">Detection Mode:</label>';

        var modeSelect = Utils.createElement('select', 'moon-select');
        modeSelect.innerHTML = '<option value="face">Faces Only</option>' +
            '<option value="person">Full Body</option>' +
            '<option value="hand">Hands</option>';
        modeGroup.appendChild(modeSelect);
        rightCol.appendChild(modeGroup);

        // Actions
        var actions = Utils.createElement('div', 'moon-actions');

        var detectBtn = Utils.createElement('button', 'moon-btn moon-btn-primary moon-btn-lg moon-btn-action', {
            textContent: 'Track People'
        });
        detectBtn.onclick = function() {
            self.ensureApiKey(function() { self.track(); });
        };
        actions.appendChild(detectBtn);

        var continuousBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary moon-btn-continuous', {
            textContent: '▶ Live Track'
        });
        continuousBtn.onclick = function() {
            self.toggleContinuous(continuousBtn);
        };
        actions.appendChild(continuousBtn);

        rightCol.appendChild(actions);

        // Count display
        var countDisplay = Utils.createElement('div', 'moon-count-display moon-person-count');
        countDisplay.innerHTML = '<div class="moon-count-number">0</div>' +
            '<div class="moon-count-label">people in frame</div>';
        rightCol.appendChild(countDisplay);

        // Person list
        var results = Utils.createElement('div', 'moon-results');
        results.innerHTML = '<div class="moon-results-list moon-person-list"></div>';
        rightCol.appendChild(results);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);

        this._modeSelect = modeSelect;
        this._countDisplay = countDisplay;
        this._personList = results.querySelector('.moon-person-list');
    };

    PersonTrackerWidget.prototype.track = function() {
        var self = this;
        var frame = this.getCurrentFrame();
        var mode = this._modeSelect.value;

        if (!frame) {
            this.showError('Please start webcam or upload an image first');
            return;
        }

        this.hideError();
        this.setLoading(true, 'Tracking...');

        ApiClient.detect(frame, mode).then(function(response) {
            self.setLoading(false);
            self.displayPeople(response.objects || [], mode);
        }).catch(function(err) {
            self.setLoading(false);
            self.showError(err.message);
        });
    };

    PersonTrackerWidget.prototype.displayPeople = function(objects, mode) {
        this.clearOverlay();

        var numberEl = this._countDisplay.querySelector('.moon-count-number');
        var labelEl = this._countDisplay.querySelector('.moon-count-label');

        numberEl.textContent = objects.length;
        labelEl.textContent = mode + (objects.length === 1 ? '' : 's') + ' detected';

        this._personList.innerHTML = '';

        if (objects.length === 0) {
            this._personList.innerHTML = '<p class="moon-no-results">No people detected</p>';
            return;
        }

        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        objects.forEach(function(obj, index) {
            var color = CONFIG.colors.person;
            var label = mode + ' ' + (index + 1);

            CanvasUtils.drawBoundingBox(ctx, obj, color, label, w, h);

            // Calculate position info
            var centerX = (obj.x_min + obj.x_max) / 2;

            var position = '';
            if (centerX < 0.33) position = 'left';
            else if (centerX > 0.66) position = 'right';
            else position = 'center';

            var item = Utils.createElement('div', 'moon-result-item');
            item.innerHTML = '<span class="moon-result-color" style="background:' + color + '"></span>' +
                '<span class="moon-result-label">' + label + '</span>' +
                '<span class="moon-result-position">' + position + ' third</span>';
            this._personList.appendChild(item);
        }.bind(this));

        // Rule of thirds overlay
        this.drawRuleOfThirds();
    };

    PersonTrackerWidget.prototype.drawRuleOfThirds = function() {
        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(w / 3, 0);
        ctx.lineTo(w / 3, h);
        ctx.moveTo(2 * w / 3, 0);
        ctx.lineTo(2 * w / 3, h);

        // Horizontal lines
        ctx.moveTo(0, h / 3);
        ctx.lineTo(w, h / 3);
        ctx.moveTo(0, 2 * h / 3);
        ctx.lineTo(w, 2 * h / 3);

        ctx.stroke();
        ctx.setLineDash([]);
    };

    PersonTrackerWidget.prototype.toggleContinuous = function(btn) {
        var self = this;
        if (this._continuousInterval) {
            this.stopContinuous();
            btn.textContent = '▶ Live Track';
            btn.classList.remove('moon-btn-active');
        } else {
            if (!MediaCapture.stream) {
                this.showError('Start webcam for live tracking');
                return;
            }
            btn.textContent = '■ Stop';
            btn.classList.add('moon-btn-active');
            this.startContinuous(function() {
                self.track();
            }, 1000);
        }
    };

    // ============================================================
    // WIDGET 5: ZONE MONITOR
    // ============================================================
    /**
     * ZoneMonitorWidget - Custom zone drawing with entry detection.
     *
     * Draw polygonal zones on the video feed and monitor when
     * specified objects enter those zones. Triggers alerts.
     *
     * Features:
     * - Click-to-draw polygon zones
     * - Multiple zone support with different colors
     * - Object entry detection (configurable target)
     * - Visual alerts when objects enter zones
     * - Zone management (clear, finish)
     *
     * Algorithm:
     * - Uses ray-casting point-in-polygon test
     * - Checks if detection center point is inside zone polygon
     *
     * API used: /detect endpoint
     *
     * @extends WidgetBase
     */
    function ZoneMonitorWidget() {
        WidgetBase.call(this,
            'zone-monitor',
            'Zone Monitor',
            '🚧',
            'Draw custom zones and detect when objects enter them. Perfect for safety monitoring and restricted area alerts.'
        );
        this._zones = [];
        this._currentZone = [];
        this._isDrawing = false;
    }
    ZoneMonitorWidget.prototype = Object.create(WidgetBase.prototype);

    ZoneMonitorWidget.prototype.render = function() {
        var self = this;

        var header = Utils.createElement('div', 'moon-widget-header');
        header.innerHTML = '<span class="moon-widget-icon">' + this.icon + '</span>' +
            '<h2 class="moon-widget-title">' + this.label + '</h2>' +
            '<p class="moon-widget-desc">' + this.description + '</p>';
        this.rootEl.appendChild(header);

        var body = Utils.createElement('div', 'moon-widget-body');
        var grid = Utils.createElement('div', 'moon-grid moon-grid-2');

        var leftCol = Utils.createElement('div', 'moon-col');
        leftCol.appendChild(this.createMediaSection());

        // Drawing instructions
        var instructions = Utils.createElement('div', 'moon-instructions');
        instructions.innerHTML = '<p>Click "Draw Zone" then click on the video to create zone corners. Click "Finish Zone" when done.</p>';
        leftCol.appendChild(instructions);

        grid.appendChild(leftCol);

        var rightCol = Utils.createElement('div', 'moon-col');

        // Zone drawing controls
        var zoneControls = Utils.createElement('div', 'moon-zone-controls');

        var drawBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary moon-btn-draw', {
            textContent: 'Draw Zone'
        });
        drawBtn.onclick = function() { self.startDrawing(drawBtn); };
        zoneControls.appendChild(drawBtn);

        var finishBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary moon-btn-finish', {
            textContent: 'Finish Zone',
            disabled: 'disabled'
        });
        finishBtn.onclick = function() { self.finishZone(); };
        zoneControls.appendChild(finishBtn);

        var clearZonesBtn = Utils.createElement('button', 'moon-btn moon-btn-secondary', {
            textContent: 'Clear All Zones'
        });
        clearZonesBtn.onclick = function() { self.clearZones(); };
        zoneControls.appendChild(clearZonesBtn);

        rightCol.appendChild(zoneControls);

        // Detection settings
        var detectGroup = Utils.createElement('div', 'moon-input-group');
        detectGroup.innerHTML = '<label class="moon-label">Detect in zones:</label>';

        var detectInput = Utils.createElement('input', 'moon-input moon-zone-detect-input', {
            type: 'text',
            placeholder: 'e.g., face, person, forklift, vehicle...',
            value: 'face'
        });
        detectGroup.appendChild(detectInput);
        rightCol.appendChild(detectGroup);

        // Monitor controls
        var monitorControls = Utils.createElement('div', 'moon-actions');

        var checkBtn = Utils.createElement('button', 'moon-btn moon-btn-primary moon-btn-lg moon-btn-action', {
            textContent: 'Check Zones'
        });
        checkBtn.onclick = function() {
            self.ensureApiKey(function() { self.checkZones(); });
        };
        monitorControls.appendChild(checkBtn);

        var monitorBtn = Utils.createElement('button', 'moon-btn moon-btn-warning moon-btn-monitor', {
            textContent: '▶ Start Monitoring'
        });
        monitorBtn.onclick = function() { self.toggleMonitoring(monitorBtn); };
        monitorControls.appendChild(monitorBtn);

        rightCol.appendChild(monitorControls);

        // Zone list
        var zoneList = Utils.createElement('div', 'moon-zone-list');
        zoneList.innerHTML = '<h4>Active Zones</h4><div class="moon-zones"></div>';
        rightCol.appendChild(zoneList);

        // Alert display
        var alertDisplay = Utils.createElement('div', 'moon-alert-display');
        alertDisplay.innerHTML = '<h4>Alerts</h4><div class="moon-alerts"></div>';
        rightCol.appendChild(alertDisplay);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);

        this._drawBtn = drawBtn;
        this._finishBtn = finishBtn;
        this._detectInput = detectInput;
        this._zoneListEl = zoneList.querySelector('.moon-zones');
        this._alertsEl = alertDisplay.querySelector('.moon-alerts');

        // Setup canvas event handlers for drawing
        this.overlayCanvas.addEventListener('click', function(e) {
            if (self._isDrawing) {
                self.addZonePoint(e);
            }
        });

        this.overlayCanvas.addEventListener('mousemove', function(e) {
            if (self._isDrawing) {
                self.updateDrawingPreview(e);
            }
        });

        this.overlayCanvas.addEventListener('mouseleave', function(e) {
            if (self._isDrawing) {
                self._mousePos = null;
                self.redrawZones();
            }
        });
    };

    ZoneMonitorWidget.prototype.startDrawing = function(btn) {
        this._isDrawing = true;
        this._currentZone = [];
        this._mousePos = null;
        btn.textContent = 'Click to add points...';
        btn.classList.add('moon-btn-active');
        this._finishBtn.disabled = false;
        this.overlayCanvas.style.pointerEvents = 'auto';
        this.overlayCanvas.style.cursor = 'crosshair';
        this.redrawZones();
    };

    ZoneMonitorWidget.prototype.updateDrawingPreview = function(e) {
        var rect = this.overlayCanvas.getBoundingClientRect();
        // Store as normalized 0-1 coordinates
        this._mousePos = {
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
        };
        this.redrawZones();
    };

    ZoneMonitorWidget.prototype.addZonePoint = function(e) {
        var rect = this.overlayCanvas.getBoundingClientRect();
        // Store as normalized 0-1 coordinates
        var x = (e.clientX - rect.left) / rect.width;
        var y = (e.clientY - rect.top) / rect.height;

        this._currentZone.push({ x: x, y: y });
        this.redrawZones();
    };

    ZoneMonitorWidget.prototype.finishZone = function() {
        if (this._currentZone.length < 3) {
            this.showError('Zone needs at least 3 points');
            return;
        }

        var zoneIndex = this._zones.length;
        this._zones.push({
            points: this._currentZone.slice(),
            color: Utils.getColor(zoneIndex),
            name: 'Zone ' + (zoneIndex + 1)
        });

        this._currentZone = [];
        this._mousePos = null;
        this._isDrawing = false;
        this._drawBtn.textContent = 'Draw Zone';
        this._drawBtn.classList.remove('moon-btn-active');
        this._finishBtn.disabled = true;
        this.overlayCanvas.style.cursor = 'default';
        this.overlayCanvas.style.pointerEvents = 'none';

        this.redrawZones();
        this.updateZoneList();
    };

    ZoneMonitorWidget.prototype.clearZones = function() {
        this._zones = [];
        this._currentZone = [];
        this._mousePos = null;
        this._isDrawing = false;
        this._drawBtn.textContent = 'Draw Zone';
        this._drawBtn.classList.remove('moon-btn-active');
        this._finishBtn.disabled = true;
        this.overlayCanvas.style.pointerEvents = 'none';
        this.clearOverlay();
        this.updateZoneList();
        this._alertsEl.innerHTML = '';
    };

    ZoneMonitorWidget.prototype.redrawZones = function() {
        this.clearOverlay();
        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;
        var self = this;

        // Helper to convert normalized coords to canvas pixels
        function toPixel(point) {
            return { x: point.x * w, y: point.y * h };
        }

        // Draw completed zones (convert normalized to pixels)
        this._zones.forEach(function(zone) {
            var pixelPoints = zone.points.map(toPixel);
            CanvasUtils.drawZone(ctx, pixelPoints, zone.color, zone.name, false);
        });

        // Draw current zone being drawn
        if (this._isDrawing) {
            var zoneColor = CONFIG.colors.zone;

            // Draw existing points with visible markers
            this._currentZone.forEach(function(point, i) {
                var px = toPixel(point);

                // Outer ring
                ctx.beginPath();
                ctx.arc(px.x, px.y, 10, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fill();

                // Inner filled circle
                ctx.beginPath();
                ctx.arc(px.x, px.y, 7, 0, Math.PI * 2);
                ctx.fillStyle = zoneColor;
                ctx.fill();

                // Point number
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((i + 1).toString(), px.x, px.y);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            });

            // Draw solid lines between placed points
            if (this._currentZone.length > 1) {
                ctx.beginPath();
                var first = toPixel(this._currentZone[0]);
                ctx.moveTo(first.x, first.y);
                for (var i = 1; i < this._currentZone.length; i++) {
                    var pt = toPixel(this._currentZone[i]);
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.strokeStyle = zoneColor;
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            // Draw preview line from last point to mouse cursor
            if (this._mousePos && this._currentZone.length > 0) {
                var lastPx = toPixel(this._currentZone[this._currentZone.length - 1]);
                var mousePx = toPixel(this._mousePos);

                // Dashed line to cursor
                ctx.beginPath();
                ctx.moveTo(lastPx.x, lastPx.y);
                ctx.lineTo(mousePx.x, mousePx.y);
                ctx.strokeStyle = zoneColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Show closing line preview (to first point) if we have 2+ points
                if (this._currentZone.length >= 2) {
                    var firstPx = toPixel(this._currentZone[0]);
                    ctx.beginPath();
                    ctx.moveTo(mousePx.x, mousePx.y);
                    ctx.lineTo(firstPx.x, firstPx.y);
                    ctx.strokeStyle = 'rgba(255, 217, 61, 0.3)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Cursor dot
                ctx.beginPath();
                ctx.arc(mousePx.x, mousePx.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = zoneColor;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    };

    ZoneMonitorWidget.prototype.updateZoneList = function() {
        var self = this;
        this._zoneListEl.innerHTML = '';

        if (this._zones.length === 0) {
            this._zoneListEl.innerHTML = '<p class="moon-no-zones">No zones defined. Click "Draw Zone" to create one.</p>';
            return;
        }

        this._zones.forEach(function(zone, index) {
            var item = Utils.createElement('div', 'moon-zone-item');
            item.innerHTML = '<span class="moon-zone-color" style="background:' + zone.color + '"></span>' +
                '<span class="moon-zone-name">' + zone.name + '</span>' +
                '<button class="moon-btn moon-btn-sm moon-btn-delete">×</button>';

            item.querySelector('.moon-btn-delete').onclick = function() {
                self._zones.splice(index, 1);
                self.redrawZones();
                self.updateZoneList();
            };

            self._zoneListEl.appendChild(item);
        });
    };

    ZoneMonitorWidget.prototype.checkZones = function() {
        var self = this;
        var frame = this.getCurrentFrame();
        var objectName = this._detectInput.value.trim();

        if (!frame) {
            this.showError('Please start webcam or upload an image first');
            return;
        }
        if (this._zones.length === 0) {
            this.showError('Please draw at least one zone first');
            return;
        }
        if (!objectName) {
            this.showError('Please enter what to detect');
            return;
        }

        this.hideError();
        this.setLoading(true, 'Checking...');

        ApiClient.detect(frame, objectName).then(function(response) {
            self.setLoading(false);
            self.analyzeZoneIntrusions(response.objects || [], objectName);
        }).catch(function(err) {
            self.setLoading(false);
            self.showError(err.message);
        });
    };

    ZoneMonitorWidget.prototype.analyzeZoneIntrusions = function(objects, objectName) {
        var self = this;
        this.redrawZones();

        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        // Helper to convert normalized coords to canvas pixels
        function toPixel(point) {
            return { x: point.x * w, y: point.y * h };
        }

        this._alertsEl.innerHTML = '';
        var alerts = [];

        // Draw detected objects and check zone intrusions
        objects.forEach(function(obj, objIndex) {
            // Object center in normalized coordinates (API returns 0-1)
            var objCenterNorm = {
                x: (obj.x_min + obj.x_max) / 2,
                y: (obj.y_min + obj.y_max) / 2
            };

            var inZone = false;
            var zoneName = '';

            // Check each zone (zone points are in normalized 0-1 coordinates)
            self._zones.forEach(function(zone) {
                if (CanvasUtils.pointInPolygon(objCenterNorm, zone.points)) {
                    inZone = true;
                    zoneName = zone.name;

                    // Highlight the zone (convert to pixels for drawing)
                    var pixelPoints = zone.points.map(toPixel);
                    CanvasUtils.drawZone(ctx, pixelPoints, CONFIG.colors.error, zone.name + ' - ALERT!', true);
                }
            });

            // Draw object bounding box
            var color = inZone ? CONFIG.colors.error : CONFIG.colors.detect;
            CanvasUtils.drawBoundingBox(ctx, obj, color, objectName + ' ' + (objIndex + 1), w, h);

            if (inZone) {
                alerts.push(objectName + ' detected in ' + zoneName);
            }
        });

        // Display alerts
        if (alerts.length > 0) {
            alerts.forEach(function(alert) {
                var alertEl = Utils.createElement('div', 'moon-alert-item moon-alert-danger');
                alertEl.innerHTML = '⚠️ ' + Utils.escapeHTML(alert);
                self._alertsEl.appendChild(alertEl);
            });
        } else if (objects.length > 0) {
            var safeEl = Utils.createElement('div', 'moon-alert-item moon-alert-safe');
            safeEl.innerHTML = '✓ ' + objects.length + ' ' + objectName + '(s) detected - none in restricted zones';
            this._alertsEl.appendChild(safeEl);
        } else {
            var noneEl = Utils.createElement('div', 'moon-alert-item');
            noneEl.innerHTML = 'No ' + objectName + ' detected in scene';
            this._alertsEl.appendChild(noneEl);
        }
    };

    ZoneMonitorWidget.prototype.toggleMonitoring = function(btn) {
        var self = this;
        if (this._continuousInterval) {
            this.stopContinuous();
            btn.textContent = '▶ Start Monitoring';
            btn.classList.remove('moon-btn-active');
        } else {
            if (!MediaCapture.stream) {
                this.showError('Start webcam for monitoring');
                return;
            }
            if (this._zones.length === 0) {
                this.showError('Draw at least one zone first');
                return;
            }
            btn.textContent = '■ Stop Monitoring';
            btn.classList.add('moon-btn-active');
            this.startContinuous(function() {
                self.checkZones();
            }, 2000);
        }
    };

    // ============================================================
    // WIDGET 6: PRODUCTION MONITOR (ShotSquire-style)
    // ============================================================
    /**
     * ProductionMonitorWidget - Comprehensive video production quality dashboard.
     *
     * Combines traditional computer vision (MediaPipe, OpenCV) with MoonDream's
     * visual reasoning for a hybrid approach to shot quality analysis.
     *
     * MONITORS (7 total):
     * | Monitor     | Source     | What It Checks                    |
     * |-------------|------------|-----------------------------------|
     * | Orientation | MediaPipe  | Is subject facing camera?         |
     * | Talking     | MediaPipe  | Is subject speaking?              |
     * | Focus       | Canvas     | Is image sharp (Laplacian)?       |
     * | Lighting    | Canvas     | Is scene properly exposed?        |
     * | Presence    | MoonDream  | Is a face detected in frame?      |
     * | Composition | MoonDream  | Is subject well-framed?           |
     * | Scene       | MoonDream  | AI description of what's happening|
     *
     * Status Colors:
     * - Green (good): Optimal conditions
     * - Yellow (warning): Suboptimal but acceptable
     * - Red (problem): Needs attention
     *
     * Features:
     * - Real-time status cards with visual indicators
     * - Click to toggle individual monitors
     * - Scene description with AI analysis
     * - Adjustable monitoring interval
     *
     * External libraries:
     * - MediaPipe Face Mesh (loaded dynamically)
     *
     * @extends WidgetBase
     */
    function ProductionMonitorWidget() {
        WidgetBase.call(this,
            'production-monitor',
            'Production Monitor',
            '🎥',
            'Real-time production quality monitoring combining client-side CV with MoonDream visual reasoning.'
        );
        this._monitors = {
            orientation: { enabled: true, status: 'N/A', class: 'disabled' },
            talking: { enabled: true, status: 'N/A', class: 'disabled' },
            focus: { enabled: true, status: 'N/A', class: 'disabled' },
            lighting: { enabled: true, status: 'N/A', class: 'disabled' },
            presence: { enabled: true, status: 'N/A', class: 'disabled' },
            composition: { enabled: true, status: 'N/A', class: 'disabled' },
            sceneContext: { enabled: true, status: 'N/A', class: 'disabled' }
        };
        this._faceMesh = null;
        this._cvReady = false;
        this._isMonitoring = false;
        this._monitorInterval = null;
        this._landmarkHistory = [];
        this._talkingState = { isTalking: false, lastChange: Date.now() };
        this._lastMoonDreamCall = 0;
    }
    ProductionMonitorWidget.prototype = Object.create(WidgetBase.prototype);

    ProductionMonitorWidget.prototype.render = function() {
        var self = this;

        var header = Utils.createElement('div', 'moon-widget-header');
        header.innerHTML = '<span class="moon-widget-icon">' + this.icon + '</span>' +
            '<h2 class="moon-widget-title">' + this.label + '</h2>' +
            '<p class="moon-widget-desc">' + this.description + '</p>';
        this.rootEl.appendChild(header);

        var body = Utils.createElement('div', 'moon-widget-body');
        var grid = Utils.createElement('div', 'moon-grid moon-grid-2');

        // Left column - media
        var leftCol = Utils.createElement('div', 'moon-col');
        leftCol.appendChild(this.createMediaSection());

        // Monitor controls
        var controlsSection = Utils.createElement('div', 'moon-section');
        var startBtn = Utils.createElement('button', 'moon-btn moon-btn-primary moon-btn-lg moon-btn-action moon-monitor-start', {
            textContent: '▶ Start Monitoring'
        });
        startBtn.onclick = function() {
            self.ensureApiKey(function() { self.toggleMonitoring(); });
        };
        controlsSection.appendChild(startBtn);

        var statusText = Utils.createElement('div', 'moon-monitor-status-text');
        statusText.textContent = 'Click monitors to enable/disable. Start monitoring to begin analysis.';
        controlsSection.appendChild(statusText);

        leftCol.appendChild(controlsSection);
        grid.appendChild(leftCol);

        // Right column - status cards
        var rightCol = Utils.createElement('div', 'moon-col');

        // Status cards grid
        var cardsGrid = Utils.createElement('div', 'moon-status-cards');

        var monitorConfig = [
            { key: 'orientation', label: 'Orientation', icon: '📐', source: 'MediaPipe' },
            { key: 'talking', label: 'Talking', icon: '🗣️', source: 'MediaPipe' },
            { key: 'focus', label: 'Focus', icon: '🎯', source: 'OpenCV' },
            { key: 'lighting', label: 'Lighting', icon: '💡', source: 'Canvas' },
            { key: 'presence', label: 'Presence', icon: '👁️', source: 'MoonDream' },
            { key: 'composition', label: 'Composition', icon: '🖼️', source: 'MoonDream' },
            { key: 'sceneContext', label: 'Scene Context', icon: '🎬', source: 'MoonDream' }
        ];

        monitorConfig.forEach(function(config) {
            var card = Utils.createElement('div', 'moon-status-card moon-status-disabled');
            card.dataset.monitor = config.key;
            card.innerHTML =
                '<div class="moon-status-card-header">' +
                    '<span class="moon-status-icon">' + config.icon + '</span>' +
                    '<span class="moon-status-label">' + config.label + '</span>' +
                    '<span class="moon-status-source">' + config.source + '</span>' +
                '</div>' +
                '<div class="moon-status-value">N/A</div>';
            card.onclick = function() { self.toggleMonitor(config.key); };
            cardsGrid.appendChild(card);
            self._monitors[config.key].element = card;
        });

        rightCol.appendChild(cardsGrid);

        // Scene description area
        var sceneSection = Utils.createElement('div', 'moon-section moon-scene-description');
        sceneSection.innerHTML = '<h4>Scene Description</h4>' +
            '<div class="moon-scene-text">Start monitoring to see AI scene analysis...</div>';
        rightCol.appendChild(sceneSection);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);

        this._startBtn = startBtn;
        this._statusText = statusText;
        this._sceneText = sceneSection.querySelector('.moon-scene-text');

        // Initialize CV libraries
        this.initCV();
    };

    ProductionMonitorWidget.prototype.initCV = function() {
        var self = this;

        // Load MediaPipe FaceMesh
        if (typeof FaceMesh !== 'undefined') {
            this.setupFaceMesh();
        } else {
            // Dynamically load MediaPipe
            var script1 = document.createElement('script');
            script1.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
            script1.onload = function() {
                var script2 = document.createElement('script');
                script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
                script2.onload = function() {
                    self.setupFaceMesh();
                };
                document.head.appendChild(script2);
            };
            document.head.appendChild(script1);
        }

        // Check for OpenCV
        if (typeof cv !== 'undefined' && cv.Mat) {
            this._cvReady = true;
        } else {
            // Try to load OpenCV
            var cvScript = document.createElement('script');
            cvScript.src = 'https://docs.opencv.org/4.x/opencv.js';
            cvScript.onload = function() {
                if (typeof cv !== 'undefined') {
                    cv['onRuntimeInitialized'] = function() {
                        self._cvReady = true;
                    };
                }
            };
            document.head.appendChild(cvScript);
        }
    };

    ProductionMonitorWidget.prototype.setupFaceMesh = function() {
        var self = this;
        if (typeof FaceMesh === 'undefined') {
            console.warn('FaceMesh not available');
            return;
        }

        this._faceMesh = new FaceMesh({
            locateFile: function(file) {
                return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + file;
            }
        });

        this._faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this._faceMesh.onResults(function(results) {
            self.processFrameResults(results);
        });

    };

    ProductionMonitorWidget.prototype.toggleMonitor = function(key) {
        var monitor = this._monitors[key];
        if (!monitor) return;

        monitor.enabled = !monitor.enabled;
        if (monitor.element) {
            if (monitor.enabled) {
                monitor.element.classList.remove('moon-status-off');
            } else {
                monitor.element.classList.add('moon-status-off');
                this.updateMonitorStatus(key, 'OFF', 'disabled');
            }
        }
    };

    ProductionMonitorWidget.prototype.updateMonitorStatus = function(key, status, statusClass) {
        var monitor = this._monitors[key];
        if (!monitor || !monitor.element) return;

        monitor.status = status;
        monitor.class = statusClass;

        var valueEl = monitor.element.querySelector('.moon-status-value');
        if (valueEl) valueEl.textContent = status;

        monitor.element.classList.remove('moon-status-good', 'moon-status-bad', 'moon-status-warning', 'moon-status-disabled');
        monitor.element.classList.add('moon-status-' + statusClass);
    };

    ProductionMonitorWidget.prototype.toggleMonitoring = function() {
        if (this._isMonitoring) {
            this.stopMonitoring();
        } else {
            this.startMonitoring();
        }
    };

    ProductionMonitorWidget.prototype.startMonitoring = function() {
        var self = this;

        if (!MediaCapture.stream && !this._currentImage) {
            this.showError('Please start webcam or upload an image first');
            return;
        }

        this._isMonitoring = true;
        this._startBtn.textContent = '■ Stop Monitoring';
        this._startBtn.classList.add('moon-btn-active');
        this._statusText.textContent = 'Monitoring active...';

        // Reset all monitors to initializing
        Object.keys(this._monitors).forEach(function(key) {
            if (self._monitors[key].enabled) {
                self.updateMonitorStatus(key, 'Analyzing...', 'warning');
            }
        });

        // Start monitoring loop
        this.runMonitoringCycle();
        this._monitorInterval = setInterval(function() {
            self.runMonitoringCycle();
        }, 1500);
    };

    ProductionMonitorWidget.prototype.stopMonitoring = function() {
        this._isMonitoring = false;
        this._startBtn.textContent = '▶ Start Monitoring';
        this._startBtn.classList.remove('moon-btn-active');
        this._statusText.textContent = 'Monitoring stopped.';

        if (this._monitorInterval) {
            clearInterval(this._monitorInterval);
            this._monitorInterval = null;
        }
    };

    ProductionMonitorWidget.prototype.runMonitoringCycle = function() {
        var self = this;
        if (!this._isMonitoring) return;

        // Get current frame
        var video = this._media ? this._media.video : null;

        // Run client-side CV (MediaPipe)
        if (this._faceMesh && video && MediaCapture.stream) {
            this._faceMesh.send({ image: video }).catch(function(err) {
                console.warn('FaceMesh error:', err);
            });
        }

        // Run lighting analysis (doesn't need MediaPipe)
        if (this._monitors.lighting.enabled) {
            this.analyzeLighting();
        }

        // Run MoonDream analyses (throttled)
        var now = Date.now();
        if (now - this._lastMoonDreamCall > 2000) {
            this._lastMoonDreamCall = now;
            this.runMoonDreamAnalysis();
        }
    };

    ProductionMonitorWidget.prototype.processFrameResults = function(results) {
        var self = this;
        if (!this._isMonitoring) return;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            var landmarks = this.smoothLandmarks(results.multiFaceLandmarks[0]);

            // Orientation (MediaPipe)
            if (this._monitors.orientation.enabled) {
                this.analyzeOrientation(landmarks);
            }

            // Talking (MediaPipe)
            if (this._monitors.talking.enabled) {
                this.analyzeTalking(landmarks);
            }

            // Focus (OpenCV)
            if (this._monitors.focus.enabled && this._cvReady) {
                this.analyzeFocus(landmarks);
            }
        } else {
            // No face detected by MediaPipe
            if (this._monitors.orientation.enabled) {
                this.updateMonitorStatus('orientation', 'NO FACE', 'bad');
            }
            if (this._monitors.talking.enabled) {
                this.updateMonitorStatus('talking', 'NO FACE', 'bad');
            }
            if (this._monitors.focus.enabled) {
                this.updateMonitorStatus('focus', 'NO FACE', 'bad');
            }
        }
    };

    ProductionMonitorWidget.prototype.smoothLandmarks = function(newLandmarks) {
        this._landmarkHistory.push(newLandmarks);
        if (this._landmarkHistory.length > 5) {
            this._landmarkHistory.shift();
        }

        var numLandmarks = newLandmarks.length;
        var smoothed = [];

        for (var i = 0; i < numLandmarks; i++) {
            var sumX = 0, sumY = 0, sumZ = 0, count = 0;
            for (var j = 0; j < this._landmarkHistory.length; j++) {
                var frame = this._landmarkHistory[j];
                if (frame && frame[i]) {
                    sumX += frame[i].x;
                    sumY += frame[i].y;
                    if (frame[i].z) sumZ += frame[i].z;
                    count++;
                }
            }
            if (count > 0) {
                smoothed.push({ x: sumX / count, y: sumY / count, z: sumZ / count });
            } else {
                smoothed.push(newLandmarks[i]);
            }
        }

        return smoothed;
    };

    // Landmark indices
    var LANDMARKS = {
        NOSE_TIP: 1,
        LEFT_FACE: 234,
        RIGHT_FACE: 454,
        UPPER_LIP: 13,
        LOWER_LIP: 14,
        FOREHEAD: 10,
        CHIN: 152,
        LEFT_EYE: 33,
        RIGHT_EYE: 263
    };

    ProductionMonitorWidget.prototype.analyzeOrientation = function(landmarks) {
        var nose = landmarks[LANDMARKS.NOSE_TIP];
        var left = landmarks[LANDMARKS.LEFT_FACE];
        var right = landmarks[LANDMARKS.RIGHT_FACE];

        if (!nose || !left || !right) {
            this.updateMonitorStatus('orientation', 'ERROR', 'warning');
            return;
        }

        var noseToLeft = Math.abs(nose.x - left.x);
        var noseToRight = Math.abs(nose.x - right.x);
        var diff = Math.abs(noseToLeft - noseToRight);

        if (diff <= 0.15) {
            this.updateMonitorStatus('orientation', 'STRAIGHT', 'good');
        } else {
            var direction = noseToLeft > noseToRight ? 'LEFT' : 'RIGHT';
            this.updateMonitorStatus('orientation', direction, 'bad');
        }
    };

    ProductionMonitorWidget.prototype.analyzeTalking = function(landmarks) {
        var upperLip = landmarks[LANDMARKS.UPPER_LIP];
        var lowerLip = landmarks[LANDMARKS.LOWER_LIP];

        if (!upperLip || !lowerLip) {
            this.updateMonitorStatus('talking', 'ERROR', 'warning');
            return;
        }

        var distance = Math.abs(upperLip.y - lowerLip.y);
        // Threshold tuned for normalized coordinates (0-1 range)
        // Typical closed mouth: ~0.01-0.015, talking: >0.02
        var isTalking = distance > 0.018;
        var now = Date.now();

        // Update immediately but with short debounce to prevent flicker
        if (isTalking !== this._talkingState.isTalking) {
            if (now - this._talkingState.lastChange > 150) {
                this._talkingState.isTalking = isTalking;
                this._talkingState.lastChange = now;
            }
        }

        // Always show current state based on actual measurement
        if (isTalking) {
            this.updateMonitorStatus('talking', 'TALKING', 'good');
        } else {
            this.updateMonitorStatus('talking', 'SILENT', 'warning');
        }
    };

    ProductionMonitorWidget.prototype.analyzeFocus = function(landmarks) {
        if (!this._cvReady || typeof cv === 'undefined') {
            this.updateMonitorStatus('focus', 'CV N/A', 'warning');
            return;
        }

        var leftEye = landmarks[LANDMARKS.LEFT_EYE];
        var rightEye = landmarks[LANDMARKS.RIGHT_EYE];
        var nose = landmarks[LANDMARKS.NOSE_TIP];

        if (!leftEye || !rightEye || !nose) {
            this.updateMonitorStatus('focus', 'NO DATA', 'warning');
            return;
        }

        try {
            var source = this._media.video || this._media.imageCanvas;
            if (!source) {
                this.updateMonitorStatus('focus', 'NO SOURCE', 'warning');
                return;
            }

            // Get dimensions
            var w, h;
            if (source.tagName === 'VIDEO') {
                w = source.videoWidth;
                h = source.videoHeight;
            } else {
                w = source.width;
                h = source.height;
            }

            if (!w || !h || w < 40 || h < 40) {
                this.updateMonitorStatus('focus', 'WAITING', 'warning');
                return;
            }

            // Create temp canvas to capture video frame
            if (!this._focusCanvas) {
                this._focusCanvas = document.createElement('canvas');
            }
            this._focusCanvas.width = w;
            this._focusCanvas.height = h;
            var ctx = this._focusCanvas.getContext('2d');
            ctx.drawImage(source, 0, 0, w, h);

            // Sample region around face center
            var centerX = ((leftEye.x + rightEye.x + nose.x) / 3) * w;
            var centerY = ((leftEye.y + rightEye.y + nose.y) / 3) * h;
            var size = 40;
            var x = Math.max(0, Math.min(Math.floor(centerX - size/2), w - size));
            var y = Math.max(0, Math.min(Math.floor(centerY - size/2), h - size));

            var imgData = ctx.getImageData(x, y, size, size);
            var mat = cv.matFromImageData(imgData);
            var gray = new cv.Mat();
            cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
            var lap = new cv.Mat();
            cv.Laplacian(gray, lap, cv.CV_64F);
            var mean = new cv.Mat();
            var stdDev = new cv.Mat();
            cv.meanStdDev(lap, mean, stdDev);
            var variance = stdDev.doubleAt(0, 0);

            mat.delete(); gray.delete(); lap.delete(); mean.delete(); stdDev.delete();

            if (variance > 12) {
                this.updateMonitorStatus('focus', 'SHARP', 'good');
            } else if (variance > 6) {
                this.updateMonitorStatus('focus', 'OK', 'warning');
            } else {
                this.updateMonitorStatus('focus', 'BLURRY', 'bad');
            }
        } catch (e) {
            console.warn('Focus analysis error:', e);
            this.updateMonitorStatus('focus', 'CV ERROR', 'warning');
        }
    };

    ProductionMonitorWidget.prototype.analyzeLighting = function() {
        var source = this._media ? this._media.video : null;
        var imageCanvas = this._media ? this._media.imageCanvas : null;

        // Determine source and dimensions
        var w, h, drawSource;
        if (source && source.tagName === 'VIDEO' && source.videoWidth > 0) {
            w = source.videoWidth;
            h = source.videoHeight;
            drawSource = source;
        } else if (imageCanvas && imageCanvas.width > 0) {
            w = imageCanvas.width;
            h = imageCanvas.height;
            drawSource = imageCanvas;
        } else {
            this.updateMonitorStatus('lighting', 'N/A', 'disabled');
            return;
        }

        try {
            // Create/reuse temp canvas for analysis
            if (!this._lightingCanvas) {
                this._lightingCanvas = document.createElement('canvas');
            }
            this._lightingCanvas.width = w;
            this._lightingCanvas.height = h;
            var ctx = this._lightingCanvas.getContext('2d');
            ctx.drawImage(drawSource, 0, 0, w, h);

            var imgData = ctx.getImageData(0, 0, w, h);
            var data = imgData.data;

            var totalBrightness = 0;
            var pixelCount = data.length / 4;
            for (var i = 0; i < data.length; i += 4) {
                // Standard luminance formula
                totalBrightness += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
            }
            var avgBrightness = totalBrightness / pixelCount;

            // Thresholds for 0-255 brightness scale
            if (avgBrightness < 50) {
                this.updateMonitorStatus('lighting', 'DARK', 'bad');
            } else if (avgBrightness < 90) {
                this.updateMonitorStatus('lighting', 'DIM', 'warning');
            } else if (avgBrightness > 220) {
                this.updateMonitorStatus('lighting', 'OVEREXPOSED', 'bad');
            } else if (avgBrightness > 180) {
                this.updateMonitorStatus('lighting', 'BRIGHT', 'warning');
            } else {
                this.updateMonitorStatus('lighting', 'GOOD', 'good');
            }
        } catch (e) {
            console.warn('Lighting analysis error:', e);
            this.updateMonitorStatus('lighting', 'ERROR', 'warning');
        }
    };

    ProductionMonitorWidget.prototype.runMoonDreamAnalysis = function() {
        var self = this;
        var frame = this.getCurrentFrame();
        if (!frame) return;

        // Presence and Composition analysis using single /detect call
        var needsDetect = this._monitors.presence.enabled || this._monitors.composition.enabled;
        if (needsDetect) {
            ApiClient.detect(frame, 'face').then(function(response) {
                var objects = response.objects || [];

                // Update Presence (from same API call)
                if (self._monitors.presence.enabled) {
                    if (objects.length > 0) {
                        self.updateMonitorStatus('presence', 'PRESENT', 'good');
                    } else {
                        self.updateMonitorStatus('presence', 'ABSENT', 'bad');
                    }
                }

                // Update Composition
                if (self._monitors.composition.enabled) {
                    if (objects.length === 0) {
                        self.updateMonitorStatus('composition', 'NO FACE', 'bad');
                        return;
                    }

                    var face = objects[0];
                    var centerX = (face.x_min + face.x_max) / 2;
                    var centerY = (face.y_min + face.y_max) / 2;
                    var faceWidth = face.x_max - face.x_min;
                    var faceHeight = face.y_max - face.y_min;

                    // Analyze composition
                    var issues = [];

                    // Check framing (face size)
                    if (faceWidth > 0.5 || faceHeight > 0.6) {
                        issues.push('TOO CLOSE');
                    } else if (faceWidth < 0.15 && faceHeight < 0.2) {
                        issues.push('TOO FAR');
                    }

                    // Check position
                    if (centerX < 0.3) issues.push('→ RIGHT');
                    else if (centerX > 0.7) issues.push('← LEFT');
                    if (centerY < 0.25) issues.push('↓ DOWN');
                    else if (centerY > 0.75) issues.push('↑ UP');

                    if (issues.length === 0) {
                        self.updateMonitorStatus('composition', 'GOOD', 'good');
                    } else {
                        self.updateMonitorStatus('composition', issues.join(' '), 'bad');
                    }

                    // Draw composition overlay
                    self.drawCompositionOverlay(face);
                }
            }).catch(function(err) {
                if (self._monitors.presence.enabled) {
                    self.updateMonitorStatus('presence', 'ERROR', 'warning');
                }
                if (self._monitors.composition.enabled) {
                    self.updateMonitorStatus('composition', 'ERROR', 'warning');
                }
            });
        }

        // Scene context using /caption
        if (this._monitors.sceneContext.enabled) {
            ApiClient.caption(frame, 'normal').then(function(response) {
                var caption = response.caption || 'No description';
                self.updateMonitorStatus('sceneContext', 'UPDATED', 'good');
                if (self._sceneText) {
                    self._sceneText.textContent = caption;
                }
            }).catch(function(err) {
                self.updateMonitorStatus('sceneContext', 'ERROR', 'warning');
            });
        }
    };

    ProductionMonitorWidget.prototype.drawCompositionOverlay = function(face) {
        if (!this.overlayCanvas || !this.overlayCtx) return;

        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Draw rule of thirds grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;

        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(w/3, 0); ctx.lineTo(w/3, h);
        ctx.moveTo(2*w/3, 0); ctx.lineTo(2*w/3, h);
        // Horizontal lines
        ctx.moveTo(0, h/3); ctx.lineTo(w, h/3);
        ctx.moveTo(0, 2*h/3); ctx.lineTo(w, 2*h/3);
        ctx.stroke();

        // Draw face bounding box
        var x = face.x_min * w;
        var y = face.y_min * h;
        var bw = (face.x_max - face.x_min) * w;
        var bh = (face.y_max - face.y_min) * h;

        ctx.strokeStyle = CONFIG.colors.detect;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, bw, bh);

        // Draw center point
        var cx = (face.x_min + face.x_max) / 2 * w;
        var cy = (face.y_min + face.y_max) / 2 * h;
        ctx.fillStyle = CONFIG.colors.detect;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
    };

    ProductionMonitorWidget.prototype.unmount = function() {
        this.stopMonitoring();
        WidgetBase.prototype.unmount.call(this);
    };

    // ============================================================
    // WIDGET 7: PTZ AUTO-TRACKER
    // ============================================================
    /**
     * PTZTrackerWidget - AI-powered PTZ camera auto-tracking.
     *
     * Uses MoonDream to detect any specified object and automatically
     * sends pan/tilt commands to a PTZ camera to keep the object centered.
     *
     * TRACKING ALGORITHM:
     * 1. Capture frame from webcam (can be PTZ camera's NDI feed)
     * 2. Send to MoonDream /detect endpoint for target object
     * 3. Calculate center point of detected object
     * 4. Compare to frame center, determine offset
     * 5. If outside deadzone, send PTZ command to move toward center
     * 6. Repeat at configured interval
     *
     * PTZ CONTROL:
     * - Sends HTTP CGI commands compatible with PTZOptics cameras
     * - URL format: http://{IP}/cgi-bin/ptzctrl.cgi?ptzcmd&{direction}&{speed}
     * - Simulation mode available for testing without camera
     *
     * PRESETS:
     * | Preset   | Rate    | Speed | Deadzone | Use Case         |
     * |----------|---------|-------|----------|------------------|
     * | Smooth   | 0.5/sec | 3     | 12%      | Broadcast        |
     * | Balanced | 1.0/sec | 5     | 5%       | General use      |
     * | Precise  | 1.5/sec | 6     | 2%       | Presentations    |
     * | Fast     | 2.0/sec | 8     | 8%       | Sports/Action    |
     *
     * Features:
     * - Configurable target object (person, face, hand, ball, etc.)
     * - Adjustable detection rate and movement speed
     * - Visual overlay showing target position and movement direction
     * - Real-time status display
     * - Simulation mode for testing
     *
     * API used: /detect endpoint
     *
     * @extends WidgetBase
     */
    function PTZTrackerWidget() {
        WidgetBase.call(this,
            'ptz-tracker',
            'PTZ Auto-Tracker',
            '🎯',
            'AI-powered object tracking that automatically controls PTZ cameras to keep subjects centered in frame.'
        );
        this._isTracking = false;
        this._trackingInterval = null;
        this._currentDetection = null;
        this._ptzSettings = {
            cameraIP: '',
            targetObject: 'person',
            detectionRate: 1.0,
            panSpeed: 5,
            tiltSpeed: 5,
            deadzoneX: 5,
            deadzoneY: 5
        };
        this._presets = {
            smooth: { name: 'Smooth (Broadcast)', rate: 0.5, speed: 3, deadzone: 12 },
            balanced: { name: 'Balanced (General)', rate: 1.0, speed: 5, deadzone: 5 },
            precise: { name: 'Precise (Presentation)', rate: 1.5, speed: 6, deadzone: 2 },
            fast: { name: 'Fast (Sports/Action)', rate: 2.0, speed: 8, deadzone: 8 }
        };
    }
    PTZTrackerWidget.prototype = Object.create(WidgetBase.prototype);

    PTZTrackerWidget.prototype.render = function() {
        var self = this;

        var header = Utils.createElement('div', 'moon-widget-header');
        header.innerHTML = '<span class="moon-widget-icon">' + this.icon + '</span>' +
            '<h2 class="moon-widget-title">' + this.label + '</h2>' +
            '<p class="moon-widget-desc">' + this.description + '</p>';
        this.rootEl.appendChild(header);

        var body = Utils.createElement('div', 'moon-widget-body');
        var grid = Utils.createElement('div', 'moon-grid moon-grid-2');

        // Left column - Video
        var leftCol = Utils.createElement('div', 'moon-col');
        leftCol.appendChild(this.createMediaSection());

        // NDI tip for PTZ users
        var ndiTip = Utils.createElement('div', 'moon-ptz-ndi-tip');
        ndiTip.innerHTML = '<strong>💡 Tip:</strong> Use free <a href="https://ndi.video/tools/ndi-tools/" target="_blank" rel="noopener">NDI Webcam</a> software to bring your PTZ camera\'s NDI feed into this app as a webcam source for preview.';
        leftCol.appendChild(ndiTip);

        // Tracking status overlay indicator (under video controls)
        var statusOverlay = Utils.createElement('div', 'moon-ptz-status-overlay');
        statusOverlay.innerHTML = '<span class="moon-ptz-status-dot"></span><span class="moon-ptz-status-text">Ready</span>';
        leftCol.appendChild(statusOverlay);
        this._statusOverlay = statusOverlay;

        // Tracking Status Display (under video)
        var statusSection = Utils.createElement('div', 'moon-section moon-ptz-tracking-status');
        statusSection.innerHTML =
            '<h3 class="moon-section-title">Tracking Status</h3>' +
            '<div class="moon-ptz-status-grid">' +
                '<div class="moon-ptz-stat">' +
                    '<div class="moon-ptz-stat-label">Object</div>' +
                    '<div class="moon-ptz-stat-value moon-ptz-object-status">--</div>' +
                '</div>' +
                '<div class="moon-ptz-stat">' +
                    '<div class="moon-ptz-stat-label">Position</div>' +
                    '<div class="moon-ptz-stat-value moon-ptz-position-status">--</div>' +
                '</div>' +
                '<div class="moon-ptz-stat">' +
                    '<div class="moon-ptz-stat-label">PTZ Command</div>' +
                    '<div class="moon-ptz-stat-value moon-ptz-command-status">--</div>' +
                '</div>' +
                '<div class="moon-ptz-stat">' +
                    '<div class="moon-ptz-stat-label">Detections</div>' +
                    '<div class="moon-ptz-stat-value moon-ptz-fps-status">0</div>' +
                '</div>' +
            '</div>';
        leftCol.appendChild(statusSection);
        this._statusSection = statusSection;

        grid.appendChild(leftCol);

        // Right column - Controls
        var rightCol = Utils.createElement('div', 'moon-col');

        // PTZ Camera IP
        var ipGroup = Utils.createElement('div', 'moon-input-group');
        ipGroup.innerHTML = '<label class="moon-label">PTZ Camera IP Address:</label>';
        var ipInput = Utils.createElement('input', 'moon-input', {
            type: 'text',
            placeholder: '192.168.1.100'
        });
        ipGroup.appendChild(ipInput);
        var ipHint = Utils.createElement('small', 'moon-input-hint');
        ipHint.textContent = 'Your PTZ camera must support HTTP CGI control';
        ipGroup.appendChild(ipHint);
        rightCol.appendChild(ipGroup);
        this._ipInput = ipInput;

        // Target Object
        var targetGroup = Utils.createElement('div', 'moon-input-group');
        targetGroup.innerHTML = '<label class="moon-label">Target Object to Track:</label>';
        var targetInput = Utils.createElement('input', 'moon-input', {
            type: 'text',
            placeholder: 'person, face, hand, ball...',
            value: 'person'
        });
        targetGroup.appendChild(targetInput);

        // Quick presets for target
        var quickTargets = Utils.createElement('div', 'moon-quick-btns');
        ['person', 'face', 'hand'].forEach(function(target) {
            var btn = Utils.createElement('button', 'moon-btn-quick', { textContent: target });
            btn.onclick = function() { targetInput.value = target; };
            quickTargets.appendChild(btn);
        });
        targetGroup.appendChild(quickTargets);
        rightCol.appendChild(targetGroup);
        this._targetInput = targetInput;

        // Operation Style Preset
        var presetGroup = Utils.createElement('div', 'moon-input-group');
        presetGroup.innerHTML = '<label class="moon-label">Tracking Style:</label>';
        var presetSelect = Utils.createElement('select', 'moon-input');
        presetSelect.innerHTML =
            '<option value="smooth">Smooth (Broadcast) - 0.5/sec</option>' +
            '<option value="balanced" selected>Balanced (General) - 1.0/sec</option>' +
            '<option value="precise">Precise (Presentation) - 1.5/sec</option>' +
            '<option value="fast">Fast (Sports) - 2.0/sec</option>';
        presetSelect.onchange = function() {
            var preset = self._presets[presetSelect.value];
            if (preset) {
                rateSlider.value = preset.rate;
                rateValue.textContent = preset.rate.toFixed(1);
                self._ptzSettings.detectionRate = preset.rate;
                self._ptzSettings.panSpeed = preset.speed;
                self._ptzSettings.tiltSpeed = preset.speed;
                self._ptzSettings.deadzoneX = preset.deadzone;
                self._ptzSettings.deadzoneY = preset.deadzone;
            }
        };
        presetGroup.appendChild(presetSelect);
        rightCol.appendChild(presetGroup);
        this._presetSelect = presetSelect;

        // Detection Rate Slider
        var rateGroup = Utils.createElement('div', 'moon-input-group');
        var rateLabel = Utils.createElement('label', 'moon-label');
        rateLabel.innerHTML = 'Detection Rate: <span class="moon-rate-value">1.0</span>/sec';
        var rateValue = rateLabel.querySelector('.moon-rate-value');
        rateGroup.appendChild(rateLabel);

        var rateSlider = Utils.createElement('input', 'moon-input moon-slider', {
            type: 'range',
            min: '0.2',
            max: '3.0',
            step: '0.1',
            value: '1.0'
        });
        rateSlider.oninput = function() {
            var rate = parseFloat(rateSlider.value);
            rateValue.textContent = rate.toFixed(1);
            self._ptzSettings.detectionRate = rate;
            // If tracking, update interval
            if (self._isTracking) {
                self.restartTrackingInterval();
            }
        };
        rateGroup.appendChild(rateSlider);

        var rateHint = Utils.createElement('small', 'moon-input-hint');
        rateHint.textContent = 'Lower = less API usage, Higher = more responsive';
        rateGroup.appendChild(rateHint);
        rightCol.appendChild(rateGroup);
        this._rateSlider = rateSlider;
        this._rateValue = rateValue;

        // Simulation Mode Toggle
        var simGroup = Utils.createElement('div', 'moon-input-group moon-checkbox-group');
        var simLabel = Utils.createElement('label', 'moon-checkbox-label');
        var simCheckbox = Utils.createElement('input', '', { type: 'checkbox' });
        simCheckbox.checked = false; // Default to sending real PTZ commands
        simLabel.appendChild(simCheckbox);
        simLabel.appendChild(document.createTextNode(' Simulation Mode (no PTZ commands sent)'));
        simGroup.appendChild(simLabel);
        var simHint = Utils.createElement('small', 'moon-input-hint');
        simHint.textContent = 'Check to test without sending commands to your camera';
        simGroup.appendChild(simHint);
        rightCol.appendChild(simGroup);
        this._simCheckbox = simCheckbox;

        // Action Buttons
        var actions = Utils.createElement('div', 'moon-actions');

        var startBtn = Utils.createElement('button', 'moon-btn moon-btn-success moon-btn-lg moon-btn-action', {
            textContent: '▶ Start Tracking'
        });
        startBtn.onclick = function() {
            self.ensureApiKey(function() { self.startTracking(); });
        };
        actions.appendChild(startBtn);
        this._startBtn = startBtn;

        var stopBtn = Utils.createElement('button', 'moon-btn moon-btn-danger moon-btn-lg moon-btn-action', {
            textContent: '■ Stop Tracking',
            disabled: 'disabled'
        });
        stopBtn.onclick = function() { self.stopTracking(); };
        actions.appendChild(stopBtn);
        this._stopBtn = stopBtn;

        rightCol.appendChild(actions);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);
    };

    PTZTrackerWidget.prototype.startTracking = function() {
        var self = this;

        if (!MediaCapture.stream) {
            this.showError('Please start webcam first');
            return;
        }

        var target = this._targetInput.value.trim();
        if (!target) {
            this.showError('Please enter a target object to track');
            return;
        }

        var cameraIP = this._ipInput.value.trim();
        var isSimulation = this._simCheckbox.checked;

        if (!isSimulation && !cameraIP) {
            this.showError('Please enter PTZ camera IP or enable simulation mode');
            return;
        }

        this._ptzSettings.cameraIP = cameraIP;
        this._ptzSettings.targetObject = target;
        this._isTracking = true;
        this._detectionCount = 0;

        // Update UI
        this._startBtn.disabled = true;
        this._stopBtn.disabled = false;
        this._ipInput.disabled = true;
        this._targetInput.disabled = true;
        this._simCheckbox.disabled = true;

        this.updateStatusOverlay('tracking', 'Tracking: ' + target);
        this.hideError();

        // Start tracking loop
        this.trackingLoop();
        this.restartTrackingInterval();
    };

    PTZTrackerWidget.prototype.stopTracking = function() {
        this._isTracking = false;

        if (this._trackingInterval) {
            clearInterval(this._trackingInterval);
            this._trackingInterval = null;
        }

        // Send stop command to PTZ (if not simulation)
        if (!this._simCheckbox.checked && this._ptzSettings.cameraIP) {
            this.sendPTZCommand('stop');
        }

        // Clear overlay
        this.clearOverlay();
        this._currentDetection = null;

        // Update UI
        this._startBtn.disabled = false;
        this._stopBtn.disabled = true;
        this._ipInput.disabled = false;
        this._targetInput.disabled = false;
        this._simCheckbox.disabled = false;

        this.updateStatusOverlay('ready', 'Ready');
        this.updateTrackingStatus('--', '--', '--');
    };

    PTZTrackerWidget.prototype.restartTrackingInterval = function() {
        var self = this;
        if (this._trackingInterval) {
            clearInterval(this._trackingInterval);
        }
        var intervalMs = 1000 / this._ptzSettings.detectionRate;
        this._trackingInterval = setInterval(function() {
            self.trackingLoop();
        }, intervalMs);
    };

    PTZTrackerWidget.prototype.trackingLoop = function() {
        var self = this;
        if (!this._isTracking) return;

        var frame = this.getCurrentFrame();
        if (!frame) return;

        ApiClient.detect(frame, this._ptzSettings.targetObject).then(function(response) {
            if (!self._isTracking) return;

            self._detectionCount = (self._detectionCount || 0) + 1;
            var objects = response.objects || [];

            // Use first detection
            self._currentDetection = objects.length > 0 ? objects[0] : null;

            // Draw detection
            self.drawDetection(self._currentDetection);

            // Calculate PTZ command
            var ptzCommand = self.calculatePTZCommand(self._currentDetection);

            // Send PTZ command (or simulate)
            if (!self._simCheckbox.checked && self._ptzSettings.cameraIP) {
                self.sendPTZCommand(ptzCommand);
            }

            // Update status display
            var objectStatus = self._currentDetection ? 'DETECTED' : 'SEARCHING';
            var positionStatus = self._currentDetection ?
                self.getPositionDescription(self._currentDetection) : '--';
            var commandStatus = ptzCommand.toUpperCase();

            self.updateTrackingStatus(objectStatus, positionStatus, commandStatus);
            self.updateFPSDisplay();

        }).catch(function(err) {
            console.error('Tracking error:', err);
            // Continue tracking despite errors
        });
    };

    PTZTrackerWidget.prototype.drawDetection = function(detection) {
        this.clearOverlay();
        if (!detection || !this.overlayCtx) return;

        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        // Draw bounding box
        var color = '#00ff88';
        CanvasUtils.drawBoundingBox(ctx, detection, color, this._ptzSettings.targetObject, w, h);

        // Draw center crosshair on target
        var centerX = (detection.x_min + detection.x_max) / 2 * w;
        var centerY = (detection.y_min + detection.y_max) / 2 * h;

        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 15, centerY);
        ctx.lineTo(centerX + 15, centerY);
        ctx.moveTo(centerX, centerY - 15);
        ctx.lineTo(centerX, centerY + 15);
        ctx.stroke();

        // Draw frame center reference
        var frameCenterX = w / 2;
        var frameCenterY = h / 2;

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(frameCenterX - 30, frameCenterY);
        ctx.lineTo(frameCenterX + 30, frameCenterY);
        ctx.moveTo(frameCenterX, frameCenterY - 30);
        ctx.lineTo(frameCenterX, frameCenterY + 30);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw line from object to center
        ctx.strokeStyle = 'rgba(255,107,107,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(frameCenterX, frameCenterY);
        ctx.stroke();
    };

    PTZTrackerWidget.prototype.calculatePTZCommand = function(detection) {
        if (!detection) return 'stop';

        // Object position as percentage (0-100)
        var objectX = ((detection.x_min + detection.x_max) / 2) * 100;
        var objectY = ((detection.y_min + detection.y_max) / 2) * 100;

        // Target center (50% = true center)
        var targetX = 50;
        var targetY = 50;

        // Calculate offset
        var offsetX = objectX - targetX;
        var offsetY = objectY - targetY;

        // Half deadzone
        var halfDeadzoneX = this._ptzSettings.deadzoneX / 2;
        var halfDeadzoneY = this._ptzSettings.deadzoneY / 2;

        // Determine command (prioritize horizontal)
        if (offsetX > halfDeadzoneX) {
            return 'right';
        } else if (offsetX < -halfDeadzoneX) {
            return 'left';
        } else if (offsetY > halfDeadzoneY) {
            return 'down';
        } else if (offsetY < -halfDeadzoneY) {
            return 'up';
        }

        return 'centered';
    };

    PTZTrackerWidget.prototype.getPositionDescription = function(detection) {
        var x = ((detection.x_min + detection.x_max) / 2) * 100;
        var y = ((detection.y_min + detection.y_max) / 2) * 100;

        var hPos = x < 40 ? 'Left' : (x > 60 ? 'Right' : 'Center');
        var vPos = y < 40 ? 'Top' : (y > 60 ? 'Bottom' : 'Middle');

        return hPos + ' / ' + vPos;
    };

    PTZTrackerWidget.prototype.sendPTZCommand = function(command) {
        if (!this._ptzSettings.cameraIP) return;

        var endpoint = '';
        var speed = this._ptzSettings.panSpeed;

        switch (command) {
            case 'left':
                endpoint = 'ptzcmd&left&' + speed + '&' + speed;
                break;
            case 'right':
                endpoint = 'ptzcmd&right&' + speed + '&' + speed;
                break;
            case 'up':
                endpoint = 'ptzcmd&up&' + speed + '&' + speed;
                break;
            case 'down':
                endpoint = 'ptzcmd&down&' + speed + '&' + speed;
                break;
            case 'stop':
            case 'centered':
                endpoint = 'ptzcmd&ptzstop';
                break;
            default:
                return;
        }

        var url = 'http://' + this._ptzSettings.cameraIP + '/cgi-bin/ptzctrl.cgi?' + endpoint;

        fetch(url, { method: 'GET', mode: 'no-cors' }).catch(function(err) {
            // Silently handle - no-cors requests don't return readable responses
        });
    };

    PTZTrackerWidget.prototype.updateStatusOverlay = function(state, text) {
        if (!this._statusOverlay) return;
        var dot = this._statusOverlay.querySelector('.moon-ptz-status-dot');
        var textEl = this._statusOverlay.querySelector('.moon-ptz-status-text');

        this._statusOverlay.className = 'moon-ptz-status-overlay moon-ptz-status-' + state;
        textEl.textContent = text;
    };

    PTZTrackerWidget.prototype.updateTrackingStatus = function(object, position, command) {
        if (!this._statusSection) return;
        this._statusSection.querySelector('.moon-ptz-object-status').textContent = object;
        this._statusSection.querySelector('.moon-ptz-position-status').textContent = position;
        this._statusSection.querySelector('.moon-ptz-command-status').textContent = command;
    };

    PTZTrackerWidget.prototype.updateFPSDisplay = function() {
        if (!this._statusSection) return;
        this._statusSection.querySelector('.moon-ptz-fps-status').textContent = this._detectionCount || 0;
    };

    PTZTrackerWidget.prototype.unmount = function() {
        this.stopTracking();
        WidgetBase.prototype.unmount.call(this);
    };

    // ============================================================
    // WIDGET REGISTRY
    // ============================================================
    /**
     * WidgetRegistry - Maps widget IDs to their constructor functions.
     *
     * Used by Dashboard to instantiate widgets when user clicks a card.
     * To add a new widget:
     * 1. Create the widget class extending WidgetBase
     * 2. Add entry here: 'widget-id': WidgetClassName
     * 3. Add to WidgetList for card display
     * 4. Add to WidgetInfo for help content
     */
    var WidgetRegistry = {
        'object-detector': ObjectDetectorWidget,
        'smart-counter': SmartCounterWidget,
        'scene-analyzer': SceneAnalyzerWidget,
        'person-tracker': PersonTrackerWidget,
        'zone-monitor': ZoneMonitorWidget,
        'production-monitor': ProductionMonitorWidget,
        'ptz-tracker': PTZTrackerWidget
    };

    /**
     * WidgetList - Metadata for rendering the dashboard cards.
     *
     * Each entry defines how a widget appears in the main grid:
     * - id: Matches WidgetRegistry key
     * - label: Card title
     * - icon: Emoji displayed on card
     * - desc: Short description below title
     */
    var WidgetList = [
        { id: 'object-detector', label: 'Object Detector', icon: '🔍', desc: 'Find and locate any object in your scene with bounding boxes' },
        { id: 'smart-counter', label: 'Smart Counter', icon: '🔢', desc: 'Count specific objects with visual markers and totals' },
        { id: 'scene-analyzer', label: 'Scene Analyzer', icon: '🎬', desc: 'Get AI captions and ask questions about what you see' },
        { id: 'person-tracker', label: 'Person Tracker', icon: '👤', desc: 'Track and locate people with face or body detection' },
        { id: 'zone-monitor', label: 'Zone Monitor', icon: '🚧', desc: 'Draw zones and get alerts when objects enter them' },
        { id: 'production-monitor', label: 'Production Monitor', icon: '🎥', desc: 'Real-time video quality monitoring dashboard' },
        { id: 'ptz-tracker', label: 'PTZ Auto-Tracker', icon: '🎯', desc: 'AI-powered tracking that controls PTZ cameras automatically' }
    ];

    /**
     * WidgetInfo - Help content displayed in widget info modals.
     *
     * Each widget has three sections:
     * - whatItDoes: Technical description of functionality
     * - whyUseful: Real-world use cases and benefits
     * - tryThis: Step-by-step suggestion for trying the feature
     *
     * Content sourced from README.md for consistency.
     */
    var WidgetInfo = {
        'object-detector': {
            whatItDoes: 'You type in any object (like "coffee mug" or "chair") and the AI finds it in your image, drawing a colored box around each one it spots.',
            whyUseful: 'Imagine a camera that automatically knows when a specific product appears on screen, or tracks where the host is sitting. This is how smart cameras can follow action without a human operator.',
            tryThis: 'Point your webcam at your desk and search for "keyboard", "monitor", or "person". Watch how the AI outlines each object it finds.'
        },
        'smart-counter': {
            whatItDoes: 'Tell it what to count ("people", "cars", "books") and it marks each one with a dot and gives you a total.',
            whyUseful: 'Event producers use this to estimate crowd sizes. Retailers count customers. Warehouses track inventory. Instead of counting manually, AI does it instantly.',
            tryThis: 'Hold up your hand and count "fingers". Or point at a bookshelf and count "books". The AI places a marker on each item it finds.'
        },
        'scene-analyzer': {
            whatItDoes: 'Two features in one: Caption mode writes a sentence describing your entire scene. Q&A mode lets you ask questions and the AI answers based on what it sees.',
            whyUseful: 'This demo best showcases visual reasoning—the AI doesn\'t just list objects, it understands context and relationships. This is how accessibility features describe images to visually impaired users, and how AI can automatically generate descriptions for video archives.',
            tryThis: 'Click "Caption" to see how the AI describes your room. Then ask questions like "What color is the wall?" or "How many people are in the room?"'
        },
        'person-tracker': {
            whatItDoes: 'Automatically finds all people in the frame and draws boxes around them. Includes modes for finding faces specifically or detecting the full body.',
            whyUseful: 'This is the foundation of "auto-tracking" PTZ cameras that follow speakers around a room. It\'s also used in video conferencing to keep participants centered in frame.',
            tryThis: 'Turn on your webcam and select "Faces Only" to see your face highlighted. Try "Full Body" mode to see yourself fully outlined.'
        },
        'zone-monitor': {
            whatItDoes: 'You draw custom zones on your video feed, then the AI watches for specific objects entering those zones. When something you\'re looking for appears in your zone, it alerts you.',
            whyUseful: 'Security systems use this to detect when someone enters a restricted area. Sports broadcasts use it to know when a ball crosses a line. Production teams use it to trigger camera switches.',
            tryThis: 'Draw a zone by clicking to place points, then click "Finish Zone". Enter "face" in the detection field, start monitoring, and move in/out of your drawn zone to see the alert status change.'
        },
        'production-monitor': {
            whatItDoes: 'A comprehensive video production quality dashboard that combines traditional computer vision with MoonDream\'s visual reasoning. It monitors 7 different aspects of your shot in real-time: Orientation, Talking, Focus, Lighting, Presence, Composition, and Scene Context.',
            whyUseful: 'This is the kind of automated quality control that broadcast engineers dream of. Instead of manually checking that a speaker is in frame, facing the camera, properly lit, and in focus—the AI monitors everything continuously and alerts you to problems.',
            tryThis: 'Start your webcam and click "Start Monitoring". Watch the status cards turn green (good), yellow (warning), or red (problem). Move around, look away from camera, or cover the lens to see how each monitor responds.'
        },
        'ptz-tracker': {
            whatItDoes: 'Uses MoonDream AI to detect any object you specify, then automatically sends pan/tilt commands to your PTZ camera to keep that object centered in frame. Includes presets for different tracking styles from smooth broadcast movements to fast sports tracking.',
            whyUseful: 'This is real PTZ automation—no operator needed. Perfect for solo presenters, houses of worship, classrooms, or any situation where you want the camera to follow a subject automatically. Works with PTZOptics and other HTTP-controlled PTZ cameras.',
            tryThis: 'Start in Simulation Mode to see how it works without a PTZ camera. Enter "person" or "face" as target, start tracking, and watch the status display show what PTZ commands would be sent as you move around the frame.'
        }
    };

    // ============================================================
    // GETTING STARTED CONTENT
    // ============================================================
    /**
     * GettingStartedContent - Content for the Getting Started modal.
     *
     * Provides onboarding information for new users including:
     * - What visual reasoning is
     * - Setup requirements (API key, webcam)
     * - Step-by-step first-time setup
     * - Tips for best results
     * - Privacy information
     */
    var GettingStartedContent = {
        title: 'Getting Started with Visual Reasoning',
        sections: [
            {
                title: 'What Is Visual Reasoning?',
                content: 'Visual reasoning is AI\'s ability to not just see an image, but to understand and think about it. Traditional computer vision simply recognizes patterns—"that\'s a cat." Visual reasoning goes further—"that\'s a cat sitting on a red couch, looking at something outside the window."'
            },
            {
                title: 'What You\'ll Need',
                content: '<strong>1. A MoonDream API Key (free)</strong><br>Visit <a href="https://moondream.ai" target="_blank">moondream.ai</a>, create an account, and copy your API key.<br><br><strong>2. A Webcam or Images</strong><br>Any built-in or USB webcam works, or use "Upload Image" to analyze photos.'
            },
            {
                title: 'First-Time Setup',
                content: '1. Click "Set API Key" in the top bar and paste your key<br>2. Select any demo card below<br>3. Click "Start Webcam" or upload an image<br>4. Try the detection and analysis features!<br><br>Your API key is stored for this session only and clears when you close the tab.'
            },
            {
                title: 'Tips for Best Results',
                content: '• <strong>Lighting matters:</strong> Brighter, evenly-lit scenes work better<br>• <strong>Be specific:</strong> "red coffee mug" works better than "thing"<br>• <strong>Clear views:</strong> Partially hidden objects are harder to detect<br>• <strong>Try different words:</strong> If "person" doesn\'t work, try "human"'
            },
            {
                title: 'Privacy & Your Data',
                content: '• Your webcam feed stays local until you click an action<br>• Images are processed, not stored by MoonDream<br>• Your API key stays in your browser session only'
            }
        ]
    };

    // ============================================================
    // DASHBOARD (Card-based UI)
    // ============================================================
    /**
     * Dashboard - Main application controller and UI manager.
     *
     * The Dashboard is responsible for:
     * - Rendering the main card grid layout
     * - Managing navigation (header, API key status)
     * - Opening/closing widget modals
     * - Instantiating widgets from the registry
     * - Handling the Getting Started modal
     * - Managing overall application state
     *
     * UI Structure:
     * ┌─────────────────────────────────────────────────────┐
     * │ Header (Logo, Getting Started, API Key Status)     │
     * ├─────────────────────────────────────────────────────┤
     * │ Intro Text                                          │
     * ├─────────────────────────────────────────────────────┤
     * │ Card Grid                                           │
     * │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐           │
     * │ │Widget1│ │Widget2│ │Widget3│ │Widget4│           │
     * │ └───────┘ └───────┘ └───────┘ └───────┘           │
     * │ ┌───────┐ ┌───────┐ ┌───────┐                     │
     * │ │Widget5│ │Widget6│ │Widget7│                     │
     * │ └───────┘ └───────┘ └───────┘                     │
     * └─────────────────────────────────────────────────────┘
     *
     * @constructor
     * @param {HTMLElement} rootEl - Container element for the dashboard
     * @param {object} options     - Configuration options
     */
    function Dashboard(rootEl, options) {
        this.rootEl = rootEl;
        this.options = options || {};
        this.currentWidgetInstance = null;
        this.modalOpen = false;
        this.init();
    }

    /**
     * Initialize the dashboard.
     * Loads stored API key, renders UI, sets up event listeners.
     */
    Dashboard.prototype.init = function() {
        var storedKey = Utils.getStoredApiKey();
        if (storedKey) CONFIG.apiKey = storedKey;

        this.rootEl.innerHTML = '';
        this.rootEl.className = 'moon-app';

        // Top navigation bar
        this.header = Utils.createElement('header', 'moon-header');
        this.rootEl.appendChild(this.header);
        this.renderHeader();

        // Main content area (cards)
        this.main = Utils.createElement('main', 'moon-home');
        this.rootEl.appendChild(this.main);
        this.renderCards();

        // API key status (fixed lower right)
        this._keyStatusEl = Utils.createElement('div', 'moon-api-key-float');
        this.rootEl.appendChild(this._keyStatusEl);
        this.updateKeyStatus();

        // Modal container
        this.modalOverlay = Utils.createElement('div', 'moon-widget-modal-overlay');
        this.modalOverlay.style.display = 'none';
        this.rootEl.appendChild(this.modalOverlay);
        this.setupModal();
    };

    Dashboard.prototype.renderHeader = function() {
        this.header.innerHTML = '';

        // Brand (centered)
        var brand = Utils.createElement('div', 'moon-header-brand');
        brand.innerHTML = '<span class="moon-header-title">PTZOptics Visual Reasoning Playground</span>';
        this.header.appendChild(brand);
    };

    Dashboard.prototype.updateKeyStatus = function() {
        var self = this;
        var el = this._keyStatusEl;
        if (!el) return;

        if (CONFIG.apiKey) {
            el.innerHTML = '<span class="moon-key-badge moon-key-set">✓ API Key Set</span>' +
                '<button class="moon-btn moon-btn-sm moon-btn-secondary">Change Key</button>';
            el.querySelector('.moon-btn').onclick = function() {
                CONFIG.apiKey = null;
                Utils.storeApiKey(null);
                self.updateKeyStatus();
                ApiKeyModal.show(function() { self.updateKeyStatus(); });
            };
        } else {
            el.innerHTML = '<span class="moon-key-badge moon-key-missing">No API Key</span>' +
                '<button class="moon-btn moon-btn-sm moon-btn-primary">Set API Key</button>';
            el.querySelector('.moon-btn').onclick = function() {
                ApiKeyModal.show(function() { self.updateKeyStatus(); });
            };
        }
    };

    Dashboard.prototype.renderCards = function() {
        var self = this;

        this.main.innerHTML = '';

        // Intro text
        var intro = Utils.createElement('p', 'moon-home-intro');
        intro.textContent = 'This interactive playground shows how artificial intelligence can "see" and understand what\'s in your camera feed using visual reasoning.';
        this.main.appendChild(intro);

        // Card grid
        var grid = Utils.createElement('div', 'moon-card-grid');

        WidgetList.forEach(function(widget) {
            var card = Utils.createElement('div', 'moon-demo-card');
            card.innerHTML =
                '<span class="moon-demo-card-icon">' + widget.icon + '</span>' +
                '<h3 class="moon-demo-card-title">' + widget.label + '</h3>' +
                '<p class="moon-demo-card-desc">' + widget.desc + '</p>';
            card.onclick = function() { self.openWidget(widget.id); };
            grid.appendChild(card);
        });

        this.main.appendChild(grid);

        // Getting Started button (full width at bottom)
        var gettingStarted = Utils.createElement('button', 'moon-getting-started-btn');
        gettingStarted.innerHTML =
            '<span class="moon-getting-started-icon">📖</span>' +
            '<span class="moon-getting-started-text">' +
                '<strong>Getting Started</strong>' +
                '<span>Learn about Visual Reasoning & How to Use These Demos</span>' +
            '</span>';
        gettingStarted.onclick = function() { self.openGettingStarted(); };
        this.main.appendChild(gettingStarted);
    };

    Dashboard.prototype.setupModal = function() {
        var self = this;

        this.modalOverlay.innerHTML = '';

        // Modal container
        this.modal = Utils.createElement('div', 'moon-widget-modal');

        // Modal header with close button
        this.modalHeader = Utils.createElement('div', 'moon-widget-modal-header');
        this.modalTitle = Utils.createElement('h2', 'moon-widget-modal-title');
        var closeBtn = Utils.createElement('button', 'moon-widget-modal-close');
        closeBtn.innerHTML = '×';
        closeBtn.onclick = function() { self.closeModal(); };
        this.modalHeader.appendChild(this.modalTitle);
        this.modalHeader.appendChild(closeBtn);
        this.modal.appendChild(this.modalHeader);

        // Modal body (widget content goes here)
        this.modalBody = Utils.createElement('div', 'moon-widget-modal-body');
        this.modal.appendChild(this.modalBody);

        this.modalOverlay.appendChild(this.modal);

        // Click outside to close
        this.modalOverlay.onclick = function(e) {
            if (e.target === self.modalOverlay) {
                self.closeModal();
            }
        };

        // ESC key to close
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && self.modalOpen) {
                self.closeModal();
            }
        });
    };

    Dashboard.prototype.openWidget = function(widgetId) {
        var WidgetClass = WidgetRegistry[widgetId];
        if (!WidgetClass) return;

        var widget = WidgetList.find(function(w) { return w.id === widgetId; });
        this.modalTitle.innerHTML = '<span class="moon-widget-modal-icon">' + widget.icon + '</span> ' + widget.label;

        this.modalBody.innerHTML = '';
        this.modalBody.className = 'moon-widget-modal-body';

        this.currentWidgetInstance = new WidgetClass();
        this.currentWidgetInstance.mount(this.modalBody, { dashboard: this, isModal: true });

        // Remove the widget header since modal has its own, add spacer
        var widgetHeader = this.modalBody.querySelector('.moon-widget-header');
        if (widgetHeader) {
            widgetHeader.remove();
        }

        // Add spacer at top for breathing room
        var spacer = Utils.createElement('div', 'moon-modal-spacer');
        spacer.style.height = '24px';
        spacer.style.flexShrink = '0';
        var widgetBody = this.modalBody.querySelector('.moon-widget-body');
        if (widgetBody) {
            widgetBody.parentNode.insertBefore(spacer, widgetBody);
        }

        // Add info section as footer (outside modal body, at bottom of modal)
        var info = WidgetInfo[widgetId];
        if (info) {
            var infoSection = Utils.createElement('div', 'moon-widget-info');
            infoSection.innerHTML =
                '<div class="moon-widget-info-section">' +
                    '<h4>What It Does</h4>' +
                    '<p>' + info.whatItDoes + '</p>' +
                '</div>' +
                '<div class="moon-widget-info-section">' +
                    '<h4>Why It\'s Useful</h4>' +
                    '<p>' + info.whyUseful + '</p>' +
                '</div>' +
                '<div class="moon-widget-info-section">' +
                    '<h4>Try This</h4>' +
                    '<p>' + info.tryThis + '</p>' +
                '</div>';
            this.modal.appendChild(infoSection);
        }

        this.modalOverlay.style.display = 'flex';
        this.modalOpen = true;
        document.body.style.overflow = 'hidden';
    };

    Dashboard.prototype.openGettingStarted = function() {
        this.modalTitle.innerHTML = '<span class="moon-widget-modal-icon">📖</span> Getting Started';

        this.modalBody.innerHTML = '';
        this.modalBody.className = 'moon-widget-modal-body moon-getting-started-content';

        var content = Utils.createElement('div', 'moon-gs-content');

        // Sections
        GettingStartedContent.sections.forEach(function(section) {
            var sectionEl = Utils.createElement('div', 'moon-gs-section');
            sectionEl.innerHTML =
                '<h3>' + section.title + '</h3>' +
                '<p>' + section.content + '</p>';
            content.appendChild(sectionEl);
        });

        // Links
        var links = Utils.createElement('div', 'moon-gs-links');
        links.innerHTML =
            '<h3>Learn More</h3>' +
            '<p>' +
                '<a href="https://docs.moondream.ai" target="_blank">MoonDream API Docs</a> · ' +
                '<a href="https://ptzoptics.com" target="_blank">PTZOptics</a> · ' +
                '<a href="https://github.com/matthewidavis/PTZOpticsVRP" target="_blank">GitHub</a>' +
            '</p>';
        content.appendChild(links);

        this.modalBody.appendChild(content);

        this.modalOverlay.style.display = 'flex';
        this.modalOpen = true;
        document.body.style.overflow = 'hidden';
    };

    Dashboard.prototype.closeModal = function() {
        if (this.currentWidgetInstance) {
            this.currentWidgetInstance.unmount();
            this.currentWidgetInstance = null;
        }

        // Remove info footer if present
        var infoSection = this.modal.querySelector('.moon-widget-info');
        if (infoSection) {
            infoSection.remove();
        }

        this.modalOverlay.style.display = 'none';
        this.modalOpen = false;
        document.body.style.overflow = '';
    };

    // ============================================================
    // PUBLIC API
    // ============================================================
    /**
     * MoonDemo - Public API exposed to window object.
     *
     * This is the only module exposed globally. All other code is
     * encapsulated within the IIFE closure.
     *
     * Usage from HTML:
     *   MoonDemo.init('#my-container');
     *
     * @namespace
     */
    var MoonDemo = {
        /**
         * Initialize the full dashboard UI in a container element.
         * This is the standard way to start the application.
         *
         * @param {string|HTMLElement} selector - CSS selector or DOM element
         * @param {object} options              - Configuration options (reserved)
         * @returns {Dashboard}                 - Dashboard instance
         *
         * @example
         * // Initialize in a div with id "app"
         * MoonDemo.init('#app');
         */
        init: function(selector, options) {
            var rootEl = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!rootEl) {
                console.error('MoonDemo: Root element not found');
                return null;
            }
            return new Dashboard(rootEl, options);
        },

        /**
         * Mount a single widget without the full dashboard.
         * Useful for embedding individual widgets in custom layouts.
         *
         * @param {string} widgetId             - Widget ID (e.g., 'object-detector')
         * @param {string|HTMLElement} selector - Container selector or element
         * @param {object} options              - Widget-specific options
         * @returns {WidgetBase}                - Widget instance
         *
         * @example
         * // Mount just the Object Detector widget
         * MoonDemo.mountWidget('object-detector', '#detector-container');
         */
        mountWidget: function(widgetId, selector, options) {
            var rootEl = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!rootEl) return null;

            var storedKey = Utils.getStoredApiKey();
            if (storedKey) CONFIG.apiKey = storedKey;

            var WidgetClass = WidgetRegistry[widgetId];
            if (!WidgetClass) return null;

            var instance = new WidgetClass();
            instance.mount(rootEl, { options: options });
            return instance;
        },

        /** Get list of available widgets (returns copy). */
        getWidgets: function() { return WidgetList.slice(); },

        /**
         * Set the API key programmatically.
         * @param {string} key     - MoonDream API key
         * @param {boolean} persist - Store in sessionStorage if true
         */
        setApiKey: function(key, persist) {
            CONFIG.apiKey = key;
            if (persist) Utils.storeApiKey(key);
        },

        /** Clear the stored API key. */
        clearApiKey: function() {
            CONFIG.apiKey = null;
            Utils.storeApiKey(null);
        },

        /** Check if an API key is currently set. */
        hasApiKey: function() { return !!CONFIG.apiKey; }
    };

    // Expose MoonDemo to global scope (window in browsers)
    global.MoonDemo = MoonDemo;

})(typeof window !== 'undefined' ? window : this);
