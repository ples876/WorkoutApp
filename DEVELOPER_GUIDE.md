# Workout App - Developer Guide

## Overview
A privacy-focused workout tracking web application built with vanilla JavaScript, Dexie.js (IndexedDB wrapper), and custom CSS. All data is stored locally in the browser - no server, no cloud, complete privacy.

**Live App**: Hosted on GitHub Pages
**Architecture**: Client-side only, progressive web app (PWA-ready)

---

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database**: IndexedDB via Dexie.js v3.2.4 (CDN)
- **Storage**: Browser IndexedDB (persists across sessions)
- **State Management**: Observer pattern with global state object
- **Deployment**: GitHub Pages (static hosting)

---

## Project Structure

```
WorkoutApp/
├── index.html              # Main app shell with tab navigation
├── css/
│   └── styles.css          # All styles (mobile-first, custom properties)
├── js/
│   ├── app.js              # App initialization
│   ├── db.js               # Database layer (Dexie.js schemas & operations)
│   ├── state.js            # State management (observer pattern)
│   ├── ui.js               # UI rendering & event handlers
│   └── exercises-data.js   # Default exercise seed data
└── DEVELOPER_GUIDE.md      # This file
```

---

## Database Schema (IndexedDB via Dexie.js)

### Current Version: 5

**Version History:**
- v1: Initial schema (exercises, programs, workoutSessions, sets)
- v2: Added `notes` field to exercises
- v3: Added `completedCycles` field to programs
- v4: Seeded Abs exercises (Machine Crunch, Leg Raise) into existing databases
- v5: Added `swaps` field to workoutSessions (per-session temporary exercise substitutions; the UI that uses it is currently deferred)

### Tables

#### `exercises`
Stores all exercises (default + custom)
```javascript
{
  id: number,              // Auto-increment primary key
  name: string,            // Exercise name (e.g., "Bench Press")
  muscleGroup: string,     // Key from MUSCLE_GROUPS (e.g., "chest")
  isCustom: boolean,       // true if user-created, false if default
  notes: string            // User notes (v2+)
}
```

#### `programs`
Workout programs (templates)
```javascript
{
  id: number,              // Auto-increment primary key
  name: string,            // Program name
  isActive: boolean,       // Only one can be active at a time
  currentWorkout: number,  // Current workout number (1-indexed)
  completedCycles: number, // Times user completed all workouts (v3+)
  workouts: [              // Array of workout objects
    {
      workoutNumber: number,     // 1, 2, 3, etc.
      exercises: [
        {
          exerciseId: number,    // References exercises.id
          targetSets: number     // Suggested sets (user can do more/less)
        }
      ]
    }
  ]
}
```

#### `workoutSessions`
Actual workout instances (reality, not template)
```javascript
{
  id: number,              // Auto-increment primary key
  programId: number,       // References programs.id
  workoutNumber: number,   // Which workout in the program
  date: string,            // ISO timestamp
  isComplete: boolean,     // false during workout, true when finished
  swaps: object            // v5+: { [slotIndex]: exerciseId } temporary substitutions
}
```

#### `sets`
Individual logged sets
```javascript
{
  id: number,              // Auto-increment primary key
  workoutSessionId: number,// References workoutSessions.id
  exerciseId: number,      // References exercises.id
  weight: number,          // In kg (0 for bodyweight)
  reps: number,            // Repetitions performed
  rpe: number,             // Optional. 6-10 in half steps; absent if skipped
  timestamp: string        // ISO timestamp
}
```

---

## State Management

Located in: `js/state.js`

### Global State Object
```javascript
state = {
  currentTab: 'workout',              // Active tab name
  exercises: [],                      // All exercises (array)
  programs: [],                       // All programs (array)
  activeProgram: null,                // Currently active program object
  activeWorkout: null,                // In-progress workout session object
  viewingExerciseHistory: null,       // Exercise ID when viewing history
  historyReturnContext: null,         // 'exercises' or 'workout'
  creatingCustomExercise: false,      // true when form is open
  listeners: []                       // Observer callbacks
}
```

