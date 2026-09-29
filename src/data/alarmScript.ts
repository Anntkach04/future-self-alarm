/** Fixed wake script — spoken like a real morning, not copywriting. Keep in sync with server/lib/alarmScript.js */
export function buildAlarmScript(name: string) {
  const who = name.trim() || 'friend';
  return `Hey ${who}. It's me. Soft morning light — I need you with me for this next part of the day. Take one slow breath, then sit up. You already know who you're becoming, and today is just another quiet chance to meet them. Move a little, eat something that feels like care, keep one small promise before the noise starts. I'm proud of you for getting up. I'll be right here. Come on, let's begin.`;
}
