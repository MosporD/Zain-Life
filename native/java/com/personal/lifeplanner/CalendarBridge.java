package com.personal.lifeplanner;

import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

/** Reads meetings from the phone's calendars (Google, Samsung, Outlook when it syncs to the phone). Read-only. */
final class CalendarBridge {
    private CalendarBridge() {}

    /** Events from the start of today for `days` days, earliest first. Skips declined and cancelled ones. */
    static JSONArray events(Context c, int days) {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long begin = cal.getTimeInMillis();
        cal.add(Calendar.DAY_OF_MONTH, days);
        long end = cal.getTimeInMillis();

        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, begin);
        ContentUris.appendId(b, end);
        String[] cols = {
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END,
            CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.EVENT_LOCATION,
            CalendarContract.Instances.CALENDAR_DISPLAY_NAME,
            CalendarContract.Instances.SELF_ATTENDEE_STATUS,
            CalendarContract.Instances.STATUS
        };
        JSONArray out = new JSONArray();
        try (Cursor cur = c.getContentResolver().query(b.build(), cols, CalendarContract.Instances.VISIBLE + "=1", null,
                CalendarContract.Instances.BEGIN + " ASC")) {
            if (cur == null) return out;
            while (cur.moveToNext()) {
                if (cur.getInt(6) == CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) continue;
                if (!cur.isNull(7) && cur.getInt(7) == CalendarContract.Events.STATUS_CANCELED) continue;
                JSONObject e = new JSONObject();
                e.put("title", cur.isNull(0) ? "" : cur.getString(0));
                e.put("begin", cur.getLong(1));
                e.put("end", cur.getLong(2));
                e.put("allDay", cur.getInt(3) == 1);
                e.put("location", cur.isNull(4) ? "" : cur.getString(4));
                e.put("calendar", cur.isNull(5) ? "" : cur.getString(5));
                out.put(e);
            }
        } catch (Exception ignored) {
            // A calendar provider that misbehaves should not crash the app; the list is just shorter.
        }
        return out;
    }
}