### Observer Pattern
- `subscribe(listener)`: Register a callback
- `notifyListeners()`: Trigger all callbacks
- State updates → automatic UI re-render

---

## Key Features & Implementation

### 1. Program Management
**Location**: `js/ui.js` (Programs tab)

- **Create/Edit Programs**: Multi-workout programs with exercises and target sets
- **Reorder Exercises**: Arrow buttons (↑↓) to change exercise order
- **Active Program**: Only one program can be active at a time
- **Cycle Tracking**: Counts how many times user completed all workouts

**Key Functions**:
- `renderProgramForm(programId)` - Create/edit form
- `handleSaveProgram(programId)` - Validation & save
- `handleMoveExercise(workoutNumber, index, direction)` - Reorder exercises

### 2. Workout Logging
**Location**: `js/ui.js` (Workout tab)

**Two States**:
1. **Preview** (no active session): Shows exercises, "Start Workout" button
2. **Logging** (active session): Input fields for weight/reps, "Log Set" button

**Smart Features**:
- **Weight Persistence**: After logging first set, weight stays pre-filled
- **Auto-focus**: Reps input gets focus after logging
- **RPE Prompt**: After each set is logged, `showRpeModal()` asks for its RPE
  (6-10 in half steps). One tap records it; Skip / backdrop / Escape leave the
  set without an RPE. The set is written first, so a dismissed prompt never
  loses it.
- **Last Time Reference**: Shows previous workout data (grouped by weight)
- **Delete Sets**: Remove logged sets before finishing workout

**Key Functions**:
- `renderActiveWorkout()` - Router function
- `renderWorkoutPreview()` - Preview mode
- `renderWorkoutLogging()` - Logging mode
- `handleLogSet()` - Log set with weight persistence
- `fmtSetsSummary(sets)` - Format historical data (see Display Formatting)

**Example "Last Time" Display**:
- Same weight: `Last time: 4 sets - 5x10,9,9,9`
- Multiple weights: `Last time: 4 sets - 5x10,9 and 4x12,11`
- With RPE: `Last time: 3 sets - 140x1(8) and 120x3(8),3(9)`

### Display Formatting

**Location**: `js/ui.js`, next to `calcE1RM()`

All set/weight/count strings go through one small set of helpers so the same
fact reads the same way everywhere. Do not inline new variants.

| Helper | Output |
|---|---|
| `fmtWeight(w)` | `100kg` (bodyweight stays `0kg`) |
| `fmtSet(w, reps, rpe)` | `100kg × 5 (RPE 8)`; RPE omitted if not passed |
| `fmtSetCount(done, target, label)` | `2/3 sets`, `12/15 target sets`, `2 sets` when target is 0 |
| `fmtE1RM(value)` | `est. 1RM: 128kg` (rounds) |
| `fmtSetsCompact(sets)` | `140x1(8) and 120x3(8),3(9)` - grouped by weight, heaviest first |
| `fmtSetsSummary(sets)` | `3 sets - 140x1(8) and 120x3(8),3(9)` |

Note the two RPE notations are deliberate: parentheses after reps in the
compact form, spelled out as `(RPE 8)` in the long form.

### 3. Exercise History
**Location**: `js/ui.js` (History view)

**Access Points**:
- From Exercises tab: "View History" button
- During workout: "History" button (top-right of exercise)

**Display**:
- Groups sets by workout session
- Shows date, program name, workout number
- Uses `fmtSetsSummary()` for set display, identical to the "Last time" line
- Back button returns to correct context

**Key Functions**:
- `renderExerciseHistory(exerciseId)` - Main view
- `viewExerciseHistory(exerciseId, context)` - Navigate in
- `exitExerciseHistory()` - Navigate out

### 4. Exercise Notes
**Location**: Exercises tab + Workout tab

- **Always visible**: Compact textarea above exercise name
- **Auto-save**: On blur (click away)
- **Auto-expand**: Single-line when unfocused, expands to 4rem when focused
- **Exercise-specific**: Not session-specific (persists across workouts)
- **Placeholder**: "Note..." (short and subtle)

**Styling**: Uses CSS variables (--note-bg, --note-border) for theme support

