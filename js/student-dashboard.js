// ===== QR Scanner Setup =====
// Use vars so re-declaration is harmless if this script is loaded multiple times
var html5QrCode = typeof html5QrCode !== 'undefined' ? html5QrCode : null;
var qrScanner = typeof qrScanner !== "undefined" ? qrScanner : null;

// Open QR Scanner Modal and start scanning using html5-qrcode
function openQRScanner() {
  const modal = document.getElementById('scannerModal');
  const readerContainerId = 'qrReader';
  const scannerStatus = document.getElementById('scannerStatus');

  try {
    if (modal) modal.style.display = 'flex';
    if (scannerStatus) {
      scannerStatus.textContent = 'Initializing scanner...';
      scannerStatus.style.color = '#007bff';
    }

    // Clean any previous instance DOM leftovers
    const container = document.getElementById(readerContainerId);
    if (container) {
      container.innerHTML = '';
    }

    // Ensure library is available
    if (typeof Html5Qrcode === 'undefined') {
      console.error('Html5Qrcode library not loaded');
      showNotification('Scanner Error', 'QR scanner library not loaded');
      return;
    }

    // Create/replace instance
    html5QrCode = new Html5Qrcode(readerContainerId, { verbose: false });

    // Choose camera: prefer back camera
    Html5Qrcode.getCameras().then(cameras => {
      let cameraId = undefined;
      if (cameras && cameras.length > 0) {
        const back = cameras.find(c => /back|rear|environment/i.test(c.label));
        cameraId = (back && back.id) || cameras[0].id;
      }

      const config = { fps: 10, qrbox: 250, aspectRatio: 1.0 }; // reasonable defaults

      // Start either with specific cameraId or facingMode
      const startTarget = cameraId ? cameraId : { facingMode: 'environment' };
      return html5QrCode.start(
        startTarget,
        config,
        (decodedText, decodedResult) => {
          // Debounce: stop immediately after first success
          try { onScanSuccess(decodedText, decodedResult); } catch (e) { console.error(e); }
          html5QrCode.stop().then(() => {
            if (scannerStatus) {
              scannerStatus.textContent = 'Scan complete';
              scannerStatus.style.color = '#28a745';
            }
          }).catch(err => console.warn('Error stopping after success:', err));
        },
        errorMessage => {
          // Non-fatal scan errors, keep quiet but update status sometimes
          if (scannerStatus && errorMessage && /not found/i.test(String(errorMessage))) {
            scannerStatus.textContent = 'Searching for QR...';
            scannerStatus.style.color = '#6c757d';
          }
        }
      );
    }).then(() => {
      console.log('QR Scanner started');
      if (scannerStatus) {
        scannerStatus.textContent = 'Scanner active - point at QR code';
        scannerStatus.style.color = '#28a745';
      }
    }).catch(err => {
      console.error('Failed to start QR scanner:', err);
      showNotification('Scanner Error', 'Unable to start camera for QR scanning');
      if (scannerStatus) {
        scannerStatus.textContent = 'Scanner failed to start';
        scannerStatus.style.color = '#dc3545';
      }
    });
  } catch (error) {
    console.error('Error opening QR scanner:', error);
    showNotification('Scanner Error', 'Failed to initialize QR scanner.');
  }
}

// Close QR Scanner Modal
function closeQRScanner() {
  const modal = document.getElementById('scannerModal');
  
  console.log('Closing QR Scanner...');
  
  // Prefer stopping EndSem QrScanner if active and clean injected video element
  if (qrScanner) {
    try {
      qrScanner.stop();
      qrScanner.destroy();
      qrScanner = null;
      const container = document.getElementById('qrReader');
      if (container && (!container.tagName || container.tagName.toLowerCase() !== 'video')) {
        const prev = container.querySelector('video');
        if (prev) prev.remove();
      }
      console.log('QR Scanner (QrScanner) stopped successfully');
    } catch (e) {
      console.warn('Error stopping QrScanner:', e);
    }
  }

  // Stop the scanner if it's running  // Stop the scanner if it's running
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      console.log('QR Scanner stopped successfully');
      html5QrCode = null;
    }).catch(err => {
      console.error('Error stopping QR scanner:', err);
      html5QrCode = null;
    });
  }
  
  // Hide the modal
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Reset UI elements (only if they exist)
  const scannerStatus = document.getElementById('scannerStatus');
  if (scannerStatus) {
    scannerStatus.textContent = 'Scanner inactive';
    scannerStatus.style.color = '#6c757d';
  }
  
  // Clear any scanned data
  currentScannedData = null;
}

