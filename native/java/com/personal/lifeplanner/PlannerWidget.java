package com.personal.lifeplanner;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Home-screen widget: "Now" from today's plan (with a ✓ to tick it), then the next block, the next prayer
 *  and the next meeting from the phone's calendar. */
public class PlannerWidget extends AppWidgetProvider {
    static final String ACTION_DONE = "com.personal.lifeplanner.WIDGET_DONE";
    static final String ACTION_TICK = "com.personal.lifeplanner.WIDGET_TICK";
    static final Object LOCK = new Object();

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("lp_widget", Context.MODE_PRIVATE);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { updateAll(c); }

    @Override
    public void onDisabled(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(tickIntent(c));
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        String a = intent.getAction();
        if (ACTION_DONE.equals(a)) {
            markDone(c, intent.getStringExtra("date"), intent.getStringExtra("id"));
            updateAll(c);
        } else if (ACTION_TICK.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a)) {
            updateAll(c);
        }
    }

    /** Records the tick for the app (applied when it next opens) and in the widget's own copy. */
    private static void markDone(Context c, String date, String id) {
        if (date == null || id == null) return;
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            try {
                JSONArray pend = new JSONArray(p.getString("pending", "[]"));
                pend.put(new JSONObject().put("date", date).put("id", id));
                JSONObject data = new JSONObject(p.getString("data", "{}"));
                JSONObject done = data.optJSONObject("done");
                if (done == null) { done = new JSONObject(); data.put("done", done); }
                JSONArray list = done.optJSONArray(date);
                if (list == null) { list = new JSONArray(); done.put(date, list); }
                list.put(id);
                p.edit().putString("pending", pend.toString()).putString("data", data.toString()).apply();
            } catch (Exception ignored) { }
        }
    }

    private static JSONObject LBL = null;
    private static String t(String key, String en) {
        return LBL != null && LBL.has(key) ? LBL.optString(key, en) : en;
    }

    private static String fmt(int m) {
        m = ((m % 1440) + 1440) % 1440;
        int h = m / 60, mm = m % 60;
        return (h % 12 == 0 ? 12 : h % 12) + (mm != 0 ? ":" + (mm < 10 ? "0" : "") + mm : "") + " " + (h >= 12 ? t("pm", "pm") : t("am", "am"));
    }

    private static boolean contains(JSONArray a, String id) {
        if (a == null) return false;
        for (int i = 0; i < a.length(); i++) if (id.equals(a.optString(i))) return true;
        return false;
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, PlannerWidget.class));
        if (ids == null || ids.length == 0) return;
        m.updateAppWidget(ids, build(c));
    }

    private static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_planner);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        Calendar cal = Calendar.getInstance();
        int now = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        String today = f.format(cal.getTime());
        cal.add(Calendar.DAY_OF_MONTH, 1);
        String tomorrow = f.format(cal.getTime());

        JSONObject cur = null, next = null, prayer = null, meeting = null;
        boolean nextTomorrow = false, curDone = false, prayerTomorrow = false;
        long nowMs = System.currentTimeMillis();
        Calendar mid = Calendar.getInstance();
        mid.set(Calendar.HOUR_OF_DAY, 0); mid.set(Calendar.MINUTE, 0); mid.set(Calendar.SECOND, 0); mid.set(Calendar.MILLISECOND, 0);
        long midMs = mid.getTimeInMillis();
        int nextChange = -1;
        try {
            JSONObject data = new JSONObject(prefs(c).getString("data", "{}"));
            JSONObject days = data.optJSONObject("days"), done = data.optJSONObject("done");
            LBL = data.optJSONObject("labels");
            JSONArray list = days == null ? null : days.optJSONArray(today);
            if (list != null) {
                for (int i = 0; i < list.length(); i++) {
                    JSONObject b = list.getJSONObject(i);
                    int s = b.getInt("s"), e = b.getInt("e");
                    if (now >= s && now < e && (cur == null || s >= cur.getInt("s"))) cur = b;      // most specific block wins
                    if (s > now && (next == null || s < next.getInt("s"))) next = b;
                }
            }
            if (next == null && days != null) {
                JSONArray t = days.optJSONArray(tomorrow);
                if (t != null && t.length() > 0) {
                    for (int i = 0; i < t.length(); i++) {
                        JSONObject b = t.getJSONObject(i);
                        if (b.getInt("s") >= 4 * 60 && (next == null || b.getInt("s") < next.getInt("s"))) next = b;
                    }
                    nextTomorrow = next != null;
                }
            }
            JSONObject prayers = data.optJSONObject("prayers");
            JSONArray pt = prayers == null ? null : prayers.optJSONArray(today);
            if (pt != null) for (int i = 0; i < pt.length(); i++) {
                JSONObject p = pt.getJSONObject(i);
                if (p.getInt("s") > now && (prayer == null || p.getInt("s") < prayer.getInt("s"))) prayer = p;
            }
            if (prayer == null && prayers != null) {
                JSONArray tp = prayers.optJSONArray(tomorrow);
                if (tp != null && tp.length() > 0) { prayer = tp.getJSONObject(0); prayerTomorrow = true; }
            }
            JSONArray ms = data.optJSONArray("meetings");
            if (ms != null) for (int i = 0; i < ms.length(); i++) {
                JSONObject x = ms.getJSONObject(i);
                if (x.getLong("e") > nowMs && (meeting == null || x.getLong("b") < meeting.getLong("b"))) meeting = x;
            }
            if (cur != null) curDone = contains(done == null ? null : done.optJSONArray(today), cur.getString("id"));
            if (cur != null) nextChange = cur.getInt("e");
            if (next != null && !nextTomorrow && (nextChange < 0 || next.getInt("s") < nextChange)) nextChange = next.getInt("s");
            if (prayer != null && !prayerTomorrow && (nextChange < 0 || prayer.getInt("s") < nextChange)) nextChange = prayer.getInt("s");
            if (meeting != null) {   // redraw when it starts, and again when it ends
                int mb = (int) ((meeting.getLong("b") - midMs) / 60000), me = (int) ((meeting.getLong("e") - midMs) / 60000);
                int edge = mb > now ? mb : me;
                if (edge > now && edge < 1440 && (nextChange < 0 || edge < nextChange)) nextChange = edge;
            }
        } catch (Exception ignored) { }

        if (cur != null) {
            v.setTextViewText(R.id.w_label, curDone ? t("done", "NOW · DONE") : t("now", "NOW"));
            v.setTextViewText(R.id.w_now, cur.optString("t"));
            v.setTextViewText(R.id.w_until, t("until", "until") + " " + fmt(cur.optInt("e")));
        } else {
            v.setTextViewText(R.id.w_label, t("now", "NOW"));
            v.setTextViewText(R.id.w_now, next == null ? t("dayDone", "Day is done") : t("open", "Open time"));
            v.setTextViewText(R.id.w_until, next == null ? t("ready", "Tomorrow’s plan is ready") : t("nothing", "Nothing planned"));
        }
        line(v, R.id.w_next, next == null ? null : t("next", "Next") + " · " + next.optString("t") + " · " + (nextTomorrow ? t("tomorrow", "tomorrow") + " " : "") + fmt(next.optInt("s")));
        line(v, R.id.w_prayer, prayer == null ? null : t("prayer", "Prayer") + " · " + prayer.optString("t") + " · " + (prayerTomorrow ? t("tomorrow", "tomorrow") + " " : "") + fmt(prayer.optInt("s")));
        if (meeting != null) {
            long b = meeting.optLong("b");
            boolean live = b <= nowMs;
            int mb = (int) ((b - midMs) / 60000);
            String when = live ? t("until", "until") + " " + fmt((int) ((meeting.optLong("e") - midMs) / 60000))
                : (mb >= 1440 ? (mb < 2880 ? t("tomorrow", "tomorrow") + " " : "") : "") + fmt(mb);
            line(v, R.id.w_meeting, (live ? t("meetingNow", "Meeting now") : t("meeting", "Meeting")) + " · " + meeting.optString("t") + " · " + when);
        } else {
            line(v, R.id.w_meeting, null);
        }

        if (cur != null && !curDone) {
            Intent d = new Intent(c, PlannerWidget.class).setAction(ACTION_DONE)
                .putExtra("date", today).putExtra("id", cur.optString("id"));
            v.setOnClickPendingIntent(R.id.w_done, PendingIntent.getBroadcast(c, 7301, d, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            v.setViewVisibility(R.id.w_done, View.VISIBLE);
        } else {
            v.setViewVisibility(R.id.w_done, View.GONE);
        }

        // Redraw when the current block ends or the next one starts (or at midnight).
        Calendar at = Calendar.getInstance();
        at.set(Calendar.SECOND, 5);
        at.set(Calendar.MILLISECOND, 0);
        int target = nextChange > now ? nextChange : 1440;
        at.set(Calendar.HOUR_OF_DAY, 0);
        at.set(Calendar.MINUTE, 0);
        at.add(Calendar.MINUTE, target);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.set(AlarmManager.RTC, at.getTimeInMillis(), tickIntent(c));
        return v;
    }

    private static void line(RemoteViews v, int id, String text) {
        if (text == null) { v.setViewVisibility(id, View.GONE); return; }
        v.setTextViewText(id, text);
        v.setViewVisibility(id, View.VISIBLE);
    }

    private static PendingIntent tickIntent(Context c) {
        Intent i = new Intent(c, PlannerWidget.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(c, 7302, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
