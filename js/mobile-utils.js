/*
==================================================
MOBILE UTILITIES
==================================================
Simple mobile device detection and device ID generation
for student mobile-only access control
==================================================
*/

/**
 * Check if user is accessing from a mobile device
 */
function isMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
    
    // Check user agent for mobile keywords
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // Check screen size (mobile devices typically have smaller screens)
    const isSmallScreen = window.innerWidth <= 1024 || window.innerHeight <= 768;
    
    // Check for touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Combine checks - must have mobile UA OR (small screen AND touch)
    return isMobileUA || (isSmallScreen && hasTouch);
}

/**
 * Generate a simple device ID based on device characteristics
 * Browser-independent to allow Safari/Chrome switching on same device
 */
function generateDeviceId() {
    const deviceInfo = {
        // Removed userAgent - differs between Safari/Chrome on same device
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        // Add hardware concurrency if available (same across browsers)
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        // Add device memory if available (same across browsers)
        deviceMemory: navigator.deviceMemory || 'unknown'
    };
    
    // Create simple hash
    const deviceString = JSON.stringify(deviceInfo);
    let hash = 0;
    for (let i = 0; i < deviceString.length; i++) {
        const char = deviceString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `device_${Math.abs(hash).toString(16)}`;
}

/**
 * Check if current device matches stored device ID
 */
function isCurrentDevice(storedDeviceId) {
    if (!storedDeviceId) {
        return false;
    }
    
    // Generate current device ID and hash
    const currentDeviceId = generateDeviceId();
    const currentHash = currentDeviceId.split('_')[1];
    
    // Handle both old format (with timestamp) and new format (without timestamp)
    let storedHash;
    const deviceParts = storedDeviceId.split('_');
    
    if (deviceParts.length === 3) {
        // Old format: device_hash_timestamp - use the hash part
        storedHash = deviceParts[1];
    } else if (deviceParts.length === 2) {
        // New format: device_hash - use the hash part
        storedHash = deviceParts[1];
    } else {
        console.error('📱 Invalid stored device ID format:', storedDeviceId);
        return false;
    }
    
    const matches = storedHash === currentHash;
    
    
    return matches;
}

// Make functions available globally
window.isMobileDevice = isMobileDevice;
window.generateDeviceId = generateDeviceId;
window.isCurrentDevice = isCurrentDevice;

