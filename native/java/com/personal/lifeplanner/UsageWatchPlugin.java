package com.personal.lifeplanner;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Map;

/** JavaScript bridge: window.Capacitor.Plugins.UsageWatch */
@CapacitorPlugin(name = "UsageWatch")
public class UsageWatchPlugin extends Plugin {

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", UsageWatch.hasAccess(getContext()));
        call.resolve(r);
    }

    /** Opens Android's "Usage access" list, where the person switches this app on. */
    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Social-app minutes for each of the last `days` days: [{date, minutes, apps: {name: minutes}}]. */
    @PluginMethod
    public void getUsage(PluginCall call) {
        final Context c = getContext();
        if (!UsageWatch.hasAccess(c)) { call.reject("Usage access is off", "no_access"); return; }
        final int days = Math.max(1, Math.min(14, call.getInt("days", 7)));
        new Thread(() -> {
            long now = System.currentTimeMillis();
            long dayStart = UsageWatch.startOfDay(now);
            JSArray out = new JSArray();
            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(dayStart);
            long end = now;
            for (int d = 0; d < days; d++) {
                long start = cal.getTimeInMillis();
                UsageWatch.Measure m = UsageWatch.measure(c, start, end);
                Map<String, Long> byName = new HashMap<>();
                for (Map.Entry<String, Long> e : m.ms.entrySet()) {
                    String n = UsageWatch.label(e.getKey());
                    byName.put(n, (byName.containsKey(n) ? byName.get(n) : 0L) + e.getValue());
                }
                JSObject apps = new JSObject();
                for (Map.Entry<String, Long> e : byName.entrySet()) {
                    long mins = Math.round(e.getValue() / 60_000.0);
                    if (mins > 0) apps.put(e.getKey(), mins);
                }
                JSObject day = new JSObject();
                day.put("date", UsageWatch.dayKey(start));
                day.put("minutes", Math.round(m.total() / 60_000.0));
                day.put("apps", apps);
                out.put(day);
                end = start;
                cal.add(Calendar.DAY_OF_MONTH, -1);
            }
            JSObject r = new JSObject();
            r.put("days", out);
            call.resolve(r);
        }).start();
    }

    /** {enabled, sessionMin, dailyMin}: turns the background watch on or off and sets its limits. */
    @PluginMethod
    public void configure(PluginCall call) {
        Context c = getContext();
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        UsageWatch.prefs(c).edit()
            .putBoolean("enabled", enabled)
            .putInt("sessionMin", Math.max(5, call.getInt("sessionMin", 15)))
            .putInt("dailyMin", Math.max(5, call.getInt("dailyMin", 30)))
            .putString("lang", call.getString("lang", "en"))
            .apply();
        if (enabled && UsageWatch.hasAccess(c)) UsageCheckReceiver.arm(c, 30_000L);
        else UsageCheckReceiver.cancel(c);
        call.resolve();
    }
}
