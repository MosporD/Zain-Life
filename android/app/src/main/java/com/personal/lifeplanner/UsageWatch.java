package com.personal.lifeplanner;

import android.Manifest;
import android.app.AppOpsManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Reads Android's app-usage events (the same data Digital Wellbeing shows) for the big social apps,
 * and warns when one has been open too long in one go, or the daily limit has been passed.
 * Needs the "Usage access" special permission, which only the person can grant in Android settings.
 */
public final class UsageWatch {
    static final String PREFS = "lp_usage_watch";
    static final String CHANNEL = "focus";
    static final int NOTIF_SESSION = 7101, NOTIF_DAILY = 7102;
    static final long GAP_MERGE_MS = 60_000;   // switching screens inside an app is still one session

    static final Map<String, String> APPS = new HashMap<>();
    static {
        APPS.put("com.instagram.android", "Instagram");
        APPS.put("com.instagram.barcelona", "Threads");
        APPS.put("com.zhiliaoapp.musically", "TikTok");
        APPS.put("com.ss.android.ugc.trill", "TikTok");
        APPS.put("com.facebook.katana", "Facebook");
        APPS.put("com.facebook.lite", "Facebook Lite");
        APPS.put("com.snapchat.android", "Snapchat");
        APPS.put("com.twitter.android", "X");
        APPS.put("com.google.android.youtube", "YouTube");
        APPS.put("com.reddit.frontpage", "Reddit");
        APPS.put("com.pinterest", "Pinterest");
    }

    private UsageWatch() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static boolean hasAccess(Context c) {
        AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= 29
            ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
            : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
        if (mode == AppOpsManager.MODE_DEFAULT) {
            return c.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED;
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    /** Foreground time per social app between start and end, plus the app open right now (if any). */
    static final class Measure {
        final Map<String, Long> ms = new HashMap<>();
        String openPkg;
        long openSince;
        long total() { long t = 0; for (long v : ms.values()) t += v; return t; }
    }

    static Measure measure(Context c, long start, long end) {
        Measure r = new Measure();
        UsageStatsManager usm = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return r;
        UsageEvents events = usm.queryEvents(start, end);
        UsageEvents.Event e = new UsageEvents.Event();
        Map<String, Long> resumedAt = new HashMap<>(), sessionStart = new HashMap<>(), lastPause = new HashMap<>();
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            String pkg = e.getPackageName();
            if (!APPS.containsKey(pkg)) continue;
            long ts = e.getTimeStamp();
            int type = e.getEventType();
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                if (!resumedAt.containsKey(pkg)) resumedAt.put(pkg, ts);
                Long lp = lastPause.get(pkg);
                if (!sessionStart.containsKey(pkg) || lp == null || ts - lp > GAP_MERGE_MS) sessionStart.put(pkg, ts);
            } else if (type == UsageEvents.Event.ACTIVITY_PAUSED) {
                Long s = resumedAt.remove(pkg);
                if (s != null) add(r.ms, pkg, ts - s);
                lastPause.put(pkg, ts);
            }
        }
        for (Map.Entry<String, Long> open : resumedAt.entrySet()) {     // still on screen at `end`
            add(r.ms, open.getKey(), end - open.getValue());
            r.openPkg = open.getKey();
            Long s = sessionStart.get(open.getKey());
            r.openSince = s != null ? s : open.getValue();
        }
        return r;
    }

    private static void add(Map<String, Long> m, String k, long v) { if (v > 0) m.put(k, (m.containsKey(k) ? m.get(k) : 0L) + v); }

    static long startOfDay(long t) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(t);
        cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    static String dayKey(long t) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(t); }

    static String label(String pkg) { String l = APPS.get(pkg); return l != null ? l : pkg; }

    /** Runs every few minutes from UsageCheckReceiver. Posts at most one reminder per threshold. */
    static void check(Context c) {
        SharedPreferences p = prefs(c);
        if (!p.getBoolean("enabled", false) || !hasAccess(c)) return;     // switched off: stop the loop
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        boolean screenOn = pm == null || pm.isInteractive();
        long now = System.currentTimeMillis();
        if (screenOn) {
            int sessionMin = p.getInt("sessionMin", 15), dailyMin = p.getInt("dailyMin", 30);
            Measure recent = measure(c, now - 3 * 3600_000L, now);
            if (recent.openPkg != null) {
                long mins = (now - recent.openSince) / 60_000;
                int level = (int) (mins / Math.max(1, sessionMin));
                if (level >= 1 && (recent.openSince != p.getLong("sessStart", 0) || level > p.getInt("sessLevel", 0))) {
                    boolean ar = "ar".equals(p.getString("lang", "en"));
                    notify(c, NOTIF_SESSION, ar ? mins + " دقيقة على " + label(recent.openPkg) : mins + " minutes on " + label(recent.openPkg),
                        ar ? "هذه مدة طويلة. ضع الهاتف جانبًا وانظر ما التالي في خطتك." : "That's a long stretch. Put it down and check what's next in your plan.");
                    p.edit().putLong("sessStart", recent.openSince).putInt("sessLevel", level).apply();
                }
            }
            String today = dayKey(now);
            if (!today.equals(p.getString("dailyDate", ""))) {
                long total = measure(c, startOfDay(now), now).total() / 60_000;
                if (total >= dailyMin) {
                    boolean ar = "ar".equals(p.getString("lang", "en"));
                    notify(c, NOTIF_DAILY, ar ? "تجاوزت حدّك اليومي (" + dailyMin + " دقيقة)" : "Past your " + dailyMin + "-minute limit",
                        ar ? total + " دقيقة على التواصل الاجتماعي اليوم. يكفي لهذا اليوم." : total + " minutes on social media today. That's enough for today.");
                    p.edit().putString("dailyDate", today).apply();
                }
            }
        }
        // Check often while the screen is on; rarely while it's off, to save battery.
        UsageCheckReceiver.arm(c, screenOn ? 4 * 60_000L : 15 * 60_000L);
    }

    static void notify(Context c, int id, String title, String body) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Scrolling alerts", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("When a social app has been open too long");
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_swirl)
            .setColor(0xFFFFFFFF)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi);
        try {
            NotificationManagerCompat.from(c).notify(id, b.build());
        } catch (SecurityException ignored) {
            // Notifications not allowed for the app; nothing to do.
        }
    }

    static Set<String> packages() { return new HashSet<>(Arrays.asList(APPS.keySet().toArray(new String[0]))); }
}
