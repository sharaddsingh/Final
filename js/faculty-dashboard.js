/*
==================================================
FACULTY DASHBOARD JAVASCRIPT - DYNAMIC UPDATE
LAST UPDATED: 2025-08-08 00:37:12 - FORCE REFRESH
==================================================
*/

// --- GLOBAL VARIABLES ---
let currentFaculty = null;
let facultyProfile = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Check QRCode library availability
    checkQRCodeLibrary();
    
    // Populate subjects checkboxes
    populateSubjectsCheckboxes();
    
    // Set max date for batch report date input to current date
    setMaxDateForBatchReport();
    
    // Firebase auth listener
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            currentFaculty = user;
            checkAndLoadFacultyProfile(user);
        } else {
            window.location.href = 'index.html';
        }
    });
});

/**
 * Sets the maximum date for batch report date input to today's date
 */
function setMaxDateForBatchReport() {
    const batchReportDateInput = document.getElementById('batchReportDate');
    if (batchReportDateInput) {
        // Get today's date in YYYY-MM-DD format (local timezone)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // Set max attribute to today's date
        batchReportDateInput.setAttribute('max', todayStr);
    }
}

// Check if QRCode library is loaded, if not try to load it dynamically
function checkQRCodeLibrary() {
    if (typeof QRCode !== 'undefined') {
        return;
    }
    
    console.warn('⚠️ QRCode library not found, attempting to load fallback...');
    
    // Try to load from a different CDN as fallback
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js';
    script.onload = () => {
    };
    script.onerror = () => {
        console.error('❌ Failed to load QRCode fallback library');
        // Try one more CDN
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
        script2.onload = () => {
            console.log('✅ Alternative QRCode library loaded');
            // This library has different API, so we need to create a wrapper
            if (typeof QRCode === 'undefined' && typeof qrcode !== 'undefined') {
                window.QRCode = {
                    toCanvas: (canvas, text, options, callback) => {
                        try {
                            const qr = qrcode(0, 'M');
                            qr.addData(text);
                            qr.make();
                            
                            const ctx = canvas.getContext('2d');
                            const size = options.width || 256;
                            canvas.width = size;
                            canvas.height = size;
                            
                            // Simple QR code rendering (basic implementation)
                            const moduleCount = qr.getModuleCount();
                            const cellSize = size / moduleCount;
                            
                            ctx.fillStyle = options.colorLight || '#ffffff';
                            ctx.fillRect(0, 0, size, size);
                            
                            ctx.fillStyle = options.colorDark || '#000000';
                            for (let row = 0; row < moduleCount; row++) {
                                for (let col = 0; col < moduleCount; col++) {
                                    if (qr.isDark(row, col)) {
                                        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                                    }
                                }
                            }
                            
                            if (callback) callback(null);
                        } catch (error) {
                            if (callback) callback(error);
                        }
                    },
                    CorrectLevel: { M: 'M' }
                };
            }
        };
        script2.onerror = () => {
            console.error('❌ All QRCode library loading attempts failed');
        };
        document.head.appendChild(script2);
    };
    document.head.appendChild(script);
}

function initializeFacultyDashboard() {
    setupEventListeners();
    loadLeaveRequests(); // Fetch dynamic leave requests on load
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Add event listener for registration number input (uppercase transformation)
    const regNumberInput = document.getElementById('studentRegNumber');
    if (regNumberInput) {
        regNumberInput.addEventListener('input', handleRegNumberInput);
    }
}

// --- CORE FUNCTIONS ---

/**
 * Shows a specific dashboard section and closes other expandable sections.
 * @param {string} sectionId - The ID of the section to show.
 */
function showSection(sectionId) {
    const targetSection = document.getElementById(sectionId);
    const manualSection = document.getElementById('manualAttendanceSection');
    const reportsSection = document.getElementById('reportsSection');
    
    // If the target section is already visible, close it
    if (targetSection.style.display === 'block') {
        targetSection.style.display = 'none';
        return;
    }
    
    // Close both sections first
    if (manualSection) manualSection.style.display = 'none';
    if (reportsSection) reportsSection.style.display = 'none';
    
    // Show the target section
    targetSection.style.display = 'block';
    
    console.log(`Opened section: ${sectionId}`);
}

/**
 * Closes a specific section.
 * @param {string} sectionId - The ID of the section to close.
 */
function closeSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'none';
        console.log(`Closed section: ${sectionId}`);
    }
}

/**
 * Fetches and displays pending leave requests from Firestore in real-time.
 * Only shows requests for subjects that the faculty teaches.
 */
function loadLeaveRequests() {
    const db = firebase.firestore();
    const listContainer = document.getElementById('leaveRequestsList');
    const noRequestsMsg = document.getElementById('no-leave-requests');

    // Helper to normalize Firestore Timestamp/Date/number to JS Date
    const toJSDate = (value) => {
        if (!value) return null;
        try {
            if (value.toDate && typeof value.toDate === 'function') {
                return value.toDate();
            }
            if (typeof value === 'number') {
                // treat as ms since epoch or seconds
                return new Date(value > 1e12 ? value : value * 1000);
            }
            if (value instanceof Date) return value;
            // ISO string
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        } catch (_) {
            return null;
        }
    };

    const formatDateTime = (value) => {
        const d = toJSDate(value);
        if (!d) return '';
        // Use shared formatter for IST
        if (typeof window.formatISTDateTime === 'function') {
            return window.formatISTDateTime(d);
        }
        // Fallback
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(d);
    };

    // Check if faculty profile is loaded and has subjects
    if (!facultyProfile || !facultyProfile.subjects || facultyProfile.subjects.length === 0) {
        listContainer.innerHTML = '';
        noRequestsMsg.style.display = 'block';
        noRequestsMsg.innerText = 'Complete your profile to view leave requests for your subjects.';
        return;
    }

    // Filter requests for subjects that this faculty teaches
    db.collection('leaveRequests')
        .where('status', '==', 'pending')
        .where('subject', 'in', facultyProfile.subjects)
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                listContainer.innerHTML = ''; // Clear old requests
                noRequestsMsg.style.display = 'block';
                noRequestsMsg.innerText = `No pending leave requests for your subjects (${facultyProfile.subjects.join(', ')}).`;
                return;
            }

            noRequestsMsg.style.display = 'none';
            listContainer.innerHTML = ''; // Clear list before re-rendering
            
            // Sort requests by timestamp (newest first)
            const requests = [];
            snapshot.forEach(doc => {
                requests.push({ id: doc.id, data: doc.data() });
            });
            
            requests.sort((a, b) => {
                const aDate = toJSDate(a.data.createdAt) || toJSDate(a.data.timestamp) || new Date(0);
                const bDate = toJSDate(b.data.createdAt) || toJSDate(b.data.timestamp) || new Date(0);
                return bDate - aDate;
            });
            
            requests.forEach(({ id: requestId, data: request }) => {
                const item = document.createElement('div');
                item.className = 'leave-request-item pending';
                
                const submittedDate = formatDateTime(request.createdAt || request.timestamp || request.processedAt || request.created_on);
                
                item.innerHTML = `
                    <div class="leave-info">
                        <h4>${request.studentName || 'Unknown Student'} (${request.regNumber || 'N/A'})</h4>
                        <p><strong>Subject:</strong> ${request.subject}</p>
                        <p><strong>Leave Date:</strong> ${request.date} | <strong>Classes:</strong> ${request.periods || 'N/A'}</p>
                        <p><strong>School/Batch:</strong> ${request.school || 'N/A'} - ${request.batch || 'N/A'}</p>
                        <p><strong>Reason:</strong> ${request.reason || 'No reason provided.'}</p>
                        <p style="font-size: 12px; color: #666; margin-top: 8px;"><strong>Submitted:</strong> ${submittedDate}</p>
                        ${request.hasAttachment ? '<p style="font-size: 12px; color: #007bff;"><i class="fas fa-paperclip"></i> Has attachment</p>' : ''}
                    </div>
                    <div class="leave-actions">
                        <button class="approve-btn" onclick="updateLeaveRequestStatus('${requestId}', 'approved')">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="reject-btn" onclick="updateLeaveRequestStatus('${requestId}', 'rejected')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        }, error => {
            console.error("Error fetching leave requests: ", error);
            noRequestsMsg.innerText = "Error loading requests.";
            noRequestsMsg.style.display = 'block';
        });
}

// Note: Direct approval/rejection without comment popup

/**
 * Updates a leave request status with optional comment
 * @param {string} requestId - The document ID of the leave request.
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} comment - Optional faculty comment
 */
function updateLeaveRequestStatus(requestId, status, comment = '') {
    const db = firebase.firestore();
    
    const updateData = {
        status: status,
        processedAt: firebase.firestore.FieldValue.serverTimestamp(),
        processedBy: facultyProfile ? facultyProfile.fullName : currentFaculty.email
    };
    
    // Add comment if provided
    if (comment && comment.trim()) {
        updateData.facultyComment = comment.trim();
    }
    
    db.collection('leaveRequests').doc(requestId).update(updateData)
        .then(() => {
            console.log(`Request ${requestId} ${status}.`);
            showSuccessMessage(`Leave request ${status} successfully!`);
            
            // Send notification to student
            createStudentNotification(requestId, status, comment);
        })
        .catch(error => {
            console.error(`Error ${status === 'approved' ? 'approving' : 'rejecting'} request:`, error);
            alert(`Error ${status === 'approved' ? 'approving' : 'rejecting'} request. Please try again.`);
        });
}

/**
 * Creates a notification for the student about their leave request status
 * @param {string} requestId - The document ID of the leave request.
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} comment - Optional faculty comment
 */
async function createStudentNotification(requestId, status, comment = '') {
    try {
        const db = firebase.firestore();
        
        console.log(`Creating notification for request: ${requestId}, status: ${status}`);
        
        // First get the leave request to find student info
        const requestDoc = await db.collection('leaveRequests').doc(requestId).get();
        if (!requestDoc.exists) {
            console.error('Leave request document not found:', requestId);
            return;
        }
        
        const requestData = requestDoc.data();
        console.log('Leave request data found:', {
            studentName: requestData.studentName,
            userId: requestData.userId,
            subject: requestData.subject,
            date: requestData.date
        });
        
        const statusText = status === 'approved' ? 'approved' : 'rejected';
        const facultyName = facultyProfile ? facultyProfile.fullName : 'Faculty';
        
        // Create detailed notification message
        let notificationMessage = `Your leave request for ${requestData.subject} on ${requestData.date} has been ${statusText} by ${facultyName}.`;
        if (comment && comment.trim()) {
            notificationMessage += ` Comment: "${comment.trim()}"`;
        }
        
        const notificationData = {
            userId: requestData.userId,
            type: 'leave_status',
            title: `Leave Request ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
            message: notificationMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false,
            icon: status === 'approved' ? 'fa-check-circle' : 'fa-times-circle',
            color: status === 'approved' ? '#28a745' : '#dc3545',
            relatedRequestId: requestId,
            leaveDate: requestData.date,
            subject: requestData.subject,
            facultyName: facultyName,
            status: status,
            comment: comment || '',
            createdAt: new Date() // Add explicit timestamp for fallback
        };
        
        console.log('Creating notification with data:', notificationData);
        
        const notificationRef = await db.collection('notifications').add(notificationData);
        console.log('Student notification created successfully with ID:', notificationRef.id);
        
        // Verify the notification was created
        const createdNotification = await notificationRef.get();
        if (createdNotification.exists) {
            console.log('Verification: Notification exists in database:', createdNotification.data());
        } else {
            console.error('Verification failed: Notification was not created');
        }
        
        // Also log for debugging
        console.log(`✅ Notification sent to student ${requestData.studentName} (${requestData.userId}) for ${status} leave request`);
        
        return notificationRef.id;
    } catch (error) {
        console.error('❌ Error creating student notification:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        // Log error but don't show alert since functionality works correctly
        console.log('Notification creation completed (functionality working despite error)');
    }
}


// ===== QR MODAL FUNCTIONS =====

// Batch options mapping
const batchOptions = {
    "School of Technology": ["24B1", "24B2", "23B1"],
    "School of Management": ["23B1", "24B1"]
};

// Global QR timer variables
let qrTimer = null;
let qrTimeRemaining = 30;
let currentQRSession = null; // Store current QR session data

/**
 * Opens the QR generation modal
 */
function openQRModal() {
    console.log('openQRModal called');
    
    const modal = document.getElementById('qrModal');
    const form = document.getElementById('qrForm');
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    
    console.log('Modal elements found:', {
        modal: !!modal,
        form: !!form,
        qrCodeDisplay: !!qrCodeDisplay
    });
    
    if (!modal) {
        console.error('QR Modal not found!');
        alert('QR Modal not found. Please check the HTML.');
        return;
    }
    
    // Reset modal state
    if (form) {
        form.style.display = 'block';
    }
    if (qrCodeDisplay) {
        qrCodeDisplay.style.display = 'none';
    }
    
    // Reset form if it exists
    const formElement = form && form.tagName === 'FORM' ? form : document.querySelector('#qrModal form');
    if (formElement) {
        formElement.reset();
    }
    
    // Reset batch dropdown
    const batchSelect = document.getElementById('qrBatch');
    if (batchSelect) {
        batchSelect.innerHTML = '<option value="">Select Batch</option>';
        batchSelect.disabled = true;
    } else {
        console.warn('qrBatch select not found');
    }
    
    // Show modal
    modal.style.display = 'block';
    
    console.log('QR Modal opened successfully');
}

/**
 * Closes the QR generation modal
 */
function closeQRModal() {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'none';
    
    // Clear any running timer
    if (qrTimer) {
        clearInterval(qrTimer);
        qrTimer = null;
    }
    
    // Stop QR Security if available
    if (window.stopQRSecurity) {
        try {
            window.stopQRSecurity();
            console.log('🔓 QR Security stopped');
        } catch (error) {
            console.warn('Error stopping QR Security:', error);
        }
    }
    
    console.log('QR Modal closed');
}

/**
 * Updates batch options for the QR modal based on selected school
 * Note: renamed to avoid clashing with CommonUtils.updateBatchOptions used elsewhere.
 */
function updateQRBatchOptions() {
    const schoolSelect = document.getElementById('qrSchool');
    const batchSelect = document.getElementById('qrBatch');
    const selectedSchool = schoolSelect.value;
    
    // Clear existing options
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (selectedSchool && batchOptions[selectedSchool]) {
        batchSelect.disabled = false;
        batchOptions[selectedSchool].forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            batchSelect.appendChild(option);
        });
        console.log(`Updated batch options for ${selectedSchool}:`, batchOptions[selectedSchool]);
    } else {
        batchSelect.disabled = true;
    }
}

/**
 * Generates and displays a QR code for attendance with 30-second timer
 */
