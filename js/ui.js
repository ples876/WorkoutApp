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

// ===== PR CALCULATION =====

function calcE1RM(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  return weight / Math.max(0.03, 1.0278 - 0.0278 * reps);
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

  // Flag PR sessions (walk oldest→newest, track running best e1RM)
  let runningBest = 0;
  for (const s of [...sessions].reverse()) {
    s.bestE1RM = Math.max(0, ...s.sets.map(set => calcE1RM(set.weight, set.reps)));
    s.isPR = s.bestE1RM > runningBest;
    if (s.isPR) runningBest = s.bestE1RM;
  }
  const allTimeBest = runningBest;

  // Build history HTML
  let html = `
    <div class="exercise-history">
      <div class="history-header">
        <button id="back-from-history-btn" class="btn-back">← Back</button>
        <h2>${exercise.name}${allTimeBest > 0 ? ` <span class="pr-e1rm">est. 1RM: ${Math.round(allTimeBest)}kg</span>` : ''}</h2>
      </div>
  `;

  // Render each session
  html += '<div class="history-sessions">';
  sessions.forEach(({ session, program, sets, isPR }) => {
    const date = new Date(session.date).toLocaleDateString();
    const programName = program ? program.name : 'Unknown Program';
    const workoutNumber = session.workoutNumber;
    const formattedSets = formatLastTime(sets);

    html += `
      <div class="history-session">
        <div class="session-info">
          <h3>${programName} - Workout ${workoutNumber}${isPR ? ' <span class="pr-badge">PR</span>' : ''}</h3>
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

  // Check if creating custom exercise
  if (state.creatingCustomExercise) {
    renderCustomExerciseForm();
    return;
  }

  const container = document.getElementById('exercises-content');
  const groupedExercises = getExercisesGroupedByMuscleGroup();

  if (state.exercises.length === 0) {
    container.innerHTML = '<p class="empty-state">No exercises found.</p>';
    return;
  }

  let html = `
    <div class="exercises-header">
      <button id="create-custom-exercise-btn" class="btn-primary">Create Custom Exercise</button>
    </div>
  `;

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
      const notes = exercise.notes || '';
      html += `
        <div class="exercise-item-wrapper">
          <textarea
            class="exercise-notes"
            data-exercise-id="${exercise.id}"
            placeholder="Note..."
            rows="1"
          >${notes}</textarea>
          <div class="exercise-item">
            <span class="exercise-name ${exercise.isCustom ? 'custom-exercise' : ''}">${exercise.name}</span>
            <div class="exercise-item-actions">
              ${exercise.isCustom ? `<button class="btn-delete-exercise" data-exercise-id="${exercise.id}">Delete</button>` : ''}
              <button class="btn-view-history" data-exercise-id="${exercise.id}">History</button>
            </div>
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

function renderCustomExerciseForm() {
  const container = document.getElementById('exercises-content');

  let html = `
    <div class="custom-exercise-form">
      <div class="form-header">
        <button id="back-from-custom-exercise-btn" class="btn-back">← Back</button>
        <h2>Create Custom Exercise</h2>
      </div>

      <form id="custom-exercise-form">
        <div class="form-group">
          <label for="exercise-name">Exercise Name</label>
          <input type="text" id="exercise-name" name="name" required placeholder="e.g., Cable Fly">
        </div>

        <div class="form-group">
          <label for="muscle-group">Muscle Group</label>
          <select id="muscle-group" name="muscleGroup" required>
            <option value="">Select muscle group...</option>
  `;

  Object.keys(MUSCLE_GROUPS).forEach(key => {
    html += `<option value="${key}">${MUSCLE_GROUPS[key]}</option>`;
  });

  html += `
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-primary">Create Exercise</button>
          <button type="button" id="cancel-custom-exercise-btn" class="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  `;

  container.innerHTML = html;
  setupCustomExerciseFormListeners();
}

// ===== PROGRAM RENDERING =====

// Track current view state
let currentProgramView = 'list'; // 'list', 'create', 'edit', 'detail'
let currentProgramId = null;
let copySourceProgramId = null; // when creating a copy, the program to pre-fill from

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
          <button class="btn-secondary btn-small copy-program-btn" data-program-id="${program.id}">Copy</button>
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

  // When creating a copy, pre-fill the form from the source program
  const source = (!isEdit && copySourceProgramId != null)
    ? state.programs.find(p => p.id === copySourceProgramId)
    : null;
  const isCopy = source != null;
  const base = program || source;

  const programName = isEdit ? program.name : (source ? `Copy of ${source.name}` : '');
  const workouts = base && base.workouts ? base.workouts : [];

  // Clear workoutData for fresh form
  Object.keys(workoutData).forEach(key => delete workoutData[key]);

  // Initialize workoutData with existing workout data (when editing or copying)
  if (workouts.length > 0) {
    workouts.forEach(workout => {
      workoutData[workout.workoutNumber] = [...workout.exercises];
    });
  }

  let html = `
    <div class="program-form">
      <div class="form-header">
        <button id="back-to-list-btn" class="btn-back">← Back</button>
        <h2>${isEdit ? 'Edit Program' : (isCopy ? 'Copy Program' : 'Create Program')}</h2>
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
    const isFirst = index === 0;
    const isLast = index === exercises.length - 1;

    html += `
      <div class="exercise-entry" data-index="${index}">
        <div class="exercise-entry-info">
          <span class="exercise-name editable-field" title="Tap to change exercise">${exerciseName}</span>
          <span class="exercise-sets editable-field" title="Tap to change sets">${ex.targetSets} sets</span>
        </div>
        <div class="exercise-entry-actions">
          <button class="btn-move-exercise" data-index="${index}" data-direction="up" ${isFirst ? 'disabled' : ''}>↑</button>
          <button class="btn-move-exercise" data-index="${index}" data-direction="down" ${isLast ? 'disabled' : ''}>↓</button>
          <button class="btn-remove-exercise" data-index="${index}">Remove</button>
        </div>
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
    await renderWorkoutPreview(container, program, currentWorkoutNumber, workout);
  } else {
    // Active session exists - show logging interface
    await renderWorkoutLogging(container, program, currentWorkoutNumber, workout, activeSession);
  }
}

// Highest workout number in a program. Used for the "Workout X of Y" label:
// workout numbers are stable slot ids and can have gaps, so the count would
// read wrong (e.g. "Workout 3 of 2") for a program whose workouts are [1, 3].
function getLastWorkoutNumber(program) {
  const numbers = getWorkoutNumbers(program);
  return numbers.length > 0 ? numbers[numbers.length - 1] : 0;
}

async function renderWorkoutPreview(container, program, workoutNumber, workout) {
  const totalWorkouts = getLastWorkoutNumber(program);
  const currentCycle = (program.completedCycles || 0) + 1;
  const lastCompleted = await getLastCompletedSession(program.id);

  let html = `
    <div class="active-workout">
      <h2>${program.name}</h2>
      <p class="workout-subtitle">Cycle ${currentCycle} • Workout ${workoutNumber} of ${totalWorkouts}</p>

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
  `;

  if (lastCompleted) {
    html += `
      <button id="reopen-workout-btn" class="btn-link-rewind" data-workout-number="${lastCompleted.workoutNumber}">↩ Reopen previous workout (Workout ${lastCompleted.workoutNumber})</button>
    `;
  }

  html += `
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
    parts.push(`${weight}x${reps.join(',')}`);
  });

  return parts.join(' and ');
}

async function renderWorkoutLogging(container, program, workoutNumber, workout, session) {
  // Get all sets logged for this session
  const loggedSets = await getSetsForWorkout(session.id);

  // Get last completed workout for reference
  const lastWorkout = await getLastCompletedWorkout(program.id, workoutNumber);

  const totalWorkouts = getLastWorkoutNumber(program);
  const currentCycle = (program.completedCycles || 0) + 1;

  let html = `
    <div class="active-workout">
      <h2>${program.name}</h2>
      <p class="workout-subtitle">Cycle ${currentCycle} • Workout ${workoutNumber} of ${totalWorkouts}</p>
  `;

  // Render each exercise
  for (const ex of workout.exercises) {
    const exercise = state.exercises.find(e => e.id === ex.exerciseId);
    const exerciseName = exercise ? exercise.name : 'Unknown';

    // Get sets for this exercise in current session
    const exerciseSets = loggedSets.filter(s => s.exerciseId === ex.exerciseId);

    // Get last time data for this exercise
    const lastTimeSets = lastWorkout ? lastWorkout.sets.filter(s => s.exerciseId === ex.exerciseId) : [];

    const exerciseNotes = exercise ? (exercise.notes || '') : '';

    html += `
      <div class="exercise-logging" data-exercise-id="${ex.exerciseId}">
        <div class="exercise-header">
          <h3>${exerciseName}</h3>
          <div class="exercise-header-actions">
            <button class="btn-toggle-notes${exerciseNotes ? ' has-note' : ''}" data-exercise-id="${ex.exerciseId}">Note <svg class="toggle-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
            <button class="btn-view-history-workout" data-exercise-id="${ex.exerciseId}">History</button>
            <button class="btn-collapse-exercise" data-exercise-id="${ex.exerciseId}" title="Minimise exercise"><svg class="collapse-check" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg></button>
          </div>
        </div>
        <textarea
          class="exercise-notes workout-notes"
          data-exercise-id="${ex.exerciseId}"
          placeholder="Note..."
          rows="1"
          style="display: none;"
        >${exerciseNotes}</textarea>
        <p class="exercise-meta">Target: ${ex.targetSets} sets</p>
    `;

    // Show "Last Time" if available
    if (lastTimeSets.length > 0) {
      const lastTimeText = formatLastTime(lastTimeSets);
      html += `<p class="last-time">Last time: ${lastTimeSets.length} sets (${lastTimeText})</p>`;
    }

    // Input row
    html += `
        <div class="set-input-row">
          <input type="number" class="weight-input" placeholder="Weight" step="0.5" min="0" data-exercise-id="${ex.exerciseId}" />
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
      copySourceProgramId = null;
      renderPrograms();
    });
  }

  // Copy buttons - open the create form pre-filled from an existing program
  document.querySelectorAll('.copy-program-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      copySourceProgramId = parseInt(btn.dataset.programId);
      currentProgramId = null;
      currentProgramView = 'create';
      renderPrograms();
    });
  });

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
    btn.addEventListener('click', async () => {
      const programId = parseInt(btn.dataset.programId);
      if (!await canEditProgram(programId)) return;
      currentProgramId = programId;
      currentProgramView = 'edit';
      copySourceProgramId = null;
      renderPrograms();
    });
  });

  // Delete buttons
  document.querySelectorAll('.delete-program-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const programId = parseInt(btn.dataset.programId);
      const ok = await showConfirmModal({
        title: 'Delete program?',
        message: 'This program will be permanently deleted.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (ok) {
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
      copySourceProgramId = null;
      renderPrograms();
    });
  }

  const cancelBtn = document.getElementById('cancel-program-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      currentProgramView = 'list';
      currentProgramId = null;
      copySourceProgramId = null;
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

  // Remove/move buttons and inline editing (use event delegation)
  document.querySelectorAll('.workout-exercises').forEach(container => {
    const entryIndex = (target) => {
      const entry = target.closest('.exercise-entry');
      return entry ? parseInt(entry.dataset.index) : -1;
    };

    container.addEventListener('click', (e) => {
      const workoutNumber = parseInt(container.dataset.workout);

      if (e.target.classList.contains('btn-remove-exercise')) {
        const index = parseInt(e.target.dataset.index);
        handleRemoveExerciseFromWorkout(workoutNumber, index);
      } else if (e.target.classList.contains('btn-move-exercise')) {
        const index = parseInt(e.target.dataset.index);
        const direction = e.target.dataset.direction;
        handleMoveExercise(workoutNumber, index, direction);
      } else if (e.target.classList.contains('exercise-name')) {
        const index = entryIndex(e.target);
        if (index > -1) startEditExerciseName(workoutNumber, index);
      } else if (e.target.classList.contains('exercise-sets')) {
        const index = entryIndex(e.target);
        if (index > -1) startEditExerciseSets(workoutNumber, index);
      }
    });

    // Commit an inline edit. change bubbles (blur does not), so delegate it.
    container.addEventListener('change', (e) => {
      const workoutNumber = parseInt(container.dataset.workout);
      const index = entryIndex(e.target);
      if (index === -1 || !workoutData[workoutNumber] || !workoutData[workoutNumber][index]) return;

      if (e.target.classList.contains('inline-exercise-select')) {
        const exerciseId = parseInt(e.target.value);
        if (exerciseId) workoutData[workoutNumber][index].exerciseId = exerciseId;
        rerenderWorkoutExercises(workoutNumber);
      } else if (e.target.classList.contains('inline-sets-input')) {
        const targetSets = parseInt(e.target.value);
        if (targetSets >= 1 && targetSets <= 10) workoutData[workoutNumber][index].targetSets = targetSets;
        rerenderWorkoutExercises(workoutNumber);
      }
    });

    // Leaving an editor without committing restores the plain label
    container.addEventListener('focusout', (e) => {
      if (!e.target.isConnected) return; // already replaced by the change handler
      if (e.target.classList.contains('inline-exercise-select') ||
          e.target.classList.contains('inline-sets-input')) {
        rerenderWorkoutExercises(parseInt(container.dataset.workout));
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
    editBtn.addEventListener('click', async () => {
      if (!await canEditProgram(programId)) return;
      currentProgramView = 'edit';
      renderPrograms();
    });
  }

  const deleteBtn = document.getElementById('delete-program-detail-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ok = await showConfirmModal({
        title: 'Delete program?',
        message: 'This program will be permanently deleted.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (ok) {
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

  const reopenBtn = document.getElementById('reopen-workout-btn');
  if (reopenBtn) {
    reopenBtn.addEventListener('click', handleReopenLastWorkout);
  }
}

function setupWorkoutLoggingListeners(sessionId) {
  // Exercise notes textareas in workout
  document.querySelectorAll('.workout-notes').forEach(textarea => {
    // Save on blur (when user clicks away)
    textarea.addEventListener('blur', async () => {
      const exerciseId = parseInt(textarea.dataset.exerciseId);
      const notes = textarea.value;
      await handleUpdateExerciseNotes(exerciseId, notes);
      const btn = document.querySelector(`.btn-toggle-notes[data-exercise-id="${exerciseId}"]`);
      if (btn) btn.classList.toggle('has-note', notes.trim().length > 0);
    });

    // Auto-resize textarea based on content
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
  });

  // Toggle notes buttons
  document.querySelectorAll('.btn-toggle-notes').forEach(btn => {
    btn.addEventListener('click', () => {
      const exerciseId = btn.dataset.exerciseId;
      const textarea = document.querySelector(`.workout-notes[data-exercise-id="${exerciseId}"]`);
      if (textarea) {
        const isHidden = textarea.style.display === 'none';
        textarea.style.display = isHidden ? '' : 'none';
        btn.classList.toggle('active', isHidden);
        if (isHidden) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
      }
    });
  });

  // Collapse exercise buttons
  const storageKey = `minimised_${sessionId}`;
  document.querySelectorAll('.btn-collapse-exercise').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('.exercise-logging');
      const minimised = container.classList.toggle('minimised');
      btn.classList.toggle('minimised', minimised);
      const noteBtn = container.querySelector('.btn-toggle-notes');
      if (noteBtn) noteBtn.disabled = minimised;

      const exerciseId = btn.dataset.exerciseId;
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
      if (minimised) {
        if (!stored.includes(exerciseId)) stored.push(exerciseId);
      } else {
        const idx = stored.indexOf(exerciseId);
        if (idx > -1) stored.splice(idx, 1);
      }
      sessionStorage.setItem(storageKey, JSON.stringify(stored));
    });
  });

  // Restore minimised state after refresh
  const minimisedIds = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
  minimisedIds.forEach(exerciseId => {
    const container = document.querySelector(`.exercise-logging[data-exercise-id="${exerciseId}"]`);
    if (!container) return;
    container.classList.add('minimised');
    const collapseBtn = container.querySelector('.btn-collapse-exercise');
    if (collapseBtn) collapseBtn.classList.add('minimised');
    const noteBtn = container.querySelector('.btn-toggle-notes');
    if (noteBtn) noteBtn.disabled = true;
  });

  // Log Set buttons
  document.querySelectorAll('.btn-log-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const exerciseId = parseInt(btn.dataset.exerciseId);
      handleLogSet(sessionId, exerciseId);
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
    finishBtn.addEventListener('click', () => showFinishWorkoutModal(sessionId));
  }

  // Cancel Workout button
  const cancelBtn = document.getElementById('cancel-workout-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => handleCancelWorkout(sessionId));
  }
}

function setupExerciseListeners() {
  // Create Custom Exercise button
  const createBtn = document.getElementById('create-custom-exercise-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      showCustomExerciseForm();
    });
  }

  // Exercise notes textareas
  document.querySelectorAll('.exercise-notes').forEach(textarea => {
    // Save on blur (when user clicks away)
    textarea.addEventListener('blur', async () => {
      const exerciseId = parseInt(textarea.dataset.exerciseId);
      const notes = textarea.value;
      await handleUpdateExerciseNotes(exerciseId, notes);
    });

    // Auto-resize textarea based on content
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });

    // Initial resize
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  // View History buttons (from exercises tab)
  document.querySelectorAll('.btn-view-history').forEach(btn => {
    btn.addEventListener('click', () => {
      const exerciseId = parseInt(btn.dataset.exerciseId);
      viewExerciseHistory(exerciseId, 'exercises');
    });
  });

  // Delete Exercise buttons
  document.querySelectorAll('.btn-delete-exercise').forEach(btn => {
    btn.addEventListener('click', async () => {
      const exerciseId = parseInt(btn.dataset.exerciseId);
      await handleDeleteExercise(exerciseId);
    });
  });
}

