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
#include "joy-command-policy.h"
#include "sdkconfig.h"

#if !defined(CONFIG_SR_MN_EN_MULTINET7_QUANT)
#error "Joy voice requires the matching MultiNet7 English command API configuration"
#endif
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define JOY_MAX_FRAME_SAMPLES 512
#define JOY_QUEUE_FRAMES 64
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
    StaticQueue_t queue_control;
    uint8_t *queue_storage;
    SemaphoreHandle_t done;
    TaskHandle_t task;
    portMUX_TYPE lock;
    uint32_t generation;
    int result;
    uint32_t wake_frames, command_frames, dropped_frames, max_inference_us;
    const uint8_t *reference;
    size_t reference_size;
    const uint8_t *command_references[8];
    size_t command_reference_sizes[8];
    uint32_t native_detections, command_timeouts, delivered_results;
    int self_test_result;
} JoyVoice;
static JoyVoice *owner;

static int joy_reference_test(JoyVoice *voice, const uint8_t *pcm, size_t length, int expected) {
    int16_t samples[JOY_MAX_FRAME_SAMPLES];
    size_t bytes = voice->chunk * sizeof(int16_t);
    unsigned frames = 0;
    int recognized = 0;
    int accepted = 0;
    esp_mn_state_t final_state = ESP_MN_STATE_DETECTING;
    int64_t started = esp_timer_get_time();
    for (size_t offset = 0; offset < length + 16000 * 2 * 5; offset += bytes) {
        memset(samples, 0, bytes);
        if (offset < length) {
            size_t count = length - offset;
            memcpy(samples, pcm + offset, count < bytes ? count : bytes);
        }
        esp_mn_state_t state = voice->mn->detect(voice->commands, samples);
        final_state = state;
        frames++;
        if (state == ESP_MN_STATE_DETECTED) {
            esp_mn_results_t *results = voice->mn->get_results(voice->commands);
            if (results && results->num > 0) {
                recognized = results->command_id[0];
                accepted = joy_command_accepted(recognized, results->prob[0]);
            }
            break;
        }
        if (state == ESP_MN_STATE_TIMEOUT) break;
        vTaskDelay(1);
    }
    if (final_state != ESP_MN_STATE_DETECTING) {
        esp_mn_results_t *results = voice->mn->get_results(voice->commands);
        if (results)
            printf("[joy-voice] probe-decoder state=%d candidates=%d text=%.255s raw=%.255s top-probability=%.3f\n",
                final_state, results->num, results->string, results->raw_string,
                results->num > 0 ? (double)results->prob[0] : 0.0);
    }
    voice->mn->clean(voice->commands);
    printf("[joy-voice] reference-test recognized=%d expected=%d accepted=%d elapsed-ms=%u audio-ms=%u\n", recognized,
        expected, accepted, (unsigned)((esp_timer_get_time() - started) / 1000), frames * voice->chunk / 16);
    return expected == 0 ? !accepted : recognized == expected && accepted;
}

