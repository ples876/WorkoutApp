// Database module using Dexie.js
// Handles all IndexedDB operations

const db = new Dexie('WorkoutAppDB');

// Define database schema (version 1)
db.version(1).stores({
  exercises: '++id, name, muscleGroup, isCustom',
  programs: '++id, name, isActive',
  workoutSessions: '++id, programId, workoutNumber, date, isComplete',
  sets: '++id, workoutSessionId, exerciseId, weight, reps, timestamp'
});

// Version 2: Add notes field to exercises
db.version(2).stores({
  exercises: '++id, name, muscleGroup, isCustom',
  programs: '++id, name, isActive',
  workoutSessions: '++id, programId, workoutNumber, date, isComplete',
  sets: '++id, workoutSessionId, exerciseId, weight, reps, timestamp'
}).upgrade(tx => {
  // Add notes field to existing exercises (default to empty string)
  return tx.table('exercises').toCollection().modify(exercise => {
    exercise.notes = exercise.notes || '';
  });
});

// Version 3: Add completedCycles field to programs
db.version(3).stores({
  exercises: '++id, name, muscleGroup, isCustom',
  programs: '++id, name, isActive',
  workoutSessions: '++id, programId, workoutNumber, date, isComplete',
  sets: '++id, workoutSessionId, exerciseId, weight, reps, timestamp'
}).upgrade(tx => {
  // Add completedCycles field to existing programs (default to 0)
  return tx.table('programs').toCollection().modify(program => {
    program.completedCycles = program.completedCycles || 0;
  });
});

// Version 4: Add abs exercises to existing databases
db.version(4).stores({
  exercises: '++id, name, muscleGroup, isCustom',
  programs: '++id, name, isActive',
  workoutSessions: '++id, programId, workoutNumber, date, isComplete',
  sets: '++id, workoutSessionId, exerciseId, weight, reps, timestamp'
}).upgrade(async tx => {
  const existing = await tx.table('exercises').where('muscleGroup').equals('abs').count();
  if (existing === 0) {
    await tx.table('exercises').bulkAdd([
      { name: 'Machine Crunch', muscleGroup: 'abs', isCustom: false, notes: '' },
      { name: 'Leg Raise', muscleGroup: 'abs', isCustom: false, notes: '' },
    ]);
  }
});

