/** Fixed wake script (default on-device alarm text). Keep in sync with server/lib/alarmScript.js */
export function buildAlarmScript(name: string) {
  const who = name.trim() || 'friend';
  return `Hey ${who}… it’s me. Soft morning light — and I need you with me for this next part of the day.

Take one slow breath… then sit up. You already know the person you’re becoming, and today is just another quiet chance to meet them.

Go move your body a little, eat something that feels like care, and keep one small promise to yourself before the noise starts.

I’m proud of you for getting up. I’ll be right here. Come on… let’s begin.`;
}
