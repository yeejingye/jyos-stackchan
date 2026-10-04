#include "xsHost.h"
#include "xsmc.h"
#include "mc.xs.h"
#include "esp_wn_models.h"
#include "esp_mn_models.h"
#include "esp_mn_speech_commands.h"
#include "model_path.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "esp_timer.h"
#include "esp_heap_caps.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define JOY_MAX_FRAME_SAMPLES 512
typedef struct {
    uint32_t generation;
    int mode;
    int16_t samples[JOY_MAX_FRAME_SAMPLES];
} JoyFrame;

typedef struct {
    srmodel_list_t *models;
    const esp_wn_iface_t *wn;
    const esp_mn_iface_t *mn;
    model_iface_data_t *wake;
    model_iface_data_t *commands;
    int chunk;
    int allocated;
    QueueHandle_t queue;
    SemaphoreHandle_t done;
    TaskHandle_t task;
    portMUX_TYPE lock;
    uint32_t generation;
    int result;
    uint32_t wake_frames, command_frames, dropped_frames, max_inference_us;
} JoyVoice;
static JoyVoice *owner;

// The worker owns all inference/reset calls. XS only submits bounded copied frames.
static void joy_voice_worker(void *argument) {
    JoyVoice *voice = argument;
    JoyFrame frame;
    uint32_t generation = 0;
    int mode = 0;
    int wake_primed = 0;
    int commands_primed = 0;
    while (xQueueReceive(voice->queue, &frame, portMAX_DELAY) == pdTRUE) {
        if (frame.mode == -1) break;
        portENTER_CRITICAL(&voice->lock);
        uint32_t current = voice->generation;
        portEXIT_CRITICAL(&voice->lock);
        if (frame.generation != current) continue;
        if (generation != current || mode != frame.mode) {
            // ESP-SR 2.5.5 WakeNet clean() faults on the Hi Joy model's optional
            // queue (decoded on-device backtrace: dl_convq_queue_bzero).
            // Recreate a used wake engine instead, never invoking its clean().
            if (!frame.mode && wake_primed) {
                voice->wn->destroy(voice->wake);
                char *name = esp_srmodel_filter(voice->models, "wn9", "hijoy");
                voice->wake = voice->wn->create(name, DET_MODE_90);
                wake_primed = 0;
            }
            if (frame.mode && commands_primed) voice->mn->clean(voice->commands);
            generation = current;
            mode = frame.mode;
        }
        int result = 0;
        int64_t started = esp_timer_get_time();
        if (!mode) {
            if (!voice->wake) result = -2;
            else {
                if (voice->wn->detect(voice->wake, frame.samples) == WAKENET_DETECTED) result = -1;
                wake_primed = 1;
            }
        } else {
            esp_mn_state_t state = voice->mn->detect(voice->commands, frame.samples);
            commands_primed = 1;
            if (state == ESP_MN_STATE_DETECTED) {
                esp_mn_results_t *results = voice->mn->get_results(voice->commands);
                if (results && results->num > 0) result = results->command_id[0];
            }
        }
        portENTER_CRITICAL(&voice->lock);
        uint32_t inference_us = esp_timer_get_time() - started;
        if (inference_us > voice->max_inference_us) voice->max_inference_us = inference_us;
        if (mode) voice->command_frames++;
        else voice->wake_frames++;
        if (result && voice->generation == generation && !voice->result) voice->result = result;
        portEXIT_CRITICAL(&voice->lock);
    }
    xSemaphoreGive(voice->done);
    vTaskDelete(NULL);
}

