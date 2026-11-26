package com.personal.lifeplanner;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.SleepSessionRecord;
import android.health.connect.datatypes.StepsRecord;
import android.os.Build;
import android.os.OutcomeReceiver;
import com.getcapacitor.JSObject;
import java.time.Instant;
import java.util.Calendar;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/** Steps and sleep through Android 14's built-in Health Connect (no extra libraries). */
@SuppressLint("NewApi")
final class HealthBridge {
    static final String READ_STEPS = "android.permission.health.READ_STEPS";
    static final String READ_SLEEP = "android.permission.health.READ_SLEEP";
    private static final Executor DIRECT = Runnable::run;

    static boolean available(Context c) {
        return Build.VERSION.SDK_INT >= 34 && c.getSystemService(HealthConnectManager.class) != null;
    }

    private static boolean has(Context c, String p) {
        return c.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
    }

    static JSObject status(Context c) {
        JSObject r = new JSObject();
        boolean ok = available(c);
        r.put("available", ok);
        r.put("granted", ok && (has(c, READ_STEPS) || has(c, READ_SLEEP)));
        if (!ok) {
            r.put("reason", Build.VERSION.SDK_INT < 34
                ? "Steps and sleep need Android 14 or newer."
                : "Health Connect is not available on this phone.");
        }
        return r;
    }

    private interface Call<T> {
        void run(OutcomeReceiver<T, HealthConnectException> cb);
    }

    @SuppressWarnings("unchecked")
    private static <T> T await(Call<T> fn) throws Exception {
        final Object[] box = new Object[2];
        final CountDownLatch latch = new CountDownLatch(1);
        fn.run(new OutcomeReceiver<T, HealthConnectException>() {
            @Override public void onResult(T r) { box[0] = r; latch.countDown(); }
            @Override public void onError(HealthConnectException e) { box[1] = e; latch.countDown(); }
        });
        if (!latch.await(10, TimeUnit.SECONDS)) throw new Exception("timeout");
        if (box[1] != null) throw (Exception) box[1];
        return (T) box[0];
    }

    static JSONArray daily(Context c, int days) {
        JSONArray out = new JSONArray();
        final HealthConnectManager hcm = c.getSystemService(HealthConnectManager.class);
        boolean steps = has(c, READ_STEPS), sleep = has(c, READ_SLEEP);
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long now = System.currentTimeMillis();
        for (int d = 0; d < days; d++) {
            final long start = cal.getTimeInMillis();
            final long end = Math.min(start + 86_400_000L, now);
            JSONObject day = new JSONObject();
            try {
                day.put("date", UsageWatch.dayKey(start));
                if (steps) {
                    try {
                        TimeInstantRangeFilter f = new TimeInstantRangeFilter.Builder()
                            .setStartTime(Instant.ofEpochMilli(start)).setEndTime(Instant.ofEpochMilli(end)).build();
                        final AggregateRecordsRequest<Long> req = new AggregateRecordsRequest.Builder<Long>(f)
                            .addAggregationType(StepsRecord.STEPS_COUNT_TOTAL).build();
                        AggregateRecordsResponse<Long> res = await(cb -> hcm.aggregate(req, DIRECT, cb));
                        Long v = res.get(StepsRecord.STEPS_COUNT_TOTAL);
                        day.put("steps", v == null ? 0 : v);
                    } catch (Exception ignored) { }
                }
                if (sleep) {
                    try {
                        // "Last night" for a date = sleep sessions that ended between midnight and 6 pm that day.
                        long winEnd = start + 18 * 3_600_000L;
                        TimeInstantRangeFilter f = new TimeInstantRangeFilter.Builder()
                            .setStartTime(Instant.ofEpochMilli(start - 12 * 3_600_000L)).setEndTime(Instant.ofEpochMilli(winEnd)).build();
                        final ReadRecordsRequestUsingFilters<SleepSessionRecord> req =
                            new ReadRecordsRequestUsingFilters.Builder<SleepSessionRecord>(SleepSessionRecord.class)
                                .setTimeRangeFilter(f).setPageSize(50).build();
                        ReadRecordsResponse<SleepSessionRecord> res = await(cb -> hcm.readRecords(req, DIRECT, cb));
                        long ms = 0;
                        for (SleepSessionRecord s : res.getRecords()) {
                            long e = s.getEndTime().toEpochMilli();
                            if (e >= start && e < winEnd) ms += e - s.getStartTime().toEpochMilli();
                        }
                        day.put("sleepMin", Math.round(ms / 60_000.0));
                    } catch (Exception ignored) { }
                }
            } catch (Exception ignored) { }
            out.put(day);
            cal.add(Calendar.DAY_OF_MONTH, -1);
        }
        return out;
    }
}
