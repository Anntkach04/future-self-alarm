/** Fixed wake-up script — keep in sync with src/data/alarmScript.ts */
function buildAlarmScript(name) {
  const who = String(name || '').trim() || 'friend';
  return `Hey ${who}… it’s me. Mm. Soft morning light — and I need you with me for this next part of the day.

Take one slow breath with me… there. Then sit up when you’re ready. You already know who you’re becoming.

Heh — today doesn’t need to be perfect. Just move a little, eat something kind, keep one small promise before the noise starts.

I’m proud of you for getting up. Really. I’ll be right here. Come on… let’s begin.`;
}

module.exports = { buildAlarmScript };
