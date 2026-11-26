package com.personal.lifeplanner;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;

/** JavaScript bridge: window.Capacitor.Plugins.LifeNative (backup files, widget, Health Connect). */
@CapacitorPlugin(
    name = "LifeNative",
    permissions = { @Permission(alias = "health", strings = { HealthBridge.READ_STEPS, HealthBridge.READ_SLEEP }) }
)
public class LifeNativePlugin extends Plugin {

    /** {name, data}: writes a backup file to Downloads/ZainLife (kept after uninstalling the app). */
    @PluginMethod
    public void saveBackup(PluginCall call) {
        String name = call.getString("name", "ZainLife-backup.json");
        String data = call.getString("data", "");
        if (Build.VERSION.SDK_INT < 29) { call.reject("Backup files need Android 10 or newer"); return; }
        try {
            ContentResolver r = getContext().getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ZainLife");
            Uri uri = r.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) { call.reject("Could not create the file"); return; }
            try (OutputStream out = r.openOutputStream(uri)) {
                if (out == null) { call.reject("Could not open the file"); return; }
                out.write(data.getBytes(StandardCharsets.UTF_8));
            }
            JSObject res = new JSObject();
            res.put("uri", uri.toString());
            call.resolve(res);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "Could not save" : e.getMessage());
        }
    }

    /** {data}: today's and tomorrow's blocks for the home-screen widget. */
    @PluginMethod
    public void setWidget(PluginCall call) {
        Context c = getContext();
        PlannerWidget.prefs(c).edit().putString("data", call.getString("data", "{}")).apply();
        PlannerWidget.updateAll(c);
        call.resolve();
    }

    /** Tasks ticked on the widget since the app last looked: [{date, id}]. Clears the list. */
    @PluginMethod
    public void takeWidgetDone(PluginCall call) {
        SharedPreferences p = PlannerWidget.prefs(getContext());
        JSArray items;
        synchronized (PlannerWidget.LOCK) {
            try { items = new JSArray(p.getString("pending", "[]")); } catch (Exception e) { items = new JSArray(); }
            p.edit().putString("pending", "[]").apply();
        }
        JSObject res = new JSObject();
        res.put("items", items);
        call.resolve(res);
    }

    @PluginMethod
    public void healthStatus(PluginCall call) { call.resolve(HealthBridge.status(getContext())); }

    /** Shows Android's Health Connect permission screen for steps and sleep. */
    @PluginMethod
    public void healthRequest(PluginCall call) {
        if (!HealthBridge.available(getContext())) { call.resolve(HealthBridge.status(getContext())); return; }
        requestPermissionForAlias("health", call, "healthPermsCallback");
    }

    @PermissionCallback
    private void healthPermsCallback(PluginCall call) { call.resolve(HealthBridge.status(getContext())); }

    /** {days}: [{date, steps, sleepMin}] for the last `days` days, newest first. */
    @PluginMethod
    public void healthDaily(PluginCall call) {
        final Context c = getContext();
        final int days = Math.max(1, Math.min(14, call.getInt("days", 7)));
        if (!HealthBridge.available(c)) { call.reject("Health Connect is not available"); return; }
        new Thread(() -> {
            JSONArray arr = HealthBridge.daily(c, days);
            JSObject res = new JSObject();
            try { res.put("days", new JSArray(arr.toString())); } catch (Exception e) { res.put("days", new JSArray()); }
            call.resolve(res);
        }).start();
    }
}