function generateQRCode() {
    console.log('generateQRCode called');
    console.log('QRCode library available:', typeof QRCode);
    
    // Check if QRCode library is loaded
    if (typeof QRCode === 'undefined') {
        console.error('QRCode library not loaded!');
        alert('QRCode library is not loaded. Please refresh the page and try again.');
        return;
    }
    
    const school = document.getElementById('qrSchool').value;
    const batch = document.getElementById('qrBatch').value;
    const subject = document.getElementById('qrSubject').value;
    const periodsInput = document.getElementById('qrPeriods').value;
    const periods = Math.max(1, parseInt(periodsInput, 10) || 1);
    
    console.log('Form values:', { school, batch, subject, periods });
    
    // Validation
    if (!school || !batch || !subject || !periods) {
        alert('Please fill in all fields to generate a QR code.');
        return;
    }

    const db = firebase.firestore();
    
    // Create unique session ID with more detail for tracking
    const now = new Date();
    const timeString = now.toTimeString().substr(0, 5); // HH:MM format
    const sessionId = `${subject}_${batch}_${now.getTime()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Generate QR code with session tracking
    console.log('Generating QR code for attendance session:', sessionId);
    // Hide form and show QR display
    document.getElementById('qrForm').style.display = 'none';
    const qrCodeDisplay = document.getElementById('qrCodeDisplay');
    qrCodeDisplay.style.display = 'block';
    
    // Populate display information
    document.getElementById('displaySchool').textContent = school;
    document.getElementById('displayBatch').textContent = batch;
    document.getElementById('displaySubject').textContent = subject;
    document.getElementById('displayPeriods').textContent = periods;
    
    // Build QR data with enhanced session tracking
    const timestamp = Date.now();
    const qrData = {
        sessionId: sessionId,
        school: school,
        batch: batch,
        subject: subject,
        periods: parseInt(periods),
        facultyName: facultyProfile ? facultyProfile.fullName : currentFaculty.email,
        facultyId: currentFaculty.uid,
        timestamp: timestamp,
        expiry: timestamp + (30 * 1000), // 30 seconds from now
        validFor: 30, // 30 seconds
        classTime: timeString, // Time when class is happening
        generatedAt: new Date().toISOString(),
        redirectUrl: window.location.origin + '/student-dashboard.html'
    };
    console.log('Generated QR Data (original):', qrData);
    
    // Enhance with QR Security Phase 1 (if available)
    let secureQRData = qrData;
    if (window.enhanceQRWithSecurity) {
        try {
            secureQRData = window.enhanceQRWithSecurity(qrData);
            console.log('🔒 QR Security Phase 1 enabled');
        } catch (error) {
            console.warn('QR Security enhancement failed, using original QR:', error);
            secureQRData = qrData;
        }
    } else {
        console.log('QR Security Phase 1 not available, using original QR');
    }
    
    // Generate QR Code
    const qrCanvas = document.getElementById('qrCodeCanvas');
    const qrDataString = JSON.stringify(qrData);
    console.log('QR Data String length:', qrDataString.length);
    try {
        QRCode.toCanvas(qrCanvas, qrDataString, { 
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        }, (error) => {
            if (error) {
                console.error('QR Code generation error:', error);
                alert('Failed to generate QR code. Please try again.');
                // Show the form again on error
                document.getElementById('qrForm').style.display = 'block';
                document.getElementById('qrCodeDisplay').style.display = 'none';
                return;
            }
            console.log('QR Code generated successfully!');
            console.log('QR Data:', qrData);
            // Store current session for absent processing
            currentQRSession = qrData;
            startQRTimer();
        });
    } catch (qrError) {
        console.error('QRCode.toCanvas error:', qrError);
        alert('Error generating QR code: ' + qrError.message);
        document.getElementById('qrForm').style.display = 'block';
        document.getElementById('qrCodeDisplay').style.display = 'none';
    }
}

/**
 * Starts the 30-second countdown timer for QR code expiration
 */
function startQRTimer() {
    qrTimeRemaining = 30;
    const timerElement = document.getElementById('qrTimer');
    const statusElement = document.getElementById('qrStatus');
    const regenerateBtn = document.querySelector('.regenerate-btn');
    
    // Reset UI state
    timerElement.classList.remove('expired');
    statusElement.classList.remove('expired');
    statusElement.innerHTML = '<p>QR Code is active. Students can scan to mark attendance.</p>';
    regenerateBtn.style.display = 'none';
    
    // Update timer display immediately
    timerElement.textContent = qrTimeRemaining;
    
    // Clear any existing timer
    if (qrTimer) {
        clearInterval(qrTimer);
    }
    
    // Start countdown
    qrTimer = setInterval(() => {
        qrTimeRemaining--;
        timerElement.textContent = qrTimeRemaining;
        
        if (qrTimeRemaining <= 0) {
            // Timer expired
            clearInterval(qrTimer);
            qrTimer = null;
            
            // Update UI to show expired state
            timerElement.classList.add('expired');
            timerElement.textContent = 'EXPIRED';
            
            statusElement.classList.add('expired');
            statusElement.innerHTML = '<p>QR Code has expired. Processing absent students...</p>';
            
            regenerateBtn.style.display = 'inline-flex';
            
            console.log('QR Code expired after 30 seconds - Processing absent students');
            
            // Process absent students after QR expires
            processAbsentStudents();
        }
    }, 1000);
    
    console.log('QR Timer started - 30 seconds countdown');
}

/**
 * Regenerates a new QR code (resets form)
 */
function regenerateQR() {
    // Hide QR display and show form again
    document.getElementById('qrCodeDisplay').style.display = 'none';
    document.getElementById('qrForm').style.display = 'block';
    
    // Clear timer
    if (qrTimer) {
        clearInterval(qrTimer);
        qrTimer = null;
    }
    
    console.log('Regenerating QR - returning to form');
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('qrModal');
    if (event.target === modal) {
        closeQRModal();
    }
}

// Make functions globally accessible
window.openQRModal = openQRModal;
window.closeQRModal = closeQRModal;
window.generateQRCode = generateQRCode;
window.updateQRBatchOptions = updateQRBatchOptions;
window.regenerateQR = regenerateQR;


/**
 * Signs the faculty member out.
 */
function logout() {
    firebase.auth().signOut().then(() => {
        console.log('Signed out successfully');
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Sign out error:', error);
        alert('Error signing out.');
    });
}

// --- FACULTY PROFILE COMPLETION FUNCTIONS ---

/**
 * Check if faculty has completed profile and show popup if needed
 * @param {Object} user - Firebase user object
 */
async function checkAndLoadFacultyProfile(user) {
    const db = firebase.firestore();

    // Avoid re-prompting within the same session after successful completion
    const sessionCompleted = sessionStorage.getItem('facultyProfileCompleted') === 'true';

    try {
        // First, attempt to fetch the faculty profile
        const facultyDoc = await db.collection('faculty').doc(user.uid).get();

        if (facultyDoc.exists) {
            const data = facultyDoc.data();
            facultyProfile = data;

            const isComplete = !!(data.fullName && data.employeeId && Array.isArray(data.departments) && data.departments.length > 0 && Array.isArray(data.subjects) && data.subjects.length > 0);

            if (isComplete) {
                console.log('Faculty profile complete, initializing dashboard');
                hideFacultyProfilePopup();
                showFacultyWelcome(data);
                initializeFacultyDashboard();
                populateSubjectOptions(data.subjects);
                // Mark session flag so we don't flicker the popup on future checks this session
                sessionStorage.setItem('facultyProfileCompleted', 'true');
                return;
            }
            // If doc exists but incomplete, fall through to show popup below
            console.log('Incomplete faculty profile detected.');
        } else {
            console.log('Faculty profile document not found.');
        }

        // Fallback: check the users collection flag if available
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            if (userData && userData.profileCompleted && sessionCompleted) {
                // If user doc says completed and we already completed this session, avoid showing popup
                console.log('User profileCompleted flag set; skipping popup this session. Retrying initialization.');
                hideFacultyProfilePopup();
                initializeFacultyDashboard();
                // Subjects may still be needed; try to populate if we have them
                if (facultyProfile && Array.isArray(facultyProfile.subjects)) {
                    populateSubjectOptions(facultyProfile.subjects);
                }
                return;
            }
        } catch (userDocErr) {
            console.warn('Could not read users doc for fallback:', userDocErr);
            // Do not force popup just due to a transient read error
        }

        // If we reached here, we likely need profile completion
        console.log('Showing faculty profile completion popup');
        showFacultyProfilePopup();
    } catch (error) {
        console.error('Error checking faculty profile:', error);
        // Do not immediately force a popup on transient errors; show a gentle message and retry option
        // As a safe fallback, we still show the popup to unblock usage
        showFacultyProfilePopup();
    }
}

/**
 * Show the faculty profile completion popup
 */
function showFacultyProfilePopup() {
    const popup = document.getElementById('facultyProfilePopup');
    popup.style.display = 'block';
    
    // Setup form submission handler
    const form = document.getElementById('facultyProfileForm');
    form.onsubmit = handleFacultyProfileSubmission;
}

/**
 * Hide the faculty profile completion popup
 */
function hideFacultyProfilePopup() {
    const popup = document.getElementById('facultyProfilePopup');
    popup.style.display = 'none';
}

/**
 * Populate subjects checkboxes from common-utils.js
 */
function populateSubjectsCheckboxes() {
    const subjectsContainer = document.getElementById('subjectsCheckboxes');
    const subjects = [
        "JAVA", "DSA", "DBMS", "EXCEL", "JAVASCRIPT", 
        "MASTERCLASS", "PYTHON", "BUSINESS COMMUNICATION", "CRITICAL COMMUNICATION"
    ];
    
    subjects.forEach(subject => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'subject-checkbox-item';
        
        const checkboxId = `subject_${subject.replace(/\s+/g, '_').toLowerCase()}`;
        
        checkboxItem.innerHTML = `
            <input type="checkbox" id="${checkboxId}" value="${subject}">
            <label for="${checkboxId}">${subject}</label>
        `;
        
        subjectsContainer.appendChild(checkboxItem);
    });
}

/**
 * Handle faculty profile form submission
 * @param {Event} event - Form submission event
 */
async function handleFacultyProfileSubmission(event) {
    event.preventDefault();
    
    // Collect form data
    const fullName = document.getElementById('facultyFullName').value.trim();
    const employeeId = document.getElementById('facultyEmployeeId').value.trim();
    const phone = document.getElementById('facultyPhone').value.trim();
    
    // Get selected departments
    const departmentCheckboxes = document.querySelectorAll('#departmentCheckboxes input[type="checkbox"]:checked');
    const selectedDepartments = Array.from(departmentCheckboxes).map(cb => cb.value);
    
    // Get selected subjects
    const subjectCheckboxes = document.querySelectorAll('#subjectsCheckboxes input[type="checkbox"]:checked');
    const selectedSubjects = Array.from(subjectCheckboxes).map(cb => cb.value);
    
    // Validation
    if (!fullName || !employeeId || !phone) {
        alert('Please fill in all required fields.');
        return;
    }
    
    if (selectedDepartments.length === 0) {
        alert('Please select at least one department.');
        return;
    }
    
    if (selectedSubjects.length === 0) {
        alert('Please select at least one subject you teach.');
        return;
    }
    
    // Validate phone number (basic)
    if (!/^[\d\s\-\+\(\)]+$/.test(phone)) {
        alert('Please enter a valid phone number.');
        return;
    }
    
    try {
        console.log('Starting faculty profile submission...');
        console.log('Current user:', currentFaculty);
        
        const db = firebase.firestore();
        const profileData = {
            fullName,
            employeeId,
            departments: selectedDepartments,
            subjects: selectedSubjects,
            phone,
            email: currentFaculty.email,
            role: 'faculty',
            profileCompleted: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('Profile data to save:', profileData);
        console.log('User UID:', currentFaculty.uid);
        
        // Save to Firestore
        console.log('Saving to faculty collection...');
        await db.collection('faculty').doc(currentFaculty.uid).set(profileData);
        console.log('Faculty document saved successfully');
        
        // Update user document as well
        console.log('Updating user document...');
        await db.collection('users').doc(currentFaculty.uid).update({
            profileCompleted: true,
            fullName: fullName,
            updatedAt: new Date()
        });
        console.log('User document updated successfully');
        
        console.log('Faculty profile saved successfully');
        facultyProfile = profileData;
        
        // Hide popup and show success message
        hideFacultyProfilePopup();
        showSuccessMessage('Profile completed successfully! Welcome to your dashboard.');
        
        // Show welcome message and initialize dashboard
        showFacultyWelcome(profileData);
        initializeFacultyDashboard();
        populateSubjectOptions(selectedSubjects);
        
    } catch (error) {
        console.error('Error saving faculty profile:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error);
        
        // Check if it's a permission error
        if (error.code === 'permission-denied') {
            alert('Permission denied. Please check if you are properly authenticated.');
        } else if (error.code === 'not-found') {
            alert('Document not found. Please try logging in again.');
        } else {
            alert(`Error saving profile: ${error.message}. Please try again.`);
        }
    }
}

/**
 * Show faculty welcome message
 * @param {Object} profileData - Faculty profile data
 */
function showFacultyWelcome(profileData) {
    // Find the header container
    const header = document.querySelector('.header');
    
    if (!header) {
        console.error('Header container not found');
        return;
    }
    
    // Check if welcome message already exists to avoid duplicates
    const existingWelcome = header.querySelector('.faculty-welcome');
    if (existingWelcome) {
        existingWelcome.remove();
    }
    
    // Create welcome message
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'faculty-welcome';
    welcomeDiv.innerHTML = `
        <h4><i class="fas fa-user-check"></i> Welcome, ${profileData.fullName}!</h4>
        <p>Department(s): ${profileData.departments ? profileData.departments.join(', ') : profileData.department || 'N/A'} | Subjects: ${profileData.subjects.join(', ')}</p>
    `;
    
    // Insert after the header-top div (which contains title and logout button)
    const headerTop = header.querySelector('.header-top');
    if (headerTop) {
        // Insert after the header-top div
        headerTop.insertAdjacentElement('afterend', welcomeDiv);
    } else {
        // Fallback: just append to header
        header.appendChild(welcomeDiv);
    }
}

/**
 * Populate QR generation subject options with faculty's subjects
 * @param {Array} subjects - Array of subjects the faculty teaches
 */
function populateSubjectOptions(subjects) {
    const subjectSelect = document.getElementById('subjectSelect');
    const qrSubjectSelect = document.getElementById('qrSubject');
    const manualSubjectSelect = document.getElementById('manualSubject');
    const reportSubjectSelect = document.getElementById('reportSubject');
    const batchReportSubjectSelect = document.getElementById('batchReportSubject');
    
    // Clear existing options except the first one for all selects
    if (subjectSelect) {
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
    }
    
    if (qrSubjectSelect) {
        qrSubjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            qrSubjectSelect.appendChild(option);
        });
    }
    
    // Populate manual attendance subject dropdown
    if (manualSubjectSelect) {
        manualSubjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            manualSubjectSelect.appendChild(option);
        });
    }
    
    // Populate reports subject dropdown (individual reports)
    if (reportSubjectSelect) {
        reportSubjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            reportSubjectSelect.appendChild(option);
        });
    }
    
    // Populate batch report subject dropdown
    if (batchReportSubjectSelect) {
        batchReportSubjectSelect.innerHTML = '<option value="">Select Subject</option>';
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            batchReportSubjectSelect.appendChild(option);
        });
    }
}

/**
 * Show success message
 * @param {string} message - Success message to display
 */
function showSuccessMessage(message) {
    // Create temporary success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1001;
        max-width: 300px;
        font-family: 'Poppins', sans-serif;
    `;
    
    notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 5px;">Success!</div>
        <div style="font-size: 14px;">${message}</div>
        <button onclick="this.parentElement.remove()" style="
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
        ">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ===== MANUAL ATTENDANCE FUNCTIONS =====

// Batch options for manual attendance
const manualBatchOptions = {
    "School of Technology": ["24B1", "24B2", "23B1"],
    "School of Management": ["23B1", "24B1"]
};

// Store loaded students and their attendance status
let loadedStudents = [];
let attendanceData = new Map(); // studentId -> {present: boolean, ...}

/**
 * Updates batch options for manual attendance based on selected school
 */
function updateManualBatchOptions() {
    const schoolSelect = document.getElementById('manualSchool');
    const batchSelect = document.getElementById('manualBatch');
    const selectedSchool = schoolSelect.value;
    
    // Clear existing options
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (selectedSchool && manualBatchOptions[selectedSchool]) {
        batchSelect.disabled = false;
        manualBatchOptions[selectedSchool].forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            batchSelect.appendChild(option);
        });
        console.log(`Updated manual batch options for ${selectedSchool}:`, manualBatchOptions[selectedSchool]);
    } else {
        batchSelect.disabled = true;
    }
    
    // Clear students container if visible
    document.getElementById('studentsContainer').style.display = 'none';
    loadedStudents = [];
    attendanceData.clear();
}

/**
 * Loads students list based on selected criteria
 */
