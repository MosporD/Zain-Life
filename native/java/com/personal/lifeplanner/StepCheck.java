package com.personal.lifeplanner;

/**
 * Decides whether the steps counted over one stretch (about a minute, three 20-second GPS fixes)
 * came from real movement. Plain Java with no Android classes, so it can be tested on a PC.
 */
final class StepCheck {
    static final int IDLE = 0;      // too few steps to judge
    static final int MOVING = 1;    // the phone moved about as far as the steps say
    static final int STILL = 2;     // steps went up but the phone stayed in the same place
    static final int UNKNOWN = 3;   // GPS too weak to tell (indoors, between tall buildings)
    static final int VEHICLE = 4;   // faster than anyone walks or runs: steps from a car's bumps
    static final int MOCK = 5;      // a fake-GPS app supplied the position

    static final String[] NAMES = { "idle", "moving", "still", "unknown", "vehicle", "mock" };

    static final double STRIDE_M = 0.7;      // an average adult step
    static final double SHARE = 0.35;        // must cover at least 35% of the expected distance
    static final double MIN_NOISE_M = 10;    // a phone lying still still "wanders" this much
    static final double MAX_ACC_M = 30;      // fixes worse than this can't judge anything
    static final double MAX_SPEED = 7;       // m/s, about 25 km/h
    static final int MIN_STEPS = 20;
    static final long SPAN_MS = 60_000;      // judge once a minute (every third fix)

    private StepCheck() {}

    /**
     * @param steps steps counted between the two fixes
     * @param distM straight-line distance between the two fixes, in metres
     * @param accA  accuracy radius of the first fix, in metres
     * @param accB  accuracy radius of the second fix, in metres
     * @param dtMs  time between the two fixes
     * @param mock  either fix came from a fake-location app
     */
    static int verdict(int steps, double distM, double accA, double accB, long dtMs, boolean mock) {
        if (steps < MIN_STEPS) return IDLE;
        if (mock) return MOCK;
        if (!(accA > 0) || !(accB > 0) || accA > MAX_ACC_M || accB > MAX_ACC_M) return UNKNOWN;
        if (dtMs > 0 && distM / (dtMs / 1000.0) > MAX_SPEED) return VEHICLE;
        double need = steps * STRIDE_M * SHARE;
        if (distM >= need) return MOVING;
        // Only call it "same place" when real walking would have shown clearly above the GPS noise.
        double noise = Math.max(MIN_NOISE_M, accA + accB);
        return need > noise ? STILL : UNKNOWN;
    }
}
