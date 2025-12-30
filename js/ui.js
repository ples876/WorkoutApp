// UI rendering functions
// Handles all DOM manipulation and rendering

// ===== TAB NAVIGATION =====

function setupTabNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Update active states
      navButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');

      // Update state
      setCurrentTab(tabName);
    });
  });
}

// ===== EXERCISE RENDERING =====

async function renderExerciseHistory(exerciseId) {
  const container = state.currentTab === 'exercises'
    ? document.getElementById('exercises-content')
    : document.getElementById('workout-content');

  const exercise = state.exercises.find(e => e.id === exerciseId);
  if (!exercise) {
    container.innerHTML = '<p class="empty-state">Exercise not found.</p>';
    return;
  }

  // Get all sets for this exercise
  const allSets = await getExerciseHistory(exerciseId);

  if (allSets.length === 0) {
    container.innerHTML = `
      <div class="exercise-history">
        <div class="history-header">
          <button id="back-from-history-btn" class="btn-back">← Back</button>
          <h2>${exercise.name}</h2>
        </div>
        <p class="empty-state">No workout history yet for this exercise.</p>
      </div>
    `;
    setupHistoryListeners();
    return;
  }

  // Group sets by workout session
  const sessionMap = {};
  for (const set of allSets) {
    if (!sessionMap[set.workoutSessionId]) {
      sessionMap[set.workoutSessionId] = [];
    }
    sessionMap[set.workoutSessionId].push(set);
  }

  // Get session details and build history HTML
  let html = `
    <div class="exercise-history">
      <div class="history-header">
        <button id="back-from-history-btn" class="btn-back">← Back</button>
        <h2>${exercise.name}</h2>
      </div>
  `;

  // Get all sessions and sort by date (newest first)
  const sessionIds = Object.keys(sessionMap).map(id => parseInt(id));
  const sessions = [];

  for (const sessionId of sessionIds) {
    const session = await db.workoutSessions.get(sessionId);
    if (session) {
      const program = await getProgramById(session.programId);
      sessions.push({
        session,
        program,
        sets: sessionMap[sessionId]
      });
    }
  }

  sessions.sort((a, b) => new Date(b.session.date) - new Date(a.session.date));

  // Render each session
  html += '<div class="history-sessions">';
  sessions.forEach(({ session, program, sets }) => {
    const date = new Date(session.date).toLocaleDateString();
    const programName = program ? program.name : 'Unknown Program';
    const workoutNumber = session.workoutNumber;
    const formattedSets = formatLastTime(sets);

    html += `
      <div class="history-session">
        <div class="session-info">
          <h3>${programName} - Workout ${workoutNumber}</h3>
          <p class="session-date">${date}</p>
        </div>
        <div class="session-sets">
          <p>${sets.length} sets @ ${formattedSets}</p>
        </div>
      </div>
    `;
  });
  html += '</div>';

  html += '</div>';
  container.innerHTML = html;
  setupHistoryListeners();
}