// The worker owns all inference/reset calls. XS only submits bounded copied frames.
static void joy_voice_worker(void *argument) {
    JoyVoice *voice = argument;
    printf("[joy-voice] recognition worker core=%d\n", xPortGetCoreID());
    JoyFrame frame;
    uint32_t generation = 0;
    int mode = 0;
    int wake_primed = 0;
    int commands_primed = 0;
    if (voice->reference) {
        int passed = joy_reference_test(voice, voice->reference, voice->reference_size, 5);
        const int expected[] = {1, 2, 1, 2, 5, 3, 4, 0};
        const char *labels[] = {"start-tomato-timer", "pause", "historical-start-phrase", "pause-phrase", "same-voice-control",
            "resume-verb-context", "cancel", "negative-potato"};
        for (int i = 0; i < 8; i++) {
            if (voice->command_references[i]) {
                printf("[joy-voice] probe=%s\n", labels[i]);
                passed &= joy_reference_test(voice, voice->command_references[i], voice->command_reference_sizes[i], expected[i]);
            }
        }
        voice->mn->set_det_threshold(voice->commands, JOY_COMMAND_THRESHOLD);
        esp_mn_commands_remove("tell me a joke");
        esp_mn_commands_remove("pause the timer");
        if (esp_mn_commands_update()) printf("[joy-voice] diagnostic vocabulary cleanup failed\n");
        voice->mn->clean(voice->commands);
        commands_primed = 1;
        portENTER_CRITICAL(&voice->lock);
        voice->self_test_result = passed ? 1 : -1;
        portEXIT_CRITICAL(&voice->lock);
    }
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
                if (results && results->num > 0) {
                    int candidate = results->command_id[0];
                    float threshold = JOY_COMMAND_THRESHOLD;
                    if (joy_command_accepted(candidate, results->prob[0])) result = candidate;
                    printf("[joy-voice] native-detected id=%d probability=%.3f threshold=%.2f accepted=%d\n",
                        candidate, (double)results->prob[0], (double)threshold, result != 0);
                    portENTER_CRITICAL(&voice->lock);
                    voice->native_detections++;
                    portEXIT_CRITICAL(&voice->lock);
                }
            } else if (state == ESP_MN_STATE_TIMEOUT) {
                portENTER_CRITICAL(&voice->lock);
                voice->command_timeouts++;
                portEXIT_CRITICAL(&voice->lock);
                printf("[joy-voice] native-command-timeout\n");
                // A timed-out engine must be reset before the next utterance.
                voice->mn->clean(voice->commands);
            }
        }
        portENTER_CRITICAL(&voice->lock);
        uint32_t inference_us = esp_timer_get_time() - started;
        if (inference_us > voice->max_inference_us) voice->max_inference_us = inference_us;
        if (mode) voice->command_frames++;
        else voice->wake_frames++;
        if (result && voice->generation == generation && !voice->result) voice->result = result;
        portEXIT_CRITICAL(&voice->lock);
        // Let XS finish draining a microphone callback instead of preempting
        // the producer for a complete inference on every individual submission.
        vTaskDelay(1);
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
    if (voice->queue_storage) heap_caps_free(voice->queue_storage);
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
    voice->self_test_result = 1;
    if (xsmcArgc > 1 && xsmcTypeOf(xsArg(1)) != xsUndefinedType) {
        void *reference;
        xsUnsignedValue reference_size;
        xsmcGetBufferReadable(xsArg(1), &reference, &reference_size);
        if (!reference_size || reference_size > 160000 || reference_size % 2)
            xsRangeError("Invalid command reference PCM");
        voice->reference = reference;
        voice->reference_size = reference_size;
        voice->self_test_result = 0;
    }
    for (int i = 0; i < 8; i++) {
        if (xsmcArgc > i + 2 && xsmcTypeOf(xsArg(i + 2)) != xsUndefinedType) {
            void *reference;
            xsUnsignedValue reference_size;
            xsmcGetBufferReadable(xsArg(i + 2), &reference, &reference_size);
            if (!reference_size || reference_size > 160000 || reference_size % 2)
                xsRangeError("Invalid command reference PCM");
            voice->command_references[i] = reference;
            voice->command_reference_sizes[i] = reference_size;
        }
    }
    voice->models = srmodel_load(data);
    char *wake_name = esp_srmodel_filter(voice->models, "wn9", "hijoy");
    char *command_name = esp_srmodel_filter(voice->models, "mn7", "en");
    char *fst_name = esp_srmodel_filter(voice->models, "fst", NULL);
    // MultiNet7 also loads the FST language graph. Check before entering the native library.
    if (!wake_name || !command_name || !fst_name) xsUnknownError("Missing Joy speech model or FST graph");
    voice->wn = esp_wn_handle_from_name(wake_name);
    voice->mn = esp_mn_handle_from_name(command_name);
    if (!voice->wn || !voice->mn) xsUnknownError("Unsupported Joy speech model");
    voice->wake = voice->wn->create(wake_name, DET_MODE_90);
    voice->commands = voice->mn->create(command_name, 5000);
    if (!voice->wake || !voice->commands) xsUnknownError("No memory for Joy speech engines");
    // Keep loading mode at its default while comparing model/pronunciation.
    // The old MN6 loader callback was unavailable; changing this too would
    // confound the speed comparison and introduce another allocation risk.
    printf("[joy-voice] command model=%s default loader; free PSRAM=%u internal=%u\n", command_name,
        (unsigned)heap_caps_get_free_size(MALLOC_CAP_SPIRAM),
        (unsigned)heap_caps_get_free_size(MALLOC_CAP_INTERNAL));
    voice->chunk = voice->wn->get_samp_chunksize(voice->wake);
    if (voice->chunk > JOY_MAX_FRAME_SAMPLES || voice->chunk != voice->mn->get_samp_chunksize(voice->commands) ||
        voice->wn->get_samp_rate(voice->wake) != 16000 || voice->mn->get_samp_rate(voice->commands) != 16000)
        xsUnknownError("Incompatible speech frame format");
    if (esp_mn_commands_alloc(voice->mn, voice->commands) != ESP_OK) xsUnknownError("Cannot allocate voice commands");
    voice->allocated = 1;
    const char *commands[] = {"start tomato timer", "pause", "resume", "cancel"};
    // Espressif multinet_g2p.py, g2p_en 2.1.0. Resume uses verb context,
    // rather than the isolated-word noun pronunciation (resume/résumé).
    const char *phonemes[] = {"STnRT TcMdTb TiMk", "PeZ", "RmZoM", "KaNScL"};
    for (int i = 0; i < 4; i++)
        if (esp_mn_commands_phoneme_add(i + 1, commands[i], phonemes[i]) != ESP_OK)
            xsUnknownError("Cannot register voice command");
    if (voice->reference && esp_mn_commands_phoneme_add(5, "tell me a joke", "TfL Mm c qbK") != ESP_OK)
        xsUnknownError("Cannot register reference command");
    if (voice->reference && esp_mn_commands_phoneme_add(2, "pause the timer", "PeZ jc TiMk") != ESP_OK)
        xsUnknownError("Cannot register diagnostic phrases");
    if (esp_mn_commands_update()) xsUnknownError("Speech model rejected command vocabulary");
    if (voice->reference) esp_mn_active_commands_print();
    // Low-threshold synthetic probes produced wrong commands. Preserve the
    // previous live threshold until a replacement passes command/negative tests.
    voice->mn->set_det_threshold(voice->commands, JOY_COMMAND_THRESHOLD);
    voice->queue_storage = heap_caps_malloc(JOY_QUEUE_FRAMES * sizeof(JoyFrame), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (voice->queue_storage)
        voice->queue = xQueueCreateStatic(JOY_QUEUE_FRAMES, sizeof(JoyFrame), voice->queue_storage, &voice->queue_control);
    voice->done = xSemaphoreCreateBinary();
    if (!voice->queue || !voice->done) xsUnknownError("No memory for voice worker queue");
    // Test isolation from the XS caller's current core. Keep inference below
    // the priority-4 producer; core placement does not replace capture priority.
    int caller_core = xPortGetCoreID();
    int recognition_core = 1 - caller_core;
    printf("[joy-voice] constructor core=%d recognition target=%d\n", caller_core, recognition_core);
    if (xTaskCreatePinnedToCore(joy_voice_worker, "joyRecognition", 16384, voice, 3, &voice->task,
            recognition_core) != pdPASS)
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
    if (result > 0) voice->delivered_results++;
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
    int self_test_result = voice->self_test_result;
    uint32_t detections = voice->native_detections, timeouts = voice->command_timeouts, delivered = voice->delivered_results;
    portEXIT_CRITICAL(&voice->lock);
    xsmcVars(1);
    xsmcSetNewObject(xsResult);
    xsmcSetInteger(xsVar(0), wake); xsmcSet(xsResult, xsID("wakeFrames"), xsVar(0));
    xsmcSetInteger(xsVar(0), commands); xsmcSet(xsResult, xsID("commandFrames"), xsVar(0));
    xsmcSetInteger(xsVar(0), dropped); xsmcSet(xsResult, xsID("droppedFrames"), xsVar(0));
    xsmcSetInteger(xsVar(0), longest / 1000); xsmcSet(xsResult, xsID("maxInferenceMs"), xsVar(0));
    xsmcSetInteger(xsVar(0), self_test_result); xsmcSet(xsResult, xsID("selfTestResult"), xsVar(0));
    xsmcSetInteger(xsVar(0), detections); xsmcSet(xsResult, xsID("nativeDetections"), xsVar(0));
    xsmcSetInteger(xsVar(0), timeouts); xsmcSet(xsResult, xsID("commandTimeouts"), xsVar(0));
    xsmcSetInteger(xsVar(0), delivered); xsmcSet(xsResult, xsID("deliveredResults"), xsVar(0));
}