// Handle successful QR scan
function onScanSuccess(decodedText, decodedResult) {
  console.log('QR Code scanned successfully:', decodedText);
  
    try {
        // Parse the QR code data
        const qrData = JSON.parse(decodedText);
        
        // Validate QR code structure
        if (!qrData.school || !qrData.batch || !qrData.subject || !qrData.periods || !qrData.timestamp || !qrData.expiry) {
            throw new Error('Invalid QR code format');
        }
        
        // Fast QR Security validation (optimized for speed)
        if (window.validateSecureQR && qrData.security) {
            const validationResult = window.validateSecureQR(qrData);
            if (!validationResult.valid) {
                showNotification('Security Check Failed', validationResult.message);
                return;
            }
        }
        
        // Check if QR code has expired (basic validation)
        const now = Date.now();
        if (now > qrData.expiry) {
            showNotification('QR Expired', 'This QR code has expired. Ask your faculty to generate a new one.');
            return;
        }
    
    // Store scanned data in both variable and localStorage for backup
    currentScannedData = qrData;
    localStorage.setItem('currentQrData', JSON.stringify(qrData));
    console.log('✅ QR data stored:', qrData);
    console.log('✅ QR data backed up to localStorage');
    
    // Close QR scanner
    closeQRScanner();
    
    // Show success notification with details
    const timeLeft = Math.ceil((qrData.expiry - now) / 1000);
    showNotification(
      'QR Scanned Successfully!',
      `Subject: ${qrData.subject} | Batch: ${qrData.batch} | Periods: ${qrData.periods} | Now capturing photo...`
    );
    
    console.log('QR Data:', qrData);
    
    // Open photo capture modal for verification
    setTimeout(() => {
      openPhotoCapture();
    }, 1000); // Small delay to show the success message
    
  } catch (error) {
    console.error('Error processing QR code:', error);
    showNotification('Invalid QR Code', 'The scanned QR code is not valid for attendance marking.');
  }
}

// Handle scan errors (don't show for every frame)
function onScanError(error) {
  // Only log errors, don't show notifications for scanning errors
  // as they happen frequently during normal scanning
  if (error.includes('NotFoundException')) {
    // This is normal - no QR code found in frame
    return;
  }
  console.log('QR Scan error:', error);
}

// Mark attendance based on scanned QR data
async function markAttendance(qrData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Authentication Required', 'Please log in to mark attendance.');
      return;
    }
    
    // Get student profile data from local storage (existing behavior)
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }

    // EXTRA GUARD: Ensure only students from the QR's school and batch can mark attendance
    // If local profile is missing or incomplete, try fetching from Firestore
    try {
      const needsFetch = !studentProfile || !studentProfile.school || !studentProfile.batch;
      if (needsFetch && auth.currentUser) {
        const profSnap = await db.collection('profiles').doc(auth.currentUser.uid).get();
        if (profSnap.exists) {
          const profData = profSnap.data();
          if (profData && profData.school && profData.batch) {
            studentProfile.school = profData.school;
            studentProfile.batch = profData.batch;
            // Cache back to localStorage to avoid future lookups
            const cached = JSON.parse(localStorage.getItem('studentProfile') || '{}');
            localStorage.setItem('studentProfile', JSON.stringify({ ...cached, school: profData.school, batch: profData.batch }));
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch profile from Firestore for strict QR validation:', e);
    }

    // Normalize and strictly compare school and batch
    const qrSchool = String(qrData.school || '').trim();
    const qrBatch = String(qrData.batch || '').trim();
    const profSchool = String(studentProfile.school || '').trim();
    const profBatch = String(studentProfile.batch || '').trim();

    if (!profSchool || !profBatch) {
      showNotification('Profile Required', 'Complete your profile (school and batch) before scanning the QR.');
      return;
    }

    if (profSchool !== qrSchool) {
      showNotification('Invalid QR Code', 'This QR code is not for your school.');
      return;
    }

    if (profBatch !== qrBatch) {
      showNotification('Invalid QR Code', 'This QR code is not for your batch.');
      return;
    }
    
    // Check if already marked attendance for this specific session
    const today = getISTDateString();
    const attendanceQuery = await db.collection('attendances')
      .where('userId', '==', user.uid)
      .where('date', '==', today)
      .where('subject', '==', qrData.subject)
      .where('sessionId', '==', qrData.sessionId) // Check specific session
      .get();
    
    if (!attendanceQuery.empty) {
      showNotification('Already Marked', `Attendance already recorded for this ${qrData.subject} session.`);
      return;
    }
    
    // Create attendance record with session tracking
    const attendanceData = {
      userId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: qrData.school,
      batch: qrData.batch,
      subject: qrData.subject,
      periods: qrData.periods,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'present',
      markedAt: new Date(),
      qrTimestamp: qrData.timestamp,
      scanDelay: Date.now() - qrData.timestamp,
      verificationMethod: 'qr',
      hasPhoto: false,
      sessionId: qrData.sessionId, // Primary session identifier
      classTime: qrData.classTime || null, // Time when class happened
      facultyId: qrData.facultyId || null,
      facultyName: qrData.facultyName || null,
      markedBy: qrData.facultyId || null,
      generatedAt: qrData.generatedAt || null
    };
    
    // Save to Firebase
    const docRef = await db.collection('attendances').add(attendanceData);
    console.log('Attendance marked with ID:', docRef.id);
    
    // Show success notification
    showNotification(
      'Attendance Marked! ✓',
      `Present for ${qrData.subject} (${qrData.periods} periods) - ${today}`
    );
    
    // Add to local notifications
    addNotification(
      'attendance',
      `Attendance marked for ${qrData.subject} - ${qrData.periods} periods`,
      'Just now'
    );
    
    // Refresh all attendance data with fair calculation (instead of manual simulation)
    if (auth.currentUser) {
      fetchTodayAttendance(auth.currentUser);
      // Trigger fair calculation refresh to get accurate percentages
      await fetchAttendanceData();
    }
    
  } catch (error) {
    console.error('Error marking attendance:', error);
    showNotification('Error', 'Failed to mark attendance. Please try again.');
  }
}

// Photo capture variables
let photoCaptureStream = null;
let capturedPhotoData = null;
let autoCaptureTimer = null;
let countdownInterval = null;

/* ===== PHOTO CAPTURE FUNCTIONS ===== */

// Initialize video stream with proper error handling
function initializeVideoStream() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🎥 Requesting front camera access...');
      
      // Request front camera access with enhanced constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera only
          width: { ideal: 1920, min: 640, max: 1920 },
          height: { ideal: 1080, min: 480, max: 1080 },
          frameRate: { ideal: 30, min: 15, max: 30 }
        },
        audio: false
      });
      
      console.log('✅ Camera stream obtained successfully');
      console.log('Stream details:', {
        active: stream.active,
        tracks: stream.getVideoTracks().length,
        settings: stream.getVideoTracks()[0]?.getSettings()
      });
      
      resolve(stream);
      
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      reject(error);
    }
  });
}