async function renderExercises() {
  // Check if viewing history
  if (state.viewingExerciseHistory) {
    await renderExerciseHistory(state.viewingExerciseHistory);
    return;
  }

  const container = document.getElementById('exercises-content');
  const groupedExercises = getExercisesGroupedByMuscleGroup();

  if (state.exercises.length === 0) {
    container.innerHTML = '<p class="empty-state">No exercises found.</p>';
    return;
  }

  let html = '';

  // Render exercises grouped by muscle group
  Object.keys(groupedExercises).sort().forEach(muscleGroup => {
    const exercises = groupedExercises[muscleGroup];
    const groupName = MUSCLE_GROUPS[muscleGroup] || muscleGroup;

    html += `
      <div class="exercise-group">
        <h2 class="muscle-group-title">${groupName}</h2>
        <div class="exercise-list">
    `;

    exercises.forEach(exercise => {
      html += `
        <div class="exercise-item">
          <span class="exercise-name">${exercise.name}</span>
          <div class="exercise-item-actions">
            ${exercise.isCustom ? '<span class="custom-badge">Custom</span>' : ''}
            <button class="btn-view-history" data-exercise-id="${exercise.id}">View History</button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  setupExerciseListeners();
}

// ===== PROGRAM RENDERING =====

// Track current view state
let currentProgramView = 'list'; // 'list', 'create', 'edit', 'detail'
let currentProgramId = null;

function renderPrograms() {
  switch (currentProgramView) {
    case 'list':
      renderProgramList();
      break;
    case 'create':
      renderProgramForm(null);
      break;
    case 'edit':
      renderProgramForm(currentProgramId);
      break;
    case 'detail':
      renderProgramDetail(currentProgramId);
      break;
  }
}

function renderProgramList() {
  const container = document.getElementById('programs-content');

  if (state.programs.length === 0) {
    container.innerHTML = `
      <p class="empty-state">No programs yet. Create your first program!</p>
      <button id="create-program-btn" class="btn-primary">Create Program</button>
    `;
    setupProgramListeners();
    return;
  }

  let html = '<div class="program-list">';

  state.programs.forEach(program => {
    const workoutCount = program.workouts ? program.workouts.length : 0;
    const isActive = program.isActive ? '<span class="active-badge">Active</span>' : '';

    html += `
      <div class="program-item" data-program-id="${program.id}">
        <div class="program-header">
          <h3 class="program-name">${program.name} ${isActive}</h3>
          <p class="program-info">${workoutCount} workout${workoutCount !== 1 ? 's' : ''}</p>
        </div>
        <div class="program-actions">
          ${!program.isActive ? `<button class="btn-primary btn-small start-program-btn" data-program-id="${program.id}">Start</button>` : ''}
          <button class="btn-secondary btn-small view-program-btn" data-program-id="${program.id}">View</button>
          <button class="btn-secondary btn-small edit-program-btn" data-program-id="${program.id}">Edit</button>
          <button class="btn-secondary btn-small delete-program-btn" data-program-id="${program.id}">Delete</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  html += '<button id="create-program-btn" class="btn-primary">Create Program</button>';

  container.innerHTML = html;
  setupProgramListeners();
}

function renderProgramForm(programId) {
  const container = document.getElementById('programs-content');
  const isEdit = programId !== null;
  const program = isEdit ? state.programs.find(p => p.id === programId) : null;

  const programName = program ? program.name : '';
  const workouts = program && program.workouts ? program.workouts : [];

  // Clear workoutData for fresh form
  Object.keys(workoutData).forEach(key => delete workoutData[key]);

  // Initialize workoutData with existing workout data if editing
  if (isEdit && workouts.length > 0) {
    workouts.forEach(workout => {
      workoutData[workout.workoutNumber] = [...workout.exercises];
    });
  }

  let html = `
    <div class="program-form">
      <div class="form-header">
        <button id="back-to-list-btn" class="btn-back">← Back</button>
        <h2>${isEdit ? 'Edit Program' : 'Create Program'}</h2>
      </div>

      <div class="form-group">
        <label for="program-name">Program Name</label>
        <input type="text" id="program-name" class="form-input" placeholder="e.g., Push Pull Legs" value="${programName}" />
      </div>

      <div id="workouts-container">
  `;

  // Render workout configuration (up to 7 workouts)
  for (let i = 1; i <= 7; i++) {
    const workout = workouts.find(w => w.workoutNumber === i);
    const exercises = workout ? workout.exercises : [];

    html += `
      <div class="workout-config" data-workout-number="${i}">
        <h3>Workout ${i}</h3>
        <div class="exercise-selector">
          <select class="exercise-dropdown" data-workout="${i}">
            <option value="">Select exercise</option>
            ${renderExerciseOptions()}
          </select>
          <input type="number" class="sets-input" placeholder="Sets" min="1" max="10" value="3" data-workout="${i}" />
          <button class="btn-add-exercise" data-workout="${i}">Add</button>
        </div>
        <div class="workout-exercises" data-workout="${i}">
          ${renderWorkoutExercises(exercises)}
        </div>
      </div>
    `;
  }

  html += `
      </div>

      <div class="form-actions">
        <button id="cancel-program-btn" class="btn-secondary">Cancel</button>
        <button id="save-program-btn" class="btn-primary">Save Program</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
  setupProgramFormListeners(programId);
}

function renderExerciseOptions() {
  const grouped = getExercisesGroupedByMuscleGroup();
  let html = '';

  Object.keys(grouped).sort().forEach(muscleGroup => {
    html += `<optgroup label="${MUSCLE_GROUPS[muscleGroup]}">`;
    grouped[muscleGroup].forEach(exercise => {
      html += `<option value="${exercise.id}">${exercise.name}</option>`;
    });
    html += `</optgroup>`;
  });

  return html;
}

function renderWorkoutExercises(exercises) {
  if (!exercises || exercises.length === 0) {
    return '<p class="empty-exercises">No exercises added yet</p>';
  }

  let html = '<div class="exercises-list">';
  exercises.forEach((ex, index) => {
    const exercise = state.exercises.find(e => e.id === ex.exerciseId);
    const exerciseName = exercise ? exercise.name : 'Unknown';

    html += `
      <div class="exercise-entry" data-index="${index}">
        <span class="exercise-name">${exerciseName}</span>
        <span class="exercise-sets">${ex.targetSets} sets</span>
        <button class="btn-remove-exercise" data-index="${index}">Remove</button>
      </div>
    `;
  });
  html += '</div>';

  return html;
}

function renderProgramDetail(programId) {
  const container = document.getElementById('programs-content');
  const program = state.programs.find(p => p.id === programId);

  if (!program) {
    currentProgramView = 'list';
    renderProgramList();
    return;
  }

  const workouts = program.workouts || [];

  let html = `
    <div class="program-detail">
      <div class="detail-header">
        <button id="back-to-list-btn" class="btn-back">← Back</button>
        <h2>${program.name}</h2>
        ${program.isActive ? '<span class="active-badge">Active</span>' : ''}
      </div>

      <div class="workouts-detail">
  `;

  if (workouts.length === 0) {
    html += '<p class="empty-state">No workouts configured</p>';
  } else {
    workouts.forEach(workout => {
      html += `
        <div class="workout-detail">
          <h3>Workout ${workout.workoutNumber}</h3>
          <div class="exercises-list">
      `;

      workout.exercises.forEach(ex => {
        const exercise = state.exercises.find(e => e.id === ex.exerciseId);
        const exerciseName = exercise ? exercise.name : 'Unknown';

        html += `
          <div class="exercise-entry">
            <span class="exercise-name">• ${exerciseName}</span>
            <span class="exercise-sets">(${ex.targetSets} sets)</span>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });
  }

  html += `
      </div>

      <div class="detail-actions">
        ${!program.isActive ? `<button id="start-program-detail-btn" class="btn-primary" data-program-id="${program.id}">Start Program</button>` : ''}
        <button id="edit-program-detail-btn" class="btn-secondary" data-program-id="${program.id}">Edit</button>
        <button id="delete-program-detail-btn" class="btn-secondary" data-program-id="${program.id}">Delete</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
  setupProgramDetailListeners(programId);
}

// ===== WORKOUT RENDERING =====

async function renderActiveWorkout() {
  // Check if viewing history from workout tab
  if (state.viewingExerciseHistory && state.historyReturnContext === 'workout') {
    await renderExerciseHistory(state.viewingExerciseHistory);
    return;
  }

  const container = document.getElementById('workout-content');

  if (!state.activeProgram) {
    container.innerHTML = '<p class="empty-state">No active workout. Go to Programs to start a program.</p>';
    return;
  }

  const program = state.activeProgram;
  const currentWorkoutNumber = program.currentWorkout || 1;
  const workout = program.workouts ? program.workouts.find(w => w.workoutNumber === currentWorkoutNumber) : null;

  if (!workout) {
    container.innerHTML = `
      <div class="active-workout">
        <p class="empty-state">No exercises configured for Workout ${currentWorkoutNumber}</p>
        <p><small>Go to Programs to edit "${program.name}"</small></p>
      </div>
    `;
    return;
  }

  // Check if there's an active workout session
  const activeSession = state.activeWorkout;

  if (!activeSession) {
    // No active session - show preview and Start button
    renderWorkoutPreview(container, program, currentWorkoutNumber, workout);
  } else {
    // Active session exists - show logging interface
    await renderWorkoutLogging(container, program, currentWorkoutNumber, workout, activeSession);
  }
}

function renderWorkoutPreview(container, program, workoutNumber, workout) {
  let html = `
    <div class="active-workout">
      <h2>${program.name}</h2>
      <p class="workout-subtitle">Workout ${workoutNumber}</p>

      <div class="workout-exercises-preview">
        <h3>Today's Exercises:</h3>
  `;

  workout.exercises.forEach(ex => {
    const exercise = state.exercises.find(e => e.id === ex.exerciseId);
    const exerciseName = exercise ? exercise.name : 'Unknown';

    html += `
      <div class="exercise-preview">
        <span class="exercise-name">• ${exerciseName}</span>
        <span class="exercise-sets">${ex.targetSets} sets</span>
      </div>
    `;
  });

  html += `
      </div>
      <button id="start-workout-btn" class="btn-primary">Start Workout</button>
    </div>
  `;

  container.innerHTML = html;
  setupWorkoutPreviewListeners();
}

function formatLastTime(sets) {
  // Group sets by weight
  const byWeight = {};
  sets.forEach(set => {
    const key = set.weight;
    if (!byWeight[key]) {
      byWeight[key] = [];
    }
    byWeight[key].push(set.reps);
  });

  // Format each weight group
  const parts = [];
  Object.keys(byWeight).sort((a, b) => parseFloat(b) - parseFloat(a)).forEach(weight => {
    const reps = byWeight[weight];
    const repsText = reps.join(', ');
    parts.push(`${weight}kg × ${repsText} reps`);
  });

  // Join with "and" if multiple weights
  if (parts.length === 1) {
    return parts[0];
  } else {
    return parts.join(' and ');
  }
}

async function renderWorkoutLogging(container, program, workoutNumber, workout, session) {
  // Get all sets logged for this session
  const loggedSets = await getSetsForWorkout(session.id);

  // Get last completed workout for reference
  const lastWorkout = await getLastCompletedWorkout(program.id, workoutNumber);

  let html = `
    <div class="active-workout">
      <h2>${program.name}</h2>
      <p class="workout-subtitle">Workout ${workoutNumber}</p>
  `;

  // Render each exercise
  for (const ex of workout.exercises) {
    const exercise = state.exercises.find(e => e.id === ex.exerciseId);
    const exerciseName = exercise ? exercise.name : 'Unknown';

    // Get sets for this exercise in current session
    const exerciseSets = loggedSets.filter(s => s.exerciseId === ex.exerciseId);

    // Get last time data for this exercise
    const lastTimeSets = lastWorkout ? lastWorkout.sets.filter(s => s.exerciseId === ex.exerciseId) : [];

    html += `
      <div class="exercise-logging" data-exercise-id="${ex.exerciseId}">
        <div class="exercise-header">
          <h3>${exerciseName}</h3>
          <button class="btn-view-history-workout" data-exercise-id="${ex.exerciseId}">History</button>
        </div>
        <p class="exercise-meta">Target: ${ex.targetSets} sets</p>
    `;

    // Show "Last Time" if available
    if (lastTimeSets.length > 0) {
      const lastDate = new Date(lastWorkout.session.date).toLocaleDateString();
      const lastTimeText = formatLastTime(lastTimeSets);
      html += `<p class="last-time">Last time: ${lastTimeSets.length} sets @ ${lastTimeText} (${lastDate})</p>`;
    }

    // Input row
    html += `
        <div class="set-input-row">
          <input type="number" class="weight-input" placeholder="Weight (kg)" step="0.5" min="0" data-exercise-id="${ex.exerciseId}" />
          <input type="number" class="reps-input" placeholder="Reps" min="1" data-exercise-id="${ex.exerciseId}" />
          <button class="btn-log-set" data-exercise-id="${ex.exerciseId}">Log Set</button>
        </div>
    `;

    // Logged sets
    html += '<div class="logged-sets">';
    if (exerciseSets.length === 0) {
      html += '<p class="no-sets">No sets logged yet</p>';
    } else {
      exerciseSets.forEach((set, index) => {
        html += `
          <div class="logged-set" data-set-id="${set.id}">
            <span class="set-number">Set ${index + 1}:</span>
            <span class="set-data">${set.weight}kg × ${set.reps} reps</span>
            <div class="set-actions">
              <button class="btn-edit-set" data-set-id="${set.id}" data-weight="${set.weight}" data-reps="${set.reps}" data-exercise-id="${ex.exerciseId}">Edit</button>
              <button class="btn-delete-set" data-set-id="${set.id}">Delete</button>
            </div>
          </div>
        `;
      });
    }
    html += '</div>'; // logged-sets
    html += '</div>'; // exercise-logging
  }

  // Action buttons
  html += `
      <div class="workout-actions">
        <button id="finish-workout-btn" class="btn-primary">Finish Workout</button>
        <button id="cancel-workout-btn" class="btn-secondary">Cancel Workout</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
  setupWorkoutLoggingListeners(session.id);
}

// ===== EVENT LISTENERS =====

function setupProgramListeners() {
  const createBtn = document.getElementById('create-program-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      currentProgramView = 'create';
      currentProgramId = null;
      renderPrograms();
    });
  }

  // View buttons
  document.querySelectorAll('.view-program-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentProgramId = parseInt(btn.dataset.programId);
      currentProgramView = 'detail';
      renderPrograms();
    });
  });

  // Edit buttons
  document.querySelectorAll('.edit-program-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentProgramId = parseInt(btn.dataset.programId);
      currentProgramView = 'edit';
      renderPrograms();
    });
  });

  // Delete buttons
  document.querySelectorAll('.delete-program-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const programId = parseInt(btn.dataset.programId);
      if (confirm('Are you sure you want to delete this program?')) {
        await deleteProgram(programId);
        await loadPrograms();
      }
    });
  });

  // Start buttons
  document.querySelectorAll('.start-program-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const programId = parseInt(btn.dataset.programId);
      await handleStartProgram(programId);
    });
  });
}

