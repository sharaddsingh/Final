/*
==================================================
PHOTO SUBMISSION FALLBACK
==================================================
Temporary solution for photo submission when Firebase Storage is not available.
This uses compressed base64 images stored in Firestore.
WARNING: This is not recommended for production due to Firestore document size limits.
==================================================
*/

// Extract name from email address (duplicate from student-dashboard.js)
function extractNameFromEmail(email) {
  if (!email) return 'Student';
  
  try {
    // Get the part before @ symbol
    const localPart = email.split('@')[0];
    
    // Remove numbers and special characters, split by dots/underscores/hyphens
    const nameParts = localPart
      .replace(/[0-9]/g, '') // Remove numbers
      .split(/[._-]+/) // Split by dots, underscores, hyphens
      .filter(part => part.length > 0) // Remove empty parts
      .map(part => {
        // Capitalize first letter of each part
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      });
    
    // Join the parts with space
    const extractedName = nameParts.join(' ');
    
    // Return the extracted name or fallback
    return extractedName.length > 0 ? extractedName : 'Student';
  } catch (error) {
    console.error('Error extracting name from email:', error);
    return 'Student';
  }
}

// Helper: get YYYY-MM-DD in Asia/Kolkata (duplicate from student-dashboard.js)
function getISTDateString(d = new Date()) {
  // Use Intl to format in IST then build YYYY-MM-DD
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${day}`;
}

// Compress image to fit within Firestore limits
function compressImage(dataURL, quality = 0.3, maxWidth = 400, maxHeight = 300) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      // Set canvas size
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to compressed JPEG
      const compressedDataURL = canvas.toDataURL('image/jpeg', quality);
      
      
      resolve(compressedDataURL);
    };
    
    img.src = dataURL;
  });
}

// Fallback photo submission using Firestore
async function submitPhotoForVerificationFallback(qrData, photoData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      showNotification('Authentication Required', 'Please log in to mark attendance.');
      return;
    }
    
    showNotification('Processing Photo', 'Compressing image for submission...');
    
    // Get student profile data
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
    
    // Compress photo data to fit in Firestore
    let compressedPhoto = await compressImage(photoData, 0.2, 300, 225);
    
    // Check if compressed photo is still too large (Firestore has 1MB limit)
    let sizeInBytes = compressedPhoto.length * 0.75; // Base64 is ~75% of actual bytes
    const maxSize = 800000; // 800KB to be safe
    
    if (sizeInBytes > maxSize) {
      // Try with even more compression
      const superCompressed = await compressImage(photoData, 0.1, 200, 150);
      const superSize = superCompressed.length * 0.75;
      
      if (superSize > maxSize) {
        throw new Error('Photo is too large even after compression. Please try a different photo.');
      }
      
      compressedPhoto = superCompressed;
      sizeInBytes = superSize;
    }
    
    // Check if already submitted photo for this session
    const today = getISTDateString();
    // Use a simple query to avoid composite index requirements
    const baseQuerySnap = await db.collection('tempPhotos')
      .where('studentId', '==', user.uid)
      .where('date', '==', today)
      .where('subject', '==', qrData.subject)
      .get();
    
    // Client-side filter by session if available
    const existingPhotoQuery = {
      empty: baseQuerySnap.docs.filter(d => {
        const data = d.data();
        return !qrData.sessionId || data.qrSessionId === qrData.sessionId;
      }).length === 0
    };
    
    if (!existingPhotoQuery.empty) {
      showNotification('Photo Already Submitted', `Your photo for ${qrData.subject} has already been submitted for verification.`);
      return;
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
      photoData: compressedPhoto, // Compressed base64 photo
      photoMethod: 'firestore_fallback', // Indicate this is fallback method
      status: 'pending_verification',
      verificationMethod: 'qr_and_photo',
      submittedAt: new Date(),
      compressionApplied: true,
      originalSize: photoData.length,
      compressedSize: compressedPhoto.length
    };
    
    // Save to temporary photos collection
    const docRef = await db.collection('tempPhotos').add(tempPhotoData);
    
    // Show success notification
    showNotification(
      '📸 Photo Submitted!',
      `Your photo for ${qrData.subject} has been submitted for faculty verification. Attendance will be marked after approval.\n\n(Using compressed fallback method)`
    );
    
    // Add to local notifications
    addNotification(
      'info',
      `📸 Photo submitted for ${qrData.subject} - ${qrData.periods} periods (awaiting verification)`,
      'Just now'
    );
    
    // Clear the scanned data and localStorage backup
    currentScannedData = null;
    localStorage.removeItem('currentQrData');
    
  } catch (error) {
    console.error('❌ Error with fallback photo submission:', error);
    
    let errorMessage = 'Failed to submit photo. Please try again.';
    
    if (error.message.includes('too large')) {
      errorMessage = 'Photo is too large. Please try taking a new photo with better lighting or a simpler background.';
    } else if (error.code === 'permission-denied') {
      errorMessage = 'Permission denied. Please check your network connection and try again.';
    } else if (error.message.includes('compress')) {
      errorMessage = 'Failed to process photo. Please try taking the photo again.';
    }
    
    showNotification('Photo Submission Error', errorMessage);
  }
}

// Enhanced photo submission function that tries Storage first, then falls back to Firestore
async function submitPhotoForVerificationEnhanced(qrData, photoData) {
  // First try the Firebase Storage method
  if (typeof storage !== 'undefined' && storage) {
    console.log('📸 Attempting Firebase Storage upload...');
    try {
      await submitPhotoForVerification(qrData, photoData);
      return; // Success with Storage method
    } catch (storageError) {
      console.warn('📸 Firebase Storage failed, trying fallback method:', storageError);
      
      // If it's a storage configuration issue, use fallback
      if (storageError.message.includes('Firebase Storage is not configured') ||
          storageError.code === 'storage/unauthorized' ||
          !storage) {
        
        showNotification('Using Fallback Method', 'Firebase Storage unavailable. Using compressed photo storage.');
        
        // Wait a moment then try fallback
        setTimeout(() => {
          submitPhotoForVerificationFallback(qrData, photoData);
        }, 1000);
        
        return;
      } else {
        // If it's another type of error, re-throw it
        throw storageError;
      }
    }
  } else {
    console.log('📸 Firebase Storage not available, using fallback method');
    showNotification('Using Fallback Method', 'Using compressed photo storage method.');
    await submitPhotoForVerificationFallback(qrData, photoData);
  }
}

// Make the enhanced function available globally
window.submitPhotoForVerificationEnhanced = submitPhotoForVerificationEnhanced;
window.submitPhotoForVerificationFallback = submitPhotoForVerificationFallback;