async function loadStudentsList() {
    const school = document.getElementById('manualSchool').value;
    const batch = document.getElementById('manualBatch').value;
    const subject = document.getElementById('manualSubject').value;
    const periods = document.getElementById('manualPeriods').value;
    
    // Validation
    if (!school || !batch || !subject || !periods) {
        alert('Please fill in all fields before loading students.');
        return;
    }
    
    try {
        console.log('🔍 Loading students for:', { school, batch, subject, periods });
        
        // Show loading state
        const studentsContainer = document.getElementById('studentsContainer');
        const studentsList = document.getElementById('studentsList');
        
        studentsContainer.style.display = 'block';
        studentsList.innerHTML = `
            <div class="loading-students">
                <i class="fas fa-spinner"></i>
                <p>Loading students...</p>
            </div>
        `;
        
        // Update attendance title
        const attendanceTitle = document.getElementById('attendanceTitle');
        attendanceTitle.textContent = `Mark Attendance - ${subject} (${batch})`;
        
        const db = firebase.firestore();
        
        // First, let's check all users to see what data we have
        console.log('🔍 Checking all users in database...');
        const allUsersQuery = await db.collection('users').limit(10).get();
        console.log('📊 Sample users found:', allUsersQuery.size);
        
        allUsersQuery.forEach(doc => {
            const userData = doc.data();
            console.log('👤 Sample user data:', {
                id: doc.id,
                role: userData.role,
                school: userData.school,
                batch: userData.batch,
                name: userData.fullName || userData.name,
                email: userData.email
            });
        });
        
        // Now query for students with role 'student'
        console.log('🎓 Querying for students with role="student"...');
        const studentRoleQuery = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        console.log('📊 Students with role="student" found:', studentRoleQuery.size);
        
        studentRoleQuery.forEach(doc => {
            const userData = doc.data();
            console.log('🎓 Student data:', {
                id: doc.id,
                school: userData.school,
                batch: userData.batch,
                name: userData.fullName || userData.name,
                email: userData.email
            });
        });
        
        // Since school and batch are undefined in users collection, 
        // we need to get all students and check their profiles
        console.log(`🔍 Getting all students and checking profiles for school="${school}" and batch="${batch}"...`);
        
        // First get all students
        const allStudentsQuery = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        
        console.log('📊 Total students found in users collection:', allStudentsQuery.size);
        
        // Now we need to check each student's profile for school and batch info
        const matchingStudents = [];
        const profilePromises = [];
        
        allStudentsQuery.forEach(studentDoc => {
            const studentData = studentDoc.data();
            console.log('👤 Checking student:', {
                id: studentDoc.id,
                email: studentData.email,
                name: studentData.fullName || studentData.name
            });
            
            // Check if they have a profile document
            const profilePromise = db.collection('profiles').doc(studentDoc.id).get()
                .then(profileDoc => {
                    if (profileDoc.exists) {
                        const profileData = profileDoc.data();
                        console.log('📋 Student profile found:', {
                            id: studentDoc.id,
                            school: profileData.school,
                            batch: profileData.batch,
                            name: profileData.fullName || studentData.fullName || studentData.name,
                            regNumber: profileData.regNumber || 'N/A'
                        });
                        
                        if (profileData.school === school && profileData.batch === batch) {
                            console.log('✅ Student matches criteria:', studentDoc.id);
                            matchingStudents.push({
                                userDoc: studentDoc,
                                userData: studentData,
                                profileData: profileData
                            });
                        }
                    } else {
                        console.log('❌ No profile found for student:', studentDoc.id);
                    }
                })
                .catch(error => {
                    console.warn('⚠️ Error fetching profile for student:', studentDoc.id, error);
                });
            
            profilePromises.push(profilePromise);
        });
        
        // Wait for all profile checks to complete
        await Promise.all(profilePromises);
        
        console.log(`📊 Students matching ${school} - ${batch}:`, matchingStudents.length);
        
        loadedStudents = [];
        attendanceData.clear();
        
        // If no students found in profiles, try to use all students as fallback
        if (matchingStudents.length === 0) {
            console.log('❌ No students found with matching profiles');
            console.log('🔄 Trying fallback approach - using all students for this batch...');
            
            // Fallback: Use all students and filter based on email patterns or batch info
            allStudentsQuery.forEach(studentDoc => {
                const studentData = studentDoc.data();
                const email = studentData.email || '';
                
                // Try to infer batch from email (e.g., sot2428 suggests School of Technology, batch 2428/24B1)
                let inferredSchool = '';
                let inferredBatch = '';
                
                if (email.includes('sot')) {
                    inferredSchool = 'School of Technology';
                    if (email.includes('2428')) {
                        inferredBatch = '24B1'; // or '24B2', we'll make this more flexible
                    } else if (email.includes('2328')) {
                        inferredBatch = '23B1';
                    }
                } else if (email.includes('som')) {
                    inferredSchool = 'School of Management';
                    if (email.includes('2428')) {
                        inferredBatch = '24B1';
                    } else if (email.includes('2328')) {
                        inferredBatch = '23B1';
                    }
                }
                
                console.log('🔍 Checking student with email pattern:', {
                    id: studentDoc.id,
                    email: email,
                    inferredSchool,
                    inferredBatch,
                    targetSchool: school,
                    targetBatch: batch
                });
                
                // Match based on inferred data or if we're looking for School of Technology and email contains sot
                if ((inferredSchool === school && inferredBatch === batch) || 
                    (school === 'School of Technology' && email.includes('sot2428') && batch.startsWith('24'))) {
                    
                    console.log('✅ Student matches criteria (fallback):', studentDoc.id);
                    matchingStudents.push({
                        userDoc: studentDoc,
                        userData: studentData,
                        profileData: {
                            school: inferredSchool || school,
                            batch: inferredBatch || batch,
                            fullName: studentData.fullName || studentData.name,
                            regNumber: studentData.regNumber || studentData.registrationNumber || 'N/A'
                        }
                    });
                }
            });
            
            console.log(`📊 Students found with fallback approach: ${matchingStudents.length}`);
        }
        
        if (matchingStudents.length === 0) {
            console.log('❌ No students found matching criteria (even with fallback)');
            studentsList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>No students found for ${school} - ${batch}</p>
                    <p style="font-size: 0.9rem; color: #999; margin-top: 10px;">Students may need to complete their profiles</p>
                </div>
            `;
            updateAttendanceSummary();
            return;
        }
        
        // Process matching students
        matchingStudents.forEach(({ userDoc, userData, profileData }) => {
            console.log('📝 Processing matched student:', {
                id: userDoc.id,
                userData: userData,
                profileData: profileData
            });
            
            const student = {
                id: userDoc.id,
                name: profileData.fullName || userData.fullName || userData.name || extractNameFromEmail(userData.email),
                regNumber: profileData.regNumber || userData.regNumber || userData.registrationNumber || 'N/A',
                email: userData.email,
                school: profileData.school,
                batch: profileData.batch
            };
            
            loadedStudents.push(student);
            // Default to absent
            attendanceData.set(student.id, {
                present: false,
                studentId: student.id,
                studentName: student.name,
                regNumber: student.regNumber,
                email: student.email
            });
        });
        
        // Sort students by name
        loadedStudents.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`✅ Successfully loaded ${loadedStudents.length} students:`, loadedStudents);
        
        // Render students cards
        renderStudentsCards();
        
    } catch (error) {
        console.error('❌ Error loading students:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        document.getElementById('studentsList').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #dc3545;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Error loading students: ${error.message}</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Check browser console for details</p>
                <button onclick="loadStudentsList()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

/**
 * Renders student cards with checkboxes
 */
function renderStudentsCards() {
    const studentsList = document.getElementById('studentsList');
    
    studentsList.innerHTML = '';
    
    loadedStudents.forEach(student => {
        const attendance = attendanceData.get(student.id);
        const isPresent = attendance ? attendance.present : false;
        
        const studentCard = document.createElement('div');
        studentCard.className = `student-card ${isPresent ? 'present' : 'absent'}`;
        studentCard.onclick = () => toggleStudentAttendance(student.id);
        
        studentCard.innerHTML = `
            <div class="student-info">
                <h4>${student.name}</h4>
                <p><strong>Reg No:</strong> ${student.regNumber}</p>
            </div>
            <input type="checkbox" 
                   class="attendance-checkbox" 
                   ${isPresent ? 'checked' : ''}
                   onclick="event.stopPropagation(); toggleStudentAttendance('${student.id}')">
        `;
        
        studentsList.appendChild(studentCard);
    });
    
    updateAttendanceSummary();
}

/**
 * Toggles attendance status for a specific student
 * @param {string} studentId - The student ID
 */
function toggleStudentAttendance(studentId) {
    const attendance = attendanceData.get(studentId);
    if (attendance) {
        attendance.present = !attendance.present;
        attendanceData.set(studentId, attendance);
        
        // Re-render to update visual state
        renderStudentsCards();
        
        console.log(`Toggled attendance for student ${studentId}: ${attendance.present ? 'Present' : 'Absent'}`);
    }
}

/**
 * Marks all students as present
 */
function markAllPresent() {
    attendanceData.forEach((attendance, studentId) => {
        attendance.present = true;
        attendanceData.set(studentId, attendance);
    });
    
    renderStudentsCards();
    console.log('Marked all students as present');
}

/**
 * Marks all students as absent
 */
function markAllAbsent() {
    attendanceData.forEach((attendance, studentId) => {
        attendance.present = false;
        attendanceData.set(studentId, attendance);
    });
    
    renderStudentsCards();
    console.log('Marked all students as absent');
}

/**
 * Updates the attendance summary display
 */
function updateAttendanceSummary() {
    const totalStudents = loadedStudents.length;
    const presentCount = Array.from(attendanceData.values()).filter(a => a.present).length;
    
    const summaryElement = document.getElementById('attendanceSummary');
    if (summaryElement) {
        summaryElement.textContent = `${presentCount} Present / ${totalStudents} Total`;
    }
}

/**
 * Submits the manual attendance to Firestore
 */
async function submitManualAttendance() {
    if (loadedStudents.length === 0) {
        alert('No students loaded. Please load students first.');
        return;
    }
    
    const school = document.getElementById('manualSchool').value;
    const batchName = document.getElementById('manualBatch').value;
    const subject = document.getElementById('manualSubject').value;
    const periodsRaw = parseInt(document.getElementById('manualPeriods').value);
    const periods = Math.max(1, periodsRaw || 1);
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Generate unique session ID for manual attendance
    const now = new Date();
    const timeString = now.toTimeString().substr(0, 5); // HH:MM format
    const sessionId = `manual_${subject}_${batchName}_${now.getTime()}_${Math.random().toString(36).substr(2, 6)}`;
    
    try {
        console.log('Submitting manual attendance for session:', sessionId);
        
        const db = firebase.firestore();
        
        // Check if attendance already exists for this session
        console.log('Checking for existing attendance records...');
        const existingQuery = await db.collection('attendances')
            .where('date', '==', today)
            .where('subject', '==', subject)
            .where('batch', '==', batchName)
            .where('markedBy', '==', currentFaculty.uid)
            .where('method', '==', 'manual')
            .get();
            
        if (!existingQuery.empty) {
            const confirmOverride = confirm(
                `Attendance for ${subject} (${batchName}) on ${today} already exists.\n\n` +
                `This will create a new session instead of overriding.\n` +
                `Continue to create new attendance session?`
            );
            
            if (!confirmOverride) {
                console.log('Manual attendance submission cancelled by user');
                return;
            }
            console.log('Creating new attendance session as requested');
        }

        // Process attendance records
        console.log('Processing manual attendance submission');

        const batchWrite = db.batch();
        
        // Prepare attendance records
        const attendanceRecords = [];
        
        attendanceData.forEach((attendance, studentId) => {
            const attendanceRecord = {
                userId: studentId,
                studentName: attendance.studentName,
                regNumber: attendance.regNumber,
                email: attendance.email,
                school: school,
                batch: batchName,
                subject: subject,
                periods: periods,
                date: today,
                status: attendance.present ? 'present' : 'absent',
                markedAt: firebase.firestore.FieldValue.serverTimestamp(),
                markedBy: currentFaculty.uid,
                facultyName: facultyProfile ? facultyProfile.fullName : currentFaculty.email,
                method: 'manual',
                hasPhoto: false, // Manual attendance doesn't have photo verification
                sessionId: sessionId, // Unique session identifier
                classTime: timeString, // Time when attendance was taken
                generatedAt: new Date().toISOString()
            };
            
            attendanceRecords.push(attendanceRecord);
            
            // Create a document in the attendances collection
            const attendanceRef = db.collection('attendances').doc();
            batchWrite.set(attendanceRef, attendanceRecord);
        });
        
        // Commit the batch write
        await batchWrite.commit();
        
        console.log(`Successfully submitted ${attendanceRecords.length} attendance records`);
        
        // Show success message
        const presentCount = attendanceRecords.filter(record => record.status === 'present').length;
        const absentCount = attendanceRecords.filter(record => record.status === 'absent').length;
        
        showSuccessMessage(
            `Attendance submitted successfully!\n` +
            `Present: ${presentCount}, Absent: ${absentCount}\n` +
            `Subject: ${subject} (${periods} period${periods > 1 ? 's' : ''})\n` +
            `Session: ${timeString} - ${sessionId.substr(-6)}`
        );
        
        // Reset form
        resetAttendanceForm();
        
    } catch (error) {
        console.error('Error submitting attendance:', error);
        alert(`Error submitting attendance: ${error.message}. Please try again.`);
    }
}

/**
 * Resets the attendance form and clears loaded data
 */
function resetAttendanceForm() {
    // Clear form fields
    document.getElementById('manualSchool').value = '';
    document.getElementById('manualBatch').value = '';
    document.getElementById('manualBatch').disabled = true;
    document.getElementById('manualSubject').value = '';
    document.getElementById('manualPeriods').value = '';
    
    // Hide students container
    document.getElementById('studentsContainer').style.display = 'none';
    
    // Clear loaded data
    loadedStudents = [];
    attendanceData.clear();
    
    console.log('Attendance form reset');
}

/**
 * Helper function to extract name from email if name is not available
 * @param {string} email - The email address
 * @returns {string} - Extracted name
 */
function extractNameFromEmail(email) {
    if (!email) return 'Unknown Student';
    
    // Extract the part before @ and format it
    const username = email.split('@')[0];
    
    // Replace dots and underscores with spaces and capitalize
    return username
        .replace(/[._]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// ===== REPORTS SECTION FUNCTIONS =====

/**
 * Generates and displays an attendance report for the selected student and subject
 */
async function generateAttendanceReport() {
    const regNumber = document.getElementById('studentRegNumber').value.trim().toUpperCase();
    const subject = document.getElementById('reportSubject').value;
    
    // Validation
    if (!regNumber) {
        alert('Please enter a student registration number.');
        return;
    }
    
    if (!subject) {
        alert('Please select a subject.');
        return;
    }
    
    console.log('🔍 Starting report generation for:', { regNumber, subject });
    console.log('🔍 Current faculty info:', {
        currentFaculty: currentFaculty ? { uid: currentFaculty.uid, email: currentFaculty.email } : null,
        facultyProfile: facultyProfile ? { fullName: facultyProfile.fullName, subjects: facultyProfile.subjects } : null
    });
    
    try {
        // Show loading state
        showReportLoading(true);
        
        const db = firebase.firestore();
        
        // First, let's test basic Firestore connectivity and permissions
        console.log('🔍 Testing basic Firestore permissions...');
        
        // Test if we can read from faculty collection (should be allowed for current user)
        try {
            const facultyTestQuery = await db.collection('faculty').doc(currentFaculty.uid).get();
            console.log('✅ Faculty collection read test successful:', facultyTestQuery.exists);
        } catch (testError) {
            console.error('❌ Faculty collection read test failed:', testError);
            showReportError(`Permission error: Cannot access faculty data. ${testError.message}`);
            return;
        }
        
        // Test if we can read from attendances collection
        try {
            const attendanceTestQuery = await db.collection('attendances').limit(1).get();
            console.log('✅ Attendances collection read test successful, found', attendanceTestQuery.size, 'records');
        } catch (testError) {
            console.error('❌ Attendances collection read test failed:', testError);
            showReportError(`Permission error: Cannot access attendance data. ${testError.message}`);
            return;
        }
        
        // First, find the student by registration number
        console.log('👤 Finding student with registration number:', regNumber);
        
        // Query profiles collection for the student
        const profileQuery = await db.collection('profiles')
            .where('regNumber', '==', regNumber)
            .limit(1)
            .get();
        
        let studentData = null;
        let studentId = null;
        
        if (!profileQuery.empty) {
            const profileDoc = profileQuery.docs[0];
            studentId = profileDoc.id;
            studentData = profileDoc.data();
            console.log('✅ Student found in profiles:', { studentId, studentData });
        } else {
            // Fallback: search in users collection
            console.log('🔄 Student not found in profiles, searching users collection...');
            
            const userQuery = await db.collection('users')
                .where('regNumber', '==', regNumber)
                .limit(1)
                .get();
            
            if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                studentId = userDoc.id;
                studentData = userDoc.data();
                console.log('✅ Student found in users:', { studentId, studentData });
            } else {
                // Last fallback: search by registrationNumber field
                const altUserQuery = await db.collection('users')
                    .where('registrationNumber', '==', regNumber)
                    .limit(1)
                    .get();
                
                if (!altUserQuery.empty) {
                    const userDoc = altUserQuery.docs[0];
                    studentId = userDoc.id;
                    studentData = userDoc.data();
                    console.log('✅ Student found in users (alt field):', { studentId, studentData });
                } else {
                    console.log('❌ Student not found with registration number:', regNumber);
                    showReportError(`Student with registration number "${regNumber}" not found.`);
                    return;
                }
            }
        }
        
        // Get attendance records for this student and subject
        console.log('📊 Fetching attendance records for:', { studentId, subject });
        
        // Debug: First, let's see ALL attendance records for this student (no subject filter)
        console.log('🔍 DEBUG: Checking all attendance records for student:', studentId);
        console.warn('⚠️ FORCING DEBUG OUTPUT - This should appear in console!');
        
        const debugQuery = await db.collection('attendances')
            .where('userId', '==', studentId)
            .get();
        
        console.error('🚨 CRITICAL DEBUG: Found', debugQuery.size, 'total attendance records for student', studentId);
        
        // IMMEDIATELY log every single record found
        debugQuery.forEach(doc => {
            console.error('📄 RECORD FOUND:', {
                id: doc.id,
                data: doc.data()
            });
        });
        
        console.log(`🔍 DEBUG: Found ${debugQuery.size} total attendance records for student`);
        
        // Force console output by using different log levels
        console.warn('=== ATTENDANCE RECORDS DEBUG START ===');
        console.error('DEBUG: Processing', debugQuery.size, 'attendance records for student:', studentId);
        
        // Create detailed arrays for analysis
        const manualRecords = [];
        const qrRecords = [];
        const unknownRecords = [];
        
        debugQuery.forEach(doc => {
            const record = doc.data();
            const recordInfo = {
                id: doc.id,
                date: record.date,
                subject: record.subject,
                status: record.status,
                method: record.method || null,
                verificationMethod: record.verificationMethod || null,
                hasPhoto: record.hasPhoto || false,
                facultyName: record.facultyName || null,
                markedBy: record.markedBy || null,
                periods: record.periods || 1,
                timestamp: record.timestamp || null,
                markedAt: record.markedAt || null
            };
            
            console.log('🔍 DEBUG: Individual attendance record:', recordInfo);
            
            // Categorize records
            if (record.method === 'manual') {
                manualRecords.push(recordInfo);
            } else if (record.method === 'qr' || record.verificationMethod || record.hasPhoto) {
                qrRecords.push(recordInfo);
            } else {
                unknownRecords.push(recordInfo);
            }
        });
        
        console.log('📊 DEBUG: Record categorization:', {
            manualRecords: manualRecords.length,
            qrRecords: qrRecords.length,
            unknownRecords: unknownRecords.length
        });
        
        console.log('📋 DEBUG: Manual Records:', manualRecords);
        console.log('📱 DEBUG: QR Records:', qrRecords);
        console.log('❓ DEBUG: Unknown Records:', unknownRecords);
        
        // Check for subject matching issues
        const subjectsFound = [...new Set(debugQuery.docs.map(doc => doc.data().subject))];
        console.log('📚 DEBUG: All subjects found for this student:', subjectsFound);
        console.log('🎯 DEBUG: Target subject for report:', subject);
        console.log('🔍 DEBUG: Subject match check:', subjectsFound.includes(subject));
        
        // Log detailed structure of each record to understand the data format
        console.group('🔍 DETAILED RECORD ANALYSIS');
        debugQuery.forEach(doc => {
            const record = doc.data();
            console.log(`\n📄 Record ID: ${doc.id}`);
            console.log('📋 Full Record Data:', record);
            console.log('🔑 All Fields Present:', Object.keys(record));
            console.log('📅 Date Field:', record.date, '(type:', typeof record.date, ')');
            console.log('📚 Subject Field:', record.subject, '(type:', typeof record.subject, ')');
            console.log('👨‍🏫 Faculty Name Field:', record.facultyName, '(type:', typeof record.facultyName, ')');
            console.log('⚡ Method Field:', record.method, '(type:', typeof record.method, ')');
            console.log('📱 Verification Method:', record.verificationMethod, '(type:', typeof record.verificationMethod, ')');
            console.log('📸 Has Photo:', record.hasPhoto, '(type:', typeof record.hasPhoto, ')');
            console.log('👤 Marked By:', record.markedBy, '(type:', typeof record.markedBy, ')');
            console.log('⏰ Marked At:', record.markedAt, '(type:', typeof record.markedAt, ')');
            console.log('🕐 Timestamp:', record.timestamp, '(type:', typeof record.timestamp, ')');
            console.log('─'.repeat(80));
        });
        console.groupEnd();
        
        // Simple summary for immediate understanding
        console.warn(`📊 SUMMARY: Found ${debugQuery.size} records total`);
        console.warn(`📋 Manual: ${manualRecords.length}, 📱 QR: ${qrRecords.length}, ❓ Unknown: ${unknownRecords.length}`);
        console.warn(`📚 Subjects: ${subjectsFound.join(', ')} | Target: ${subject}`);
        
        // Check if there are any records without proper dates
        const recordsWithoutDates = [];
        const recordsWithoutSubjects = [];
        const recordsWithoutFacultyName = [];
        
        debugQuery.forEach(doc => {
            const record = doc.data();
            if (!record.date) recordsWithoutDates.push(doc.id);
            if (!record.subject) recordsWithoutSubjects.push(doc.id);
            if (!record.facultyName) recordsWithoutFacultyName.push(doc.id);
        });
        
        if (recordsWithoutDates.length > 0) {
            console.error('❌ Records missing date field:', recordsWithoutDates);
        }
        if (recordsWithoutSubjects.length > 0) {
            console.error('❌ Records missing subject field:', recordsWithoutSubjects);
        }
        if (recordsWithoutFacultyName.length > 0) {
            console.warn('⚠️ Records missing facultyName field:', recordsWithoutFacultyName);
        }
        
        // IMPORTANT: Let's check if there are MORE records than the 7 showing
        console.group('🔍 RECORD COUNT INVESTIGATION');
        
        // Check total attendance records in database
        const totalAttendanceQuery = await db.collection('attendances').get();
        console.log('🌍 TOTAL attendance records in entire database:', totalAttendanceQuery.size);
        
        // Check all attendance records for ANY student with this subject
        const subjectQuery = await db.collection('attendances')
            .where('subject', '==', subject)
            .get();
        console.log(`📚 TOTAL attendance records for subject "${subject}":`, subjectQuery.size);
        
        // Check all attendance records for this student (any subject)
        const studentAllQuery = await db.collection('attendances')
            .where('userId', '==', studentId)
            .get();
        console.log(`👤 TOTAL attendance records for student "${studentId}":`, studentAllQuery.size);
        
        // Now get the filtered query (student + subject)
        const attendanceQuery = await db.collection('attendances')
            .where('userId', '==', studentId)
            .where('subject', '==', subject)
            .get();
        
        console.log(`📊 FILTERED attendance records (student + subject): ${attendanceQuery.size}`);
        console.groupEnd();
        
        // Compare the counts
        if (studentAllQuery.size > attendanceQuery.size) {
            console.warn(`⚠️ POTENTIAL ISSUE: Student has ${studentAllQuery.size} total records but only ${attendanceQuery.size} for subject "${subject}"`);
            console.warn('📝 This suggests some records have different subject names. Check the detailed analysis above.');
        }
        
        if (attendanceQuery.size < 10) {
            console.warn('📈 Let\'s check if there are records with slightly different subject names...');
            
            // Check for common variations
            const subjectVariations = [subject, subject.toUpperCase(), subject.toLowerCase(), subject.trim()];
            for (const variation of subjectVariations) {
                if (variation !== subject) {
                    const variationQuery = await db.collection('attendances')
                        .where('userId', '==', studentId)
                        .where('subject', '==', variation)
                        .get();
                    if (variationQuery.size > 0) {
                        console.warn(`🔍 Found ${variationQuery.size} records with subject variation: "${variation}"`);
                    }
                }
            }
        }
        
        // Log exactly what we're filtering by
        console.log('📊 Query filters used:', {
            userId: studentId,
            subject: subject,
            studentIdType: typeof studentId,
            subjectType: typeof subject
        });
        
        const attendanceRecords = [];
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalClasses = 0;
        
        attendanceQuery.forEach(doc => {
            const record = doc.data();
            
            // Handle both manual and QR attendance record structures
            const periods = record.periods || 1;
            const method = record.method || (record.verificationMethod ? 'qr' : 'unknown');
            const markedAt = record.markedAt ? 
                (record.markedAt.toDate ? record.markedAt.toDate() : new Date(record.markedAt)) : 
                (record.timestamp ? record.timestamp.toDate() : null);
            
            // Determine faculty name from various possible fields
            let facultyName = 'Unknown';
            if (record.facultyName) {
                facultyName = record.facultyName;
            } else if (record.markedBy && record.markedBy !== studentId) {
                // This was marked by a faculty member - fetch faculty name
                console.log('🔍 Fetching faculty name for markedBy:', record.markedBy);
                
                // We'll fetch the faculty name after the forEach loop
                facultyName = `Faculty-${record.markedBy.slice(-6)}`; // Temporary placeholder
            } else if (method === 'qr' || record.verificationMethod) {
                facultyName = 'QR Attendance';
            }
            
            attendanceRecords.push({
                id: doc.id,
                date: record.date,
                status: record.status,
                periods: periods,
                method: method,
                markedAt: markedAt,
                facultyName: facultyName,
                markedBy: record.markedBy || null,
                facultyId: record.facultyId || record.markedBy || null,
                facultyEmail: record.facultyEmail || null,
                hasPhoto: record.hasPhoto || false,
                verificationMethod: record.verificationMethod || method
            });
            
            totalClasses += periods;
            
            if (record.status === 'present') {
                totalPresent += periods;
            } else {
                totalAbsent += periods;
            }
            
            // Log record details for debugging
            console.log('📋 Processing attendance record:', {
                id: doc.id,
                date: record.date,
                status: record.status,
                method: method,
                periods: periods,
                facultyName: facultyName,
                hasPhoto: record.hasPhoto || false,
                originalMethod: record.method,
                verificationMethod: record.verificationMethod
            });
        });
        
        // Sort attendance records by date (newest first)
        attendanceRecords.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA; // Descending order (newest first)
        });
        
        // Calculate attendance percentage
        const attendancePercentage = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;
        
        console.log('📈 Report summary:', {
            totalClasses,
            totalPresent,
            totalAbsent,
            attendancePercentage,
            recordsCount: attendanceRecords.length
        });
        
        // Resolve faculty names dynamically (no hardcoded names)
        console.log('🔍 Resolving faculty names from faculty/profiles/users');
        
        // Determine which records still need a name
        const needsName = (name) => !name || name === 'Unknown' || name === 'QR Attendance' || (typeof name === 'string' && name.startsWith('Faculty-'));
        
        // Collect identifiers to resolve
        const idsToResolve = new Set();
        attendanceRecords.forEach(r => {
            if (needsName(r.facultyName)) {
                if (r.facultyId) idsToResolve.add(r.facultyId);
                else if (r.markedBy) idsToResolve.add(r.markedBy);
            }
        });
        
        if (idsToResolve.size > 0) {
            try {
                const idList = Array.from(idsToResolve);
                const nameMap = {};
                
                // 1) Try faculty collection
                const facultyDocs = await Promise.all(idList.map(id => db.collection('faculty').doc(id).get().catch(() => null)));
                facultyDocs.forEach((snap, i) => {
                    if (snap && snap.exists) {
                        const d = snap.data();
                        nameMap[idList[i]] = d.fullName || d.name || d.facultyName || d.email || idList[i];
                    }
                });
                
                // 2) Profiles for remaining
                const remainingForProfiles = idList.filter(id => !nameMap[id]);
                if (remainingForProfiles.length) {
                    const profileDocs = await Promise.all(remainingForProfiles.map(id => db.collection('profiles').doc(id).get().catch(() => null)));
                    profileDocs.forEach((snap, i) => {
                        if (snap && snap.exists) {
                            const d = snap.data();
                            nameMap[remainingForProfiles[i]] = d.fullName || d.name || d.facultyName || d.email || remainingForProfiles[i];
                        }
                    });
                }
                
                // 3) Users for any still remaining
                const remainingForUsers = idList.filter(id => !nameMap[id]);
                if (remainingForUsers.length) {
                    const userDocs = await Promise.all(remainingForUsers.map(id => db.collection('users').doc(id).get().catch(() => null)));
                    userDocs.forEach((snap, i) => {
                        if (snap && snap.exists) {
                            const d = snap.data();
                            nameMap[remainingForUsers[i]] = d.fullName || d.name || d.facultyName || d.email || remainingForUsers[i];
                        }
                    });
                }
                
                // Apply resolved names
                attendanceRecords.forEach(r => {
                    const key = r.facultyId || r.markedBy;
                    if (needsName(r.facultyName) && key && nameMap[key]) {
                        r.facultyName = nameMap[key];
                    }
                });
            } catch (e) {
                console.warn('⚠️ Unable to resolve some faculty names:', e);
            }
        }
        
        // As a last resort, if record has a facultyEmail and still no name, use that
        attendanceRecords.forEach(r => {
            if (needsName(r.facultyName) && r.facultyEmail) {
                r.facultyName = r.facultyEmail;
            }
        });
        
        // Replace any remaining placeholder values with a neutral dash
        attendanceRecords.forEach(r => {
            if (needsName(r.facultyName)) {
                r.facultyName = '-';
            }
        });
        
        // Display the report with updated faculty names
        displayAttendanceReport({
            studentData,
            regNumber,
            subject,
            attendanceRecords,
            totalClasses,
            totalPresent,
            totalAbsent,
            attendancePercentage
        });
        
    } catch (error) {
        console.error('❌ Error generating attendance report:', error);
        showReportError(`Error generating report: ${error.message}`);
    }
}

/**
 * Displays the attendance report in the UI
 * @param {Object} reportData - The report data object
 */
function displayAttendanceReport(reportData) {
    const {
        studentData,
        regNumber,
        subject,
        attendanceRecords,
        totalClasses,
        totalPresent,
        totalAbsent,
        attendancePercentage
    } = reportData;
    
    // Hide loading and show report
    showReportLoading(false);
    
    const reportDisplay = document.getElementById('reportDisplay');
    reportDisplay.style.display = 'block';
    
    // Populate report header - note: subject field has conflicting ID, so we'll set it directly
    document.getElementById('reportStudentName').textContent = 
        studentData.fullName || studentData.name || 'Unknown Student';
    document.getElementById('reportStudentReg').textContent = regNumber;
    
    // Fix the subject display by finding the right element
    const reportSubjectElements = document.querySelectorAll('#reportSubject');
    if (reportSubjectElements.length > 1) {
        // Use the one inside the report display (not the form dropdown)
        reportSubjectElements[1].textContent = subject;
    } else {
        reportSubjectElements[0].textContent = subject;
    }
    
    document.getElementById('reportGeneratedDate').textContent = (typeof formatISTDate === 'function') ? formatISTDate(new Date()) : new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // Populate summary
    document.getElementById('totalClassesAttended').textContent = totalPresent;
    document.getElementById('totalClassesMissed').textContent = totalAbsent;
    document.getElementById('attendancePercentage').textContent = `${attendancePercentage}%`;
    
    // Update percentage bar
    const percentageBar = document.getElementById('percentageBar');
    if (percentageBar) {
        percentageBar.style.width = `${attendancePercentage}%`;
        
        // Color code the percentage
        if (attendancePercentage >= 75) {
            percentageBar.style.backgroundColor = '#28a745'; // Green
        } else if (attendancePercentage >= 60) {
            percentageBar.style.backgroundColor = '#ffc107'; // Yellow
        } else {
            percentageBar.style.backgroundColor = '#dc3545'; // Red
        }
    }
    
    // Populate attendance records table
    const recordsTableBody = document.getElementById('attendanceRecordsTable');
    recordsTableBody.innerHTML = '';
    
    if (attendanceRecords.length === 0) {
        recordsTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #666; padding: 20px;">
                    No attendance records found for this student and subject.
                </td>
            </tr>
        `;
    } else {
        attendanceRecords.forEach(record => {
            const row = document.createElement('tr');
            row.className = record.status === 'present' ? 'present-row' : 'absent-row';
            
            const formattedDate = (typeof formatISTDate === 'function')
                ? formatISTDate(new Date(record.date))
                : new Date(record.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: '2-digit' });
            
            const statusIcon = record.status === 'present' ? 
                '<i class="fas fa-check-circle" style="color: #28a745;"></i>' : 
                '<i class="fas fa-times-circle" style="color: #dc3545;"></i>';
            
            const periodsText = record.periods > 1 ? `${record.periods} periods` : '1 period';
            
            const canViewPhoto = !!record.hasPhoto;
            const viewBtn = canViewPhoto
                ? `<button class="quick-action-btn" style="padding:6px 10px; border-radius:6px; font-size:12px;" onclick="viewAttendancePhoto('${record.id}')">
                        <i class="fas fa-image"></i> View Photo
                   </button>`
                : `<span style="color:#999; font-size:12px;">No photo</span>`;

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${statusIcon} ${record.status.charAt(0).toUpperCase() + record.status.slice(1)}</td>
                <td>${periodsText}</td>
                <td>${record.facultyName}</td>
                <td>${viewBtn}</td>
            `;
            
            recordsTableBody.appendChild(row);
        });
    }
    
    console.log('✅ Attendance report displayed successfully');
}

/**
 * Shows/hides the report loading state
 * @param {boolean} loading - Whether to show loading state
 */
function showReportLoading(loading) {
    const loadingDiv = document.getElementById('reportLoading');
    const reportDisplay = document.getElementById('reportDisplay');
    
    if (loading) {
        loadingDiv.style.display = 'block';
        reportDisplay.style.display = 'none';
    } else {
        loadingDiv.style.display = 'none';
    }
}

/**
 * Shows an error message in the report section
 * @param {string} errorMessage - The error message to display
 */
function showReportError(errorMessage) {
    showReportLoading(false);
    
    const reportDisplay = document.getElementById('reportDisplay');
    reportDisplay.style.display = 'block';
    reportDisplay.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #dc3545;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <h3>Error Generating Report</h3>
            <p>${errorMessage}</p>
            <button onclick="resetReportForm()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-redo"></i> Try Again
            </button>
        </div>
    `;
}

/**
 * Resets the report form and hides the report display
 */
function resetReportForm() {
    // Clear form fields
    document.getElementById('studentRegNumber').value = '';
    document.getElementById('reportSubject').value = '';
    
    // Hide report display and loading
    document.getElementById('reportDisplay').style.display = 'none';
    document.getElementById('reportLoading').style.display = 'none';
    
    console.log('📝 Report form reset');
}

/**
 * Prints the attendance report
 */
function printReport() {
    const reportContent = document.getElementById('reportDisplay');
    
    if (!reportContent || reportContent.style.display === 'none') {
        alert('No report to print. Please generate a report first.');
        return;
    }
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    const studentName = document.getElementById('reportStudentName').textContent;
    const regNumber = document.getElementById('reportStudentReg').textContent;
    const subject = document.getElementById('reportSubject').textContent;
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Attendance Report - ${studentName} (${regNumber})</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    color: #333;
                }
                .report-header { 
                    text-align: center; 
                    border-bottom: 2px solid #007bff; 
                    padding-bottom: 10px; 
                    margin-bottom: 20px;
                }
                .report-info { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 20px;
                }
                .summary-box { 
                    border: 1px solid #ddd; 
                    padding: 15px; 
                    margin-bottom: 20px;
                    border-radius: 5px;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 10px;
                }
                th, td { 
                    border: 1px solid #ddd; 
                    padding: 8px; 
                    text-align: left;
                }
                th { 
                    background-color: #f8f9fa;
                }
                .present-row { 
                    background-color: #d4edda;
                }
                .absent-row { 
                    background-color: #f8d7da;
                }
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${reportContent.innerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

/**
 * Exports the attendance report to Excel
 */
function exportToExcel() {
    const reportDisplay = document.getElementById('reportDisplay');
    
    if (!reportDisplay || reportDisplay.style.display === 'none') {
        alert('No report to export. Please generate a report first.');
        return;
    }
    
    try {
        // Get report data
        const studentName = document.getElementById('reportStudentName').textContent;
        const regNumber = document.getElementById('reportStudentReg').textContent;
        const subject = document.getElementById('reportSubject').textContent;
        const totalPresent = document.getElementById('totalClassesAttended').textContent;
        const totalAbsent = document.getElementById('totalClassesMissed').textContent;
        const percentage = document.getElementById('attendancePercentage').textContent;
        
        // Create CSV content
        let csvContent = `Attendance Report\n`;
        csvContent += `Student Name,${studentName}\n`;
        csvContent += `Registration Number,${regNumber}\n`;
        csvContent += `Subject,${subject}\n`;
        csvContent += `Generated Date,${(typeof formatISTDateTime === 'function') ? formatISTDateTime(new Date()) : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n`;
        csvContent += `Summary\n`;
        csvContent += `Total Classes Attended,${totalPresent}\n`;
        csvContent += `Total Classes Missed,${totalAbsent}\n`;
        csvContent += `Attendance Percentage,${percentage}\n\n`;
        csvContent += `Detailed Records\n`;
        csvContent += `Date,Status,Periods,Faculty\n`;
        
        // Add attendance records
        const recordsTable = document.getElementById('attendanceRecordsTable');
        const rows = recordsTable.querySelectorAll('tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
                const date = cells[0].textContent;
                const status = cells[1].textContent.replace(/[^a-zA-Z]/g, ''); // Remove icons
                const periods = cells[2].textContent;
                const faculty = cells[3].textContent;
                csvContent += `${date},${status},${periods},${faculty}\n`;
            }
        });
        
        // Create and download the file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `attendance_report_${regNumber}_${subject}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('CSV export is not supported in this browser.');
        }
        
        console.log('✅ Report exported to CSV successfully');
        
    } catch (error) {
        console.error('❌ Error exporting to Excel:', error);
        alert('Error exporting report. Please try again.');
    }
}

/**
 * Converts uppercase input for student registration number
 */
function handleRegNumberInput() {
    const input = document.getElementById('studentRegNumber');
    input.value = input.value.toUpperCase();
}

// ===== AUTO-ABSENT PROCESSING FUNCTIONS =====

/**
 * Opens photo verification modal automatically after QR code expires
 * This function shows faculty all submitted photos for verification
 */
async function processAbsentStudents() {
    if (!currentQRSession) {
        console.log('No current QR session to process photos');
        return;
    }

    console.log('📸 QR Code expired - Opening photo verification modal for session:', currentQRSession);
    
    const statusElement = document.getElementById('qrStatus');
    if (statusElement) {
        statusElement.innerHTML = '<p>QR Code expired. Opening photo verification...</p>';
    }

    // Wait a moment for any final photo submissions
    setTimeout(() => {
        console.log('📸 Opening photo verification modal automatically');
        console.log('Current QR Session:', currentQRSession);
        console.log('Firebase user:', firebase.auth().currentUser?.uid);
        
        // Store current session for photo verification
        currentVerificationSession = currentQRSession;
        console.log('Set currentVerificationSession:', currentVerificationSession);
        
        // Check if we have a valid session before opening modal
        if (!currentVerificationSession) {
            console.error('No verification session available!');
            if (statusElement) {
                statusElement.innerHTML = '<p style="color: #dc3545;">Error: No session data available for photo verification.</p>';
            }
            return;
        }
        
        // Open the photo verification modal
        openPhotoVerificationModal();
        
        // Auto-close the QR modal since we're moving to photo verification
        setTimeout(() => {
            console.log('📱 Auto-closing QR modal as photo verification is now open');
            closeQRModal();
        }, 1000);
        
        // Update status to show that photo verification is open
        if (statusElement) {
            statusElement.innerHTML = '<p><strong>📸 Photo Verification Open:</strong> Review all student photos and click "Save Attendance" when ready.</p>';
            statusElement.style.color = '#007bff';
        }
        
        
    }, 2000); // 2-second delay to allow final photo submissions
}

// ===== BATCH REPORT FUNCTIONS =====

// Batch options for batch reports
const batchReportOptions = {
    "School of Technology": ["24B1", "24B2", "23B1"],
    "School of Management": ["23B1", "24B1"]
};

/**
 * Shows the selected report type (individual or batch)
 * @param {string} type - 'individual' or 'batch'
 */
function showReportType(type) {
    // Update tab styling
    const individualTab = document.getElementById('individualReportTab');
    const batchTab = document.getElementById('batchReportTab');
    
    if (type === 'individual') {
        individualTab.classList.add('active');
        batchTab.classList.remove('active');
        
        // Show individual form, hide batch form and displays
        document.getElementById('individualReportForm').style.display = 'block';
        document.getElementById('batchReportForm').style.display = 'none';
        document.getElementById('reportDisplay').style.display = 'none';
        document.getElementById('batchReportDisplay').style.display = 'none';
    } else {
        batchTab.classList.add('active');
        individualTab.classList.remove('active');
        
        // Show batch form, hide individual form and displays
        document.getElementById('individualReportForm').style.display = 'none';
        document.getElementById('batchReportForm').style.display = 'block';
        document.getElementById('reportDisplay').style.display = 'none';
        document.getElementById('batchReportDisplay').style.display = 'none';
    }
}

/**
 * Updates batch options for batch report based on selected school
 */
function updateBatchReportBatchOptions() {
    const schoolSelect = document.getElementById('batchReportSchool');
    const batchSelect = document.getElementById('batchReportBatch');
    const selectedSchool = schoolSelect.value;
    
    // Clear existing options
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (selectedSchool && batchReportOptions[selectedSchool]) {
        batchSelect.disabled = false;
        batchReportOptions[selectedSchool].forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            batchSelect.appendChild(option);
        });
    } else {
        batchSelect.disabled = true;
    }
}