function setupProgramFormListeners(programId) {
  const backBtn = document.getElementById('back-to-list-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      currentProgramView = 'list';
      currentProgramId = null;
      renderPrograms();
    });
  }

  const cancelBtn = document.getElementById('cancel-program-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      currentProgramView = 'list';
      currentProgramId = null;
      renderPrograms();
    });
  }

  const saveBtn = document.getElementById('save-program-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => handleSaveProgram(programId));
  }

  // Add exercise buttons
  document.querySelectorAll('.btn-add-exercise').forEach(btn => {
    btn.addEventListener('click', () => {
      const workoutNumber = parseInt(btn.dataset.workout);
      handleAddExerciseToWorkout(workoutNumber);
    });
  });

  // Remove exercise buttons (use event delegation)
  document.querySelectorAll('.workout-exercises').forEach(container => {
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-exercise')) {
        const workoutNumber = parseInt(container.dataset.workout);
        const index = parseInt(e.target.dataset.index);
        handleRemoveExerciseFromWorkout(workoutNumber, index);
      }
    });
  });
}

function setupProgramDetailListeners(programId) {
  const backBtn = document.getElementById('back-to-list-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      currentProgramView = 'list';
      currentProgramId = null;
      renderPrograms();
    });
  }

  const startBtn = document.getElementById('start-program-detail-btn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      await handleStartProgram(programId);
    });
  }

  const editBtn = document.getElementById('edit-program-detail-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      currentProgramView = 'edit';
      renderPrograms();
    });
  }

  const deleteBtn = document.getElementById('delete-program-detail-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this program?')) {
        await deleteProgram(programId);
        await loadPrograms();
        currentProgramView = 'list';
        currentProgramId = null;
      }
    });
  }
}

