// Quick angle test
// If cue ball is at (200, 100) and mouse is at (400, 100)
// atan2(100-100, 400-200) = atan2(0, 200) = 0 radians (pointing RIGHT) ✓

// If we then do:
// dx = cos(0) = 1
// dy = sin(0) = 0
// x += 1 * step → moves RIGHT ✓

// This should be correct! So why is it going left?

// Let me check if the issue is in how the starting segment is created...
// currentSegment = { start: { x, y }, points: [] }
// This starts at cueBall.x, cueBall.y

// Then we do x += dx * step
// This should move in the correct direction

// WAIT! I need to check if maybe the segment.start is being used incorrectly in drawing!