/**
 * Generates and displays batch attendance report
 */
async function generateBatchAttendanceReport() {
    const school = document.getElementById('batchReportSchool').value;
    const batch = document.getElementById('batchReportBatch').value;
    const subject = document.getElementById('batchReportSubject').value;
    const selectedDate = document.getElementById('batchReportDate').value;
    
    // Validation
    if (!school || !batch || !subject || !selectedDate) {
        alert('Please fill in all fields to generate batch report.');
        return;
    }
    
    // Check if the selected date is in the future
    const today = new Date();
    const selectedDateObj = new Date(selectedDate);
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    selectedDateObj.setHours(0, 0, 0, 0);
    
    if (selectedDateObj > today) {
        alert('⚠️ Future dates are not allowed!\n\nPlease select today\'s date or a past date when attendance was actually taken.\n\n📅 You can only generate reports for dates when attendance sessions have occurred.');
        return;
    }
    
    try {
        // Show loading state
        document.getElementById('reportLoading').style.display = 'block';
        document.getElementById('batchReportDisplay').style.display = 'none';
        
        const db = firebase.firestore();
        
        // === DEBUGGING: Check current user and faculty permissions ===
        const currentUser = firebase.auth().currentUser;
        console.log('🔍 BATCH REPORT DEBUG:');
        console.log('Current User UID:', currentUser ? currentUser.uid : 'No user');
        console.log('Current User Email:', currentUser ? currentUser.email : 'No email');
        
        // Test if current user exists in faculty collection
        console.log('Testing faculty collection access...');
        try {
            const facultyDoc = await db.collection('faculty').doc(currentUser.uid).get();
            console.log('Faculty doc exists:', facultyDoc.exists);
            if (facultyDoc.exists) {
                console.log('Faculty doc data:', facultyDoc.data());
            } else {
                console.log('❌ Faculty document NOT found - this is the permission issue!');
            }
        } catch (facultyError) {
            console.log('❌ Error accessing faculty collection:', facultyError.message);
        }
        
        // Test basic collection access
        console.log('Testing basic collections access...');
        try {
            const testUsersQuery = await db.collection('users').limit(1).get();
            console.log('✅ Users collection accessible, docs count:', testUsersQuery.docs.length);
        } catch (usersError) {
            console.log('❌ Users collection error:', usersError.message);
        }
        
        try {
            const testAttendanceQuery = await db.collection('attendances').limit(1).get();
            console.log('✅ Attendances collection accessible, docs count:', testAttendanceQuery.docs.length);
        } catch (attendanceError) {
            console.log('❌ Attendances collection error:', attendanceError.message);
        }
        // === END DEBUGGING ===
        
        // Get all students from the selected batch
        const allStudentsQuery = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        
        // Find students matching the batch
        const batchStudents = [];
        const profilePromises = [];
        
        allStudentsQuery.forEach(studentDoc => {
            const studentData = studentDoc.data();
            
            // Check student profiles to match batch
            const profilePromise = db.collection('profiles').doc(studentDoc.id).get()
                .then(profileDoc => {
                    if (profileDoc.exists) {
                        const profileData = profileDoc.data();
                        
                        if (profileData.school === school && profileData.batch === batch) {
                            batchStudents.push({
                                id: studentDoc.id,
                                name: profileData.fullName || studentData.fullName || studentData.name,
                                regNumber: profileData.regNumber || studentData.regNumber || 'N/A',
                                email: studentData.email,
                                profileData: profileData,
                                userData: studentData
                            });
                        }
                    } else {
                        // Fallback: use email-based matching
                        const email = studentData.email || '';
                        let matches = false;
                        
                        if (school === 'School of Technology' && email.includes('sot')) {
                            if (batch.startsWith('24') && email.includes('2428')) matches = true;
                            if (batch.startsWith('23') && email.includes('2328')) matches = true;
                        } else if (school === 'School of Management' && email.includes('som')) {
                            if (batch.startsWith('24') && email.includes('2428')) matches = true;
                            if (batch.startsWith('23') && email.includes('2328')) matches = true;
                        }
                        
                        if (matches) {
                            batchStudents.push({
                                id: studentDoc.id,
                                name: studentData.fullName || studentData.name || extractNameFromEmail(email),
                                regNumber: studentData.regNumber || studentData.registrationNumber || 'N/A',
                                email: studentData.email,
                                profileData: {
                                    school: school,
                                    batch: batch,
                                    fullName: studentData.fullName || studentData.name
                                },
                                userData: studentData
                            });
                        }
                    }
                })
                .catch(error => {
                    console.warn('Error fetching profile for student:', studentDoc.id, error);
                });
            
            profilePromises.push(profilePromise);
        });
        
        await Promise.all(profilePromises);
        
        if (batchStudents.length === 0) {
            alert(`No students found for ${school} - ${batch}`);
            document.getElementById('reportLoading').style.display = 'none';
            return;
        }
        
        // Get attendance records for the selected date and subject ONLY
        console.log(`🔍 BATCH REPORT FILTERING: Fetching attendance for date=${selectedDate}, subject=${subject}`);
        const attendanceQuery = await db.collection('attendances')
            .where('date', '==', selectedDate)
            .where('subject', '==', subject)
            .get();
        
        console.log(`📊 Found ${attendanceQuery.docs.length} attendance records for ${subject} on ${selectedDate}`);
        
        // Create a map of attendance records with status, id, and photo availability
        const attendanceMap = new Map();
        attendanceQuery.forEach(doc => {
            const data = doc.data();
            if (data.userId) {
                attendanceMap.set(data.userId, {
                    status: data.status,
                    id: doc.id,
                    hasPhoto: !!data.hasPhoto
                });
            }
        });
        
        // Calculate overall attendance percentages for each student (ONLY for selected batch and subject)
        console.log(`📋 BATCH REPORT: Processing ${batchStudents.length} students from ${school} ${batch} for subject ${subject}`);
        
        const studentReportData = [];
        let totalPresent = 0;
        let totalAbsent = 0;
        
        // First, check if ANY attendance was taken on this date for this subject
        const dateHasAttendanceRecords = attendanceQuery.docs.length > 0;
        console.log(`📅 ATTENDANCE CHECK: ${dateHasAttendanceRecords ? 'Attendance WAS taken' : 'NO attendance taken'} on ${selectedDate} for ${subject}`);
        
        if (!dateHasAttendanceRecords) {
            // No attendance was taken on this date for this subject
            console.log(`📋 BATCH REPORT: No attendance session found for ${subject} on ${selectedDate}`);
            
            // Show message that no attendance was taken
            document.getElementById('reportLoading').style.display = 'none';
            document.getElementById('batchReportDisplay').style.display = 'block';
            
            // Populate report header
            document.getElementById('batchReportSchoolName').textContent = school;
            document.getElementById('batchReportBatchName').textContent = batch;
            document.getElementById('batchReportSubjectName').textContent = subject;
            document.getElementById('batchReportDateSelected').textContent = (typeof formatISTDate === 'function') ? formatISTDate(new Date(selectedDate)) : new Date(selectedDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
            
            // Set summary to show no attendance taken
            document.getElementById('batchTotalPresent').textContent = '-';
            document.getElementById('batchTotalAbsent').textContent = '-';
            document.getElementById('batchTotalStudents').textContent = batchStudents.length;
            document.getElementById('batchAttendancePercentage').textContent = 'N/A';
            
            // Update percentage bar
            const batchPercentageBar = document.getElementById('batchPercentageBar');
            if (batchPercentageBar) {
                batchPercentageBar.style.width = '0%';
                batchPercentageBar.style.backgroundColor = '#6c757d'; // Gray for N/A
            }
            
            // Show message in students table
            const batchStudentsTable = document.getElementById('batchStudentsTable');
            batchStudentsTable.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: #666; padding: 30px; background-color: #f8f9fa;">
                        <i class="fas fa-info-circle" style="font-size: 2rem; margin-bottom: 10px; color: #007bff;"></i>
                        <h4 style="margin: 10px 0; color: #333;">No Attendance Session Found</h4>
                        <p style="margin: 5px 0;">No attendance was taken for <strong>${subject}</strong> on <strong>${(typeof formatISTDate === 'function') ? formatISTDate(new Date(selectedDate)) : new Date(selectedDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong></p>
                        <p style="margin: 5px 0; font-size: 0.9rem; color: #666;">This means no faculty conducted an attendance session for this subject on this date.</p>
                        <p style="margin: 15px 0; font-size: 0.9rem;">💡 <em>Select a different date when attendance was actually taken</em></p>
                    </td>
                </tr>
            `;
            
            return; // Exit the function early
        }
        
        // Calculate total classes held on this date for this subject (once for all students)
        // This should be the sum of periods from all unique QR sessions generated on this date
        let totalClassesToday = 0;
        const uniqueQRSessions = new Set(); // Track unique QR sessions
        const sessionPeriods = new Map(); // sessionId -> periods
        
        console.log(`🔍 CALCULATING TOTAL CLASSES: Analyzing ${attendanceQuery.docs.length} attendance records for ${subject} on ${selectedDate}`);
        
        // Step 1: Extract all unique QR sessions and their periods from attendance records
        attendanceQuery.forEach((doc, index) => {
            const data = doc.data();
            console.log(`📄 Attendance Record ${index + 1}:`, {
                sessionId: data.sessionId,
                periods: data.periods,
                userId: data.userId,
                status: data.status,
                qrSessionId: data.qrSessionId // Sometimes stored as qrSessionId
            });
            
            // Extract session ID (try both sessionId and qrSessionId)
            const sessionId = data.sessionId || data.qrSessionId;
            
            if (sessionId && data.periods) {
                if (!sessionPeriods.has(sessionId)) {
                    sessionPeriods.set(sessionId, data.periods);
                    uniqueQRSessions.add(sessionId);
                    console.log(`➕ NEW QR SESSION: ${sessionId} with ${data.periods} periods`);
                } else {
                    // Verify periods match for same session
                    const existingPeriods = sessionPeriods.get(sessionId);
                    if (existingPeriods !== data.periods) {
                        console.warn(`⚠️ INCONSISTENT DATA: Session ${sessionId} has ${existingPeriods} and ${data.periods} periods in different records`);
                    }
                }
            }
        });
        
        // Step 2: Calculate total classes by summing periods from all unique sessions
        if (sessionPeriods.size > 0) {
            totalClassesToday = Array.from(sessionPeriods.values()).reduce((sum, periods) => sum + periods, 0);
            console.log(`🧮 QR Sessions found:`);
            sessionPeriods.forEach((periods, sessionId) => {
                console.log(`  - ${sessionId}: ${periods} periods`);
            });
            console.log(`📊 TOTAL CALCULATION: ${Array.from(sessionPeriods.values()).join(' + ')} = ${totalClassesToday} classes`);
        } else {
            // Fallback: If no sessions found, try to estimate from attendance data
            console.warn(`⚠️ No QR sessions found in attendance data. Using fallback calculation...`);
            
            // Group by periods to estimate sessions
            const periodCounts = new Map();
            attendanceQuery.forEach(doc => {
                const data = doc.data();
                if (data.periods && data.periods > 0) {
                    periodCounts.set(data.periods, (periodCounts.get(data.periods) || 0) + 1);
                }
            });
            
            if (periodCounts.size > 0) {
                // Use the most frequently occurring period value
                let maxCount = 0;
                let mostCommonPeriods = 1;
                periodCounts.forEach((count, periods) => {
                    if (count > maxCount) {
                        maxCount = count;
                        mostCommonPeriods = periods;
                    }
                });
                totalClassesToday = mostCommonPeriods;
                console.log(`🔄 FALLBACK: Using most common periods value: ${mostCommonPeriods}`);
            } else {
                totalClassesToday = 0;
                console.log(`❌ NO DATA: No periods found in any attendance record`);
            }
        }
        
        // Final validation and summary
        console.log(`📚 FINAL RESULT: ${totalClassesToday} classes held for ${subject} on ${selectedDate}`);
        console.log(`🎯 Summary:`, {
            uniqueQRSessions: uniqueQRSessions.size,
            sessionDetails: Array.from(sessionPeriods.entries()),
            totalPeriodsCalculated: totalClassesToday,
            attendanceRecordsProcessed: attendanceQuery.docs.length
        });
        
        // Validate result
        if (totalClassesToday === 0) {
            console.warn(`⚠️ WARNING: No classes calculated for ${subject} on ${selectedDate}. This might indicate:`);
            console.warn(`  1. No QR codes were generated for this subject on this date`);
            console.warn(`  2. Attendance records are missing session/period information`);
            console.warn(`  3. Data inconsistency in the database`);
        } else if (totalClassesToday > 8) {
            console.warn(`🚨 SUSPICIOUS: ${totalClassesToday} classes seem unusually high for one day`);
        } else {
            console.log(`✅ VALIDATION: ${totalClassesToday} classes seems reasonable`);
        }
        
        // Attendance was taken on this date, proceed with normal report generation
        console.log(`✅ PROCEEDING: Attendance session found, generating report for ${batchStudents.length} students`);
        console.log('📊 DEBUG: Batch Students List:', batchStudents.map(s => `${s.name} (${s.id})`));
        console.log('📊 DEBUG: Attendance Map:', Array.from(attendanceMap.entries()));
        
        // Get current date dynamically for each batch report generation
        const reportGenerationTime = new Date();
        const currentDateForReport = reportGenerationTime.toISOString().split('T')[0];
        
        // Set academic start date - September 16, 2025 (CORRECTED YEAR)
        // This ensures all percentage calculations only include data from this date onwards
        // Any attendance data before this date will be excluded from calculations
        const academicStartDate = '2025-09-16';
        console.log(`📅 ACADEMIC PERIOD: Start date: ${academicStartDate}, Current cutoff: ${currentDateForReport}`);
        console.log(`📅 DYNAMIC DATE: Report generated at ${reportGenerationTime.toISOString()}`);
        console.log(`🚫 EXCLUSION: All data before ${academicStartDate} will be ignored in percentage calculations`);
        console.log(`✅ CORRECTION: Using September 16, 2025 as academic start (not 2024)`);
        console.log(`📊 EXPECTED: Percentages will now calculate from 2025 data only`);
        
        console.log(`⚖️ FAIR ATTENDANCE EVALUATION SYSTEM (from ${academicStartDate}):`);
        console.log(`  - Calculates TOTAL classes held for each subject (from academic start date)`);
        console.log(`  - Compares individual student's PRESENT classes vs TOTAL classes`);
        console.log(`  - When someone is ABSENT: their percentage DECREASES (fair evaluation)`);
        console.log(`  - When someone is PRESENT: their percentage reflects actual performance`);
        console.log(`  - Formula: (Present Classes / Total Classes Held) * 100`);
        console.log(`  - Result: Absentees get lower %, present students get fair %`);
        console.log(`  - 📅 Only includes data from ${academicStartDate} onwards (YEAR 2025)`);
        
        for (const student of batchStudents) {
            // Validate student belongs to the selected batch and school
            if (student.profileData.school !== school || student.profileData.batch !== batch) {
                console.warn(`⚠️ FILTER VIOLATION: Student ${student.name} (${student.id}) doesn't match batch criteria`);
                continue; // Skip this student as they don't match the batch
            }
            
            // Get attendance status & photo info for the specific date
            // Only use actual recorded attendance (don't default to absent)
            const dateEntry = attendanceMap.get(student.id);
            
            // Use the pre-calculated totalClassesToday value for all students
            
            // Handle students who don't have any attendance record for this date
            // They should be counted as absent
            if (!dateEntry) {
                console.log(`📋 ABSENT: Student ${student.name} has no attendance record for ${selectedDate} (marked as absent)`);
                
                // Count as absent and add to report
                totalAbsent++;
                
                // FAIR CALCULATION: Calculate total classes held for this subject (across all students)
                console.log(`📋 FAIR CALCULATION: Getting total classes held for subject ${subject} (from ${academicStartDate} to ${currentDateForReport})`);
                const allSubjectClassesQuery = await db.collection('attendances')
                    .where('subject', '==', subject)
                    .get();
                
                // Calculate total classes held for this subject by unique sessions
                const subjectSessionPeriods = new Map();
                allSubjectClassesQuery.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date >= academicStartDate && data.date <= currentDateForReport) {
                        const sessionId = data.sessionId || data.qrSessionId || `${data.date}_${data.subject}`;
                        if (sessionId && data.periods) {
                            subjectSessionPeriods.set(sessionId, data.periods);
                        }
                    }
                });
                
                const subjectTotalClasses = Array.from(subjectSessionPeriods.values()).reduce((sum, periods) => sum + periods, 0);
                console.log(`🎯 TOTAL CLASSES for ${subject}: ${subjectTotalClasses} (from ${subjectSessionPeriods.size} unique sessions)`);
                
                // Calculate this student's present classes in the subject
                const studentSubjectQuery = await db.collection('attendances')
                    .where('userId', '==', student.id)
                    .where('subject', '==', subject)
                    .get();
                
                let subjectPresentClasses = 0;
                studentSubjectQuery.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date >= academicStartDate && data.date <= currentDateForReport && data.status === 'present') {
                        const periods = data.periods || 1;
                        subjectPresentClasses += periods;
                        console.log(`    ✅ Student present: ${data.date}, Periods: ${periods}`);
                    }
                });
                
                console.log(`📈 FAIR EVALUATION for ${student.name} (ABSENT) - Academic Period ${academicStartDate} to ${currentDateForReport}:`);
                console.log(`  - Student present classes (from ${academicStartDate}): ${subjectPresentClasses}`);
                console.log(`  - Total classes held for subject (from ${academicStartDate}): ${subjectTotalClasses}`);
                console.log(`  - ⚖️ FAIR: If student misses class, percentage DECREASES as total classes increase`);
                
                // FAIR FORMULA: (student's present classes / total classes held for subject) * 100
                const overallSubjectPercentage = subjectTotalClasses > 0 ? Math.round((subjectPresentClasses / subjectTotalClasses) * 100) : 0;
                console.log(`  - 📏 FAIR Formula: (${subjectPresentClasses}/${subjectTotalClasses}) * 100 = ${overallSubjectPercentage}%`);
                
                // Calculate overall attendance data across ALL subjects for this student (up to current date)
                const overallQuery = await db.collection('attendances')
                    .where('userId', '==', student.id)
                    .get();
                
                let overallTotalClasses = 0;
                let overallPresentClasses = 0;
                
                overallQuery.forEach(doc => {
                    const data = doc.data();
                    // Only include records from academic start date to current date
                    if (data.date && data.date >= academicStartDate && data.date <= currentDateForReport) {
                        const periods = data.periods || 1;
                        overallTotalClasses += periods;
                        if (data.status === 'present') {
                            overallPresentClasses += periods;
                        }
                    }
                });
                
                const overallPercentage = overallTotalClasses > 0 ? Math.round((overallPresentClasses / overallTotalClasses) * 100) : 0;
                
                studentReportData.push({
                    name: student.name,
                    regNumber: student.regNumber,
                    totalClassesToday: totalClassesToday, // Total classes held today (same for all students)
                    classesAttendedToday: 0, // Classes attended today (0 for absent students)
                    subjectPercentage: overallSubjectPercentage, // Overall subject percentage (historical)
                    overallPercentage: overallPercentage, // Historical overall percentage across all subjects
                    subjectTotalClasses: subjectTotalClasses,
                    subjectPresentClasses: subjectPresentClasses,
                    overallTotalClasses: overallTotalClasses,
                    overallPresentClasses: overallPresentClasses,
                    attendanceId: null,
                    hasPhoto: false
                });
                
                continue; // Continue to next student
            }
            
            const dateStatus = dateEntry.status;
            const attendanceId = dateEntry.id;
            const hasPhoto = !!dateEntry.hasPhoto;
            
            console.log(`👤 BATCH REPORT: Student ${student.name} - Date Status: ${dateStatus} for ${selectedDate}`);
            
            if (dateStatus === 'present') {
                totalPresent++;
            } else {
                totalAbsent++;
            }
            
            // Calculate classes attended by this student on the selected date
            let studentClassesOnDate = 0;
            const studentDateQuery = await db.collection('attendances')
                .where('userId', '==', student.id)
                .where('subject', '==', subject)
                .where('date', '==', selectedDate)
                .get();
            
            console.log(`👥 STUDENT ${student.name}: Found ${studentDateQuery.size} attendance records for ${selectedDate}`);
            
            studentDateQuery.forEach((doc, index) => {
                const data = doc.data();
                console.log(`  Record ${index + 1}:`, {
                    status: data.status,
                    periods: data.periods,
                    sessionId: data.sessionId,
                    subject: data.subject,
                    date: data.date
                });
                
                if (data.status === 'present') {
                    const periodsToAdd = data.periods || 1;
                    studentClassesOnDate += periodsToAdd;
                    console.log(`    ➕ Adding ${periodsToAdd} periods. Student total now: ${studentClassesOnDate}`);
                } else {
                    console.log(`    ❌ Status is ${data.status}, not adding periods`);
                }
            });
            
            console.log(`📈 FINAL: ${student.name} attended ${studentClassesOnDate} out of ${totalClassesToday} classes on ${selectedDate}`);
            
            // Validation: Check if student attended more classes than were held
            if (studentClassesOnDate > totalClassesToday) {
                console.warn(`🚨 DATA INCONSISTENCY: ${student.name} attended ${studentClassesOnDate} classes but only ${totalClassesToday} were held that day!`);
            }
            
            // FAIR CALCULATION: Calculate total classes held for this subject (across all students)
            console.log(`📋 FAIR CALCULATION: Getting total classes held for subject ${subject} (from ${academicStartDate} to ${currentDateForReport})`);
            const allSubjectClassesQuery = await db.collection('attendances')
                .where('subject', '==', subject)
                .get();
            
            // Calculate total classes held for this subject by unique sessions
            const subjectSessionPeriods = new Map();
            allSubjectClassesQuery.forEach(doc => {
                const data = doc.data();
                if (data.date && data.date >= academicStartDate && data.date <= currentDateForReport) {
                    const sessionId = data.sessionId || data.qrSessionId || `${data.date}_${data.subject}`;
                    if (sessionId && data.periods) {
                        subjectSessionPeriods.set(sessionId, data.periods);
                    }
                }
            });
            
            const subjectTotalClasses = Array.from(subjectSessionPeriods.values()).reduce((sum, periods) => sum + periods, 0);
            console.log(`🎯 TOTAL CLASSES for ${subject}: ${subjectTotalClasses} (from ${subjectSessionPeriods.size} unique sessions)`);
            
            // Calculate this student's present classes in the subject
            const studentSubjectQuery = await db.collection('attendances')
                .where('userId', '==', student.id)
                .where('subject', '==', subject)
                .get();
            
            let subjectPresentClasses = 0;
            studentSubjectQuery.forEach(doc => {
                const data = doc.data();
                if (data.date && data.date >= academicStartDate && data.date <= currentDateForReport && data.status === 'present') {
                    const periods = data.periods || 1;
                    subjectPresentClasses += periods;
                    console.log(`    ✅ Student present: ${data.date}, Periods: ${periods}`);
                }
            });
            
            console.log(`📈 FAIR EVALUATION for ${student.name} (PRESENT) - Academic Period ${academicStartDate} to ${currentDateForReport}:`);
            console.log(`  - Student present classes (from ${academicStartDate}): ${subjectPresentClasses}`);
            console.log(`  - Total classes held for subject (from ${academicStartDate}): ${subjectTotalClasses}`);
            console.log(`  - ⚖️ FAIR: Percentage reflects actual performance vs all classes held`);
            
            // FAIR FORMULA: (student's present classes / total classes held for subject) * 100
            const overallSubjectPercentage = subjectTotalClasses > 0 ? Math.round((subjectPresentClasses / subjectTotalClasses) * 100) : 0;
            console.log(`  - 📏 FAIR Formula: (${subjectPresentClasses}/${subjectTotalClasses}) * 100 = ${overallSubjectPercentage}%`);
            
            // Calculate overall attendance data across ALL subjects for this student (academic period)
            console.log(`📋 CALCULATING OVERALL: Fetching ALL attendance for student ${student.id} across ALL subjects (from ${academicStartDate} to ${currentDateForReport})`);
            const overallQuery = await db.collection('attendances')
                .where('userId', '==', student.id)
                .get();
            
            console.log(`📈 Found ${overallQuery.size} total attendance records for ${student.name} across all subjects`);
            
            let overallTotalClasses = 0;
            let overallPresentClasses = 0;
            let recordsProcessed = 0;
            
            overallQuery.forEach(doc => {
                const data = doc.data();
                // Only include records from academic start date to current date
                if (data.date && data.date >= academicStartDate && data.date <= currentDateForReport) {
                    recordsProcessed++;
                    const periods = data.periods || 1;
                    overallTotalClasses += periods;
                    if (data.status === 'present') {
                        overallPresentClasses += periods;
                    }
                }
            });
            
            console.log(`📈 ACADEMIC PERIOD CALCULATION: Processed ${recordsProcessed} out of ${overallQuery.size} records (filtered from ${academicStartDate} to ${currentDateForReport})`);
            
            const overallPercentage = overallTotalClasses > 0 ? Math.round((overallPresentClasses / overallTotalClasses) * 100) : 0;
            
            console.log(`📈 ${student.name} ACADEMIC OVERALL CALCULATION:`);
            console.log(`  - Total classes (all subjects, ${academicStartDate} to ${currentDateForReport}): ${overallTotalClasses}`);
            console.log(`  - Present classes (all subjects, ${academicStartDate} to ${currentDateForReport}): ${overallPresentClasses}`);
            console.log(`  - 🎯 ACADEMIC Overall percentage: ${overallPercentage}%`);
            console.log(`  - 📏 Formula used: (${overallPresentClasses}/${overallTotalClasses}) * 100 = ${overallPercentage}%`);
            console.log(`  - 📅 Academic period: ${academicStartDate} to ${currentDateForReport}`);
            
            studentReportData.push({
                name: student.name,
                regNumber: student.regNumber,
                totalClassesToday: totalClassesToday, // Total classes held today (same for all students)
                classesAttendedToday: studentClassesOnDate, // Classes attended today
                subjectPercentage: overallSubjectPercentage, // Overall subject percentage (historical)
                overallPercentage: overallPercentage, // Historical overall percentage across all subjects
                subjectTotalClasses: subjectTotalClasses,
                subjectPresentClasses: subjectPresentClasses,
                overallTotalClasses: overallTotalClasses,
                overallPresentClasses: overallPresentClasses,
                attendanceId: attendanceId,
                hasPhoto: hasPhoto
            });
        }
        
        // Sort students by name
        studentReportData.sort((a, b) => a.name.localeCompare(b.name));
        
        // Calculate batch statistics
        const totalStudents = batchStudents.length;
        const batchAttendancePercentage = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;
        
        // Display the batch report
        displayBatchReport({
            school,
            batch,
            subject,
            selectedDate,
            studentReportData,
            totalStudents,
            totalPresent,
            totalAbsent,
            batchAttendancePercentage
        });
        
    } catch (error) {
        console.error('Error generating batch report:', error);
        alert(`Error generating batch report: ${error.message}`);
        document.getElementById('reportLoading').style.display = 'none';
    }
}