// ===== WORKOUT EVENT LISTENERS =====

function setupWorkoutPreviewListeners() {
  const startBtn = document.getElementById('start-workout-btn');
  if (startBtn) {
    startBtn.addEventListener('click', handleStartWorkout);
  }
}

function setupWorkoutLoggingListeners(sessionId) {
  // Log Set buttons
  document.querySelectorAll('.btn-log-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const exerciseId = parseInt(btn.dataset.exerciseId);
      handleLogSet(sessionId, exerciseId);
    });
  });

  // Edit Set buttons
  document.querySelectorAll('.btn-edit-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const setId = parseInt(btn.dataset.setId);
      const weight = parseFloat(btn.dataset.weight);
      const reps = parseInt(btn.dataset.reps);
      const exerciseId = parseInt(btn.dataset.exerciseId);
      handleEditSet(setId, weight, reps, exerciseId);
    });
  });

  // Delete Set buttons
  document.querySelectorAll('.btn-delete-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const setId = parseInt(btn.dataset.setId);
      handleDeleteSet(setId);
    });
  });

  // View History buttons (from workout)
  document.querySelectorAll('.btn-view-history-workout').forEach(btn => {
    btn.addEventListener('click', () => {
      const exerciseId = parseInt(btn.dataset.exerciseId);
      viewExerciseHistory(exerciseId, 'workout');
    });
  });

  // Finish Workout button
  const finishBtn = document.getElementById('finish-workout-btn');
  if (finishBtn) {
    finishBtn.addEventListener('click', () => handleFinishWorkout(sessionId));
  }

  // Cancel Workout button
  const cancelBtn = document.getElementById('cancel-workout-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => handleCancelWorkout(sessionId));
  }
}