function setupCustomExerciseFormListeners() {
  // Form submission
  const form = document.getElementById('custom-exercise-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCreateCustomExercise(e);
    });
  }

  // Back button
  const backBtn = document.getElementById('back-from-custom-exercise-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      hideCustomExerciseForm();
    });
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancel-custom-exercise-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      hideCustomExerciseForm();
    });
  }
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

function setupSettingsListeners() {
  // Dark mode toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', handleDarkModeToggle);
  }

  // Export data button
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExportData);
  }

  // Import data button
  const importBtn = document.getElementById('import-data-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
  }

  // File input change
  const fileInput = document.getElementById('import-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleImportData);
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

async function handleReopenLastWorkout() {
  const program = state.activeProgram;
  if (!program) return;

  const last = await getLastCompletedSession(program.id);
  if (!last) return;

  const ok = await showConfirmModal({
    title: `Reopen Workout ${last.workoutNumber}?`,
    message: 'Your logged sets will be restored so you can edit or finish it again.',
    confirmLabel: 'Reopen',
  });
  if (!ok) return;

  try {
    await reopenLastWorkout(program.id);
    // Reload pointer + active session so the logging screen reappears
    await loadActiveProgram();
    await loadActiveWorkout();
  } catch (error) {
    console.error('Failed to reopen workout:', error);
    alert('Failed to reopen workout. Please try again.');
  }
}

async function handleLogSet(sessionId, exerciseId) {
  const weightInput = document.querySelector(`.weight-input[data-exercise-id="${exerciseId}"]`);
  const repsInput = document.querySelector(`.reps-input[data-exercise-id="${exerciseId}"]`);

  const weight = parseFloat(weightInput.value);
  const reps = parseInt(repsInput.value);

  if (isNaN(weight) || weight < 0 || !reps || reps <= 0) {
    alert('Please enter valid weight and reps');
    return;
  }

  try {
    await logSet(sessionId, exerciseId, weight, reps);

    // Keep the weight, clear only reps
    repsInput.value = '';

    // Re-render to show new set
    await renderActiveWorkout();

    // After re-render, restore the weight value and focus on reps
    setTimeout(() => {
      const newWeightInput = document.querySelector(`.weight-input[data-exercise-id="${exerciseId}"]`);
      const newRepsInput = document.querySelector(`.reps-input[data-exercise-id="${exerciseId}"]`);
      if (newWeightInput) {
        newWeightInput.value = weight;
      }
      if (newRepsInput) {
        newRepsInput.focus();
      }
    }, 0);
  } catch (error) {
    console.error('Failed to log set:', error);
    alert('Failed to log set. Please try again.');
  }
}

async function handleDeleteSet(setId) {
  const ok = await showConfirmModal({
    title: 'Delete set?',
    message: 'This logged set will be removed.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;

  try {
    await deleteSet(setId);
    await renderActiveWorkout();
  } catch (error) {
    console.error('Failed to delete set:', error);
    alert('Failed to delete set. Please try again.');
  }
}

async function handleCreateCustomExercise(event) {
  const formData = new FormData(event.target);
  const name = formData.get('name').trim();
  const muscleGroup = formData.get('muscleGroup');

  if (!name || !muscleGroup) {
    alert('Please fill in all fields');
    return;
  }

  // Check for duplicate name
  const existingExercise = state.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (existingExercise) {
    alert('An exercise with this name already exists');
    return;
  }

  try {
    await addCustomExercise(name, muscleGroup);
    await loadExercises();
    hideCustomExerciseForm();
    alert('Custom exercise created successfully!');
  } catch (error) {
    console.error('Failed to create custom exercise:', error);
    alert('Failed to create exercise. Please try again.');
  }
}

async function handleUpdateExerciseNotes(exerciseId, notes) {
  try {
    await updateExerciseNotes(exerciseId, notes);
    await loadExercises(); // Reload to update state
  } catch (error) {
    console.error('Failed to update notes:', error);
    alert('Failed to save notes. Please try again.');
  }
}

async function handleDeleteExercise(exerciseId) {
  const exercise = state.exercises.find(e => e.id === exerciseId);
  if (!exercise) return;

  const ok = await showConfirmModal({
    title: `Delete "${exercise.name}"?`,
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return;

  try {
    await deleteExercise(exerciseId);
    await loadExercises();
    alert('Exercise deleted successfully!');
  } catch (error) {
    console.error('Failed to delete exercise:', error);
    if (error.message.includes('workout history')) {
      alert('Cannot delete this exercise because it has workout history.');
    } else {
      alert('Failed to delete exercise. Please try again.');
    }
  }
}

// ===== MODAL HELPERS =====

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') closeModal();
}

// Reusable yes/no confirmation modal. Resolves true on confirm, false on
// cancel / backdrop / Escape. Replaces native confirm() for important gates.
// Pass cancelLabel: null for a single-button informational dialog.
function showConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal-header">
          <h3 id="confirm-title">${title}</h3>
        </div>
        <div class="modal-body">
          <p class="modal-message">${message}</p>
        </div>
        <div class="modal-actions">
          <button id="confirm-ok-btn" class="btn-primary${danger ? ' btn-danger' : ''}">${confirmLabel}</button>
          ${cancelLabel ? `<button id="confirm-cancel-btn" class="btn-secondary">${cancelLabel}</button>` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const onKey = (e) => { if (e.key === 'Escape') finish(false); };
    function finish(result) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    document.addEventListener('keydown', onKey);
    document.getElementById('confirm-ok-btn').addEventListener('click', () => finish(true));
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => finish(false));
    document.getElementById('confirm-ok-btn').focus();
  });
}

// Build and show the finish-workout confirmation modal with a summary
async function showFinishWorkoutModal(sessionId) {
  const program = state.activeProgram;
  const session = state.activeWorkout;

  // Fallback: if we can't build a summary, finish directly
  if (!program || !session) {
    await handleFinishWorkout(sessionId);
    return;
  }

  const workoutNumber = session.workoutNumber;
  const workout = program.workouts
    ? program.workouts.find(w => w.workoutNumber === workoutNumber)
    : null;
  const exercises = workout ? workout.exercises : [];

  const loggedSets = await getSetsForWorkout(sessionId);

  // Build per-exercise completion summary + detect PRs (estimated 1RM)
  const summary = [];
  const prs = [];
  for (const ex of exercises) {
    const exercise = state.exercises.find(e => e.id === ex.exerciseId);
    const name = exercise ? exercise.name : 'Unknown';
    const target = ex.targetSets || 0;
    const exSets = loggedSets.filter(s => s.exerciseId === ex.exerciseId);
    const done = exSets.length;
    summary.push({ name, target, done, complete: target > 0 && done >= target });

    if (exSets.length > 0) {
      const history = await getExerciseHistory(ex.exerciseId);
      const priorBest = Math.max(0, ...history
        .filter(s => s.workoutSessionId !== sessionId)
        .map(s => calcE1RM(s.weight, s.reps)));
      let sessionBest = 0;
      let bestSet = null;
      exSets.forEach(s => {
        const e = calcE1RM(s.weight, s.reps);
        if (e > sessionBest) { sessionBest = e; bestSet = s; }
      });
      if (sessionBest > priorBest && sessionBest > 0) {
        prs.push({ name, e1rm: Math.round(sessionBest), weight: bestSet.weight, reps: bestSet.reps });
      }
    }
  }

  const totalTarget = summary.reduce((a, s) => a + s.target, 0);
  const totalDone = summary.reduce((a, s) => a + s.done, 0);
  const completed = summary.filter(s => s.complete);
  const incomplete = summary.filter(s => !s.complete);

  const checkIcon = '<svg class="status-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>';
  const partialIcon = '<svg class="status-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';

  let bodyHtml = `
    <p class="modal-summary-line">${totalDone} of ${totalTarget} target sets logged across ${summary.length} exercise${summary.length === 1 ? '' : 's'}.</p>
  `;

  if (prs.length > 0) {
    bodyHtml += `
      <div class="modal-section modal-pr-section">
        <h4>🎉 New PR${prs.length === 1 ? '' : 's'}!</h4>
        <ul class="modal-status-list">
    `;
    prs.forEach(pr => {
      bodyHtml += `<li class="status-item pr"><span class="status-name">${pr.name}</span><span class="status-detail">${pr.weight}kg × ${pr.reps} · est. 1RM ${pr.e1rm}kg</span></li>`;
    });
    bodyHtml += '</ul></div>';
  }

  if (completed.length > 0) {
    bodyHtml += `
      <div class="modal-section">
        <h4>Completed</h4>
        <ul class="modal-status-list">
    `;
    completed.forEach(s => {
      bodyHtml += `<li class="status-item complete">${checkIcon}<span class="status-name">${s.name}</span><span class="status-detail">${s.done}/${s.target} sets</span></li>`;
    });
    bodyHtml += '</ul></div>';
  }

  if (incomplete.length > 0) {
    bodyHtml += `
      <div class="modal-section">
        <h4>Not completed</h4>
        <ul class="modal-status-list">
    `;
    incomplete.forEach(s => {
      const detail = s.target > 0 ? `${s.done} of ${s.target} sets` : `${s.done} sets`;
      bodyHtml += `<li class="status-item incomplete">${partialIcon}<span class="status-name">${s.name}</span><span class="status-detail">${detail}</span></li>`;
    });
    bodyHtml += '</ul></div>';
  }

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h3 id="modal-title">Finish Workout?</h3>
        <p class="modal-subtitle">${program.name} • Workout ${workoutNumber}</p>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
      <div class="modal-actions">
        <button id="modal-confirm-btn" class="btn-primary">Confirm &amp; Finish</button>
        <button id="modal-cancel-btn" class="btn-secondary">Keep Going</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', handleModalKeydown);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
    closeModal();
    await handleFinishWorkout(sessionId);
  });
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
  } catch (error) {
    console.error('Failed to finish workout:', error);
    alert('Failed to finish workout. Please try again.');
  }
}

