/**
 * collision.js
 * Segment-vs-circle collision between the fingertip's recent trail and game
 * objects (fruits/bombs). Only trail segments whose implied speed exceeds
 * the configured swipe threshold count as a "cut" -- slow hovering should
 * never slice anything.
 */
const Collision = (() => {
  /**
   * Minimum distance from point (cx,cy) to segment (x1,y1)-(x2,y2).
   */
  function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Physics.dist(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Physics.clamp(t, 0, 1);
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Physics.dist(px, py, projX, projY);
  }

  /**
   * Checks the trail (array of {x,y,t,speed}) against a list of circular
   * objects. Returns an array of { object, segIndex } for objects hit by a
   * fast-enough segment. Each object is tested only once (first hit wins).
   */
  function checkTrailAgainstObjects(trail, objects, speedThreshold) {
    const hits = [];
    if (trail.length < 2) return hits;
    for (const obj of objects) {
      if (obj.dead || obj.sliced) continue;
      let hit = null;
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const segSpeed = Math.max(a.speed, b.speed);
        if (segSpeed < speedThreshold) continue;
        const d = pointToSegmentDistance(obj.x, obj.y, a.x, a.y, b.x, b.y);
        if (d <= obj.radius) {
          hit = { dx: b.x - a.x, dy: b.y - a.y };
          break;
        }
      }
      if (hit) hits.push({ object: obj, dir: hit });
    }
    return hits;
  }

  return { checkTrailAgainstObjects, pointToSegmentDistance };
})();