function setupExerciseListeners() {
  // View History buttons (from exercises tab)
  document.querySelectorAll('.btn-view-history').forEach(btn => {
    btn.addEventListener('click', () => {
      const exerciseId = parseInt(btn.dataset.exerciseId);
      viewExerciseHistory(exerciseId, 'exercises');
    });
  });
}

function setupHistoryListeners() {
  // Back button from history
  const backBtn = document.getElementById('back-from-history-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      exitExerciseHistory();
    });
  }
}

// ===== WORKOUT ACTION HANDLERS =====

async function handleStartWorkout() {
  const program = state.activeProgram;
  const workoutNumber = program.currentWorkout || 1;

  try {
    const sessionId = await createWorkoutSession(program.id, workoutNumber);
    await loadActiveWorkout();
    console.log('Workout session created:', sessionId);
  } catch (error) {
    console.error('Failed to start workout:', error);
    alert('Failed to start workout. Please try again.');
  }
}

async function handleLogSet(sessionId, exerciseId) {
  const weightInput = document.querySelector(`.weight-input[data-exercise-id="${exerciseId}"]`);
  const repsInput = document.querySelector(`.reps-input[data-exercise-id="${exerciseId}"]`);

  const weight = parseFloat(weightInput.value);
  const reps = parseInt(repsInput.value);

  if (!weight || weight <= 0 || !reps || reps <= 0) {
    alert('Please enter valid weight and reps');
    return;
  }

  try {
    await logSet(sessionId, exerciseId, weight, reps);

    // Clear inputs
    weightInput.value = '';
    repsInput.value = '';

    // Re-render to show new set
    await renderActiveWorkout();
  } catch (error) {
    console.error('Failed to log set:', error);
    alert('Failed to log set. Please try again.');
  }
}

