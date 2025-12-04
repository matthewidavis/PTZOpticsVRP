/**
 * MoonDream AI Demo Suite
 * Interactive demos showcasing MoonDream's vision AI capabilities
 *
 * Demos:
 * 1. Universal Object Detector - Detect any object with bounding boxes
 * 2. Smart Counter - Count objects with visual point markers
 * 3. Scene Analyzer - Caption and Q&A for understanding scenes
 * 4. Person Tracker - Track people with bounding boxes
 * 5. Zone Monitor - User-defined zones with detection alerts
 */
(function(global) {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================
    var CONFIG = {
        apiBaseUrl: 'https://api.moondream.ai/v1',
        apiKey: null,
        jpegQuality: 0.85,
        requestTimeout: 30000,
        maxVideoSizeMB: 200,
        storageKey: 'moondream_api_key',
        colors: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            detect: '#00ff88',
            point: '#ff6b6b',
            zone: '#ffd93d',
            person: '#6bcfff'
        }
    };

    // ============================================================
    // UTILITIES
    // ============================================================
    var Utils = {
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

        uniqueId: function(prefix) {
            return (prefix || 'moon') + '-' + Math.random().toString(36).substr(2, 9);
        },

        escapeHTML: function(str) {
            var div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        copyToClipboard: function(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
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

        storeApiKey: function(key) {
            try {
                if (key) {
                    localStorage.setItem(CONFIG.storageKey, key);
                } else {
                    localStorage.removeItem(CONFIG.storageKey);
                }
            } catch (e) {}
        },

        getStoredApiKey: function() {
            try {
                return localStorage.getItem(CONFIG.storageKey);
            } catch (e) {
                return null;
            }
        },

        // Color utilities for multiple detections
        getColor: function(index) {
            var colors = ['#00ff88', '#ff6b6b', '#6bcfff', '#ffd93d', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3'];
            return colors[index % colors.length];
        }
    };

    // ============================================================
    // CANVAS DRAWING UTILITIES
    // ============================================================
    var CanvasUtils = {
        /**
         * Draw bounding box on canvas
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
         * Draw point marker on canvas
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
         * Draw zone polygon on canvas
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
         * Check if a point is inside a polygon
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
         * Clear canvas
         */
        clear: function(ctx, width, height) {
            ctx.clearRect(0, 0, width, height);
        }
    };

    // ============================================================
    // API CLIENT
    // ============================================================
    var ApiClient = {
        hasApiKey: function() {
            return !!CONFIG.apiKey;
        },

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
         * Query - Visual Q&A
         */
        query: function(imageData, question) {
            return this._request('/query', {
                image_url: imageData,
                question: question
            });
        },

        /**
         * Detect - Object detection with bounding boxes
         */
        detect: function(imageData, objectName) {
            return this._request('/detect', {
                image_url: imageData,
                object: objectName
            });
        },

        /**
         * Point - Get coordinates of objects
         */
        point: function(imageData, objectName) {
            return this._request('/point', {
                image_url: imageData,
                object: objectName
            });
        },

        /**
         * Caption - Generate image description
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
    var MediaCapture = {
        stream: null,
        videoElement: null,

        isWebcamSupported: function() {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        },

        startWebcam: function(videoElement) {
            var self = this;
            return new Promise(function(resolve, reject) {
                if (!self.isWebcamSupported()) {
                    reject(new Error('Webcam not supported'));
                    return;
                }

                // Use simpler constraints for better compatibility
                var constraints = {
                    video: true,
                    audio: false
                };

                navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
                    self.stream = stream;
                    self.videoElement = videoElement;
                    videoElement.srcObject = stream;

                    // Wait for video to be ready before resolving
                    videoElement.onloadedmetadata = function() {
                        videoElement.play().then(function() {
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
                        reject(new Error('Camera does not support requested settings. Trying again...'));
                    } else {
                        reject(new Error('Camera error: ' + (err.message || err.name)));
                    }
                });
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
            apiKeyTip: 'Your API key is stored locally in your browser and never shared'
        },
        welcome: {
            title: 'Welcome to PTZOptics Moondreams',
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
                        '<div class="moon-input-hint">Your key is stored locally and never shared with anyone except MoonDream.</div>' +
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

    WidgetBase.prototype.mount = function(rootEl, context) {
        this.rootEl = rootEl;
        this.context = context;
        rootEl.innerHTML = '';
        rootEl.className = 'moon-widget moon-widget-' + this.id;
        this.render();
    };

    WidgetBase.prototype.unmount = function() {
        this.stopContinuous();
        MediaCapture.stopWebcam();
        if (this.rootEl) this.rootEl.innerHTML = '';
        this.rootEl = null;
    };

    WidgetBase.prototype.render = function() {};

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

    WidgetBase.prototype.hideError = function() {
        var errorEl = this.rootEl.querySelector('.moon-error-banner');
        if (errorEl) errorEl.style.display = 'none';
    };

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

    WidgetBase.prototype.showSuccess = function(message) {
        this.showToast(message, 'success');
    };

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

    WidgetBase.prototype.ensureApiKey = function(callback) {
        if (ApiClient.hasApiKey()) {
            callback();
        } else {
            ApiKeyModal.show(callback);
        }
    };

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
                    }).catch(function(err) {
                        self.showError(err.message);
                    });
                }
            };
            controls.appendChild(webcamBtn);
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

    WidgetBase.prototype.clearOverlay = function() {
        if (this.overlayCtx && this.overlayCanvas) {
            CanvasUtils.clear(this.overlayCtx, this.overlayCanvas.width, this.overlayCanvas.height);
        }
    };

    WidgetBase.prototype.startContinuous = function(callback, interval) {
        var self = this;
        this.stopContinuous();
        this._continuousInterval = setInterval(function() {
            if (MediaCapture.stream) {
                callback();
            }
        }, interval || 2000);
    };

    WidgetBase.prototype.stopContinuous = function() {
        if (this._continuousInterval) {
            clearInterval(this._continuousInterval);
            this._continuousInterval = null;
        }
    };

    // ============================================================
    // WIDGET 1: UNIVERSAL OBJECT DETECTOR
    // ============================================================
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
        modeSelect.innerHTML = '<option value="person">Full Body</option>' +
            '<option value="face">Faces Only</option>' +
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

        // Framing suggestions
        var suggestions = Utils.createElement('div', 'moon-suggestions');
        suggestions.innerHTML = '<h4>Framing Suggestions</h4><div class="moon-suggestions-content"></div>';
        rightCol.appendChild(suggestions);

        grid.appendChild(rightCol);
        body.appendChild(grid);
        this.rootEl.appendChild(body);

        this._modeSelect = modeSelect;
        this._countDisplay = countDisplay;
        this._personList = results.querySelector('.moon-person-list');
        this._suggestions = suggestions.querySelector('.moon-suggestions-content');
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
        this._suggestions.innerHTML = '';

        if (objects.length === 0) {
            this._personList.innerHTML = '<p class="moon-no-results">No people detected</p>';
            return;
        }

        var ctx = this.overlayCtx;
        var w = this.overlayCanvas.width;
        var h = this.overlayCanvas.height;

        var suggestions = [];

        objects.forEach(function(obj, index) {
            var color = CONFIG.colors.person;
            var label = mode + ' ' + (index + 1);

            CanvasUtils.drawBoundingBox(ctx, obj, color, label, w, h);

            // Calculate position info for suggestions
            var centerX = (obj.x_min + obj.x_max) / 2;
            var centerY = (obj.y_min + obj.y_max) / 2;
            var size = (obj.x_max - obj.x_min) * (obj.y_max - obj.y_min);

            var position = '';
            if (centerX < 0.33) position = 'left';
            else if (centerX > 0.66) position = 'right';
            else position = 'center';

            var item = Utils.createElement('div', 'moon-result-item');
            item.innerHTML = '<span class="moon-result-color" style="background:' + color + '"></span>' +
                '<span class="moon-result-label">' + label + '</span>' +
                '<span class="moon-result-position">' + position + ' third</span>';
            this._personList.appendChild(item);

            // Generate framing suggestion
            if (size < 0.1) {
                suggestions.push('Person ' + (index + 1) + ' is far - consider zooming in');
            } else if (size > 0.5) {
                suggestions.push('Person ' + (index + 1) + ' fills frame - consider wider shot');
            }

            if (centerY < 0.3 && obj.y_min > 0.1) {
                suggestions.push('Person ' + (index + 1) + ' has excess headroom');
            }
        }.bind(this));

        // Rule of thirds overlay
        this.drawRuleOfThirds();

        // Display suggestions
        if (suggestions.length > 0) {
            suggestions.forEach(function(s) {
                var p = Utils.createElement('p', 'moon-suggestion-item', { textContent: '• ' + s });
                this._suggestions.appendChild(p);
            }.bind(this));
        } else {
            this._suggestions.innerHTML = '<p class="moon-suggestion-good">✓ Framing looks good!</p>';
        }
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
                        console.log('OpenCV ready');
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

        console.log('FaceMesh initialized');
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
    // WIDGET REGISTRY
    // ============================================================
    var WidgetRegistry = {
        'object-detector': ObjectDetectorWidget,
        'smart-counter': SmartCounterWidget,
        'scene-analyzer': SceneAnalyzerWidget,
        'person-tracker': PersonTrackerWidget,
        'zone-monitor': ZoneMonitorWidget,
        'production-monitor': ProductionMonitorWidget
    };

    var WidgetList = [
        { id: 'object-detector', label: 'Object Detector', icon: '🔍' },
        { id: 'smart-counter', label: 'Smart Counter', icon: '🔢' },
        { id: 'scene-analyzer', label: 'Scene Analyzer', icon: '🎬' },
        { id: 'person-tracker', label: 'Person Tracker', icon: '👤' },
        { id: 'zone-monitor', label: 'Zone Monitor', icon: '🚧' },
        { id: 'production-monitor', label: 'Production Monitor', icon: '🎥' }
    ];

    // ============================================================
    // DASHBOARD
    // ============================================================
    function Dashboard(rootEl, options) {
        this.rootEl = rootEl;
        this.options = options || {};
        this.currentWidget = null;
        this.currentWidgetInstance = null;
        this.init();
    }

    Dashboard.prototype.init = function() {
        var storedKey = Utils.getStoredApiKey();
        if (storedKey) CONFIG.apiKey = storedKey;

        this.rootEl.innerHTML = '';
        this.rootEl.className = 'moon-dashboard';

        this.sidebar = Utils.createElement('nav', 'moon-sidebar');
        this.main = Utils.createElement('main', 'moon-main');

        this.rootEl.appendChild(this.sidebar);
        this.rootEl.appendChild(this.main);

        this.renderSidebar();
        this.activateWidget(WidgetList[0].id);
    };

    Dashboard.prototype.renderSidebar = function() {
        var self = this;

        var title = Utils.createElement('div', 'moon-sidebar-title');
        title.innerHTML = '<span class="moon-logo">🌙</span> PTZOptics Moondreams';
        this.sidebar.appendChild(title);

        var nav = Utils.createElement('ul', 'moon-nav');

        WidgetList.forEach(function(widget) {
            var li = Utils.createElement('li', 'moon-nav-item');
            li.dataset.widgetId = widget.id;
            li.innerHTML = '<span class="moon-nav-icon">' + widget.icon + '</span>' +
                '<span class="moon-nav-label">' + widget.label + '</span>';
            li.onclick = function() { self.activateWidget(widget.id); };
            nav.appendChild(li);
        });

        this.sidebar.appendChild(nav);

        // API key status
        var keyStatus = Utils.createElement('div', 'moon-api-status');
        this.updateKeyStatus(keyStatus);
        this.sidebar.appendChild(keyStatus);
        this._keyStatusEl = keyStatus;
    };

    Dashboard.prototype.updateKeyStatus = function(el) {
        var self = this;
        el = el || this._keyStatusEl;
        if (!el) return;

        if (CONFIG.apiKey) {
            el.innerHTML = '<span class="moon-key-indicator moon-key-set">🔑 API Key Set</span>' +
                '<button class="moon-btn moon-btn-sm">Change</button>';
            el.querySelector('.moon-btn').onclick = function() {
                CONFIG.apiKey = null;
                Utils.storeApiKey(null);
                self.updateKeyStatus();
                ApiKeyModal.show(function() { self.updateKeyStatus(); });
            };
        } else {
            el.innerHTML = '<span class="moon-key-indicator moon-key-missing">🔑 No API Key</span>' +
                '<button class="moon-btn moon-btn-sm">Set Key</button>';
            el.querySelector('.moon-btn').onclick = function() {
                ApiKeyModal.show(function() { self.updateKeyStatus(); });
            };
        }
    };

    Dashboard.prototype.activateWidget = function(widgetId) {
        if (this.currentWidgetInstance) {
            this.currentWidgetInstance.unmount();
        }

        this.sidebar.querySelectorAll('.moon-nav-item').forEach(function(item) {
            item.classList.remove('moon-active');
            if (item.dataset.widgetId === widgetId) {
                item.classList.add('moon-active');
            }
        });

        var WidgetClass = WidgetRegistry[widgetId];
        if (WidgetClass) {
            this.currentWidget = widgetId;
            this.currentWidgetInstance = new WidgetClass();
            this.currentWidgetInstance.mount(this.main, { dashboard: this });
        }

        this.updateKeyStatus();
    };

    // ============================================================
    // PUBLIC API
    // ============================================================
    var MoonDemo = {
        init: function(selector, options) {
            var rootEl = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!rootEl) {
                console.error('MoonDemo: Root element not found');
                return null;
            }
            return new Dashboard(rootEl, options);
        },

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

        getWidgets: function() { return WidgetList.slice(); },
        setApiKey: function(key, persist) {
            CONFIG.apiKey = key;
            if (persist) Utils.storeApiKey(key);
        },
        clearApiKey: function() {
            CONFIG.apiKey = null;
            Utils.storeApiKey(null);
        },
        hasApiKey: function() { return !!CONFIG.apiKey; }
    };

    global.MoonDemo = MoonDemo;

})(typeof window !== 'undefined' ? window : this);
