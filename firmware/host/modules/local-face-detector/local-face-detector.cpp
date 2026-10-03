#include "xsHost.h"
#include "xsmc.h"
#include "mc.xs.h"
#include "human_face_detect.hpp"
#include "esp_timer.h"
#include <new>

extern "C" void xs_local_face_destructor(void *data) { delete static_cast<HumanFaceDetect *>(data); }
extern "C" void xs_local_face_constructor(xsMachine *the) {
    auto *detector = new (std::nothrow) HumanFaceDetect();
    if (!detector) xsUnknownError("no memory for local face detector");
    xsmcSetHostData(xsThis, detector);
}
extern "C" void xs_local_face_close(xsMachine *the) {
    xs_local_face_destructor(xsmcGetHostData(xsThis));
    xsmcSetHostData(xsThis, nullptr);
}
extern "C" void xs_local_face_detect(xsMachine *the) {
    auto *detector = static_cast<HumanFaceDetect *>(xsmcGetHostData(xsThis));
    if (!detector) xsUnknownError("local face detector is closed");
    void *pixels;
    xsUnsignedValue length;
    const int width = xsmcToInteger(xsArg(1)), height = xsmcToInteger(xsArg(2));
    if ((width != 176) || (height != 144)) xsRangeError("expected 176x144 RGB565LE");
    xsmcGetBufferReadable(xsArg(0), &pixels, &length);
    if (length != static_cast<unsigned>(width * height * 2)) xsRangeError("invalid camera frame length");
    dl::image::img_t image = {pixels, static_cast<uint16_t>(width), static_cast<uint16_t>(height), dl::image::DL_IMAGE_PIX_TYPE_RGB565LE};
    const int64_t start = esp_timer_get_time();
    auto &faces = detector->run(image);
    xsmcVars(1);
    xsmcSetInteger(xsVar(0), (esp_timer_get_time() - start) / 1000);
    xsmcSet(xsThis, xsID("inferenceMs"), xsVar(0));
    const dl::detect::result_t *largest = nullptr;
    int largestArea = 0;
    for (const auto &face : faces) {
        if (face.box.size() < 4 || face.score < 0.5f) continue;
        const int area = (face.box[2] - face.box[0]) * (face.box[3] - face.box[1]);
        if (area > largestArea) { largest = &face; largestArea = area; }
    }
    if (!largest) { xsmcSetNull(xsResult); return; }
    xsmcSetNewObject(xsResult);
    xsmcSetNumber(xsVar(0), (largest->box[0] + largest->box[2]) / (2.0 * width));
    xsmcSet(xsResult, xsID("x"), xsVar(0));
    xsmcSetNumber(xsVar(0), (largest->box[1] + largest->box[3]) / (2.0 * height));
    xsmcSet(xsResult, xsID("y"), xsVar(0));
    xsmcSetNumber(xsVar(0), largest->score);
    xsmcSet(xsResult, xsID("confidence"), xsVar(0));
}
