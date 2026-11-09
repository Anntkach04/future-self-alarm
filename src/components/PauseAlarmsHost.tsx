import { useEffect } from 'react';
import { useAlarms } from '../context/AlarmsContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { cancelScheduledAlarm } from '../services/alarmScheduler';

/** When vacation pause is on, cancel all schedules until resume. */
export function PauseAlarmsHost() {
  const { isPaused } = useAppSettings();
  const { alarms, refreshSchedules, ready } = useAlarms();

  useEffect(() => {
    if (!ready) return;
    if (isPaused) {
      void Promise.all(alarms.map((a) => cancelScheduledAlarm(a.id)));
      return;
    }
    void refreshSchedules().catch(() => {});
  }, [isPaused, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