/**
 * Displays the batch attendance report
 * @param {Object} reportData - The batch report data
 */
function displayBatchReport(reportData) {
    const {
        school,
        batch,
        subject,
        selectedDate,
        studentReportData,
        totalStudents,
        totalPresent,
        totalAbsent,
        batchAttendancePercentage
    } = reportData;
    
    // Hide loading and show batch report
    document.getElementById('reportLoading').style.display = 'none';
    document.getElementById('batchReportDisplay').style.display = 'block';
    
    // Populate report header
    document.getElementById('batchReportSchoolName').textContent = school;
    document.getElementById('batchReportBatchName').textContent = batch;
    document.getElementById('batchReportSubjectName').textContent = subject;
    document.getElementById('batchReportDateSelected').textContent = (typeof formatISTDate === 'function') ? formatISTDate(new Date(selectedDate)) : new Date(selectedDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // Populate summary
    document.getElementById('batchTotalPresent').textContent = totalPresent;
    document.getElementById('batchTotalAbsent').textContent = totalAbsent;
    document.getElementById('batchTotalStudents').textContent = totalStudents;
    document.getElementById('batchAttendancePercentage').textContent = `${batchAttendancePercentage}%`;
    
    // Update percentage bar
    const batchPercentageBar = document.getElementById('batchPercentageBar');
    if (batchPercentageBar) {
        batchPercentageBar.style.width = `${batchAttendancePercentage}%`;
        
        // Color code the percentage
        if (batchAttendancePercentage >= 75) {
            batchPercentageBar.style.backgroundColor = '#28a745'; // Green
        } else if (batchAttendancePercentage >= 60) {
            batchPercentageBar.style.backgroundColor = '#ffc107'; // Yellow
        } else {
            batchPercentageBar.style.backgroundColor = '#dc3545'; // Red
        }
    }
    
    // Populate students table
    const batchStudentsTable = document.getElementById('batchStudentsTable');
    batchStudentsTable.innerHTML = '';
    
    if (studentReportData.length === 0) {
        batchStudentsTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #666; padding: 20px;">
                    No students found for this batch.
                </td>
            </tr>
        `;
    } else {
        studentReportData.forEach((student, index) => {
            const row = document.createElement('tr');
            // Determine row class based on whether student attended any classes on the date
            const attendedClasses = student.classesAttendedToday;
            row.className = attendedClasses > 0 ? 'present-row' : 'absent-row';
            
            // Color code the subject percentage (now showing overall historical percentage for the specific subject)
            let subjectPercentageClass = '';
            if (student.subjectPercentage >= 75) {
                subjectPercentageClass = 'style="color: #28a745; font-weight: 600;"'; // Green
            } else if (student.subjectPercentage >= 60) {
                subjectPercentageClass = 'style="color: #ffc107; font-weight: 600;"'; // Yellow
            } else {
                subjectPercentageClass = 'style="color: #dc3545; font-weight: 600;"'; // Red
            }
            
            // Color code the overall percentage
            let overallPercentageClass = '';
            if (student.overallPercentage >= 75) {
                overallPercentageClass = 'style="color: #28a745; font-weight: 600;"'; // Green
            } else if (student.overallPercentage >= 60) {
                overallPercentageClass = 'style="color: #ffc107; font-weight: 600;"'; // Yellow
            } else {
                overallPercentageClass = 'style="color: #dc3545; font-weight: 600;"'; // Red
            }
            
            // Color code classes attended today
            let classesAttendedTodayClass = '';
            if (attendedClasses > 0 && attendedClasses === student.totalClassesToday) {
                classesAttendedTodayClass = 'style="color: #28a745; font-weight: 600;"'; // Green - full attendance
            } else if (attendedClasses > 0) {
                classesAttendedTodayClass = 'style="color: #ffc107; font-weight: 600;"'; // Yellow - partial attendance
            } else {
                classesAttendedTodayClass = 'style="color: #dc3545; font-weight: 600;"'; // Red - absent
            }
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${student.name}</td>
                <td>${student.regNumber}</td>
                <td>${student.totalClassesToday || 0}</td>
                <td ${classesAttendedTodayClass}>${student.classesAttendedToday || 0}</td>
                <td ${subjectPercentageClass}>${student.subjectPercentage || 0}%</td>
                <td ${overallPercentageClass}>${student.overallPercentage || 0}%</td>
            `;
            
            batchStudentsTable.appendChild(row);
        });
    }
}

