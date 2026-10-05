#ifndef JOY_COMMAND_POLICY_H
#define JOY_COMMAND_POLICY_H
#include <math.h>

#define JOY_COMMAND_THRESHOLD 0.65f

// ID 5 belongs only to the diagnostic reference; live grammar removes it.
static inline int joy_command_accepted(int id, float probability) {
    return id >= 1 && id <= 5 && isfinite(probability) && probability <= 1.0f &&
        probability >= JOY_COMMAND_THRESHOLD;
}
#endif
