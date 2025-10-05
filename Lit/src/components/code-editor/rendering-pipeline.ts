

interface RenderLayers {
  background: CanvasRenderingContext2D;    // Background colors
  text: CanvasRenderingContext2D;          // Character rendering
  overlay: CanvasRenderingContext2D;       // Cursor, selections
}

/*

Rendering Steps:
Clear canvas (or dirty regions only)
Draw background (line highlighting, etc.)
Draw text (character by character with styling)
Draw overlay (cursor, selections)

Example Input Cycle:

User types 'H' →
Hidden textarea receives 'H' →
Extract text from textarea →
Insert 'H' at cursor position →
Update cursor position →
Mark line as dirty for re-render →
Trigger render cycle

Special Key Input Cycle:
User presses Arrow Right →
Canvas keydown handler catches it →
Calculate new cursor position →
Update cursor state →
Trigger cursor re-render

Phase 1:
Immediate mode: Redraw everything each frame 
Canvas 2D: Simpler API, good for text rendering

Phase 2
Retained mode: Track dirty regions, only redraw changes

Important considerations/questions: 

Font loading: How do we ensure font is loaded before measuring?
High DPI: How do we handle retina displays properly?
Performance: At what document size do we need virtual scrolling?
Accessibility: How do we maintain screen reader compatibility?


*/