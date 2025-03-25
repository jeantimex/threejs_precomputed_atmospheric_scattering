// This file serves as the entry point for the Three.js version
// It imports the main-three.js file which contains the Three.js Demo implementation

// Import the Demo class from main-three.js
import { Demo } from './main-three.js';

// Initialize the Demo when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new Demo(document.body);
});
