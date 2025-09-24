/*
==================================================
COMPLETE PROFILE JAVASCRIPT - CLEANED VERSION
==================================================
*/

// School and batch options mapping (using shared data)
const batchOptions = {
    "School of Technology": ["24B1", "24B2", "23B1"],
    "School of Management": ["23B1", "24B1"]
};

// Update batch options based on selected school
function updateBatchOptions() {
    const schoolSelect = document.getElementById('school');
    const batchSelect = document.getElementById('batch');
    const selectedSchool = schoolSelect.value;
    
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (selectedSchool && batchOptions[selectedSchool]) {
        batchSelect.disabled = false;
        batchOptions[selectedSchool].forEach(batch => {
            const option = document.createElement('option');
            option.value = batch;
            option.textContent = batch;
            batchSelect.appendChild(option);
        });
    } else {
        batchSelect.disabled = true;
    }
}

// Check authentication state
auth.onAuthStateChanged(user => {
    if (!user) {
        // If no user is authenticated, redirect to login
        window.location.href = 'index.html';
    }
    // Note: Profile completion check is now handled at login time
    // This page is only reached by new signups that need to complete their profile
});

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('completeProfileForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Generate and bind device ID
        const deviceId = generateDeviceId();
        console.log('📱 Binding device ID:', deviceId);
        
        const profileData = {
            fullName: document.getElementById('fullName').value,
            regNumber: document.getElementById('regNumber').value,
            school: document.getElementById('school').value,
            batch: document.getElementById('batch').value,
            phone: document.getElementById('phone').value,
            completedAt: new Date().toISOString(),
            deviceId: deviceId,
            deviceBoundAt: new Date()
        };
        
        try {
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;
            
            // Save to Firebase
            const user = auth.currentUser;
            if (user) {
                // Create user document with completed profile flag
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    role: 'student',
                    createdAt: new Date(),
                    profileCompleted: true,
                    isNewSignup: false, // No longer new after profile completion
                    deviceId: deviceId,
                    deviceBoundAt: new Date()
                });
                
                // Create profile document
                await db.collection('profiles').doc(user.uid).set(profileData);
                
                console.log('✅ Student user document and profile created successfully');
            }
            
            // Save to localStorage
            localStorage.setItem('profileCompleted', 'true');
            localStorage.setItem('studentProfile', JSON.stringify(profileData));
            
            // Show success message
            alert('Profile completed successfully! Redirecting to dashboard...');
            
            // Redirect to dashboard
            window.location.href = 'student-dashboard.html';
            
        } catch (error) {
            alert('Error saving profile. Please try again.');
            
            // Reset button
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});