// Setup video element properly
function setupVideoElement(video, stream) {
  return new Promise((resolve, reject) => {
    console.log('📺 Setting up video element...');
    
    // Configure video element
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    
    // Apply mirror effect and styling
    video.style.transform = 'scaleX(-1)';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.backgroundColor = '#000';
    
    // Handle video events
    video.onloadedmetadata = () => {
      console.log('📹 Video metadata loaded:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
    };
    
    video.oncanplay = () => {
      console.log('📹 Video can play');
    };
    
    video.onplaying = () => {
      console.log('📹 Video is playing');
      resolve(true);
    };
    
    video.onerror = (error) => {
      console.error('❌ Video error:', error);
      reject(error);
    };
    
    // Force play the video
    video.play().then(() => {
      console.log('✅ Video play() succeeded');
    }).catch(err => {
      console.error('❌ Video play() failed:', err);
      // Don't reject here, onplaying event will handle success
    });
    
    // Timeout fallback
    setTimeout(() => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        console.log('⏰ Video ready via timeout fallback');
        resolve(true);
      } else {
        reject(new Error('Video failed to initialize within timeout'));
      }
    }, 5000);
  });
}

// Open Photo Capture Modal
function openPhotoCapture() {
  const modal = document.getElementById('photoCaptureModal');
  const video = document.getElementById('photoCaptureVideo');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  console.log('Opening Photo Capture modal...');
  
  if (!modal || !video) {
    console.error('Photo capture elements not found');
    showNotification('Photo Capture Error', 'Photo capture components not properly configured.');
    return;
  }
  
  modal.style.display = 'flex';
  
  // Reset UI first
  if (captureBtn) captureBtn.style.display = 'none';
  photoStatus.textContent = 'Requesting camera permission...';
  photoStatus.style.color = '#007bff';
  photoStatus.style.fontSize = '16px';
  photoStatus.style.fontWeight = 'normal';
  
  // Check if mediaDevices is supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error('getUserMedia is not supported in this browser');
    photoStatus.textContent = 'Camera not supported in this browser';
    photoStatus.style.color = '#dc3545';
    showNotification('Camera Error', 'Your browser does not support camera access.');
    return;
  }

  // Directly request front camera access - this will show the browser's native permission dialog
  console.log('🎥 Requesting camera access...');
  navigator.mediaDevices.getUserMedia({ 
    video: { 
      facingMode: 'user', // Front camera
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      frameRate: { ideal: 30, min: 15 }
    },
    audio: false
  }).then(stream => {
    console.log('✅ Camera permission granted, stream obtained:', {
      streamId: stream.id,
      active: stream.active,
      videoTracks: stream.getVideoTracks().length,
      trackSettings: stream.getVideoTracks()[0]?.getSettings()
    });
    
    photoCaptureStream = stream;
    photoStatus.textContent = 'Initializing camera...';
    photoStatus.style.color = '#ffc107';
    
    // Clear any existing srcObject first
    video.srcObject = null;
    
    // Set up video element with proper event handling
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.controls = false;
    
    // Apply styling
    video.style.transform = 'scaleX(-1)'; // Mirror effect
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.backgroundColor = '#000';
    
    // Set up event listeners before assigning stream
    const onVideoReady = () => {
      console.log('📹 Video ready event triggered:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        currentTime: video.currentTime
      });
      
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        photoStatus.textContent = 'Camera ready! Position your face and tap Capture Photo';
        photoStatus.style.color = '#28a745';
        
        // Show the manual capture button
        if (captureBtn) {
          captureBtn.style.display = 'flex';
        }
      }
    };
    
    // Multiple event listeners to catch video ready state
    video.addEventListener('loadedmetadata', () => {
      console.log('📹 Video metadata loaded');
      onVideoReady();
    }, { once: true });
    
    video.addEventListener('canplay', () => {
      console.log('📹 Video can play');
      onVideoReady();
    }, { once: true });
    
    video.addEventListener('playing', () => {
      console.log('📹 Video is playing');
      onVideoReady();
    }, { once: true });
    
    video.addEventListener('error', (err) => {
      console.error('❌ Video element error:', err);
      photoStatus.textContent = 'Video error occurred';
      photoStatus.style.color = '#dc3545';
    });
    
    // Now set the stream
    video.srcObject = stream;
    
    // Force play the video
    setTimeout(() => {
      video.play().then(() => {
        console.log('✅ Video.play() succeeded');
      }).catch(err => {
        console.error('❌ Video.play() failed:', err);
        // Try to trigger ready check anyway
        setTimeout(onVideoReady, 500);
      });
    }, 100);
    
    // Safety timeout - force ready after reasonable time
    setTimeout(() => {
      console.log('⏰ Safety timeout check:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused
      });
      
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        console.log('✅ Video ready via safety timeout');
        onVideoReady();
      } else {
        console.log('⚠️ Video still not ready, starting anyway');
        photoStatus.textContent = 'Camera initializing... Please wait';
        photoStatus.style.color = '#ffc107';
        
        // Final attempt after longer delay
        setTimeout(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            onVideoReady();
          } else {
            console.log('🔧 Showing manual capture button despite video not fully ready');
            photoStatus.textContent = 'Camera ready! Position your face and tap Capture Photo';
            photoStatus.style.color = '#28a745';
            if (captureBtn) {
              captureBtn.style.display = 'flex';
            }
          }
        }, 2000);
      }
    }, 3000);
    
  }).catch(error => {
    console.error('❌ Camera permission denied or error:', error);
    photoStatus.style.color = '#dc3545';

    let errorMessage = 'Camera access failed';
    let notificationTitle = 'Camera Error';
    let notificationMessage = 'Unable to access camera';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Camera permission denied';
      notificationTitle = 'Permission Denied';
      notificationMessage = 'Please allow camera access to continue';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera found';
      notificationTitle = 'No Camera';
      notificationMessage = 'No camera detected on this device';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Camera in use by another app';
      notificationTitle = 'Camera Busy';
      notificationMessage = 'Close other apps using the camera';
    } else if (error.name === 'OverconstrainedError') {
      errorMessage = 'Camera constraints not supported';
      notificationTitle = 'Camera Issue';
      notificationMessage = 'Camera settings not compatible';
    }

    photoStatus.textContent = errorMessage;
    showNotification(notificationTitle, notificationMessage);
    
    // Add retry button
    setTimeout(() => {
      photoStatus.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">📷</div>
          <h3 style="color: #dc3545; margin-bottom: 10px;">Camera Access Required</h3>
          <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            ${notificationMessage}
          </p>
          <button onclick="requestCameraPermission()" 
                  style="background: #007bff; color: white; border: none; padding: 12px 24px; 
                         border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px;">
            🔄 Try Again
          </button>
        </div>
      `;
    }, 1000);
  });
}

// Close Photo Capture Modal
function closePhotoCaptureModal() {
  const modal = document.getElementById('photoCaptureModal');
  
  console.log('Closing Photo Capture modal...');
  console.log('Before closing - capturedPhotoData exists:', !!capturedPhotoData);
  console.log('Before closing - currentScannedData exists:', !!currentScannedData);
  
  // Stop camera stream
  if (photoCaptureStream) {
    photoCaptureStream.getTracks().forEach(track => track.stop());
    photoCaptureStream = null;
  }
  
  // Reset UI
  resetPhotoCaptureUI();
  
  // Hide modal
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Only clear captured data if attendance was successfully marked
  // This preserves the photo data in case the modal needs to be reopened
  // Note: Data will be cleared in markAttendanceWithPhoto after successful submission
}

// Capture student photo
function captureStudentPhoto() {
  const video = document.getElementById('photoCaptureVideo');
  const canvas = document.getElementById('photoCaptureCanvas');
  const capturedImg = document.getElementById('capturedPhotoImg');
  const capturedPreview = document.getElementById('capturedPhotoPreview');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const retakeBtn = document.getElementById('retakePhotoBtn');
  const confirmBtn = document.getElementById('confirmPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  console.log('Capture photo attempt - video ready check:', {
    videoExists: !!video,
    canvasExists: !!canvas,
    videoWidth: video?.videoWidth || 0,
    videoHeight: video?.videoHeight || 0,
    videoReadyState: video?.readyState
  });
  
  if (!video || !canvas) {
    showNotification('Capture Error', 'Video or canvas elements not found.');
    return;
  }
  
  // More comprehensive video readiness check
  if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
    console.log('Video not ready yet, waiting...');
    photoStatus.textContent = 'Video is loading, please wait...';
    photoStatus.style.color = '#007bff';
    
    // Try again after a short delay
    setTimeout(() => {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
        console.log('Video ready after delay, trying capture again');
        captureStudentPhoto();
      } else {
        showNotification('Camera Error', 'Video stream is not ready. Please refresh the page and try again.');
      }
    }, 1000);
    return;
  }
  
  console.log('Capturing student photo...');
  
  // Set canvas dimensions to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  
  // Capture frame from video
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Convert to base64 data URL
  capturedPhotoData = canvas.toDataURL('image/jpeg', 0.8);
  
  // Show captured photo preview
  capturedImg.src = capturedPhotoData;
  capturedPreview.style.display = 'flex';
  
  // Update UI buttons
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'flex';
  confirmBtn.style.display = 'flex';
  
  // Update status
  photoStatus.textContent = 'Photo captured! Review and confirm or retake';
  photoStatus.style.color = '#007bff';
  
  console.log('Photo captured successfully');
}

// Retake photo
function retakePhoto() {
  const capturedPreview = document.getElementById('capturedPhotoPreview');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const retakeBtn = document.getElementById('retakePhotoBtn');
  const confirmBtn = document.getElementById('confirmPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  console.log('Retaking photo...');
  
  // Hide captured photo preview
  capturedPreview.style.display = 'none';
  
  // Reset UI buttons
  captureBtn.style.display = 'flex';
  retakeBtn.style.display = 'none';
  confirmBtn.style.display = 'none';
  
  // Update status
  photoStatus.textContent = 'Position your face in the frame and capture again';
  photoStatus.style.color = '#28a745';
  
  // Clear captured data
  capturedPhotoData = null;
}

// Confirm photo and mark attendance
function confirmPhotoAndMarkAttendance() {
  console.log('=== CONFIRM PHOTO AND MARK ATTENDANCE DEBUG ===');
  console.log('capturedPhotoData exists:', !!capturedPhotoData);
  console.log('currentScannedData exists:', !!currentScannedData);
  console.log('capturedPhotoData length:', capturedPhotoData ? capturedPhotoData.length : 'null');
  console.log('currentScannedData details:', currentScannedData);
  
  // Check localStorage backup for QR data
  const backupQrData = localStorage.getItem('currentQrData');
  console.log('Backup QR data in localStorage:', backupQrData);
  
  if (!capturedPhotoData) {
    console.error('Missing captured photo data');
    showNotification('Photo Error', 'No photo captured. Please capture a photo first.');
    return;
  }
  
  // Try to recover QR data from localStorage if main variable is lost
  if (!currentScannedData && backupQrData) {
    try {
      currentScannedData = JSON.parse(backupQrData);
      console.log('✅ Recovered QR data from localStorage:', currentScannedData);
    } catch (e) {
      console.error('❌ Failed to parse backup QR data:', e);
    }
  }
  
  if (!currentScannedData) {
    console.error('❌ Missing QR scan data - both main variable and backup are empty');
    showNotification('QR Error', 'No QR data available. Please scan QR code again.');
    
    // Close the photo modal and redirect user to scan QR again
    setTimeout(() => {
      closePhotoCaptureModal();
      showNotification('Please Start Over', 'Please scan the QR code first, then take your photo.');
    }, 2000);
    return;
  }
  
  console.log('Confirming photo and marking attendance...');
  
  // Show processing notification first
  showNotification(
    'Processing Attendance...',
    'Saving photo and marking attendance. Please wait...'
  );
  
  // Submit photo for faculty verification - use direct Firestore fallback
  try {
    console.log('📸 Starting photo submission process...');
    
    // Get student profile
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }
    
    const user = auth.currentUser;
    const today = getISTDateString();
    
    // Use Firestore fallback method directly (more reliable)
    submitPhotoToFirestoreFallback(currentScannedData, capturedPhotoData, studentProfile, user, today)
      .then((docId) => {
        console.log('✅ Photo submission completed successfully:', docId);
      })
      .catch((error) => {
        console.error('❌ Photo submission failed:', error);
        showNotification('Photo Upload Error', 'Failed to submit photo. Please try again.');
      });
      
  } catch (error) {
    console.error('❌ Error in photo submission setup:', error);
    showNotification('Photo Upload Error', 'Failed to setup photo submission. Please try again.');
  }
  
  // Close photo capture modal after starting the process
  setTimeout(() => {
    closePhotoCaptureModal();
  }, 1000);
}

// Reset photo capture UI
function resetPhotoCaptureUI() {
  const capturedPreview = document.getElementById('capturedPhotoPreview');
  const captureBtn = document.getElementById('capturePhotoBtn');
  const retakeBtn = document.getElementById('retakePhotoBtn');
  const confirmBtn = document.getElementById('confirmPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');
  
  if (capturedPreview) capturedPreview.style.display = 'none';
  if (captureBtn) captureBtn.style.display = 'none';
  if (retakeBtn) retakeBtn.style.display = 'none';
  if (confirmBtn) confirmBtn.style.display = 'none';
  
  if (photoStatus) {
    photoStatus.textContent = 'Camera inactive';
    photoStatus.style.color = '#6c757d';
  }
}

// Firestore fallback for photo submission (when Storage is not available)
async function submitPhotoToFirestoreFallback(qrData, photoData, studentProfile, user, today) {
  try {
    console.log('📦 Using Firestore fallback for photo submission...');
    
    // Compress the photo to fit in Firestore (1MB document limit)
    let compressedPhoto = photoData;
    let compressionApplied = false;
    
    // Check photo size and compress if needed
    const photoSizeKB = (photoData.length * 0.75) / 1024; // Base64 is ~75% of actual bytes
    console.log(`📷 Original photo size: ${photoSizeKB.toFixed(2)} KB`);
    
    if (photoSizeKB > 700) { // If larger than 700KB, compress it
      console.log('🗜️ Compressing photo to fit in Firestore...');
      compressedPhoto = await compressImageSimple(photoData, 0.5, 800, 600);
      compressionApplied = true;
      const compressedSizeKB = (compressedPhoto.length * 0.75) / 1024;
      console.log(`✅ Compressed photo size: ${compressedSizeKB.toFixed(2)} KB`);
      
      // If still too large, compress more
      if (compressedSizeKB > 700) {
        console.log('🗜️ Applying stronger compression...');
        compressedPhoto = await compressImageSimple(photoData, 0.3, 600, 450);
        const finalSizeKB = (compressedPhoto.length * 0.75) / 1024;
        console.log(`✅ Final compressed size: ${finalSizeKB.toFixed(2)} KB`);
      }
    }
    
    // Create temporary photo record with compressed photo data
    const tempPhotoData = {
      studentId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: qrData.school,
      batch: qrData.batch,
      subject: qrData.subject,
      periods: qrData.periods,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      photoTimestamp: new Date(),
      qrTimestamp: qrData.timestamp,
      scanDelay: Date.now() - qrData.timestamp,
      qrSessionId: qrData.sessionId || null,
      facultyId: qrData.facultyId || null,
      facultyName: qrData.facultyName || null,
      photoData: compressedPhoto, // Store compressed base64 photo directly
      photoMethod: 'firestore_fallback', // Mark as fallback method
      compressionApplied: compressionApplied,
      originalSize: photoData.length,
      compressedSize: compressedPhoto.length,
      status: 'pending_verification',
      verificationMethod: 'qr_and_photo',
      submittedAt: new Date()
    };
    
    console.log('💾 Saving photo to Firestore tempPhotos collection...');
    
    // Save to temporary photos collection
    const docRef = await db.collection('tempPhotos').add(tempPhotoData);
    console.log('✅ Photo saved to Firestore with ID:', docRef.id);
    
    // Show success notification
    showNotification(
      '📸 Photo Submitted!',
      `Your photo for ${qrData.subject} has been submitted for faculty verification (using fallback storage).`
    );
    
    // Add to local notifications
    addNotification(
      'info',
      `📸 Photo submitted for ${qrData.subject} - ${qrData.periods} periods (awaiting verification)`,
      'Just now'
    );
    
    // Clear the scanned data
    currentScannedData = null;
    localStorage.removeItem('currentQrData');
    console.log('✅ Photo submission completed using Firestore fallback');
    
    return docRef.id;
    
  } catch (error) {
    console.error('❌ Firestore fallback failed:', error);
    throw error;
  }
}

// Simple image compression function
async function compressImageSimple(dataURL, quality = 0.5, maxWidth = 800, maxHeight = 600) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let { width, height } = img;
      
      // Resize if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Return compressed image
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataURL;
  });
}

// Helper function to convert data URL to blob
function dataURLToBlob(dataURL) {
  try {
    // Split the data URL to get the base64 data
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while(n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  } catch (error) {
    console.error('Error converting data URL to blob:', error);
    return null;
  }
}

// Submit photo for faculty verification (new workflow with Firebase Storage)
async function submitPhotoForVerification(qrData, photoData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Authentication Required', 'Please log in to mark attendance.');
      return;
    }
    
    console.log('📸 Starting photo verification submission...');
    
    // Get student profile data from local storage
    const savedProfile = localStorage.getItem('studentProfile');
    let studentProfile = {};
    if (savedProfile) {
      studentProfile = JSON.parse(savedProfile);
    }
    
    // Validate student belongs to the same batch/school as QR code
    if (studentProfile.school && studentProfile.school !== qrData.school) {
      showNotification('Invalid QR Code', 'This QR code is not for your school.');
      return;
    }
    
    if (studentProfile.batch && studentProfile.batch !== qrData.batch) {
      showNotification('Invalid QR Code', 'This QR code is not for your batch.');
      return;
    }
    
    // Check if already submitted photo for this session
    const today = getISTDateString();
    // Use a simple query to avoid index/undefined issues
    const baseQuerySnap = await db.collection('tempPhotos')
      .where('studentId', '==', user.uid)
      .where('date', '==', today)
      .where('subject', '==', qrData.subject)
      .get();
    
    // Client-side filter by session if available
    const alreadySubmitted = baseQuerySnap.docs.some(d => {
      const data = d.data();
      return !qrData.sessionId || data.qrSessionId === (qrData.sessionId || null);
    });
    
    if (alreadySubmitted) {
      showNotification('Photo Already Submitted', `Your photo for ${qrData.subject} has already been submitted for verification.`);
      return;
    }
    
    // Convert base64 to blob for Firebase Storage upload
    console.log('🔄 Converting photo data for storage...');
    const photoBlob = dataURLToBlob(photoData);
    
    if (!photoBlob) {
      throw new Error('Failed to convert photo data');
    }
    
    // Generate unique photo filename
    const timestamp = Date.now();
    const photoFileName = `temp_photos/${user.uid}/${today}/${qrData.subject}_${timestamp}.jpg`;
    
    console.log('☁️ Uploading photo to Firebase Storage...', photoFileName);
    
    // Check if Firebase Storage is available
    if (!storage) {
      console.warn('Firebase Storage not available, using Firestore fallback');
      // Instead of throwing error, directly use Firestore fallback
      return submitPhotoToFirestoreFallback(qrData, photoData, studentProfile, user, today);
    }
    
    // Upload photo to Firebase Storage
    const storageRef = storage.ref().child(photoFileName);
    const uploadTask = await storageRef.put(photoBlob, {
      contentType: 'image/jpeg',
      customMetadata: {
        studentId: user.uid,
        subject: qrData.subject,
        date: today,
        sessionId: qrData.sessionId || 'unknown'
      }
    });
    
    // Get download URL for the uploaded photo
    const photoURL = await uploadTask.ref.getDownloadURL();
    console.log('✅ Photo uploaded successfully:', photoURL);
    
    // Create temporary photo record for faculty verification (without embedding photo data)
    const tempPhotoData = {
      studentId: user.uid,
      studentEmail: user.email,
      studentName: studentProfile.fullName || extractNameFromEmail(user.email),
      regNumber: studentProfile.regNumber || 'N/A',
      school: qrData.school,
      batch: qrData.batch,
      subject: qrData.subject,
      periods: qrData.periods,
      date: today,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      photoTimestamp: new Date(),
      qrTimestamp: qrData.timestamp,
      scanDelay: Date.now() - qrData.timestamp,
      qrSessionId: qrData.sessionId || null,
      facultyId: qrData.facultyId || null,
      facultyName: qrData.facultyName || null,
      photoURL: photoURL, // Store Firebase Storage URL instead of base64 data
      photoFileName: photoFileName, // Store filename for potential cleanup
      status: 'pending_verification', // Will be changed to 'approved' or 'rejected' by faculty
      verificationMethod: 'qr_and_photo',
      submittedAt: new Date()
    };
    
    console.log('💾 Saving photo verification record to Firestore...');
    
    // Save to temporary photos collection
    const docRef = await db.collection('tempPhotos').add(tempPhotoData);
    console.log('✅ Photo verification record saved with ID:', docRef.id);
    
    // Show success notification
    showNotification(
      '📸 Photo Submitted!',
      `Your photo for ${qrData.subject} has been submitted for faculty verification. Attendance will be marked after approval.`
    );
    
    // Add to local notifications
    addNotification(
      'info',
      `📸 Photo submitted for ${qrData.subject} - ${qrData.periods} periods (awaiting verification)`,
      'Just now'
    );
    
    // Don't update attendance charts yet - wait for faculty approval
    // Don't mark as present immediately - this will happen after faculty verification
    
    // Clear the scanned data and localStorage backup
    currentScannedData = null;
    localStorage.removeItem('currentQrData');
    console.log('✅ QR data cleared after photo submission');
    
  } catch (error) {
    console.error('❌ Error submitting photo for verification:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Debug: Check Firebase Storage availability
    console.error('🔍 Firebase Storage Debug:', {
      storageAvailable: typeof storage !== 'undefined',
      storageObject: storage,
      firebaseApp: typeof firebase !== 'undefined',
      authUser: auth?.currentUser?.uid || 'No user'
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to submit photo for verification. Please try again.';
    let debugInfo = '';
    
    // Check for specific Firebase Storage errors
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'You do not have permission to upload photos. Please contact support.';
      debugInfo = 'Storage rules may not be deployed correctly.';
    } else if (error.code === 'storage/canceled') {
      errorMessage = 'Photo upload was cancelled. Please try again.';
    } else if (error.code === 'storage/unknown') {
      errorMessage = 'Unknown error occurred while uploading photo. Please check your internet connection.';
    } else if (error.code === 'storage/quota-exceeded') {
      errorMessage = 'Storage quota exceeded. Please contact support.';
    } else if (error.message && error.message.includes('Firebase Storage is not configured')) {
      errorMessage = 'Photo upload is currently unavailable. Firebase Storage needs to be enabled. Please contact your administrator.';
      debugInfo = 'Firebase Storage service is not enabled in the console.';
    } else if (error.message && error.message.includes('convert')) {
      errorMessage = 'Failed to process photo data. Please take the photo again.';
    } else if (error.code === 'storage/object-not-found') {
      errorMessage = 'Storage bucket not found. Please contact support.';
      debugInfo = 'Firebase Storage bucket may not be created.';
    } else if (error.message && error.message.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (!storage) {
      errorMessage = 'Firebase Storage is not initialized. Please refresh the page and try again.';
      debugInfo = 'Storage object is undefined - Firebase Storage may not be enabled.';
    }
    
    showNotification('Photo Upload Error', errorMessage + (debugInfo ? '\n\nDebug: ' + debugInfo : ''));
    
    // Log additional debug information
    console.error('🔍 Additional Debug Info:', {
      errorMessage,
      debugInfo,
      currentUser: auth?.currentUser ? {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email
      } : 'Not logged in',
      qrData: currentScannedData ? {
        school: currentScannedData.school,
        batch: currentScannedData.batch,
        subject: currentScannedData.subject
      } : 'No QR data',
      photoDataLength: capturedPhotoData ? capturedPhotoData.length : 0
    });
  }
}

// Keep the old function for backward compatibility but mark as deprecated
// Mark attendance with photo verification (DEPRECATED - use submitPhotoForVerification instead)
async function markAttendanceWithPhoto(qrData, photoData) {
  console.warn('markAttendanceWithPhoto is deprecated. Using new photo verification workflow.');
  return await submitPhotoForVerification(qrData, photoData);
}

// Request camera permission function
function requestCameraPermission() {
  console.log('Requesting camera permission...');
  const photoStatus = document.getElementById('photoStatus');
  
  if (photoStatus) {
    photoStatus.textContent = 'Requesting camera permission...';
    photoStatus.style.color = '#ffc107';
  }
  
  // Try to open photo capture again
  openPhotoCapture();
}

// Global functions to be called from HTML
window.openQRScanner = openQRScanner;
window.closeQRScanner = closeQRScanner;
window.openPhotoCapture = openPhotoCapture;
window.closePhotoCaptureModal = closePhotoCaptureModal;
window.captureStudentPhoto = captureStudentPhoto;
window.retakePhoto = retakePhoto;
window.confirmPhotoAndMarkAttendance = confirmPhotoAndMarkAttendance;
window.requestCameraPermission = requestCameraPermission;

/* ===== PAGE INITIALIZATION ===== */
// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Note: Logout function is already defined in HTML head section
  
  // Only initialize charts after a small delay to ensure DOM is ready
  setTimeout(() => {
    updateCharts();
    showLowAttendanceWarnings();
  }, 100);
  
  // Add debug info to console
  console.log('Student dashboard loaded. Debug functions available:');
  console.log('- debugCreateTestNotification(status) - Create test notification');
  console.log('- debugNotificationStatus() - Check notification system status');
  console.log('- debugTestFirebaseConnection() - Test Firebase connection');
  console.log('- debugCheckNotificationPermissions() - Test notification permissions');
});