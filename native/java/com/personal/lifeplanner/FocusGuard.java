package com.personal.lifeplanner;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * Focus session guard: Do Not Disturb while a session runs, and screen pinning (lock task).
 * DND needs "Do Not Disturb access" (the person switches Zain Life on once in Android settings).
 * The receiver side turns DND back off at the session's end time, even if the app was closed.
 * We only ever undo our own change: if the person changed DND themselves mid-session, it is left alone.
 */
public class FocusGuard extends BroadcastReceiver {
    static final String ACTION_END = "com.personal.lifeplanner.FOCUS_END";
    private static final int REQ = 9101;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("focus_guard", Context.MODE_PRIVATE); }

    static NotificationManager nm(Context c) { return (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); }

    static boolean dndAccess(Context c) {
        NotificationManager n = nm(c);
        return n != null && n.isNotificationPolicyAccessGranted();
    }

    /** True while DND is on because we switched it on. */
    static boolean dndOurs(Context c) { return prefs(c).getBoolean("ours", false); }

    /** Switches DND to "priority only" (the person's own DND exceptions apply) until endAt. */
    static boolean startDnd(Context c, long endAt) {
        NotificationManager n = nm(c);
        if (n == null || !n.isNotificationPolicyAccessGranted()) return false;
        int cur = n.getCurrentInterruptionFilter();
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("ours", false)) {
            // Already silenced by the person (or a schedule): nothing to switch, nothing to undo later.
            if (cur != NotificationManager.INTERRUPTION_FILTER_ALL && cur != NotificationManager.INTERRUPTION_FILTER_UNKNOWN) {
                p.edit().putLong("endAt", endAt).apply();
                return true;
            }
            n.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
            p.edit().putBoolean("ours", true).putInt("prev", cur == NotificationManager.INTERRUPTION_FILTER_UNKNOWN ? NotificationManager.INTERRUPTION_FILTER_ALL : cur).apply();
        }
        p.edit().putLong("endAt", endAt).apply();
        armEnd(c, endAt);
        return true;
    }

    /** Puts DND back the way it was, if we turned it on and nobody changed it since. */
    static void stopDnd(Context c) {
        SharedPreferences p = prefs(c);
        cancelEnd(c);
        if (!p.getBoolean("ours", false)) { p.edit().remove("endAt").apply(); return; }
        NotificationManager n = nm(c);
        if (n != null && n.isNotificationPolicyAccessGranted()
                && n.getCurrentInterruptionFilter() == NotificationManager.INTERRUPTION_FILTER_PRIORITY) {
            n.setInterruptionFilter(p.getInt("prev", NotificationManager.INTERRUPTION_FILTER_ALL));
        }
        p.edit().remove("ours").remove("prev").remove("endAt").apply();
    }

    /** A session that ended while the phone was off (alarms are lost on reboot) is cleaned up here. */
    static void stopIfExpired(Context c) {
        long end = prefs(c).getLong("endAt", 0L);
        if (end > 0 && end <= System.currentTimeMillis()) stopDnd(c);
    }

    private static PendingIntent endIntent(Context c) {
        Intent i = new Intent(c, FocusGuard.class).setAction(ACTION_END);
        return PendingIntent.getBroadcast(c, REQ, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void armEnd(Context c, long at) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, endIntent(c));
        else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, endIntent(c));
    }

    private static void cancelEnd(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(endIntent(c));
    }

    /** Screen pinning. Android shows its own "App pinned" message; the person can always unpin. */
    static boolean pinned(Activity a) {
        if (a == null) return false;
        ActivityManager am = (ActivityManager) a.getSystemService(Context.ACTIVITY_SERVICE);
        return am != null && am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    static void pin(Activity a) {
        if (a == null || pinned(a)) return;
        try { a.startLockTask(); } catch (Exception ignored) { }
    }

    static void unpin(Activity a) {
        if (a == null || !pinned(a)) return;
        try { a.stopLockTask(); } catch (Exception ignored) { }
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (ACTION_END.equals(intent.getAction())) stopDnd(c);
    }
}
