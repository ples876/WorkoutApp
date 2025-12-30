// Global state management
// Simple state object with event listeners for updates

const state = {
  currentTab: 'workout',
  exercises: [],
  programs: [],
  activeProgram: null,
  activeWorkout: null,
  viewingExerciseHistory: null, // exercise ID when viewing history
  historyReturnContext: null, // 'exercises' or 'workout' - where to return after viewing history
  listeners: []
};

// Subscribe to state changes
function subscribe(listener) {
  state.listeners.push(listener);
}

// Notify all listeners of state changes
function notifyListeners() {
  state.listeners.forEach(listener => listener(state));
}

// Update current tab
function setCurrentTab(tab) {
  state.currentTab = tab;
  notifyListeners();
}

// Load exercises into state
async function loadExercises() {
  state.exercises = await getAllExercises();
  notifyListeners();
}

// Load programs into state
async function loadPrograms() {
  state.programs = await getAllPrograms();
  notifyListeners();
}

// Load active program into state
async function loadActiveProgram() {
  state.activeProgram = await getActiveProgram();
  notifyListeners();
}

// Load active workout into state
async function loadActiveWorkout() {
  state.activeWorkout = await getActiveWorkoutSession();
  notifyListeners();
}

// Refresh all data from database
async function refreshState() {
  await loadExercises();
  await loadPrograms();
  await loadActiveProgram();
  await loadActiveWorkout();
}

// Get exercises grouped by muscle group
function getExercisesGroupedByMuscleGroup() {
  const grouped = {};

  state.exercises.forEach(exercise => {
    if (!grouped[exercise.muscleGroup]) {
      grouped[exercise.muscleGroup] = [];
    }
    grouped[exercise.muscleGroup].push(exercise);
  });

  return grouped;
}

// View exercise history
function viewExerciseHistory(exerciseId, returnContext) {
  state.viewingExerciseHistory = exerciseId;
  state.historyReturnContext = returnContext;
  notifyListeners();
}

// Return from exercise history
function exitExerciseHistory() {
  state.viewingExerciseHistory = null;
  state.historyReturnContext = null;
  notifyListeners();
}
