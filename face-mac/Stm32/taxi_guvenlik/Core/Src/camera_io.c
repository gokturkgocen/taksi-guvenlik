/* CAMERA_IO_* implementation backing the ST BSP ov5640 driver.
 *
 * The BSP driver expects four free functions (CAMERA_IO_Init/Write/Read/Delay)
 * which it calls during ov5640_Init/ov5640_ReadID/etc. We bridge them to the
 * STM32 HAL I2C peripheral that CubeMX configured (hi2c1, pins PB8/PB9).
 *
 * SCCB on the OV5640 uses 16-bit register addresses and 8-bit data, even though
 * the BSP types name them uint16_t. We mask to 8 bits when writing/reading.
 */

#include "camera_io.h"
#include "main.h"

extern I2C_HandleTypeDef hi2c1;

#define CAM_I2C_TIMEOUT_MS  100U

void CAMERA_IO_Init(void) {
    /* hi2c1 is already initialized by MX_I2C1_Init() from main.c, nothing to do here. */
}

void CAMERA_IO_Write(uint8_t addr, uint16_t reg, uint16_t value) {
    uint8_t data = (uint8_t)(value & 0xFF);
    HAL_I2C_Mem_Write(&hi2c1, addr, reg, I2C_MEMADD_SIZE_16BIT,
                      &data, 1, CAM_I2C_TIMEOUT_MS);
}

uint16_t CAMERA_IO_Read(uint8_t addr, uint16_t reg) {
    uint8_t data = 0;
    if (HAL_I2C_Mem_Read(&hi2c1, addr, reg, I2C_MEMADD_SIZE_16BIT,
                         &data, 1, CAM_I2C_TIMEOUT_MS) != HAL_OK) {
        return 0xFFFF;
    }
    return (uint16_t)data;
}

void CAMERA_Delay(uint32_t delay) {
    HAL_Delay(delay);
}
