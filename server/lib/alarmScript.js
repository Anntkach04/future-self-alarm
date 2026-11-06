/** Wake line — ~25–28s spoken (fits Apple custom alarm sound <30s). Sync with src/data/alarmScript.ts */
function buildAlarmScript(name, mood, habits) {
  const who = String(name || '').trim() || 'friend';
  const moodLabel = String(mood?.label || mood || '').trim().toLowerCase();
  const habitList = Array.isArray(habits)
    ? habits.map((h) => String(h || '').trim()).filter(Boolean)
    : [];
  const habit =
    habitList.length > 0
      ? habitList[Math.floor(Math.random() * habitList.length)]
      : '';

  const moodLine = (() => {
    if (!moodLabel) return '';
    if (/heavy|tired|exhausted|drained|low|numb|stuck/.test(moodLabel)) {
      return ' Yesterday was a lot. That’s okay. Go easy on yourself.';
    }
    if (
      /restless|anxious|worried|stressed|overwhelmed|angry|scattered/.test(
        moodLabel
      )
    ) {
      return ' Leave yesterday there for a second. One slow breath.';
    }
    if (/sad|down|lonely|blue|tender/.test(moodLabel)) {
      return ' Soft morning. Be gentle with yourself.';
    }
    if (
      /light|steady|happy|good|great|energ|excited|calm|hopeful|grateful|connected|inspired|playful/.test(
        moodLabel
      )
    ) {
      return ' Bring a little of that good feeling with you.';
    }
    return ' Meet this morning softly.';
  })();

  const moodBit = String(moodLine || '').trim();
  const moodSentence = moodBit ? ` ${moodBit}` : '';
  const habitSentence = habit
    ? ` Remember your morning plan — ${habit.toLowerCase()}.`
    : ' Pick one tiny thing for the day — just one.';

  return (
    `Hey ${who}. It's me.${moodSentence} ` +
    `No rush. Feel the bed for a second, then sit up when you're ready. ` +
    `Drink some water. Stretch your shoulders.` +
    `${habitSentence} ` +
    `I'm right here. Let's go.`
  );
}

module.exports = { buildAlarmScript };
