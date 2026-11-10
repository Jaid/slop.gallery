/** key that suppresses every mood or lets them back with `?development` */
export const moodSuppressionKey = 'KeyN'

/** Whether the player suppressed every mood with N, for looking at the world as it is, read by `Moods` without a React subscription. */
export const moodSuppression = {active: false}

/** Suppresses every mood or lets them back, returning whether they are suppressed now. Both ignore the moods’ fades: a mood showing is cut off at once and the mood due comes back in full at once. */
export function toggleMoodSuppression() {
  moodSuppression.active = !moodSuppression.active
  return moodSuppression.active
}
