# Workout App

A privacy-focused web application for creating workouts, logging exercises, and tracking fitness progress.

## Project Overview

This is a free, open-source workout tracking application designed with privacy and simplicity in mind. The app stores all data locally in your browser and provides export/import functionality for data portability.

## Core Principles

- **Privacy First**: All data stored locally, no cloud sync, no tracking
- **Free & Open**: Free to use, no monetization
- **Simple Start**: Begin with essential features, expand based on needs
- **User Control**: Full data ownership with export/import capabilities

## Planned Features

### Phase 1 - MVP (Minimum Viable Product)
- Create and manage workout programs (Day 1-7 structure)
- Define exercises per day with target number of sets
- Log weight and reps for each set during workouts
- View exercise history (per exercise, across all workouts)
- Browse pre-defined exercise library organized by muscle groups
- Add custom exercises to the library

### Future Enhancements
- Personal records (PR) tracking
- Advanced set types (drop sets, supersets, etc.)
- Bodyweight and cardio exercises
- Rest period tracking
- Notes and tags for workouts
- Workout analytics and charts

## Technical Decisions

### Confirmed
- **Platform**: Web (Browser-based, static site)
- **Development Framework**: Vanilla HTML/CSS/JavaScript (no framework)
- **Database**: IndexedDB (browser local storage)
- **IndexedDB Wrapper**: Dexie.js (~20KB, via CDN)
- **UI Framework**: Custom CSS built from scratch (minimal, responsive design)
- **State Management**: Global state object with event listeners
- **Data Storage**: Local browser storage only (IndexedDB)
- **Data Portability**: Export/import functionality (JSON format)
- **Monetization**: Free app (no monetization in Phase 1)
- **Privacy**: No analytics, no cloud services, no user tracking
- **Hosting**: Static hosting (GitHub Pages, Netlify, or similar)
- **Build Tools**: None (keep it simple, add only if needed)

### Phase 1 Scope Decisions
- **Exercise Library**: ~20 pre-defined exercises (including Backsquats, Flat Bench Press, Deadlifts) organized by muscle groups + ability to add custom exercises
- **Program Structure**: Users create programs with Day 1-7 structure, assigning exercises and target sets to each day
- **Workout Flow**: Users select a program, then log weight/reps for each set on workout days
- **Set Types**: Straight sets only (no warm-up sets, drop sets, supersets)
- **Progress Tracking**: Exercise history (view past performance per exercise, accessible from exercise list or during active workout)
- **Export Format**: JSON only
- **Rest Period Tracking**: Not included in Phase 1
- **Units**: Metric only (kg) - no bodyweight or cardio tracking in Phase 1
- **UI Design**: Mobile-first, bottom tab navigation, text inputs with number keyboard
- **Navigation**: 3 tabs - "Active Workout", "Programs", "Exercises"

## Data Model (Draft)

```
Program
  - id
  - name
  - days[] (Day 1-7)

ProgramDay
  - dayNumber (1-7)
  - exercises[] (reference to Exercise Definitions)
  - targetSets (number of sets for each exercise)

ExerciseDefinition
  - id
  - name
  - muscleGroup (e.g., legs, chest, back, shoulders, arms)
  - isCustom (boolean)

WorkoutSession
  - id
  - programId
  - dayNumber
  - date
  - setInstances[]

SetInstance
  - exerciseDefinitionId (reference to ExerciseDefinition)
  - reps
  - weight (kg)
  - timestamp
  - notes (optional)
```

### Data Model Notes
- **ExerciseDefinition**: The catalog of exercises (both pre-defined and custom)
- **SetInstance**: Actual logged sets during workouts, linked to exercise definitions
- **History**: Retrieved by querying all SetInstances for a specific exerciseDefinitionId

## User Flow

### First-Time User
1. User opens app
2. Browses pre-defined exercise library (organized by muscle groups)
3. Creates a program (e.g., "Push Pull Legs")
4. Assigns exercises to days (Day 1, Day 2, etc.)
5. Specifies target number of sets for each exercise

### During Workout
1. User opens app to "Active Workout" tab (shows last active workout or prompts to select program/day)
2. Selects program and day if not already active
3. Sees list of exercises for that day with empty set inputs
4. Logs weight and reps for each set using number keyboard
5. Can view exercise history from any exercise during workout
6. Completes workout (data saved to IndexedDB)

### Viewing History
1. User navigates to "Exercises" tab
2. Browses or searches for an exercise
3. Views all past sets for that exercise across all workouts
4. Can see progression over time

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, or Edge)
- A text editor or IDE (VS Code, Sublime Text, or similar)
- Basic knowledge of HTML, CSS, and JavaScript

### Development Setup
1. Clone/create the project directory
2. Open `index.html` in your browser to run locally
3. Edit files in your text editor
4. Refresh browser to see changes
5. No build tools or compilation required

