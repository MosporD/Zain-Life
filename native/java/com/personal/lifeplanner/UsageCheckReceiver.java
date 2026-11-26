package com.personal.lifeplanner;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Wakes up every few minutes to run UsageWatch.check(); re-arms itself after reboots. */
public class UsageCheckReceiver extends BroadcastReceiver {
    static final String ACTION = "com.personal.lifeplanner.USAGE_CHECK";

    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            if (UsageWatch.prefs(c).getBoolean("enabled", false)) arm(c, 60_000L);
            return;
        }
        final PendingResult pending = goAsync();          // reading usage events can take a moment
        new Thread(() -> {
            try { UsageWatch.check(c); } finally { pending.finish(); }
        }).start();
    }

    private static PendingIntent pending(Context c) {
        Intent i = new Intent(c, UsageCheckReceiver.class).setAction(ACTION);
        return PendingIntent.getBroadcast(c, 4242, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void arm(Context c, long delayMs) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long at = System.currentTimeMillis() + delayMs;
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c));
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c));
        }
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c));
    }
}