async function handleEditSet(setId, currentWeight, currentReps, exerciseId) {
  // Populate inputs with current values
  const weightInput = document.querySelector(`.weight-input[data-exercise-id="${exerciseId}"]`);
  const repsInput = document.querySelector(`.reps-input[data-exercise-id="${exerciseId}"]`);

  weightInput.value = currentWeight;
  repsInput.value = currentReps;

  // Delete the old set
  await deleteSet(setId);

  // Re-render
  await renderActiveWorkout();

  // Focus on weight input
  weightInput.focus();
}

async function handleDeleteSet(setId) {
  if (!confirm('Delete this set?')) {
    return;
  }

  try {
    await deleteSet(setId);
    await renderActiveWorkout();
  } catch (error) {
    console.error('Failed to delete set:', error);
    alert('Failed to delete set. Please try again.');
  }
}

async function handleFinishWorkout(sessionId) {
  try {
    // Mark session as complete
    await completeWorkoutSession(sessionId);

    // Advance to next workout
    await advanceWorkout(state.activeProgram.id);

    // Reload state
    await loadActiveWorkout();
    await loadActiveProgram();

    alert('Workout completed! Great job!');
  } catch (error) {
    console.error('Failed to finish workout:', error);
    alert('Failed to finish workout. Please try again.');
  }
}

async function handleCancelWorkout(sessionId) {
  if (!confirm('Cancel this workout? All logged sets will be deleted.')) {
    return;
  }

  try {
    // Delete session and all sets
    await deleteWorkoutSession(sessionId);

    // Reload state
    await loadActiveWorkout();

    alert('Workout cancelled.');
  } catch (error) {
    console.error('Failed to cancel workout:', error);
    alert('Failed to cancel workout. Please try again.');
  }
}

// ===== PROGRAM ACTION HANDLERS =====