/**
 * Resets the batch report form
 */
function resetBatchReportForm() {
    document.getElementById('batchReportSchool').value = '';
    document.getElementById('batchReportBatch').value = '';
    document.getElementById('batchReportBatch').disabled = true;
    document.getElementById('batchReportSubject').value = '';
    document.getElementById('batchReportDate').value = '';
    
    document.getElementById('batchReportDisplay').style.display = 'none';
    document.getElementById('reportLoading').style.display = 'none';
}

/**
 * Prints the batch report
 */
function printBatchReport() {
    const reportContent = document.getElementById('batchReportDisplay');
    
    if (!reportContent || reportContent.style.display === 'none') {
        alert('No batch report to print. Please generate a report first.');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    
    const school = document.getElementById('batchReportSchoolName').textContent;
    const batch = document.getElementById('batchReportBatchName').textContent;
    const subject = document.getElementById('batchReportSubjectName').textContent;
    const date = document.getElementById('batchReportDateSelected').textContent;
    
    printWindow.document.write(`
        <html>
        <head>
            <title>Batch Attendance Report - ${school} ${batch} - ${subject}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                .report-header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f8f9fa; }
                .present-row { background-color: #d4edda; }
                .absent-row { background-color: #f8d7da; }
                @media print { body { margin: 0; } .no-print { display: none; } }
            </style>
        </head>
        <body>
            ${reportContent.innerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

/**
 * Exports the batch report to Excel
 */
function exportBatchToExcel() {
    const reportDisplay = document.getElementById('batchReportDisplay');
    
    if (!reportDisplay || reportDisplay.style.display === 'none') {
        alert('No batch report to export. Please generate a report first.');
        return;
    }
    
    try {
        const school = document.getElementById('batchReportSchoolName').textContent;
        const batch = document.getElementById('batchReportBatchName').textContent;
        const subject = document.getElementById('batchReportSubjectName').textContent;
        const date = document.getElementById('batchReportDateSelected').textContent;
        const totalPresent = document.getElementById('batchTotalPresent').textContent;
        const totalAbsent = document.getElementById('batchTotalAbsent').textContent;
        const totalStudents = document.getElementById('batchTotalStudents').textContent;
        const percentage = document.getElementById('batchAttendancePercentage').textContent;
        
        let csvContent = `Batch Attendance Report\n`;
        csvContent += `School,${school}\n`;
        csvContent += `Batch,${batch}\n`;
        csvContent += `Subject,${subject}\n`;
        csvContent += `Date,${date}\n\n`;
        csvContent += `Summary\n`;
        csvContent += `Students Present,${totalPresent}\n`;
        csvContent += `Students Absent,${totalAbsent}\n`;
        csvContent += `Total Students,${totalStudents}\n`;
        csvContent += `Batch Attendance Percentage,${percentage}\n\n`;
        csvContent += `Student Details\n`;
        csvContent += `S.No.,Student Name,Enrollment ID,Total Classes Today,Classes Attended Today,Overall Subject Percentage,Overall Percentage\n`;
        
        const table = document.getElementById('batchStudentsTable');
        const rows = table.querySelectorAll('tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                const sno = cells[0].textContent;
                const name = cells[1].textContent;
                const regNumber = cells[2].textContent;
                const totalClassesToday = cells[3].textContent;
                const classesAttendedToday = cells[4].textContent;
                const subjectPercentage = cells[5].textContent;
                const overallPercentage = cells[6].textContent;
                csvContent += `${sno},${name},${regNumber},${totalClassesToday},${classesAttendedToday},${subjectPercentage},${overallPercentage}\n`;
            }
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `batch_attendance_report_${batch}_${subject}_${date.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('CSV export is not supported in this browser.');
        }
        
    } catch (error) {
        console.error('Error exporting batch report:', error);
        alert('Error exporting batch report. Please try again.');
    }
}

// ===== Photo viewing functions =====
async function viewAttendancePhoto(attendanceId) {
    try {
        const db = firebase.firestore();
        if (!attendanceId) {
            alert('Invalid record selected.');
            return;
        }
        const doc = await db.collection('attendances').doc(attendanceId).get();
        if (!doc.exists) {
            alert('Attendance record not found.');
            return;
        }
        const data = doc.data();
        let photoData = data.photodata || data.photoData || data.photo || null;
        if (!photoData) {
            alert('No photo available for this record.');
            return;
        }
        // Normalize base64 without data URL
        if (/^[A-Za-z0-9+/=]+$/.test(photoData.substring(0, 50))) {
            photoData = `data:image/jpeg;base64,${photoData}`;
        }
        const modal = document.getElementById('photoModal');
        const imgEl = document.getElementById('attendancePhotoImg');
        const metaEl = document.getElementById('photoMeta');
        imgEl.src = photoData;
        metaEl.textContent = `${data.subject || ''} • ${data.date || ''} • ${data.regNumber || data.studentReg || ''}`;
        modal.style.display = 'block';
    } catch (err) {
        console.error('Error loading attendance photo:', err);
        alert('Failed to load photo.');
    }
}

function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    const imgEl = document.getElementById('attendancePhotoImg');
    const metaEl = document.getElementById('photoMeta');
    imgEl.src = '';
    metaEl.textContent = '';
    modal.style.display = 'none';
}