### 5. Custom Exercises
**Location**: Exercises tab

- Create with name + muscle group
- Delete with confirmation (blocked if has history)
- Italic styling to distinguish from defaults (no badge)
- Stored with `isCustom: true`

### 6. Dark Mode
**Location**: Settings tab

- **Toggle switch**: Manual light/dark mode selection
- **Persistence**: Saved to localStorage, restored on app load
- **Implementation**: CSS custom properties with `body.dark-mode` class
- **Colors**: All UI elements adapt via CSS variables

### 7. Data Export/Import
**Location**: Settings tab

**Export**:
- Downloads JSON: `workout-data-YYYY-MM-DD.json`
- Contains: exercises, programs, sessions, sets

**Import**:
- Shows preview (counts)
- Replace-only strategy (clears all, then imports)
- Validates JSON structure
- Reloads page after import

**Use Cases**:
- Backup before clearing browser data
- Transfer between devices
- Recover from accidental data loss

---

## UI/UX Patterns

### Navigation
- **Bottom Nav**: 4 tabs (Workout, Programs, Exercises, Settings)
- **State-based rendering**: Each tab has render function
- **Deep navigation**: Some tabs have sub-views (e.g., history, program detail)

### Forms
- **Validation**: Client-side, alerts for errors
- **Auto-save**: Notes save on blur
- **Smart defaults**: Target sets = 3, weight persists after first log

### Mobile-First Design
- Fixed-width inputs (90px for weight/reps)
- Reduced padding in cards
- `flex-wrap: nowrap` to keep buttons inline
- Touch-friendly button sizes

### Color Scheme
Uses CSS custom properties for theming:
```css
/* Light mode (default) */
--primary-color: #3b82f6 (blue)
--background: #ffffff
--surface: #f8f9fa
--text-primary: #1e293b

/* Dark mode (body.dark-mode) */
--primary-color: #60a5fa (lighter blue)
--background: #0f172a
--surface: #1e293b
--text-primary: #f1f5f9
```
All colors adapt automatically via CSS variables

---

## Important Business Logic

### Program Advancement
**Location**: `js/db.js` - `advanceWorkout(programId)`

When user finishes a workout:
1. Check if it's the last workout in program
2. If yes: increment `completedCycles`, reset to workout 1
3. If no: increment `currentWorkout`

**UI Display**:
- Current cycle = `completedCycles + 1`
- Shows: "Cycle 2 • Workout 3 of 4"

### Set Logging Flow
1. User enters weight + reps (or just reps if weight persists)
2. Click "Log Set" → validates, saves to DB
3. Weight stays filled, reps clears, focus on reps
4. User enters next reps → repeat
5. "Finish Workout" → marks session complete, advances program

### Session Lifecycle
- **Create**: `createWorkoutSession()` - sets `isComplete: false`
- **Active**: Persists across page reloads (auto-loaded on app init)
- **Complete**: `completeWorkoutSession()` - sets `isComplete: true`
- **Cancel**: `deleteWorkoutSession()` - deletes session, keeps program on same workout

---

## Key Code Conventions

### Async/Await
All database operations are async:
```javascript
async function loadExercises() {
  state.exercises = await getAllExercises();
  notifyListeners();
}
```

### Event Delegation
For dynamic elements (exercises, sets):
```javascript
container.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-remove-exercise')) {
    handleRemove(e.target.dataset.index);
  }
});
```

### Data Flow
```
User Action → Handler Function → DB Operation →
State Update → notifyListeners() → UI Re-render
```

---

## Common Tasks

### Adding a New Field to Exercises
1. **Update schema** in `js/db.js` with the next version number (currently v5, so add v6):
   ```javascript
   db.version(6).stores({ ... }).upgrade(tx => {
     return tx.table('exercises').toCollection().modify(exercise => {
       exercise.newField = defaultValue;
     });
   });
   ```
2. **Update UI** in `js/ui.js` to display/edit field
3. **Update seed data** if needed in `js/exercises-data.js`

### Adding a New Tab
1. Add HTML in `index.html`:
   ```html
   <div id="tab-newtab" class="tab-content">...</div>
   <button class="nav-btn" data-tab="newtab">...</button>
   ```
