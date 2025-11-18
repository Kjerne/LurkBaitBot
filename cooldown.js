/**
 * Returns a random cooldown in milliseconds between min and max
 */
function getRandomCooldown(min, max) {
  if (min > max) [min, max] = [max, min];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { getRandomCooldown };