async function handleCancelWorkout(sessionId) {
  const ok = await showConfirmModal({
    title: 'Cancel workout?',
    message: 'All logged sets for this workout will be deleted.',
    confirmLabel: 'Cancel workout',
    cancelLabel: 'Keep going',
    danger: true,
  });
  if (!ok) return;

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

// ===== SETTINGS ACTION HANDLERS =====

function handleDarkModeToggle(event) {
  const isDark = event.target.checked;

  if (isDark) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('theme', 'light');
  }

  // Update the label text
  const label = document.querySelector('.toggle-label');
  if (label) {
    label.textContent = isDark ? 'Dark Mode' : 'Light Mode';
  }
}

async function handleExportData() {
  try {
    const data = await exportAllData();

    // Create a blob and download link
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link and trigger it
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `workout-data-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(url);

    alert('Data exported successfully!');
  } catch (error) {
    console.error('Failed to export data:', error);
    alert('Failed to export data. Please try again.');
  }
}

async function handleImportData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);

      // Show preview of what will be imported
      const { exercises, programs, workoutSessions, sets } = importedData.data;
      const ok = await showConfirmModal({
        title: 'Import data?',
        message: `This will <strong>delete all existing data</strong> and replace it with:<br>` +
          `${exercises?.length || 0} exercises · ${programs?.length || 0} programs · ` +
          `${workoutSessions?.length || 0} sessions · ${sets?.length || 0} sets.<br><br>` +
          `This cannot be undone.`,
        confirmLabel: 'Replace all data',
        danger: true,
      });

      if (!ok) {
        // Reset file input
        event.target.value = '';
        return;
      }

      // Import the data
      await importAllData(importedData);

      // Reload state
      await refreshState();

      // Reset file input
      event.target.value = '';

      alert('Data imported successfully! The app will now refresh.');

      // Refresh the page to ensure clean state
      window.location.reload();

    } catch (error) {
      console.error('Failed to import data:', error);
      alert('Failed to import data. Please make sure the file is a valid export.');
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

// ===== PROGRAM ACTION HANDLERS =====

// A live session is rendered from its program's template, so editing that
// template mid-workout would change the session underneath the user. Block it
// until the workout is finished or cancelled. Returns true if editing is safe.
async function canEditProgram(programId) {
  const isActiveProgram = state.activeProgram && state.activeProgram.id === programId;
  if (!state.activeWorkout || !isActiveProgram) return true;

  await showConfirmModal({
    title: 'Workout in progress',
    message: 'You have a workout in progress for this program. Finish or cancel it first, then you can edit the program.',
    confirmLabel: 'Got it',
    cancelLabel: null,
  });
  return false;
}

async function handleStartProgram(programId) {
  // Check if another program is active
  if (state.activeProgram && state.activeProgram.id !== programId) {
    const currentProgramName = state.activeProgram.name;
    const newProgram = state.programs.find(p => p.id === programId);
    const newProgramName = newProgram ? newProgram.name : 'this program';

    const ok = await showConfirmModal({
      title: 'Switch program?',
      message: `You're currently following "${currentProgramName}". Switch to "${newProgramName}"?`,
      confirmLabel: 'Switch',
    });
    if (!ok) return;
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

  // Collect workouts from workoutData, which every mutation (add / remove /
  // move / inline edit) writes to. The rendered list is a projection of it, and
  // may hold a transient inline editor instead of a label mid-edit.
  const workouts = [];

  for (let i = 1; i <= 7; i++) {
    const exercises = (workoutData[i] || [])
      .filter(ex => ex && ex.exerciseId && ex.targetSets > 0)
      .map(ex => ({ exerciseId: ex.exerciseId, targetSets: ex.targetSets }));

    if (exercises.length > 0) {
      workouts.push({
        workoutNumber: i,
        exercises
      });
    }
  }

  try {
    if (programId) {
      // Edit existing. Only the template changes here - isActive, completedCycles
      // and the user's place in the cycle must survive the edit.
      const updates = { name, workouts };
      // Read the pointer from the DB - state.programs can lag behind it
      // (finishing a workout advances currentWorkout without reloading the list).
      const existing = await getProgramById(programId);
      const numbers = workouts.map(w => w.workoutNumber).sort((a, b) => a - b);

      if (existing && numbers.length > 0) {
        const current = existing.currentWorkout || numbers[0];
        if (!numbers.includes(current)) {
          // The workout they were on was edited away: move to the next one
          // that still exists, wrapping to the first if none follow it.
          const nextExisting = numbers.find(n => n > current);
          updates.currentWorkout = nextExisting !== undefined ? nextExisting : numbers[0];
        }
      }

      await updateProgram(programId, updates);
    } else {
      // Create new
      await createProgram({ name, workouts, isActive: false, currentWorkout: 1 });
    }

    await loadPrograms();
    await loadActiveProgram(); // pick up edits to the active program right away
    currentProgramView = 'list';
    currentProgramId = null;
    copySourceProgramId = null;
  } catch (error) {
    console.error('Failed to save program:', error);
    alert('Failed to save program. Please try again.');
  }
}

