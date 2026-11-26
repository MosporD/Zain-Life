package com.personal.lifeplanner;

/** Run: npm run test:java (needs a JDK). */
public class StepCheckTest {
    static int fails = 0;
    static void eq(String what, int want, int got) {
        if (want != got) { fails++; System.out.println("FAIL " + what + ": want " + StepCheck.NAMES[want] + ", got " + StepCheck.NAMES[got]); }
        else System.out.println("ok   " + what);
    }
    public static void main(String[] a) {
        // A minute of normal walking: ~100 steps, ~65 m along a street, good GPS.
        eq("walking a minute", StepCheck.MOVING, StepCheck.verdict(100, 65, 6, 8, 60_000, false));
        // Slow walk with a few turns: 60 steps, 20 m apart.
        eq("slow walk with turns", StepCheck.MOVING, StepCheck.verdict(60, 20, 8, 8, 60_000, false));
        // Rocking the phone at a desk: 120 steps a minute, GPS jitters 6 m.
        eq("rocking the phone", StepCheck.STILL, StepCheck.verdict(120, 6, 5, 7, 60_000, false));
        // Same, with weaker but usable GPS (12 m), jitter 14 m.
        eq("rocking, weaker GPS", StepCheck.STILL, StepCheck.verdict(120, 14, 12, 12, 60_000, false));
        // Few steps cannot be told apart from GPS noise.
        eq("a few steps", StepCheck.IDLE, StepCheck.verdict(12, 3, 5, 5, 20_000, false));
        eq("short stretch inside the noise", StepCheck.UNKNOWN, StepCheck.verdict(30, 4, 10, 10, 20_000, false));
        // Indoors: 60 m accuracy, nothing can be judged.
        eq("indoors, weak GPS", StepCheck.UNKNOWN, StepCheck.verdict(100, 2, 60, 45, 60_000, false));
        eq("no accuracy reported", StepCheck.UNKNOWN, StepCheck.verdict(100, 60, 0, 5, 60_000, false));
        // In a car: 40 steps from bumps, 700 m in a minute.
        eq("in a car", StepCheck.VEHICLE, StepCheck.verdict(40, 700, 5, 5, 60_000, false));
        // Running is still moving: 170 steps, 200 m (3.3 m/s).
        eq("running", StepCheck.MOVING, StepCheck.verdict(170, 200, 5, 5, 60_000, false));
        // Fake GPS app wins over everything else.
        eq("fake GPS", StepCheck.MOCK, StepCheck.verdict(100, 65, 5, 5, 60_000, true));
        if (fails > 0) { System.out.println(fails + " failed"); System.exit(1); }
        System.out.println("StepCheck: all passed");
    }
}
