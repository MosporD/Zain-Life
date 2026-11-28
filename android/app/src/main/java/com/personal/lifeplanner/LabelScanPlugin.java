package com.personal.lifeplanner;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/** Reads the text on a photo of a nutrition label, on the phone (ML Kit, bundled model, no internet).
 *  JS sends the photo as base64 JPEG (already rotated and shrunk); this returns every text line with its
 *  box so www/labelscan.js can rebuild the table rows. The photo is not saved anywhere. */
@CapacitorPlugin(name = "LabelScan")
public class LabelScanPlugin extends Plugin {
    @PluginMethod
    public void read(PluginCall call) {
        String data = call.getString("image");
        if (data == null || data.isEmpty()) { call.reject("No image"); return; }
        int comma = data.indexOf(',');
        if (comma >= 0) data = data.substring(comma + 1);
        final Bitmap bmp;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException e) { call.reject("Not an image"); return; }
        if (bmp == null) { call.reject("Not an image"); return; }
        final TextRecognizer reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        reader.process(InputImage.fromBitmap(bmp, 0))
            .addOnSuccessListener(text -> {
                JSArray lines = new JSArray();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        JSObject o = new JSObject();
                        o.put("t", line.getText());
                        Rect r = line.getBoundingBox();
                        if (r != null) { o.put("x", r.left); o.put("y", r.top); o.put("w", r.width()); o.put("h", r.height()); }
                        lines.put(o);
                    }
                }
                JSObject res = new JSObject();
                res.put("lines", lines);
                res.put("w", bmp.getWidth());
                res.put("h", bmp.getHeight());
                reader.close();
                call.resolve(res);
            })
            .addOnFailureListener(e -> { reader.close(); call.reject("Could not read the photo: " + e.getMessage()); });
    }
}