// Track workout data while building the form
const workoutData = {};

// Re-render one workout's exercise list from workoutData. Listeners survive
// because the form uses event delegation on the .workout-exercises container.
function rerenderWorkoutExercises(workoutNumber) {
  const container = document.querySelector(`.workout-exercises[data-workout="${workoutNumber}"]`);
  if (container) {
    container.innerHTML = renderWorkoutExercises(workoutData[workoutNumber] || []);
  }
}

// Swap the exercise name label for a dropdown so it can be changed in place
function startEditExerciseName(workoutNumber, index) {
  const entry = workoutData[workoutNumber] && workoutData[workoutNumber][index];
  if (!entry) return;

  const span = document.querySelector(
    `.workout-exercises[data-workout="${workoutNumber}"] .exercise-entry[data-index="${index}"] .exercise-name`
  );
  if (!span) return;

  const select = document.createElement('select');
  select.className = 'inline-exercise-select';
  select.innerHTML = renderExerciseOptions();
  select.value = String(entry.exerciseId);
  span.replaceWith(select);
  select.focus();
}

// Swap the sets label for a number input so it can be changed in place
function startEditExerciseSets(workoutNumber, index) {
  const entry = workoutData[workoutNumber] && workoutData[workoutNumber][index];
  if (!entry) return;

  const span = document.querySelector(
    `.workout-exercises[data-workout="${workoutNumber}"] .exercise-entry[data-index="${index}"] .exercise-sets`
  );
  if (!span) return;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'inline-sets-input';
  input.min = '1';
  input.max = '10';
  input.value = String(entry.targetSets);
  span.replaceWith(input);
  input.focus();
  input.select();
}

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

  rerenderWorkoutExercises(workoutNumber);

  // Reset inputs
  dropdown.value = '';
  setsInput.value = '3';
}

