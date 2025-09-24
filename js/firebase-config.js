/*
==================================================
FIREBASE CONFIGURATION MODULE
==================================================
Author: Attendance Tracker System
Description: Centralized Firebase configuration
Last Updated: 2024
==================================================
*/

// Firebase Configuration - Single source of truth
const firebaseConfig = {
  apiKey: "AIzaSyAJAl0Y-vtu-edqDBiOUWZHLRuPpg2W7AY",
  authDomain: "attendancetracker-f8461.firebaseapp.com",
  projectId: "attendancetracker-f8461",
  storageBucket: "attendancetracker-f8461.appspot.com",
  messagingSenderId: "87952419692",
  appId: "1:87952419692:web:6ca63cb53cc467be972149"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Common utility functions
const FirebaseUtils = {
  // Check if user is authenticated
  isAuthenticated: () => auth.currentUser !== null,
  
  // Get current user
  getCurrentUser: () => auth.currentUser,
  
  // Logout function
  logout: async function() {
    try {
      localStorage.clear();
      sessionStorage.clear();
      await auth.signOut();
      window.location.href = 'index.html';
    } catch (error) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = 'index.html';
    }
  }
};