2. Add render function in `js/ui.js`:
   ```javascript
   function renderNewTab() { ... }
   ```
3. Add case in `render()` switch statement:
   ```javascript
   case 'newtab': renderNewTab(); break;
   ```

### Debugging Tips
- Check console for DB errors
- Use `db.exercises.toArray()` in console to inspect data
- State is global: `console.log(state)` to check current state
- Dexie.js DevTools: Shows IndexedDB structure

---

## Deployment

### GitHub Pages Setup
1. Push code to GitHub repository
2. Settings → Pages → Source: main branch
3. URL: `https://username.github.io/WorkoutApp/`

### Update Process
```bash
git add .
git commit -m "Description"
git push origin main
```
GitHub Pages auto-deploys in 1-2 minutes.

---

## Known Limitations & Design Decisions

### Limitations
- **No sync**: Each device has separate data (by design, privacy-focused)
- **No offline detection**: Assumes always online for CDN (Dexie.js)
- **Browser storage limits**: IndexedDB quota varies by browser (~50MB+)
- **No user accounts**: Intentionally local-only

### Design Decisions
- **Programs as templates**: Static, users can deviate during workouts
- **Sessions as reality**: Dynamic, tracks what actually happened
- **Replace-only import**: Simpler than merge, prevents ID conflicts
- **Cycles not weeks**: More general terminology (program could be 3 days or 6 days)
- **Single active program**: Simplifies UX, prevents confusion

---

## Future Enhancement Ideas

Potential features (not implemented):
- Rest timer between sets
- Progressive overload calculator
- Volume tracking (total weight × reps)
- Workout duration tracking
- Charts/graphs for progress
- Dark mode
- Export to CSV
- Print workout templates
- Exercise videos/gifs
- Supersets/circuits support

---

## Troubleshooting

### Data Lost After Clearing Cookies
- IndexedDB is tied to "site data" in most browsers
- **Solution**: Export data regularly to JSON

### Can't Delete Exercise
- Error: "This exercise has workout history and cannot be deleted"
- **By Design**: Prevents orphaned set records
- **Workaround**: None (delete history sets manually in DB, or keep exercise)

### Duplicate Exercises When Removing
- **Fixed**: Was due to duplicate event listeners
- If reoccurs: Check for multiple `addEventListener` calls on same element

### Weight Doesn't Persist
- Check `handleLogSet()` - should restore weight after re-render
- Verify `setTimeout` executes after DOM updates

---

## Testing Checklist

Before deploying major changes:

**Exercises**
- [ ] View exercises grouped by muscle
- [ ] Create custom exercise
- [ ] Delete custom exercise (with/without history)
- [ ] Add/edit notes (auto-save on blur)
- [ ] View exercise history

**Programs**
- [ ] Create program with multiple workouts
- [ ] Add/remove exercises to workouts
- [ ] Reorder exercises (↑↓ buttons)
- [ ] Edit existing program
- [ ] Delete program
- [ ] Start program (sets as active)

**Workouts**
- [ ] Start workout from preview
- [ ] Log sets (weight + reps)
- [ ] Weight persists after first set
- [ ] Delete logged set
- [ ] View "Last Time" reference
- [ ] View exercise history from workout
- [ ] Finish workout (advances to next)
- [ ] Cancel workout (deletes session)
- [ ] Cycle tracking increments correctly

**Data Management**
- [ ] Export data to JSON
- [ ] Import data (shows preview)
- [ ] Import replaces all data correctly

**Appearance**
- [ ] Toggle dark mode on/off
- [ ] Dark mode persists across page refresh
- [ ] All UI elements adapt to theme

**Edge Cases**
- [ ] Log bodyweight exercise (0kg)
- [ ] Complete last workout (cycle increments)
- [ ] Browser refresh during workout (session persists)
- [ ] Multiple devices (data is separate - expected)

---

## Contact & Contribution

This is a personal project built iteratively with Claude Code. No external contributions expected, but feel free to fork for your own use.

**License**: Not specified (assume personal use)
