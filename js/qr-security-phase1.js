/*
==================================================
QR SECURITY SYSTEM - PHASE 1
==================================================
Author: Attendance Tracker System
Description: Phase 1 anti-screenshot protection - maintains full compatibility
Features:
- Real-time QR refresh (3-5 seconds)
- Basic screenshot detection
- Full backward compatibility with existing system
==================================================
*/

class QRSecurityPhase1 {
    constructor() {
        this.isEnabled = true;
        this.currentSession = null;
        this.refreshInterval = null;
        this.refreshRate = 4000; // 4 seconds - good balance between security and UX
        this.isActive = false;
        this.originalQRData = null; // Store original QR data
        
        // Initialize only if not already initialized
        if (!window.qrSecurityInitialized) {
            this.init();
            window.qrSecurityInitialized = true;
        }
    }

    /**
     * Initialize the security system
     */
    async init() {
        console.log('🔒 Initializing QR Security Phase 1...');
        
        try {
            // Setup screenshot detection (non-intrusive)
            this.setupScreenshotDetection();
            
            console.log('✅ QR Security Phase 1 initialized successfully');
        } catch (error) {
            console.warn('⚠️ QR Security initialization failed, continuing without security:', error);
            this.isEnabled = false;
        }
    }


    /**
     * Setup non-intrusive screenshot detection
     */
    setupScreenshotDetection() {
        // Only add listeners if security is enabled
        if (!this.isEnabled) return;

        // Detect common screenshot key combinations
        document.addEventListener('keydown', (e) => {
            // Only act if QR is currently active
            if (!this.isActive) return;

            const isScreenshot = (
                e.key === 'PrintScreen' ||
                (e.altKey && e.key === 'PrintScreen') ||
                (e.metaKey && e.shiftKey && e.key === 'S') ||
                (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))
            );

            if (isScreenshot) {
                this.handleScreenshotAttempt();
            }
        }, { passive: true }); // Passive listener to avoid interference