async function handleStartProgram(programId) {
  // Check if another program is active
  if (state.activeProgram && state.activeProgram.id !== programId) {
    const currentProgramName = state.activeProgram.name;
    const newProgram = state.programs.find(p => p.id === programId);
    const newProgramName = newProgram ? newProgram.name : 'this program';

    if (!confirm(`You're currently following "${currentProgramName}". Switch to "${newProgramName}"?`)) {
      return;
    }
  }

  await setActiveProgram(programId);
  await loadActiveProgram();
  await loadPrograms(); // Reload programs list to update Active badge

  alert('Program started! Go to the Workout tab to begin your first workout.');
}

async function handleSaveProgram(programId) {
  const nameInput = document.getElementById('program-name');
  const name = nameInput.value.trim();

  if (!name) {
    alert('Please enter a program name');
    return;
  }

  // Collect workouts data
  const workouts = [];

  for (let i = 1; i <= 7; i++) {
    const container = document.querySelector(`.workout-exercises[data-workout="${i}"]`);
    if (!container) continue;

    const exerciseEntries = container.querySelectorAll('.exercise-entry');
    if (exerciseEntries.length === 0) continue;

    const exercises = [];
    exerciseEntries.forEach(entry => {
      // Find exercise ID from the rendered name
      const exerciseName = entry.querySelector('.exercise-name').textContent;
      const exercise = state.exercises.find(e => e.name === exerciseName);

      if (exercise) {
        exercises.push({
          exerciseId: exercise.id,
          targetSets: parseInt(entry.querySelector('.exercise-sets').textContent.split(' ')[0])
        });
      }
    });

    if (exercises.length > 0) {
      workouts.push({
        workoutNumber: i,
        exercises
      });
    }
  }

  const programData = {
    name,
    workouts,
    isActive: false,
    currentWorkout: 1
  };

  try {
    if (programId) {
      // Edit existing
      await updateProgram(programId, programData);
    } else {
      // Create new
      await createProgram(programData);
    }

    await loadPrograms();
    currentProgramView = 'list';
    currentProgramId = null;
  } catch (error) {
    console.error('Failed to save program:', error);
    alert('Failed to save program. Please try again.');
  }
}

// Track workout data while building the form
const workoutData = {};

function handleAddExerciseToWorkout(workoutNumber) {
  const dropdown = document.querySelector(`.exercise-dropdown[data-workout="${workoutNumber}"]`);
  const setsInput = document.querySelector(`.sets-input[data-workout="${workoutNumber}"]`);

  const exerciseId = parseInt(dropdown.value);
  const targetSets = parseInt(setsInput.value);

  if (!exerciseId || !targetSets || targetSets < 1) {
    alert('Please select an exercise and enter number of sets');
    return;
  }

  // Initialize workout data if needed
  if (!workoutData[workoutNumber]) {
    workoutData[workoutNumber] = [];
  }

  // Add exercise to workout
  workoutData[workoutNumber].push({ exerciseId, targetSets });

  // Re-render just this workout's exercises
  const container = document.querySelector(`.workout-exercises[data-workout="${workoutNumber}"]`);
  container.innerHTML = renderWorkoutExercises(workoutData[workoutNumber]);

  // Reset inputs
  dropdown.value = '';
  setsInput.value = '3';

  // Re-attach listeners for remove buttons
  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-exercise')) {
      const index = parseInt(e.target.dataset.index);
      handleRemoveExerciseFromWorkout(workoutNumber, index);
    }
  });
}

function handleRemoveExerciseFromWorkout(workoutNumber, index) {
  if (!workoutData[workoutNumber]) return;

  workoutData[workoutNumber].splice(index, 1);

  // Re-render
  const container = document.querySelector(`.workout-exercises[data-workout="${workoutNumber}"]`);
  container.innerHTML = renderWorkoutExercises(workoutData[workoutNumber]);
}

// ===== MAIN RENDER FUNCTION =====

function render() {
  // Re-render based on current tab
  switch (state.currentTab) {
    case 'workout':
      renderActiveWorkout();
      break;
    case 'programs':
      renderPrograms();
      break;
    case 'exercises':
      renderExercises();
      break;
  }
}

// Subscribe to state changes to trigger re-render (but not on initial load)
subscribe(() => {
  // Small delay to ensure DOM is ready
  setTimeout(render, 0);
});
