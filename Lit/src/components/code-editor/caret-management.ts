import { Position } from "./types";


interface CursorState {
  position: Position;
  visible: boolean;                   // For blinking animation
  blinkTimer: number;                 // Animation timing
  
  // Visual properties
  width: number;                      // Usually 1-2px
  color: string;                      // Theme-based
}

/*
Cursor Rendering:
Canvas drawing: Draw thin rectangle at calculated position
Blinking: Use requestAnimationFrame for smooth animation
Focus handling: Only blink when editor has focus


*/