void xs_joy_voice_destructor(void *data) {
    JoyVoice *voice = data;
    if (!voice) return;
    if (voice->task) {
        JoyFrame stop = {.mode = -1};
        xQueueSend(voice->queue, &stop, portMAX_DELAY);
        xSemaphoreTake(voice->done, portMAX_DELAY);
    }
    if (voice->queue) vQueueDelete(voice->queue);
    if (voice->done) vSemaphoreDelete(voice->done);
    if (voice->allocated) esp_mn_commands_free();
    if (voice->commands) voice->mn->destroy(voice->commands);
    if (voice->wake) voice->wn->destroy(voice->wake);
    if (voice->models) srmodel_host_deinit(voice->models);
    if (owner == voice) owner = NULL;
    free(voice);
}
static JoyVoice *get_voice(xsMachine *the) {
    JoyVoice *voice = xsmcGetHostData(xsThis);
    if (!voice) xsUnknownError("Joy voice is closed");
    return voice;
}
void xs_joy_voice_constructor(xsMachine *the) {
    if (owner) xsUnknownError("Joy voice already owns speech models");
    void *data;
    xsUnsignedValue size;
    xsmcGetBufferReadable(xsArg(0), &data, &size);
    if (size < 4) xsRangeError("Missing voice models");
    JoyVoice *voice = calloc(1, sizeof(JoyVoice));
    if (!voice) xsUnknownError("No memory for Joy voice");
    xsmcSetHostData(xsThis, voice);
    owner = voice;
    voice->lock = (portMUX_TYPE)portMUX_INITIALIZER_UNLOCKED;
    voice->models = srmodel_load(data);
    char *wake_name = esp_srmodel_filter(voice->models, "wn9", "hijoy");
    char *command_name = esp_srmodel_filter(voice->models, "mn6", "en");
    char *fst_name = esp_srmodel_filter(voice->models, "fst", NULL);
    // MultiNet 6/7 also load the FST language graph. Check before entering the native library.
    if (!wake_name || !command_name || !fst_name) xsUnknownError("Missing Joy speech model or FST graph");
    voice->wn = esp_wn_handle_from_name(wake_name);
    voice->mn = esp_mn_handle_from_name(command_name);
    if (!voice->wn || !voice->mn) xsUnknownError("Unsupported Joy speech model");
    voice->wake = voice->wn->create(wake_name, DET_MODE_90);
    voice->commands = voice->mn->create(command_name, 5000);
    if (!voice->wake || !voice->commands) xsUnknownError("No memory for Joy speech engines");
    // Keep command weights in PSRAM: flash-backed inference exceeded the
    // microphone frame interval and dropped most of the spoken command.
    size_t available = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
    voice->commands = voice->mn->switch_loader_mode(voice->commands, ESP_MN_LOAD_FROM_PSRAM);
    if (!voice->commands) xsUnknownError("Cannot load command weights into PSRAM");
    printf("[joy-voice] command PSRAM free before=%u after=%u\n", (unsigned)available,
        (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
    voice->chunk = voice->wn->get_samp_chunksize(voice->wake);
    if (voice->chunk > JOY_MAX_FRAME_SAMPLES || voice->chunk != voice->mn->get_samp_chunksize(voice->commands) ||
        voice->wn->get_samp_rate(voice->wake) != 16000 || voice->mn->get_samp_rate(voice->commands) != 16000)
        xsUnknownError("Incompatible speech frame format");
    if (esp_mn_commands_alloc(voice->mn, voice->commands) != ESP_OK) xsUnknownError("Cannot allocate voice commands");
    voice->allocated = 1;
    const char *commands[] = {"POMODORO", "PAUSE", "RESUME", "CANCEL"};
    for (int i = 0; i < 4; i++)
        if (esp_mn_commands_add(i + 1, commands[i]) != ESP_OK) xsUnknownError("Cannot register voice command");
    if (esp_mn_commands_update()) xsUnknownError("Speech model rejected command vocabulary");
    // Four commands behind an explicit wake window; live negative tests still
    // must confirm this trial threshold before the feature is released.
    voice->mn->set_det_threshold(voice->commands, 0.65f);
    voice->queue = xQueueCreate(2, sizeof(JoyFrame));
    voice->done = xSemaphoreCreateBinary();
    if (!voice->queue || !voice->done) xsUnknownError("No memory for voice worker queue");
    if (xTaskCreatePinnedToCore(joy_voice_worker, "joyRecognition", 16384, voice, 4, &voice->task, 1) != pdPASS)
        xsUnknownError("Cannot start voice recognition worker");
}
void xs_joy_voice_chunk(xsMachine *the) { xsmcSetInteger(xsResult, get_voice(the)->chunk); }
void xs_joy_voice_reset(xsMachine *the) {
    JoyVoice *voice = get_voice(the);
    portENTER_CRITICAL(&voice->lock);
    voice->generation++;
    voice->result = 0;
    portEXIT_CRITICAL(&voice->lock);
}
void xs_joy_voice_close(xsMachine *the) {
    xs_joy_voice_destructor(xsmcGetHostData(xsThis));
    xsmcSetHostData(xsThis, NULL);
}
void xs_joy_voice_detect(xsMachine *the) {
    JoyVoice *voice = get_voice(the);
    void *data;
    xsUnsignedValue size;
    xsmcGetBufferReadable(xsArg(0), &data, &size);
    if (size != (xsUnsignedValue)(voice->chunk * 2)) xsRangeError("Invalid speech frame");
    JoyFrame frame = {.mode = xsmcToBoolean(xsArg(1))};
    portENTER_CRITICAL(&voice->lock);
    int result = voice->result;
    voice->result = 0;
    frame.generation = voice->generation;
    portEXIT_CRITICAL(&voice->lock);
    memcpy(frame.samples, data, size);
    // Never wait in the UI callback. Saturation drops input instead of accumulating work.
    if (xQueueSend(voice->queue, &frame, 0) != pdTRUE) {
        portENTER_CRITICAL(&voice->lock);
        voice->dropped_frames++;
        portEXIT_CRITICAL(&voice->lock);
    }
    xsmcSetInteger(xsResult, result);
}

void xs_joy_voice_stats(xsMachine *the) {
    JoyVoice *voice = get_voice(the);
    portENTER_CRITICAL(&voice->lock);
    uint32_t wake = voice->wake_frames, commands = voice->command_frames;
    uint32_t dropped = voice->dropped_frames, longest = voice->max_inference_us;
    portEXIT_CRITICAL(&voice->lock);
    xsmcVars(1);
    xsmcSetNewObject(xsResult);
    xsmcSetInteger(xsVar(0), wake); xsmcSet(xsResult, xsID("wakeFrames"), xsVar(0));
    xsmcSetInteger(xsVar(0), commands); xsmcSet(xsResult, xsID("commandFrames"), xsVar(0));
    xsmcSetInteger(xsVar(0), dropped); xsmcSet(xsResult, xsID("droppedFrames"), xsVar(0));
    xsmcSetInteger(xsVar(0), longest / 1000); xsmcSet(xsResult, xsID("maxInferenceMs"), xsVar(0));
}
