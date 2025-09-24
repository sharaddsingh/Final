/*
==================================================
COMMON UTILITIES MODULE
==================================================
Author: Attendance Tracker System
Description: Shared utility functions
Last Updated: 2024
==================================================
*/

// School and batch options mapping
const BATCH_OPTIONS = {
  "School of Technology": ["24B1", "24B2", "23B1"],
  "School of Management": ["23B1", "24B1"]
};

// Subject list
const SUBJECTS = [
  "JAVA", "DSA", "DBMS", "EXCEL", "JAVASCRIPT", 
  "MASTERCLASS", "PYTHON", "BUSINESS COMMUNICATION", "CRITICAL COMMUNICATION"
];

// Common utility functions
const CommonUtils = {
  // Update batch options based on selected school
  updateBatchOptions: function() {
    const schoolSelect = document.getElementById('school');
    const batchSelect = document.getElementById('batch');
    
    if (!schoolSelect || !batchSelect) return;
    
    const selectedSchool = schoolSelect.value;
    batchSelect.innerHTML = '<option value="">Select Batch</option>';
    
    if (selectedSchool && BATCH_OPTIONS[selectedSchool]) {
      batchSelect.disabled = false;
      BATCH_OPTIONS[selectedSchool].forEach(batch => {
        const option = document.createElement('option');
        option.value = batch;
        option.textContent = batch;
        batchSelect.appendChild(option);
      });
    } else {
      batchSelect.disabled = true;
    }
  },

  // Show notification popup
  showNotification: function(title, message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
      info: 'linear-gradient(135deg, #007bff, #0056b3)',
      success: 'linear-gradient(135deg, #28a745, #20c997)',
      warning: 'linear-gradient(135deg, #ffc107, #e0a800)',
      error: 'linear-gradient(135deg, #dc3545, #c82333)'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
      max-width: 300px;
      font-family: 'Poppins', sans-serif;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 5px;">${title}</div>
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
  },

  // Calculate attendance percentage
  calculatePercentage: function(present, total) {
    return total > 0 ? Math.round((present / total) * 100) : 0;
  },

  // Get attendance color based on percentage
  getAttendanceColor: function(percentage) {
    if (percentage >= 85) return '#28a745';
    if (percentage >= 75) return '#ffc107';
    return '#dc3545';
  },

  // Format date to "DD Mon YYYY" in IST
  formatISTDate: function(date) {
    const d = new Date(date);
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || '';
    const mon = parts.find(p => p.type === 'month')?.value || '';
    const yr = parts.find(p => p.type === 'year')?.value || '';
    return `${day} ${mon} ${yr}`;
  },

  // Format date-time to "DD Mon YYYY, HH:mm" in IST (24-hour)
  formatISTDateTime: function(date) {
    const d = new Date(date);
    const dateStr = CommonUtils.formatISTDate(d);
    const timeParts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);
    const hh = timeParts.find(p => p.type === 'hour')?.value || '';
    const mm = timeParts.find(p => p.type === 'minute')?.value || '';
    return `${dateStr}, ${hh}:${mm}`;
  },

  // Backwards-compatible generic date formatter (kept for legacy usage)
  formatDate: function(date) {
    return CommonUtils.formatISTDate(date);
  },

  // Validate profile data
  validateProfileData: function(profileData) {
    const requiredFields = ['fullName', 'regNumber', 'school', 'batch', 'phone'];
    return requiredFields.every(field => 
      profileData[field] && profileData[field].trim() !== ''
    );
  }
};

// Make functions available globally
window.updateBatchOptions = CommonUtils.updateBatchOptions;
window.formatISTDate = CommonUtils.formatISTDate;
window.formatISTDateTime = CommonUtils.formatISTDateTime;