function handleRemoveExerciseFromWorkout(workoutNumber, index) {
  if (!workoutData[workoutNumber]) return;

  workoutData[workoutNumber].splice(index, 1);

  rerenderWorkoutExercises(workoutNumber);
}

function handleMoveExercise(workoutNumber, index, direction) {
  if (!workoutData[workoutNumber]) return;

  const exercises = workoutData[workoutNumber];
  const newIndex = direction === 'up' ? index - 1 : index + 1;

  // Validate bounds
  if (newIndex < 0 || newIndex >= exercises.length) return;

  // Swap exercises
  [exercises[index], exercises[newIndex]] = [exercises[newIndex], exercises[index]];

  rerenderWorkoutExercises(workoutNumber);
}

// ===== SETTINGS RENDERING =====

function renderSettings() {
  const container = document.getElementById('settings-content');

  const isDarkMode = document.body.classList.contains('dark-mode');

  let html = `
    <div class="settings-section">
      <h2>Appearance</h2>

      <div class="settings-item">
        <h3>Dark Mode</h3>
        <p>Switch between light and dark theme</p>
        <label class="theme-toggle">
          <input type="checkbox" id="dark-mode-toggle" ${isDarkMode ? 'checked' : ''}>
          <span class="toggle-slider"></span>
          <span class="toggle-label">${isDarkMode ? 'Dark' : 'Light'} Mode</span>
        </label>
      </div>
    </div>

    <div class="settings-section">
      <h2>Data Management</h2>

      <div class="settings-item">
        <h3>Export Data</h3>
        <p>Download all your workout data as a JSON file. Use this to backup your data or transfer to another device.</p>
        <button id="export-data-btn" class="btn-primary">Export All Data</button>
      </div>

      <div class="settings-item">
        <h3>Import Data</h3>
        <p><strong>Warning:</strong> This will replace all existing data with the imported data. Make sure to export your current data first if you want to keep it.</p>
        <input type="file" id="import-file-input" accept=".json" style="display: none;">
        <button id="import-data-btn" class="btn-secondary">Import Data</button>
      </div>
    </div>

    <div class="settings-section">
      <h2>About</h2>
      <p class="settings-info">Workout App v1.0</p>
      <p class="settings-info">Privacy-focused workout tracking</p>
      <p class="settings-info">All data stored locally on your device</p>
    </div>
  `;

  container.innerHTML = html;
  setupSettingsListeners();
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
    case 'settings':
      renderSettings();
      break;
  }
}

// Subscribe to state changes to trigger re-render (but not on initial load)
subscribe(() => {
  // Small delay to ensure DOM is ready
  setTimeout(render, 0);
});
