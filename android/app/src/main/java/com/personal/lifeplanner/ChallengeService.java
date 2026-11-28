package com.personal.lifeplanner;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.location.LocationRequest;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Company step challenge check. Runs only between the challenge's start and end, as a foreground
 * service with a visible notification. GPS stays off until the step counter moves; then it takes a
 * fix every 20 seconds, judges each minute with StepCheck, and turns off a minute after the steps stop.
 * Results are totals per day, kept on the phone (SharedPreferences "zl_challenge").
 */
public class ChallengeService extends Service implements SensorEventListener, LocationListener {
    static final String PREFS = "zl_challenge";
    static final String CHANNEL = "challenge";
    static final int NOTIF_ID = 7301;
    static final long FIX_MS = 20_000;          // one GPS fix every 20 seconds while walking
    static final long QUIET_MS = 60_000;        // GPS off after a minute without new steps
    static volatile boolean running = false;

    private SensorManager sm;
    private LocationManager lm;
    private Handler h;
    private PowerManager.WakeLock wake;
    private boolean sensorOn = false, gpsOn = false;
    private long lastCounter = -1, lastStepAt = 0;
    private Location anchor, last;              // start of the current minute, and the latest fix
    private int spanSteps = 0, preFixSteps = 0;
    private boolean spanMock = false, closing = false;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** The challenge is switched on and today is inside its dates. */
    static boolean inWindow(Context c) {
        SharedPreferences p = prefs(c);
        long now = System.currentTimeMillis();
        return p.getBoolean("on", false) && now >= p.getLong("start", 0) && now < p.getLong("end", 0);
    }