        // Detect window focus/blur (lightweight detection)
        window.addEventListener('blur', () => {
            if (this.isActive) {
                console.log('⚠️ Window lost focus during QR display');
                // Don't force refresh on blur, just log it
                this.logSecurityEvent('window_blur');
            }
        }, { passive: true });
    }

    /**
     * Start secure QR session (enhances existing QR data)
     */
    startSecureSession(originalQRData) {
        if (!this.isEnabled) {
            console.log('🔒 QR Security disabled, using original QR system');
            return originalQRData; // Return unchanged if security disabled
        }

        console.log('🔒 Starting secure QR session...');
        
        this.isActive = true;
        this.originalQRData = originalQRData;
        
        // Enhance existing QR data with security features
        const secureQRData = {
            ...originalQRData, // Preserve all original data
            // Add security fields
            security: {
                enabled: true,
                sessionId: this.generateSecureSessionId(),
                refreshRate: this.refreshRate,
                version: 'phase1'
            },
            // Update timestamps
            secureTimestamp: Date.now(),
            refreshCount: 0
        };

        this.currentSession = secureQRData;
        
        // Start real-time refresh
        this.startRealTimeRefresh();
        
        return secureQRData;
    }

    /**
     * Generate secure session ID
     */
    generateSecureSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `sec1_${timestamp}_${random}`;
    }

    /**
     * Start real-time QR refresh (compatible with existing system)
     */
    startRealTimeRefresh() {
        if (!this.isEnabled || !this.isActive) return;

        // Clear any existing refresh interval
        this.stopRealTimeRefresh();

        console.log(`🔄 Starting real-time QR refresh every ${this.refreshRate}ms`);

        this.refreshInterval = setInterval(() => {
            if (this.isActive && this.currentSession) {
                this.refreshSecureQR();
            }
        }, this.refreshRate);
    }

    /**
     * Stop real-time refresh
     */
    stopRealTimeRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Refresh QR with updated security data
     */
    refreshSecureQR() {
        if (!this.currentSession) return;

        // Update session with new security data
        const refreshedData = {
            ...this.currentSession,
            // Keep all original fields intact
            // Update only security-related fields
            security: {
                ...this.currentSession.security,
                lastRefresh: Date.now(),
                refreshNonce: this.generateRefreshNonce()
            },
            refreshCount: (this.currentSession.refreshCount || 0) + 1,
            // Update main timestamp for compatibility
            timestamp: Date.now(),
            expiry: Date.now() + (30 * 1000) // Maintain 30-second main expiry
        };

        this.currentSession = refreshedData;

        // Call the existing QR generation function with updated data
        this.triggerQRRegeneration(refreshedData);

        console.log(`🔄 Secure QR refreshed (count: ${refreshedData.refreshCount})`);
    }

    /**
     * Trigger QR regeneration using existing system
     */
    triggerQRRegeneration(qrData) {
        try {
            // Update the global QR data if it exists
            if (window.currentQRSession) {
                window.currentQRSession = qrData;
            }

            // Try to regenerate QR using existing canvas and QR library
            const qrCanvas = document.getElementById('qrCodeCanvas');
            if (qrCanvas && window.QRCode) {
                const qrDataString = JSON.stringify(qrData);
                
                // Use the same QR generation options as the original system
                window.QRCode.toCanvas(qrCanvas, qrDataString, { 
                    width: 256,
                    height: 256,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: window.QRCode.CorrectLevel.M
                }, (error) => {
                    if (error) {
                        console.warn('QR regeneration error:', error);
                    }
                });
            }
        } catch (error) {
            console.warn('Error during QR regeneration:', error);
        }
    }

    /**
     * Generate refresh nonce
     */
    generateRefreshNonce() {
        return Math.random().toString(36).substring(2, 10);
    }

    /**
     * Handle screenshot attempt
     */
    handleScreenshotAttempt() {
        console.warn('🚨 Screenshot attempt detected!');
        
        // Log the event
        this.logSecurityEvent('screenshot_attempt');
        
        // Show subtle warning (non-intrusive)
        this.showSubtleWarning('For security, QR code will refresh automatically');
        
        // Force immediate refresh
        this.refreshSecureQR();
    }

    /**
     * Stop secure session
     */
    stopSecureSession() {
        console.log('🔓 Stopping secure QR session...');
        
        this.isActive = false;
        
        // Stop refresh interval
        this.stopRealTimeRefresh();
        
        // Clear session data
        this.currentSession = null;
        this.originalQRData = null;
    }

    /**
     * Fast validate scanned QR (optimized for speed)
     */
    validateScannedQR(scannedData) {
        // Quick early returns for maximum performance
        if (!this.isEnabled || !scannedData.security) {
            return { valid: true, message: 'Using original validation' };
        }

        // Fast check - if no security data, pass through
        if (!scannedData.security.sessionId) {
            return { valid: true, message: 'Non-secure QR, using original validation' };
        }

        // Optimized timing check with minimal calculations
        const now = Date.now();
        const lastRefresh = scannedData.security.lastRefresh || scannedData.secureTimestamp;
        
        // Fast expiry check - use simple comparison
        if (lastRefresh && (now - lastRefresh) > 7000) { // 7 seconds max age for fast rejection
            return {
                valid: false,
                reason: 'expired',
                message: 'QR code expired. Please scan the current QR.'
            };
        }


        return {
            valid: true,
            message: 'Validated',
            refreshCount: scannedData.refreshCount || 0
        };
    }

    /**
     * Log security events (lightweight)
     */
    logSecurityEvent(eventType) {
        const event = {
            type: eventType,
            timestamp: Date.now(),
            sessionId: this.currentSession?.security?.sessionId || 'no_session'
        };

        // Store in session storage (temporary, non-persistent)
        const securityLog = JSON.parse(sessionStorage.getItem('qr_security_log') || '[]');
        securityLog.push(event);
        
        // Keep only last 20 events to avoid storage bloat
        if (securityLog.length > 20) {
            securityLog.splice(0, securityLog.length - 20);
        }
        
        sessionStorage.setItem('qr_security_log', JSON.stringify(securityLog));
    }

    /**
     * Show subtle, non-intrusive warning
     */
    showSubtleWarning(message) {
        // Check if warning already exists
        const existingWarning = document.querySelector('.qr-security-warning');
        if (existingWarning) return;

        const warning = document.createElement('div');
        warning.className = 'qr-security-warning';
        warning.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 193, 7, 0.9);
            color: #333;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 13px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 280px;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        warning.innerHTML = `
            <i class="fas fa-shield-alt" style="margin-right: 6px; font-size: 12px;"></i>
            ${message}
        `;

        document.body.appendChild(warning);

        // Fade in
        setTimeout(() => {
            warning.style.opacity = '1';
        }, 100);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            warning.style.opacity = '0';
            setTimeout(() => {
                if (warning.parentElement) {
                    warning.remove();
                }
            }, 300);
        }, 3000);
    }

    /**
     * Get security status for debugging
     */
    getSecurityStatus() {
        return {
            enabled: this.isEnabled,
            active: this.isActive,
            refreshRate: this.refreshRate,
            currentSession: this.currentSession?.security?.sessionId,
            refreshCount: this.currentSession?.refreshCount || 0
        };
    }
}

// Initialize QR Security Phase 1
const qrSecurityPhase1 = new QRSecurityPhase1();

// Make available globally for integration
window.qrSecurityPhase1 = qrSecurityPhase1;

// Integration helpers for existing code
window.enhanceQRWithSecurity = function(originalQRData) {
    return qrSecurityPhase1.startSecureSession(originalQRData);
};

window.stopQRSecurity = function() {
    qrSecurityPhase1.stopSecureSession();
};

window.validateSecureQR = function(scannedData) {
    return qrSecurityPhase1.validateScannedQR(scannedData);
};

// Debug function
window.getQRSecurityStatus = function() {
    console.log('QR Security Status:', qrSecurityPhase1.getSecurityStatus());
    return qrSecurityPhase1.getSecurityStatus();
};

console.log('🔒 QR Security Phase 1 loaded and ready for integration');