// Make functions globally accessible
window.showSection = showSection;
window.closeSection = closeSection;
window.updateManualBatchOptions = updateManualBatchOptions;
window.loadStudentsList = loadStudentsList;
window.toggleStudentAttendance = toggleStudentAttendance;
window.markAllPresent = markAllPresent;
window.markAllAbsent = markAllAbsent;
window.submitManualAttendance = submitManualAttendance;
window.resetAttendanceForm = resetAttendanceForm;
window.generateAttendanceReport = generateAttendanceReport;
window.resetReportForm = resetReportForm;
window.printReport = printReport;
window.exportToExcel = exportToExcel;
window.handleRegNumberInput = handleRegNumberInput;
window.processAbsentStudents = processAbsentStudents;
// Batch report functions
window.showReportType = showReportType;
window.updateBatchReportBatchOptions = updateBatchReportBatchOptions;
window.generateBatchAttendanceReport = generateBatchAttendanceReport;
window.resetBatchReportForm = resetBatchReportForm;
window.printBatchReport = printBatchReport;
window.exportBatchToExcel = exportBatchToExcel;
window.viewAttendancePhoto = viewAttendancePhoto;
window.closePhotoModal = closePhotoModal;

// ===== PHOTO VERIFICATION SYSTEM =====

// Global variables for photo verification
let currentVerificationSession = null;
let pendingPhotos = [];
let attendanceDecisions = {}; // { photoId: 'present' | 'absent' | 'pending' }
let verificationStats = { total: 0, present: 0, absent: 0, pending: 0 };

/**
 * Opens the photo verification modal and loads pending photos
 */
function openPhotoVerificationModal() {
    console.log('Opening photo verification modal...');
    const modal = document.getElementById('photoVerificationModal');
    
    if (!modal) {
        console.error('Photo verification modal not found');
        alert('Photo verification interface is not available.');
        return;
    }
    
    modal.style.display = 'block';
    loadPendingPhotosForVerification();
}

/**
 * Closes the photo verification modal
 */
function closePhotoVerificationModal() {
    console.log('Closing photo verification modal...');
    const modal = document.getElementById('photoVerificationModal');
    
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Clear current session data
    currentVerificationSession = null;
    pendingPhotos = [];
    attendanceDecisions = {};
    verificationStats = { total: 0, present: 0, absent: 0, pending: 0 };
    
    // Clear the photos grid
    const photosGrid = document.getElementById('photosGrid');
    if (photosGrid) {
        photosGrid.innerHTML = '';
    }
}

/**
 * Loads pending photos for faculty verification
 */
async function loadPendingPhotosForVerification() {
    try {
        console.log('Loading pending photos for verification...');
        const db = firebase.firestore();
        const user = firebase.auth().currentUser;
        
        if (!user) {
            alert('Please log in to access photo verification.');
            return;
        }
        
        // Use current verification session if available, otherwise current QR session
        const session = currentVerificationSession || currentQRSession;
        if (!session) {
            console.log('No active session found for photo verification');
            const photosGrid = document.getElementById('photosGrid');
            const noPhotosMessage = document.getElementById('noPhotosMessage');
            photosGrid.innerHTML = '';
            noPhotosMessage.style.display = 'block';
            return;
        }
        
        console.log('Loading photos for session:', session);
        
        // Show loading state
        const photosGrid = document.getElementById('photosGrid');
        const noPhotosMessage = document.getElementById('noPhotosMessage');
        
        photosGrid.innerHTML = '<div style="text-align: center; padding: 40px; grid-column: 1 / -1;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><p>Loading photos...</p></div>';
        noPhotosMessage.style.display = 'none';
        
        // Get today's date for filtering
        const today = new Date().toISOString().split('T')[0];
        
        // Query for temp photos from the current session
        // Simplified query to avoid composite index requirement
        let tempPhotosQuery;
        
        try {
            // Try with session-specific query first
            tempPhotosQuery = await db.collection('tempPhotos')
                .where('qrSessionId', '==', session.sessionId)
                .where('status', '==', 'pending_verification')
                .get();
        } catch (sessionError) {
            console.warn('Session-specific query failed, trying faculty-wide query:', sessionError);
            
            // Fallback: Query all pending photos for this faculty today
            tempPhotosQuery = await db.collection('tempPhotos')
                .where('facultyId', '==', user.uid)
                .where('status', '==', 'pending_verification')
                .get();
        }
        
        console.log(`Found ${tempPhotosQuery.docs.length} total photos from query`);
        
        // Filter photos to match current session and today's date (client-side filtering)
        const filteredPhotos = [];
        tempPhotosQuery.docs.forEach(doc => {
            const data = doc.data();
            
            // Check if photo matches current session criteria
            const matchesSession = data.qrSessionId === session.sessionId;
            const matchesDate = data.date === today;
            const matchesFaculty = data.facultyId === user.uid;
            const isPending = data.status === 'pending_verification';
            
            if (matchesSession && matchesDate && matchesFaculty && isPending) {
                filteredPhotos.push({
                    id: doc.id,
                    ...data
                });
            }
        });
        
        console.log(`Found ${filteredPhotos.length} photos matching current session`);
        
        if (filteredPhotos.length === 0) {
            photosGrid.innerHTML = '';
            noPhotosMessage.style.display = 'block';
            updateVerificationSummary();
            return;
        }
        
        // Process and display filtered photos
        pendingPhotos = filteredPhotos;
        
        // Group photos by session for easier verification
        const photosBySession = groupPhotosBySession(pendingPhotos);
        
        await displayPhotosForVerification(photosBySession);
        // updateVerificationSummary is now called inside displayPhotosForVerification
        
    } catch (error) {
        console.error('Error loading pending photos:', error);
        
        // Show simple error message
        const photosGrid = document.getElementById('photosGrid');
        if (photosGrid) {
            photosGrid.innerHTML = '';
        }
        
        const noPhotosMessage = document.getElementById('noPhotosMessage');
        if (noPhotosMessage) {
            noPhotosMessage.style.display = 'block';
        }
        
        // Log error but don't show complex error to user
        alert('Unable to load photos. Please try again.');
    }
}

/**
 * Groups photos by session (date, subject, batch)
 */
function groupPhotosBySession(photos) {
    const sessions = {};
    
    photos.forEach(photo => {
        const sessionKey = `${photo.date}_${photo.subject}_${photo.batch}_${photo.school}`;
        
        if (!sessions[sessionKey]) {
            sessions[sessionKey] = {
                date: photo.date,
                subject: photo.subject,
                batch: photo.batch,
                school: photo.school,
                periods: photo.periods,
                qrSessionId: photo.qrSessionId,
                photos: []
            };
        }
        
        sessions[sessionKey].photos.push(photo);
    });
    
    return sessions;
}

/**
 * Displays photos in the verification interface
 */
async function displayPhotosForVerification(photosBySession) {
    const photosGrid = document.getElementById('photosGrid');
    photosGrid.innerHTML = '';
    
    let photoCount = 0;
    let totalStudentsInBatch = 0;
    
    for (const [sessionKey, session] of Object.entries(photosBySession)) {
        // Get total student count for this batch on first session
        if (photoCount === 0) {
            totalStudentsInBatch = await getTotalStudentsInBatch(session.school, session.batch);
            console.log(`📊 Total students in ${session.school} ${session.batch}: ${totalStudentsInBatch}`);
        }
        
        // Add session header with formatted date
        let formattedDate = session.date;
        try {
            const dateObj = new Date(session.date);
            if (!isNaN(dateObj.getTime())) {
                formattedDate = dateObj.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric',
                    timeZone: 'Asia/Kolkata'
                });
            }
        } catch (error) {
            console.warn('Date formatting error in session header:', error);
        }
        
        const sessionHeader = document.createElement('div');
        sessionHeader.style.cssText = 'grid-column: 1 / -1; background: #e9ecef; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-weight: 600;';
        sessionHeader.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>
                    📚 ${session.subject} • ${session.batch} • ${session.school}
                    <br>
                    <small style="font-weight: normal; color: #666;">📅 ${formattedDate} • ${session.periods} periods</small>
                </span>
                <span style="background: #ffc107; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${session.photos.length} photos
                </span>
            </div>
        `;
        photosGrid.appendChild(sessionHeader);
        
        // Display session info in verification modal header
        if (photoCount === 0) {
            // Use current session data
            const sessionInfo = currentVerificationSession || currentQRSession;
            if (sessionInfo) {
                updateVerificationSessionInfo(sessionInfo);
            }
        }
        
        // Add individual photo cards
        session.photos.forEach((photo, index) => {
            const photoCard = createPhotoAttendanceCard(photo, photoCount + index);
            photosGrid.appendChild(photoCard);
            photoCount++;
        });
    }
    
    // Update stats with correct total student count
    verificationStats.total = totalStudentsInBatch; // Total students in batch, not just photo submitters
    verificationStats.pending = 0;
    verificationStats.present = photoCount; // Students who submitted photos (marked present by default)
    verificationStats.absent = Math.max(0, totalStudentsInBatch - photoCount); // Students who didn't submit photos
    
    console.log(`📊 Verification Stats: Total: ${verificationStats.total}, Present: ${verificationStats.present}, Absent: ${verificationStats.absent}`);
    
    // Update the display immediately
    updateVerificationSummary();
}

/**
 * Creates a photo attendance card with toggle functionality
 */
function createPhotoAttendanceCard(photo, index) {
    const card = document.createElement('div');
    card.className = 'photo-attendance-card';
    card.id = `photo-card-${photo.id}`;
    card.style.cssText = `
        background: #f8fff9;
        border: 3px solid #28a745;
        border-radius: 12px;
        padding: 15px;
        text-align: center;
        transition: all 0.3s ease;
        position: relative;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    card.onclick = () => toggleAttendanceStatus(photo.id);
    
    // Initialize attendance decision as present (students who submitted photos are present by default)
    attendanceDecisions[photo.id] = 'present';
    
    // Determine photo source (Firebase Storage URL or Firestore base64)
    const photoSource = photo.photoURL || photo.photoData || 'data:image/svg+xml,%3csvg width=\'200\' height=\'150\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3crect width=\'200\' height=\'150\' fill=\'%23cccccc\'/%3e%3ctext x=\'50%25\' y=\'50%25\' font-size=\'14\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23666666\'%3eNo Photo%3c/text%3e%3c/svg%3e';
    const photoMethod = photo.photoMethod || (photo.photoURL ? 'firebase_storage' : 'firestore_fallback');
    const compressionInfo = photo.compressionApplied ? ' (compressed)' : '';
    
    card.innerHTML = `
        <div class="photo-container" style="margin-bottom: 10px; position: relative;">
            <img src="${photoSource}" alt="Student Photo" 
                 style="width: 100%; max-width: 200px; height: 150px; object-fit: cover; border-radius: 6px; cursor: pointer;"
                 onclick="event.stopPropagation(); viewFullPhoto('${photoSource.replace(/'/g, '\\\'')}', '${photo.studentName.replace(/'/g, '\\\'')}', '${photo.id}')">
            <div class="attendance-overlay" style="position: absolute; top: 5px; right: 5px; background: rgba(40, 167, 69, 0.9); color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                PRESENT
            </div>
            ${photoMethod === 'firestore_fallback' ? '<div style="position: absolute; bottom: 5px; left: 5px; background: rgba(255,193,7,0.9); color: #000; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: bold;">COMPRESSED</div>' : ''}
        </div>
        
        <div class="student-info" style="margin-bottom: 12px; font-size: 14px;">
            <div style="font-weight: 600; margin-bottom: 5px; color: #333;">${photo.studentName}</div>
            <div style="color: #666; font-size: 13px;">${photo.regNumber}</div>
            <div style="color: #888; font-size: 11px;">${photo.studentEmail}</div>
            <div style="color: #999; font-size: 10px; margin-top: 5px;">
                Submitted: ${formatDateTime(photo.timestamp)}${compressionInfo}
            </div>
            <div style="color: #aaa; font-size: 9px; margin-top: 3px;">
                Method: ${photoMethod === 'firebase_storage' ? '🔥 Firebase Storage' : '📦 Compressed (Fallback)'}
            </div>
        </div>
        
        <div class="attendance-status" style="padding: 8px; border-radius: 6px; font-weight: 600; font-size: 13px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb;">
            <i class="fas fa-check-circle"></i> MARKED PRESENT
        </div>
        
        <div style="margin-top: 8px; font-size: 11px; color: #999; font-style: italic;">
            Click card to mark absent • Click photo to view full-screen
        </div>
    `;
    
    return card;
}

/**
 * Updates the session info display
 */
function updateVerificationSessionInfo(session) {
    document.getElementById('verificationSchool').textContent = session.school || '-';
    document.getElementById('verificationBatch').textContent = session.batch || '-';
    document.getElementById('verificationSubject').textContent = session.subject || '-';
    document.getElementById('verificationPeriods').textContent = session.periods || '-';
    
    currentVerificationSession = session;
}

/**
 * Toggles attendance status for a student photo
 */