    static void start(Context c) {
        Intent i = new Intent(c, ChallengeService.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    static void stop(Context c) { c.stopService(new Intent(c, ChallengeService.class)); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        h = new Handler(Looper.getMainLooper());
        sm = (SensorManager) getSystemService(SENSOR_SERVICE);
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, notif(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIF_ID, notif());
        } catch (Exception e) {
            // Location permission missing, or Android refused a start from the background.
            note("error", e.getMessage() == null ? "could not start" : e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!inWindow(this)) { stopSelf(); return START_NOT_STICKY; }
        running = true;
        if (!sensorOn) startSensor();
        // Not sticky: Android may not start a location service from the background, so the app
        // restarts it the next time it is opened during the challenge.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        closing = true;
        stopGps();
        if (sensorOn) sm.unregisterListener(this);
        sensorOn = false;
        if (wake != null && wake.isHeld()) wake.release();
        h.removeCallbacksAndMessages(null);
        running = false;
        super.onDestroy();
    }

    /* ---------------- steps ---------------- */

    private void startSensor() {
        if (sm == null) { note("error", "no sensors"); stopSelf(); return; }
        // A wake-up step counter wakes the phone only when steps happen. Without one, keep the
        // processor awake for the challenge (costs more battery, but steps are not missed).
        Sensor s = Build.VERSION.SDK_INT >= 21 ? sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER, true) : null;
        boolean wakeUp = s != null;
        if (s == null) s = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (s == null) { note("error", "This phone has no step counter."); stopSelf(); return; }
        sensorOn = sm.registerListener(this, s, SensorManager.SENSOR_DELAY_NORMAL, 10_000_000);
        if (!sensorOn) { note("error", "Could not read the step counter. Allow Physical activity for " + getString(R.string.app_name) + "."); stopSelf(); return; }
        if (!wakeUp) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "app:challenge");
            wake.acquire(Math.max(60_000, prefs(this).getLong("end", 0) - System.currentTimeMillis()));
        }
        note("error", null);
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        long c = (long) e.values[0];
        if (lastCounter < 0 || c < lastCounter) { lastCounter = c; return; }   // first reading, or the phone restarted
        int d = (int) (c - lastCounter);
        lastCounter = c;
        if (d <= 0) return;
        if (!inWindow(this)) { stopSelf(); return; }
        lastStepAt = System.currentTimeMillis();
        if (anchor == null) preFixSteps += d; else spanSteps += d;
        if (!gpsOn) startGps();
        h.removeCallbacks(quietCheck);
        h.postDelayed(quietCheck, QUIET_MS + 5_000);
    }

    @Override public void onAccuracyChanged(Sensor s, int a) {}

    private final Runnable quietCheck = new Runnable() {
        @Override public void run() { if (System.currentTimeMillis() - lastStepAt >= QUIET_MS) stopGps(); }
    };

    /* ---------------- GPS ---------------- */

    private void startGps() {
        if (lm == null) return;
        String p = LocationManager.GPS_PROVIDER;
        if (Build.VERSION.SDK_INT >= 31 && lm.hasProvider(LocationManager.FUSED_PROVIDER)) p = LocationManager.FUSED_PROVIDER;
        try {
            if (!lm.isProviderEnabled(p)) { note("gps", "off"); return; }
            if (Build.VERSION.SDK_INT >= 31) {
                LocationRequest r = new LocationRequest.Builder(FIX_MS)
                    .setQuality(LocationRequest.QUALITY_HIGH_ACCURACY)
                    .setMinUpdateIntervalMillis(FIX_MS - 5_000)
                    .build();
                lm.requestLocationUpdates(p, r, getMainExecutor(), this);
            } else {
                lm.requestLocationUpdates(p, FIX_MS, 0f, this, Looper.getMainLooper());
            }
            gpsOn = true;
            note("gps", "on");
        } catch (SecurityException e) {
            note("error", "Location permission is off.");
        }
    }

    private void stopGps() {
        if (gpsOn) {
            try { lm.removeUpdates(this); } catch (Exception ignored) {}
            gpsOn = false;
        }
        // Close the last, shorter stretch with whatever fixes it has.
        if (anchor != null && last != null && last != anchor && spanSteps > 0) judge(last);
        else if (spanSteps > 0) record(StepCheck.UNKNOWN, spanSteps, 0);
        if (preFixSteps > 0) record(StepCheck.UNKNOWN, preFixSteps, 0);   // walked before the first fix arrived
        spanSteps = 0; preFixSteps = 0; spanMock = false; anchor = null; last = null;
        note("gps", "idle");
    }

    private static boolean isMock(Location l) {
        return Build.VERSION.SDK_INT >= 31 ? l.isMock() : l.isFromMockProvider();
    }

    @Override
    public void onLocationChanged(Location l) {
        if (!inWindow(this)) { stopSelf(); return; }
        last = l;
        if (anchor == null) {
            anchor = l;
            spanMock = isMock(l);
            if (preFixSteps > 0) { record(StepCheck.UNKNOWN, preFixSteps, 0); preFixSteps = 0; }
        } else {
            spanMock |= isMock(l);
            if (ms(anchor, l) >= StepCheck.SPAN_MS - 5_000) judge(l);
        }
        if (System.currentTimeMillis() - lastStepAt >= QUIET_MS) stopGps();
    }

    private static long ms(Location a, Location b) {
        return (b.getElapsedRealtimeNanos() - a.getElapsedRealtimeNanos()) / 1_000_000L;
    }

    private void judge(Location l) {
        double dist = anchor.distanceTo(l);
        float accA = anchor.hasAccuracy() ? anchor.getAccuracy() : 0, accB = l.hasAccuracy() ? l.getAccuracy() : 0;
        int v = StepCheck.verdict(spanSteps, dist, accA, accB, ms(anchor, l), spanMock);
        record(v, spanSteps, v == StepCheck.MOVING ? dist : 0);
        anchor = l; spanSteps = 0; spanMock = isMock(l);
    }

    // Older Android versions call these directly; without them the app would crash there.
    @Override public void onStatusChanged(String p, int s, Bundle b) {}
    @Override public void onProviderEnabled(String p) {}
    @Override public void onProviderDisabled(String p) { note("gps", "off"); }

    /* ---------------- results ---------------- */

    static String dayKey(long t) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(t)); }

    private void record(int verdict, int steps, double distM) {
        if (steps <= 0) return;
        SharedPreferences p = prefs(this);
        long now = System.currentTimeMillis();
        String k = dayKey(now), name = StepCheck.NAMES[verdict];
        try {
            JSONObject days = new JSONObject(p.getString("days", "{}"));
            JSONObject d = days.optJSONObject(k);
            if (d == null) d = new JSONObject();
            d.put(name, d.optInt(name, 0) + steps);
            if (distM > 0) d.put("distM", Math.round(d.optDouble("distM", 0) + distM));
            days.put(k, d);
            JSONArray log = new JSONArray(p.getString("log", "[]"));
            JSONObject e = new JSONObject();
            e.put("t", now); e.put("v", name); e.put("steps", steps); e.put("m", Math.round(distM));
            log.put(e);
            while (log.length() > 120) log.remove(0);
            p.edit().putString("days", days.toString()).putString("log", log.toString()).apply();
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null && !closing) nm.notify(NOTIF_ID, notif());
        } catch (Exception ignored) {}
    }

    private void note(String key, String value) {
        SharedPreferences.Editor e = prefs(this).edit();
        if (value == null) e.remove(key); else e.putString(key, value);
        e.apply();
    }

    private Notification notif() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Step challenge", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shown while the step challenge check is on.");
            nm.createNotificationChannel(ch);
        }
        int moving = 0;
        try {
            JSONObject d = new JSONObject(prefs(this).getString("days", "{}")).optJSONObject(dayKey(System.currentTimeMillis()));
            if (d != null) moving = d.optInt("moving", 0);
        } catch (Exception ignored) {}
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = open == null ? null : PendingIntent.getActivity(this, 7301, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String name = prefs(this).getString("name", "Step challenge");
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_app)
            .setContentTitle(name + ": " + String.format(Locale.US, "%,d", moving) + " verified steps today")
            .setContentText("Location is checked only while you walk.")
            .setContentIntent(pi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }
}
