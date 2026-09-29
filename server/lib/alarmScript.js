/** Fixed wake-up script — keep in sync with src/data/alarmScript.ts */
function buildAlarmScript(name) {
  const who = String(name || '').trim() || 'friend';
  return `Hey ${who}, it's me. Soft morning light, and I need you with me for this next part of the day. Take one slow breath, then sit up when you're ready. You already know who you're becoming. Today doesn't need to be perfect — just move a little, eat something kind, keep one small promise before the noise starts. I'm proud of you for getting up. I'll be right here. Come on, let's begin.`;
}

module.exports = { buildAlarmScript };
