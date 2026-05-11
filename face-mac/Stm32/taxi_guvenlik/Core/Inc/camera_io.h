#ifndef CAMERA_IO_H
#define CAMERA_IO_H

#include <stdint.h>

/* I2C glue between ST BSP ov5640 driver and STM32 HAL.
 * Implementation lives in camera_io.c. */

void     CAMERA_IO_Init(void);
void     CAMERA_IO_Write(uint8_t addr, uint16_t reg, uint16_t value);
uint16_t CAMERA_IO_Read(uint8_t addr, uint16_t reg);
void     CAMERA_Delay(uint32_t delay);

/* OV5640 7-bit I2C address (slave). The BSP driver multiplies by 2 internally
 * for the HAL 8-bit address convention, so pass the 8-bit form (0x78). */
#define OV5640_I2C_ADDRESS  0x78

#endif
