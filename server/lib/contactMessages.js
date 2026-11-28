const { insertContactMessage } = require('./db');

/**
 * Persist a contact form submission so support mail never depends on mailto alone.
 * @param {{ name: string, email: string, topic: string, message: string }} input
 */
async function saveContactMessage(input) {
  const row = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    name: String(input.name || '').trim().slice(0, 120),
    email: String(input.email || '').trim().slice(0, 200),
    topic: String(input.topic || '').trim().slice(0, 80),
    message: String(input.message || '').trim().slice(0, 4000),
  };
  if (!row.name || !row.email || !row.message) {
    const err = new Error('Name, email, and message are required');
    err.status = 400;
    throw err;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    const err = new Error('Please enter a valid email');
    err.status = 400;
    throw err;
  }

  await insertContactMessage(row);
  console.log(
    `[contact] ${row.id} · ${row.topic} · ${row.email} · ${row.name}`
  );

  const webhook = (process.env.CONTACT_WEBHOOK_URL || '').trim();
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...row,
          subject: `[Future Self Alarm] ${row.topic}`,
        }),
      });
    } catch (err) {
      console.warn('[contact] webhook failed', err?.message || err);
    }
  }

  return row;
}

module.exports = { saveContactMessage };
