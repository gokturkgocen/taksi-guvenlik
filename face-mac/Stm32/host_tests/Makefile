# Host-side test build for the STM32 state machine.
#
# Compiles state_machine.c plus the test driver with gcc/clang. No HAL
# headers needed — the module is portable C99 with a callback vtable.

CC      ?= cc
CFLAGS  ?= -std=c99 -Wall -Wextra -Wpedantic -Wshadow -Wconversion -O2 -g
SRC      = test_state_machine.c ../taxi_guvenlik/Core/Src/state_machine.c
OUT      = test_state_machine
INCLUDES = -I../taxi_guvenlik/Core/Inc

.PHONY: all run clean

all: $(OUT)

$(OUT): $(SRC)
	$(CC) $(CFLAGS) $(INCLUDES) $(SRC) -o $(OUT)

run: $(OUT)
	./$(OUT)

clean:
	rm -f $(OUT)