### Project Structure
```
/WorkoutApp
  index.html              # Main HTML file
  /css
    styles.css            # All CSS styles
  /js
    app.js                # Main entry point & initialization
    db.js                 # Database operations (Dexie.js wrapper)
    state.js              # Global state management
    ui.js                 # UI rendering functions
    exercises-data.js     # Pre-defined exercise library
```

## Development Phases

Building the app in vertical slices with clear deliverables at each phase.

### Phase 0: Foundation (Walking Skeleton) ✅
**Goal:** Basic app loads with tabs and exercise library showing

**Tasks:**
- Create folder structure (css/, js/)
- Set up index.html with basic layout and tab navigation
- Add Dexie.js via CDN and initialize database
- Create tab navigation system (Active Workout, Programs, Exercises)
- Add pre-defined exercise data (~20 exercises organized by muscle groups)
- Display exercises in Exercises tab
- Basic mobile-first CSS layout

**Success Criteria:** Open index.html in browser, see three tabs, click Exercises tab, see list of exercises.

---

### Phase 1: Program Management ✅
**Goal:** Can create and view programs

**Tasks:**
- Create program form (name input)
- Add exercises to program days (Day 1-7 structure)
- Specify target sets per exercise
- Save programs to IndexedDB
- View list of all programs
- View program details (see days and exercises)
- Edit/delete programs

**Success Criteria:** Create a "Push Pull Legs" program with exercises assigned to different days, close and reopen app, see program persisted.

---

### Phase 2: Workout Logging
**Goal:** Can start a workout and log sets

**Tasks:**
- Select program + day to start a workout
- Display exercises for selected day with input fields
- Input weight and reps for each set
- Auto-save sets to IndexedDB (draft mode)
- "Finish Workout" and "Cancel Workout" buttons
- Active workout persists on app close/reopen
- Mark workout as complete when finished

**Success Criteria:** Start a workout, log several sets, close browser, reopen, see workout still in progress with logged sets intact.

---

### Phase 3: Exercise History
**Goal:** Can view past performance per exercise

**Tasks:**
- Add "View History" button/link on each exercise
- Query all past sets for selected exercise from IndexedDB
- Display history (date, workout, weight, reps per set)
- Make history accessible from exercise library
- Make history accessible during active workout
- Basic styling for history view

**Success Criteria:** Complete multiple workouts with same exercise, view history, see all past sets with dates and weights.

---

### Phase 4: Polish & Data Management
**Goal:** Production-ready app

**Tasks:**
- Add custom exercise functionality
- Implement confirmation dialogs for destructive actions
- Export data to JSON file
- Import data from JSON file (with confirmation)
- Implement all empty states
- Error handling and validation
- Final CSS polish and responsive design
- Testing across different screen sizes
- Performance check

**Success Criteria:** Complete user journey from first launch through creating programs, logging workouts, viewing history, and exporting data. App feels polished and handles edge cases gracefully.

---

## Contributing

This is primarily a personal project, but suggestions and contributions are welcome.

## License

_(To be determined)_

---

## Open Questions & Decisions Needed

### ✅ Resolved (Phase 1)

#### Technical Architecture
1. **IndexedDB Wrapper**: Dexie.js via CDN
2. **State Management Pattern**: Global state object with event listeners
3. **File/Folder Structure**: See Project Structure above
4. **CSS Framework**: Build from scratch
5. **Build Tools**: None (keep it simple)

#### Data Management
6. **Data Versioning**: Yes, start with version 1 using Dexie's versioning system
7. **Export/Import Behavior**: Replace mode only - import clears all data and replaces with imported JSON (with confirmation dialog)
8. **Data Backup Prompts**: Not in Phase 1 - just provide an "Export Data" button in the UI

#### UX Details
9. **Program Selection**: Users can create multiple programs, but only one program can be "active/in progress" at a time. Only one workout session can be in progress at a time. Must finish current workout before the app marks the next workout from that program as "up next"
10. **Empty States**:
   - Active Workout tab: "No active workout. Go to Programs to start a workout."
   - Programs tab: "No programs yet. Create your first program!" with "Create Program" button
   - Exercises tab: Show ~20 pre-defined exercises immediately
11. **Confirmations**: Only for destructive actions - Delete program (if has history), Delete custom exercise (if has history), Import data (replaces all)
12. **Active Workout Persistence**: Auto-save as draft - sets are saved immediately, workout persists until marked "Finished" or "Cancelled"

#### Edge Cases
13. **Same Exercise Multiple Times**: Yes to both - allow same exercise on multiple days (common) and multiple times in one day
14. **Editing Programs**: Allow editing freely - historical data references exercise IDs, so editing program structure won't break history
15. **Deleting Exercises**: Prevent deletion if exercise has workout history - show message "This exercise has workout history and cannot be deleted"

#### Performance
16. **History Display Limits**: Start unlimited, add pagination later if performance becomes an issue
17. **Offline Support**: Browser caching is sufficient for Phase 1

#### Build & Deployment
18. **Testing**: Manual testing for Phase 1
19. **Browser Support**: Modern browsers only (Chrome/Firefox/Safari/Edge from last 2 years)
