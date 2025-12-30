// Pre-defined exercise library
// Organized by muscle groups with ~20 exercises

const PREDEFINED_EXERCISES = [
  // Legs
  { id: 1, name: 'Backsquat', muscleGroup: 'legs', isCustom: false },
  { id: 2, name: 'Front Squat', muscleGroup: 'legs', isCustom: false },
  { id: 3, name: 'Romanian Deadlift', muscleGroup: 'legs', isCustom: false },
  { id: 4, name: 'Leg Press', muscleGroup: 'legs', isCustom: false },
  { id: 5, name: 'Leg Curl', muscleGroup: 'legs', isCustom: false },

  // Chest
  { id: 6, name: 'Flat Bench Press', muscleGroup: 'chest', isCustom: false },
  { id: 7, name: 'Incline Bench Press', muscleGroup: 'chest', isCustom: false },
  { id: 8, name: 'Dumbbell Fly', muscleGroup: 'chest', isCustom: false },

  // Back
  { id: 9, name: 'Deadlift', muscleGroup: 'back', isCustom: false },
  { id: 10, name: 'Barbell Row', muscleGroup: 'back', isCustom: false },
  { id: 11, name: 'Pull-up', muscleGroup: 'back', isCustom: false },
  { id: 12, name: 'Lat Pulldown', muscleGroup: 'back', isCustom: false },

  // Shoulders
  { id: 13, name: 'Overhead Press', muscleGroup: 'shoulders', isCustom: false },
  { id: 14, name: 'Lateral Raise', muscleGroup: 'shoulders', isCustom: false },
  { id: 15, name: 'Face Pull', muscleGroup: 'shoulders', isCustom: false },

  // Arms
  { id: 16, name: 'Barbell Curl', muscleGroup: 'arms', isCustom: false },
  { id: 17, name: 'Hammer Curl', muscleGroup: 'arms', isCustom: false },
  { id: 18, name: 'Tricep Pushdown', muscleGroup: 'arms', isCustom: false },
  { id: 19, name: 'Overhead Tricep Extension', muscleGroup: 'arms', isCustom: false },
  { id: 20, name: 'Close-Grip Bench Press', muscleGroup: 'arms', isCustom: false },
];

// Muscle group display names
const MUSCLE_GROUPS = {
  legs: 'Legs',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
};