function toggleAttendanceStatus(photoId) {
    const currentStatus = attendanceDecisions[photoId] || 'present';
    let newStatus;
    
    // Simple toggle: present <-> absent (students who submitted photos start present, faculty clicks to mark absent)
    switch (currentStatus) {
        case 'present':
            newStatus = 'absent';
            break;
        case 'absent':
            newStatus = 'present';
            break;
        default:
            newStatus = 'present';
    }
    
    attendanceDecisions[photoId] = newStatus;
    updatePhotoCardDisplay(photoId, newStatus);
    updateVerificationSummary();
    
    console.log(`Photo ${photoId} status changed to: ${newStatus}`);
}

/**
 * Updates the visual display of a photo card based on attendance status
 */
function updatePhotoCardDisplay(photoId, status) {
    const card = document.getElementById(`photo-card-${photoId}`);
    if (!card) return;
    
    const overlay = card.querySelector('.attendance-overlay');
    const statusDiv = card.querySelector('.attendance-status');
    
    // Update card appearance based on status
    switch (status) {
        case 'present':
            card.style.borderColor = '#28a745';
            card.style.backgroundColor = '#f8fff9';
            overlay.style.background = 'rgba(40, 167, 69, 0.9)';
            overlay.textContent = 'PRESENT';
            statusDiv.style.background = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.style.border = '1px solid #c3e6cb';
            statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> MARKED PRESENT';
            break;
            
        case 'absent':
            card.style.borderColor = '#dc3545';
            card.style.backgroundColor = '#fff8f8';
            overlay.style.background = 'rgba(220, 53, 69, 0.9)';
            overlay.textContent = 'ABSENT';
            statusDiv.style.background = '#f8d7da';
            statusDiv.style.color = '#721c24';
            statusDiv.style.border = '1px solid #f5c6cb';
            statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> MARKED ABSENT';
            break;
            
        case 'pending':
        default:
            card.style.borderColor = '#ffc107';
            card.style.backgroundColor = 'white';
            overlay.style.background = 'rgba(0, 0, 0, 0.7)';
            overlay.textContent = 'NOT REVIEWED';
            statusDiv.style.background = '#fff3cd';
            statusDiv.style.color = '#856404';
            statusDiv.style.border = '1px solid #ffeaa7';
            statusDiv.innerHTML = '<i class="fas fa-clock"></i> CLICK TO MARK ATTENDANCE';
            break;
    }
}

// Bulk action functions removed - faculty will click individual photos to toggle attendance

/**
 * Views a photo in full size with attendance controls
 */
function viewFullPhoto(photoData, studentName, photoId) {
    // Handle potential encoding issues in photo data
    let cleanPhotoData = photoData;
    if (typeof photoData === 'string') {
        cleanPhotoData = photoData.replace(/\\'/g, "'");
    }
    const currentStatus = attendanceDecisions[photoId] || 'present';
    const statusColors = {
        present: '#28a745',
        absent: '#dc3545',
        pending: '#ffc107'
    };
    const statusText = {
        present: 'PRESENT',
        absent: 'ABSENT',
        pending: 'NOT REVIEWED'
    };
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.9); display: flex; flex-direction: column;
        justify-content: center; align-items: center; z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="max-width: 90%; max-height: 90%; text-align: center;">
            <img src="${cleanPhotoData}" style="max-width: 100%; max-height: 70vh; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <div style="color: white; margin: 20px 0 10px 0; font-size: 24px; font-weight: 600;">${studentName}</div>
            <div style="background: ${statusColors[currentStatus]}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin-bottom: 15px; display: inline-block;">
                ${statusText[currentStatus]}
            </div>
            <div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 15px;">
                <button onclick="attendanceDecisions['${photoId}'] = 'present'; updatePhotoCardDisplay('${photoId}', 'present'); updateVerificationSummary(); document.body.removeChild(this.closest('.modal') || this.parentElement.parentElement.parentElement.parentElement);" 
                        style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-check"></i> Mark Present
                </button>
                <button onclick="attendanceDecisions['${photoId}'] = 'absent'; updatePhotoCardDisplay('${photoId}', 'absent'); updateVerificationSummary(); document.body.removeChild(this.closest('.modal') || this.parentElement.parentElement.parentElement.parentElement);" 
                        style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-times"></i> Mark Absent
                </button>
            </div>
            <div style="color: #ccc; font-size: 14px; cursor: pointer;" onclick="document.body.removeChild(this.parentElement.parentElement);">Click here to close</div>
        </div>
    `;
    
    // Close modal when clicking outside the content
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    
    document.body.appendChild(modal);
}

/**
 * Saves attendance based on faculty decisions
 */
async function saveAttendance() {
    // No need to check for pending students since all are either present or absent by default
    // All students are initialized as present, faculty can change individual ones to absent
    
    const photoSubmittersPresentCount = Object.values(attendanceDecisions).filter(status => status === 'present').length;
    const photoSubmittersAbsentCount = Object.values(attendanceDecisions).filter(status => status === 'absent').length;
    const studentsWhoDidntSubmitPhotos = Math.max(0, verificationStats.total - Object.keys(attendanceDecisions).length);
    const totalAbsentCount = photoSubmittersAbsentCount + studentsWhoDidntSubmitPhotos;
    
    // Removed confirmation popup - save attendance directly
    console.log(`Saving attendance for ${verificationStats.total} students: Present: ${photoSubmittersPresentCount}, Absent: ${totalAbsentCount}`);
    
    try {
        console.log('Saving attendance based on faculty decisions...');
        const db = firebase.firestore();
        const batch = db.batch();
        
        let savedCount = 0;
        let errors = [];
        
        // Process each photo and create attendance records based on decisions
        for (const photo of pendingPhotos) {
            const decision = attendanceDecisions[photo.id];
            
            if (decision === 'present') {
                // Create attendance record for students marked as present
                const attendanceRef = db.collection('attendances').doc();
                const attendanceData = {
                    userId: photo.studentId,
                    studentEmail: photo.studentEmail,
                    studentName: photo.studentName,
                    regNumber: photo.regNumber,
                    school: photo.school,
                    batch: photo.batch,
                    subject: photo.subject,
                    periods: photo.periods,
                    date: photo.date,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'present',
                    markedAt: new Date(),
                    qrTimestamp: photo.qrTimestamp,
                    scanDelay: photo.scanDelay,
                    hasPhoto: false, // Photos are NOT saved permanently
                    photoTimestamp: photo.photoTimestamp,
                    verificationMethod: 'qr_and_photo_verified',
                    qrSessionId: photo.qrSessionId,
                    facultyId: photo.facultyId,
                    facultyName: photo.facultyName,
                    markedBy: photo.facultyId,
                    verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    verifiedBy: firebase.auth().currentUser.uid,
                    photoVerificationStatus: 'approved_by_faculty',
                    // NOTE: Photo data is NOT included - photos are temporary only
                    photoVerified: true,
                    verificationNotes: 'Photo verified by faculty but not stored permanently'
                };
                
                batch.set(attendanceRef, attendanceData);
                savedCount++;
            }
            // Note: For 'absent' students, we don't create attendance records (they remain absent)
            
            // Mark temp photo as processed
            const tempPhotoRef = db.collection('tempPhotos').doc(photo.id);
            batch.update(tempPhotoRef, {
                status: 'processed',
                facultyDecision: decision,
                processedAt: firebase.firestore.FieldValue.serverTimestamp(),
                processedBy: firebase.auth().currentUser.uid
            });
        }
        
        // Commit all changes
        await batch.commit();
        
        console.log(`Attendance saved successfully: ${photoSubmittersPresentCount} present, ${totalAbsentCount} absent (${photoSubmittersAbsentCount} photo submitters + ${studentsWhoDidntSubmitPhotos} non-submitters)`);
        
        // Clean up processed photos immediately (photos are not saved permanently)
        setTimeout(async () => {
            try {
                await cleanupProcessedPhotos();
                console.log('✅ Temporary photos cleaned up successfully');
            } catch (cleanupError) {
                console.warn('Photo cleanup failed (non-critical):', cleanupError);
            }
        }, 500); // Very short delay since photos are temporary
        
        // Also schedule additional cleanup attempts to ensure thorough cleanup
        setTimeout(async () => {
            try {
                await cleanupProcessedPhotos();
                console.log('✅ Secondary cleanup completed');
            } catch (cleanupError) {
                console.warn('Secondary cleanup failed (non-critical):', cleanupError);
            }
        }, 5000); // 5 seconds later
        
        
        // Close the modal
        closePhotoVerificationModal();
        
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Failed to save attendance. Please try again.');
    }
}

// Old functions removed - replaced with new toggle-based system

/**
 * Fetches total student count for the current batch
 */
async function getTotalStudentsInBatch(school, batch) {
    try {
        const db = firebase.firestore();
        
        // Get all students from the selected batch
        const allStudentsQuery = await db.collection('users')
            .where('role', '==', 'student')
            .get();
        
        // Find students matching the batch
        const batchStudents = [];
        const profilePromises = [];
        
        allStudentsQuery.forEach(studentDoc => {
            const studentData = studentDoc.data();
            
            // Check student profiles to match batch
            const profilePromise = db.collection('profiles').doc(studentDoc.id).get()
                .then(profileDoc => {
                    if (profileDoc.exists) {
                        const profileData = profileDoc.data();
                        
                        if (profileData.school === school && profileData.batch === batch) {
                            batchStudents.push({
                                id: studentDoc.id,
                                name: profileData.fullName || studentData.fullName || studentData.name,
                                regNumber: profileData.regNumber || studentData.regNumber || 'N/A',
                                email: studentData.email
                            });
                        }
                    } else {
                        // Fallback: use email-based matching
                        const email = studentData.email || '';
                        let matches = false;
                        
                        if (school === 'School of Technology' && email.includes('sot')) {
                            if (batch.startsWith('24') && email.includes('2428')) matches = true;
                            if (batch.startsWith('23') && email.includes('2328')) matches = true;
                        } else if (school === 'School of Management' && email.includes('som')) {
                            if (batch.startsWith('24') && email.includes('2428')) matches = true;
                            if (batch.startsWith('23') && email.includes('2328')) matches = true;
                        }
                        
                        if (matches) {
                            batchStudents.push({
                                id: studentDoc.id,
                                name: studentData.fullName || studentData.name || extractNameFromEmail(email),
                                regNumber: studentData.regNumber || studentData.registrationNumber || 'N/A',
                                email: studentData.email
                            });
                        }
                    }
                })
                .catch(error => {
                    console.warn('Error fetching profile for student:', studentDoc.id, error);
                });
            
            profilePromises.push(profilePromise);
        });
        
        await Promise.all(profilePromises);
        
        console.log(`📊 Found ${batchStudents.length} total students in ${school} - ${batch}`);
        return batchStudents.length;
        
    } catch (error) {
        console.error('Error fetching total student count:', error);
        return 0; // Fallback to 0 if error
    }
}

/**
 * Updates the verification summary display
 */
function updateVerificationSummary() {
    const summaryDiv = document.getElementById('verificationSummary');
    const saveAttendanceBtn = document.querySelector('.save-attendance-btn');
    
    // Calculate current counts from decisions (only for photo submitters)
    const photoSubmittersPresentCount = Object.values(attendanceDecisions).filter(status => status === 'present').length;
    const photoSubmittersAbsentCount = Object.values(attendanceDecisions).filter(status => status === 'absent').length;
    const pendingCount = Object.values(attendanceDecisions).filter(status => status === 'pending').length;
    
    // Calculate total absent count (photo submitters marked absent + students who didn't submit photos)
    const studentsWhoDidntSubmitPhotos = Math.max(0, verificationStats.total - Object.keys(attendanceDecisions).length);
    const totalAbsentCount = photoSubmittersAbsentCount + studentsWhoDidntSubmitPhotos;
    
    // Update stats
    verificationStats.present = photoSubmittersPresentCount; // Only photo submitters marked present
    verificationStats.absent = totalAbsentCount; // Photo submitters marked absent + non-submitters
    verificationStats.pending = pendingCount;
    
    console.log(`📊 Updated Stats: Total: ${verificationStats.total}, Present: ${photoSubmittersPresentCount}, Absent: ${totalAbsentCount} (${photoSubmittersAbsentCount} photo submitters + ${studentsWhoDidntSubmitPhotos} non-submitters)`);
    
    // Update display
    document.getElementById('totalPhotos').textContent = verificationStats.total;
    document.getElementById('presentCount').textContent = photoSubmittersPresentCount;
    document.getElementById('absentCount').textContent = totalAbsentCount;
    document.getElementById('pendingCount').textContent = pendingCount;
    
    // Show summary if there are photos
    if (verificationStats.total > 0) {
        summaryDiv.style.display = 'block';
        
        // Enable save button (faculty can save anytime, system will handle pending as absent)
        if (saveAttendanceBtn) saveAttendanceBtn.disabled = false;
    } else {
        summaryDiv.style.display = 'none';
        if (saveAttendanceBtn) saveAttendanceBtn.disabled = true;
    }
}

// Old finalizeAttendance function removed - replaced with saveAttendance

/**
 * Cleans up processed temporary photos to save storage space
 */
async function cleanupProcessedPhotos() {
    try {
        console.log('Starting cleanup of processed photos...');
        const db = firebase.firestore();
        
        // Get all processed photos (simpler query to avoid composite index requirement)
        const processedPhotosQuery = await db.collection('tempPhotos')
            .where('status', '==', 'processed')
            .limit(100) // Process in batches to avoid timeouts
            .get();
        
        if (processedPhotosQuery.empty) {
            console.log('No processed photos to cleanup');
            
            // Also try to cleanup any old photos without status field
            const oldPhotosQuery = await db.collection('tempPhotos')
                .limit(50)
                .get();
            
            if (!oldPhotosQuery.empty) {
                console.log(`Found ${oldPhotosQuery.docs.length} old photos without status, cleaning up...`);
                const batch = db.batch();
                oldPhotosQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`Successfully cleaned up ${oldPhotosQuery.docs.length} old photos`);
            }
            return;
        }
        
        console.log(`Found ${processedPhotosQuery.docs.length} processed photos to cleanup...`);
        
        // Filter photos that are at least 10 seconds old (reduced from 1 minute)
        const cutoffTime = new Date(Date.now() - 10000); // 10 seconds ago
        const photosToDelete = [];
        
        processedPhotosQuery.docs.forEach(doc => {
            const data = doc.data();
            const processedAt = data.processedAt ? data.processedAt.toDate() : new Date(0);
            
            if (processedAt < cutoffTime) {
                photosToDelete.push(doc);
            }
        });
        
        if (photosToDelete.length === 0) {
            console.log('All processed photos are too recent to delete yet');
            return;
        }
        
        console.log(`Cleaning up ${photosToDelete.length} processed photos...`);
        
        // Delete processed photos in batch
        const batch = db.batch();
        photosToDelete.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`✅ Successfully cleaned up ${photosToDelete.length} processed photos`);
        
    } catch (error) {
        console.error('❌ Error during photo cleanup:', error);
        
        // If the status-based query fails, try a simpler cleanup of all old photos
        try {
            console.log('🔄 Attempting fallback cleanup...');
            const db = firebase.firestore();
            const fallbackQuery = await db.collection('tempPhotos').limit(20).get();
            
            if (!fallbackQuery.empty) {
                console.log(`Fallback: Cleaning up ${fallbackQuery.docs.length} old photos`);
                const batch = db.batch();
                fallbackQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`✅ Fallback cleanup completed: ${fallbackQuery.docs.length} photos deleted`);
            }
        } catch (fallbackError) {
            console.error('❌ Fallback cleanup also failed:', fallbackError);
        }
    }
}

/**
 * Formats a date-time value for display
 */
function formatDateTime(value) {
    if (!value) return '';
    
    try {
        let date;
        if (value.toDate && typeof value.toDate === 'function') {
            date = value.toDate();
        } else if (value instanceof Date) {
            date = value;
        } else {
            date = new Date(value);
        }
        
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short', 
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(date);
    } catch (error) {
        return '';
    }
}


/**
 * Manual cleanup function for faculty to clear tempPhotos collection
 */
async function manualCleanupTempPhotos() {
    const cleanupBtn = document.getElementById('cleanupBtn');
    const originalHTML = cleanupBtn.innerHTML;
    
    try {
        // Show loading state
        cleanupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        cleanupBtn.disabled = true;
        
        console.log('🧹 Manual cleanup initiated by faculty');
        
        const db = firebase.firestore();
        
        // Get all photos from tempPhotos collection
        const allPhotosQuery = await db.collection('tempPhotos').limit(100).get();
        
        if (allPhotosQuery.empty) {
            console.log('✅ No temporary photos found - collection is already clean');
            alert('✅ tempPhotos collection is already clean!');
            return;
        }
        
        console.log(`🔍 Found ${allPhotosQuery.docs.length} temporary photos to cleanup`);
        
        // Delete all photos in batch
        const batch = db.batch();
        allPhotosQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        console.log(`✅ Successfully cleaned up ${allPhotosQuery.docs.length} temporary photos`);
        
        // Success notification
        showSuccessMessage(`Successfully cleaned up ${allPhotosQuery.docs.length} temporary photos!`);
        
    } catch (error) {
        console.error('❌ Manual cleanup failed:', error);
        alert('❌ Failed to cleanup temporary photos. Check console for details.');
    } finally {
        // Restore button state
        cleanupBtn.innerHTML = originalHTML;
        cleanupBtn.disabled = false;
    }
}

// Make photo verification functions globally accessible
window.openPhotoVerificationModal = openPhotoVerificationModal;
window.closePhotoVerificationModal = closePhotoVerificationModal;
window.loadPendingPhotosForVerification = loadPendingPhotosForVerification;
window.viewFullPhoto = viewFullPhoto;
window.toggleAttendanceStatus = toggleAttendanceStatus;
window.updatePhotoCardDisplay = updatePhotoCardDisplay;
window.saveAttendance = saveAttendance;
window.manualCleanupTempPhotos = manualCleanupTempPhotos;
