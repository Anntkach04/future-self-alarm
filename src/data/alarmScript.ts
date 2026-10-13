/** Fixed wake script — spoken like a real morning, not copywriting. Keep in sync with server/lib/alarmScript.js */
export function buildAlarmScript(
  name: string,
  mood?: { label?: string } | string | null
) {
  const who = name.trim() || 'friend';
  const moodLabel =
    (typeof mood === 'string' ? mood : mood?.label || '').trim().toLowerCase();

  const moodLine = (() => {
    if (!moodLabel) return '';
    if (/heavy|tired|exhausted|drained|low|numb|stuck/.test(moodLabel)) {
      return ' Yesterday was heavy - so start soft today. ';
    }
    if (
      /restless|anxious|worried|stressed|overwhelmed|angry|scattered/.test(
        moodLabel
      )
    ) {
      return ' Leave yesterday’s noise in bed. One breath, then one step. ';
    }
    if (/sad|down|lonely|blue|tender/.test(moodLabel)) {
      return ' Be gentle with yourself this morning - you still get a clean page. ';
    }
    if (
      /light|steady|happy|good|great|energ|excited|calm|hopeful|grateful|connected|inspired|playful/.test(
        moodLabel
      )
    ) {
      return ' Carry a little of yesterday’s good into this morning. ';
    }
    return ' Whatever yesterday felt like, this morning is only this morning. ';
  })();

  return `Hey ${who}. It's me.${moodLine}Soft morning light. I need you with me for this next part of the day. Take one slow breath, then sit up. You already know who you're becoming, and today is just another quiet chance to meet them. Move a little, eat something that feels like care, keep one small promise before the noise starts. I'm proud of you for getting up. I'll be right here. Come on, let's begin.`;
}
