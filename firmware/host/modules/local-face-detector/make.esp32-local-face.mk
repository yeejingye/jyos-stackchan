# Keep the SDK's normal build and specialize only the ESP-DL binding.
include $(MODDABLE)/tools/mcconfig/make.esp32.mk
C_INCLUDES += -I$(IDF_PATH)/components/esp_mm/include
$(TMP_DIR)/local-face-detector.cpp.o: C_FLAGS := $(filter-out -std=gnu17 -Wno-implicit-function-declaration,$(C_FLAGS)) -std=gnu++20
