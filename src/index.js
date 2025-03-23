// This file serves as the entry point for Vite
// It imports the main.js file which contains the Demo class

// Import the Demo class from main.js
import { Demo } from './main.js';

// Initialize the Demo when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new Demo(document.body);
});
