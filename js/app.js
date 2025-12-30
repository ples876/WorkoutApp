// Main application initialization
// Entry point for the app

async function initApp() {
  console.log('Initializing Workout App...');

  try {
    // Initialize database
    console.log('Step 1: Initializing database...');
    const dbInitialized = await initDatabase();
    if (!dbInitialized) {
      console.error('Failed to initialize database');
      return;
    }
    console.log('Database initialized');

    // Load initial data into state
    console.log('Step 2: Loading state...');
    await refreshState();
    console.log('State loaded:', state);

    // Setup UI event listeners
    console.log('Step 3: Setting up tab navigation...');
    setupTabNavigation();
    console.log('Tab navigation set up');

    // Initial render
    console.log('Step 4: Initial render...');
    render();
    console.log('Initial render complete');

    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    console.error('Error stack:', error.stack);
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