// Database initialization
async function initDatabase() {
  try {
    await db.open();
    console.log('Database opened successfully');

    // Check if we need to seed exercises
    const exerciseCount = await db.exercises.count();
    if (exerciseCount === 0) {
      console.log('Seeding exercises...');
      await seedExercises();
    }

    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

// Seed pre-defined exercises
async function seedExercises() {
  try {
    await db.exercises.bulkAdd(PREDEFINED_EXERCISES);
    console.log('Exercises seeded successfully');
  } catch (error) {
    console.error('Failed to seed exercises:', error);
  }
}

// ===== EXERCISE OPERATIONS =====

async function getAllExercises() {
  return await db.exercises.toArray();
}

async function getExercisesByMuscleGroup(muscleGroup) {
  return await db.exercises.where('muscleGroup').equals(muscleGroup).toArray();
}

async function getExerciseById(id) {
  return await db.exercises.get(id);
}

async function addCustomExercise(name, muscleGroup) {
  return await db.exercises.add({
    name,
    muscleGroup,
    isCustom: true,
    notes: ''
  });
}

async function updateExerciseNotes(exerciseId, notes) {
  return await db.exercises.update(exerciseId, { notes });
}

async function deleteExercise(id) {
  // Check if exercise has history
  const hasHistory = await db.sets.where('exerciseId').equals(id).count() > 0;
  if (hasHistory) {
    throw new Error('This exercise has workout history and cannot be deleted');
  }
  return await db.exercises.delete(id);
}

// ===== PROGRAM OPERATIONS =====

async function getAllPrograms() {
  return await db.programs.toArray();
}

async function getProgramById(id) {
  return await db.programs.get(id);
}

async function createProgram(programData) {
  return await db.programs.add(programData);
}

async function updateProgram(id, programData) {
  return await db.programs.update(id, programData);
}

async function deleteProgram(id) {
  // Check if program has history
  const hasHistory = await db.workoutSessions.where('programId').equals(id).count() > 0;
  if (hasHistory) {
    // Could throw error or ask for confirmation
    // For now, we'll allow deletion but keep the workout history
  }
  return await db.programs.delete(id);
}

async function getActiveProgram() {
  const programs = await db.programs.toArray();
  return programs.find(program => program.isActive === true);
}

async function setActiveProgram(programId) {
  // Deactivate all programs
  const allPrograms = await db.programs.toArray();
  for (const program of allPrograms) {
    if (program.isActive) {
      await db.programs.update(program.id, { isActive: false });
    }
  }

  // Activate the selected program and set currentWorkout to 1
  await db.programs.update(programId, {
    isActive: true,
    currentWorkout: 1
  });
}

async function advanceWorkout(programId) {
  const program = await db.programs.get(programId);
  if (!program) return;

  const totalWorkouts = program.workouts ? program.workouts.length : 0;
  if (totalWorkouts === 0) return;

  const currentWorkout = program.currentWorkout || 1;

  // Check if we're completing the last workout
  const isLastWorkout = currentWorkout >= totalWorkouts;

  // Advance to next workout, loop back to 1 if at the end
  const nextWorkout = isLastWorkout ? 1 : currentWorkout + 1;

  // If completing the cycle, increment completedCycles
  const updates = { currentWorkout: nextWorkout };
  if (isLastWorkout) {
    updates.completedCycles = (program.completedCycles || 0) + 1;
  }

  await db.programs.update(programId, updates);
}

// ===== WORKOUT SESSION OPERATIONS =====

async function createWorkoutSession(programId, workoutNumber) {
  return await db.workoutSessions.add({
    programId,
    workoutNumber,
    date: new Date().toISOString(),
    isComplete: false
  });
}

async function getActiveWorkoutSession() {
  // Get all sessions and filter in memory since isComplete might not be indexed properly
  const sessions = await db.workoutSessions.toArray();
  return sessions.find(session => session.isComplete === false);
}

async function completeWorkoutSession(sessionId) {
  return await db.workoutSessions.update(sessionId, { isComplete: true });
}

async function getLastCompletedSession(programId) {
  const sessions = await db.workoutSessions.where('programId').equals(programId).toArray();
  const completed = sessions
    .filter(s => s.isComplete === true)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return completed.length > 0 ? completed[0] : null;
}

// Reopen the most recently completed session for a program: flip it back to
// in-progress (sets are preserved) and reverse the workout-pointer advance.
async function reopenLastWorkout(programId) {
  const last = await getLastCompletedSession(programId);
  if (!last) return null;

  // Restore the session to in-progress
  await db.workoutSessions.update(last.id, { isComplete: false });

  // Reverse advanceWorkout: point back to this session's workout, and undo the
  // cycle increment if finishing it had wrapped the cycle.
  const program = await db.programs.get(programId);
  const totalWorkouts = program.workouts ? program.workouts.length : 0;
  const updates = { currentWorkout: last.workoutNumber };
  if (last.workoutNumber === totalWorkouts && (program.completedCycles || 0) > 0) {
    updates.completedCycles = program.completedCycles - 1;
  }
  await db.programs.update(programId, updates);

  return last;
}

async function deleteWorkoutSession(sessionId) {
  // Also delete all sets for this session
  await db.sets.where('workoutSessionId').equals(sessionId).delete();
  return await db.workoutSessions.delete(sessionId);
}

// ===== SET OPERATIONS =====

async function logSet(workoutSessionId, exerciseId, weight, reps) {
  return await db.sets.add({
    workoutSessionId,
    exerciseId,
    weight,
    reps,
    timestamp: new Date().toISOString()
  });
}

async function getSetsForWorkout(workoutSessionId) {
  return await db.sets.where('workoutSessionId').equals(workoutSessionId).toArray();
}

async function getExerciseHistory(exerciseId) {
  return await db.sets.where('exerciseId').equals(exerciseId).toArray();
}

async function deleteSet(setId) {
  return await db.sets.delete(setId);
}

async function updateSet(setId, weight, reps) {
  return await db.sets.update(setId, {
    weight,
    reps,
    timestamp: new Date().toISOString()
  });
}

async function getLastCompletedWorkout(programId, workoutNumber) {
  // Get all completed sessions for this program and workout number
  const sessions = await db.workoutSessions
    .where('programId').equals(programId)
    .toArray();

  const completedSessions = sessions
    .filter(s => s.isComplete === true && s.workoutNumber === workoutNumber)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (completedSessions.length === 0) return null;

  const lastSession = completedSessions[0];
  const sets = await db.sets.where('workoutSessionId').equals(lastSession.id).toArray();

  return {
    session: lastSession,
    sets
  };
}

// ===== DATA EXPORT/IMPORT =====

async function exportAllData() {
  const exercises = await db.exercises.toArray();
  const programs = await db.programs.toArray();
  const workoutSessions = await db.workoutSessions.toArray();
  const sets = await db.sets.toArray();

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    data: {
      exercises,
      programs,
      workoutSessions,
      sets
    }
  };
}

async function importAllData(importedData) {
  // Validate data structure
  if (!importedData.version || !importedData.data) {
    throw new Error('Invalid data format');
  }

  const { exercises, programs, workoutSessions, sets } = importedData.data;

  // Clear all existing data
  await db.exercises.clear();
  await db.programs.clear();
  await db.workoutSessions.clear();
  await db.sets.clear();

  // Import new data
  if (exercises && exercises.length > 0) {
    await db.exercises.bulkAdd(exercises);
  }
  if (programs && programs.length > 0) {
    await db.programs.bulkAdd(programs);
  }
  if (workoutSessions && workoutSessions.length > 0) {
    await db.workoutSessions.bulkAdd(workoutSessions);
  }
  if (sets && sets.length > 0) {
    await db.sets.bulkAdd(sets);
  }

  return true;
}

// ===== EXPORT/IMPORT OPERATIONS =====

async function exportData() {
  const data = {
    exercises: await db.exercises.toArray(),
    programs: await db.programs.toArray(),
    workoutSessions: await db.workoutSessions.toArray(),
    sets: await db.sets.toArray(),
    exportDate: new Date().toISOString()
  };
  return data;
}

async function importData(data) {
  try {
    // Clear all existing data
    await db.exercises.clear();
    await db.programs.clear();
    await db.workoutSessions.clear();
    await db.sets.clear();

    // Import new data
    if (data.exercises) await db.exercises.bulkAdd(data.exercises);
    if (data.programs) await db.programs.bulkAdd(data.programs);
    if (data.workoutSessions) await db.workoutSessions.bulkAdd(data.workoutSessions);
    if (data.sets) await db.sets.bulkAdd(data.sets);

    console.log('Data imported successfully');
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}
