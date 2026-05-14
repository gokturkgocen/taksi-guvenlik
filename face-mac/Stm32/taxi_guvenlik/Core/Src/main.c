/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2026 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "main.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */

/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/

DCMI_HandleTypeDef hdcmi;
DMA_HandleTypeDef hdma_dcmi;

I2C_HandleTypeDef hi2c1;

UART_HandleTypeDef huart1;
UART_HandleTypeDef huart2;
UART_HandleTypeDef huart3;

/* USER CODE BEGIN PV */

/* Application state machine. Single-passenger flow: TARA → SCAN → MATCH/NOMATCH → IDLE.
 * PANIC button bypasses scan and goes straight to alert. */
typedef enum {
    STATE_IDLE = 0,
    STATE_SCANNING,
    STATE_MATCH,
    STATE_NOMATCH,
    STATE_PANIC,
    STATE_NETERR,
} app_state_t;

static volatile app_state_t app_state = STATE_IDLE;
static uint32_t state_entered_ms = 0;
static char match_name[48] = {0};
static float match_sim = 0.0f;

/* USART6 = ESP32-CAM uplink. We hand-configure USART6 instead of CubeMX's
 * USART1 because PG14/PG9 are wired to the NUCLEO-F767ZI Arduino D1/D0
 * silkscreen pads — far easier for users to identify than the Morpho-only
 * PA9/PA10. huart1 stays initialized by CubeMX (no harm) but is unused. */
UART_HandleTypeDef huart6;
static uint8_t cam_rxb = 0;
static char cam_line[96];
static volatile size_t cam_idx = 0;
static volatile bool cam_line_ready = false;

/* Pending event flags set from EXTI ISR, consumed in main loop. */
static volatile bool flag_tara = false;
static volatile bool flag_panic = false;

#define SCAN_TIMEOUT_MS    15000  /* ESP-CAM should answer within this. */
#define MATCH_HOLD_MS       5000  /* How long to hold red+buzzer on MATCH. */
#define NOMATCH_HOLD_MS     1000
#define PANIC_HOLD_MS       5000
#define NETERR_HOLD_MS      3000

/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MPU_Config(void);
static void MX_GPIO_Init(void);
static void MX_DMA_Init(void);
static void MX_DCMI_Init(void);
static void MX_I2C1_Init(void);
static void MX_USART1_UART_Init(void);
static void MX_USART2_UART_Init(void);
static void MX_USART3_UART_Init(void);
/* USER CODE BEGIN PFP */
static void SystemClock_Config_216MHz(void);
static void uart_set_baud(UART_HandleTypeDef *huart, uint32_t baud);
static void MX_USART6_UART_Init_Manual(void);  /* hand-rolled USART6 setup */
static void enter_state(app_state_t s);
static void apply_state_outputs(app_state_t s);
static void send_cam(const char *line);     /* USART6 (Arduino D0/D1) → ESP32-CAM */
static void send_phone(const char *line);   /* USART2 → HM-10 → Android */
static void process_cam_line(const char *line);
int _write(int fd, char *ptr, int len);     /* printf retarget to USART3 */
/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */

/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{

  /* USER CODE BEGIN 1 */

  /* USER CODE END 1 */

  /* MPU Configuration--------------------------------------------------------*/
  MPU_Config();

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();           /* CubeMX baseline (HSI 16 MHz, no PLL) */
  SystemClock_Config_216MHz();    /* HSI × PLL → 216 MHz */

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_DMA_Init();
  MX_DCMI_Init();
  MX_I2C1_Init();
  MX_USART1_UART_Init();
  MX_USART2_UART_Init();
  MX_USART3_UART_Init();
  /* USER CODE BEGIN 2 */

  /* USART baud overrides — CubeMX hard-codes 115200 across the board.
   *   USART2 → HM-10 BLE      : 9600   (HM-10 default)
   *   USART3 → ST-LINK VCP    : 115200 (printf debug, unchanged)
   *   USART6 → ESP32-CAM      : configured below at 115200, Arduino D0/D1 pins
   * huart1 is left at 115200 by CubeMX; we don't use it (kept to avoid touching
   * generated MX_USART1_UART_Init).
   */
  uart_set_baud(&huart2, 9600);
  uart_set_baud(&huart3, 115200);
  MX_USART6_UART_Init_Manual();

  /* Configure onboard LD2 blue LED (PB7) as heartbeat — visible without
   * external wiring. CubeMX didn't map PB7. */
  {
      GPIO_InitTypeDef gp = {0};
      gp.Pin = GPIO_PIN_7;
      gp.Mode = GPIO_MODE_OUTPUT_PP;
      gp.Pull = GPIO_NOPULL;
      gp.Speed = GPIO_SPEED_FREQ_LOW;
      HAL_GPIO_Init(GPIOB, &gp);
  }

  setvbuf(stdout, NULL, _IONBF, 0);
  printf("\r\n[STM] boot, HCLK=%lu Hz, plan-B (esp-cam slave)\r\n",
         HAL_RCC_GetHCLKFreq());

  /* Camera control pins are no longer wired to anything in Plan B but the
   * GPIO outputs still exist (CubeMX-generated). Leave them low/idle. */
  HAL_GPIO_WritePin(CAM_PWDN_GPIO_Port, CAM_PWDN_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(CAM_RESET_GPIO_Port, CAM_RESET_Pin, GPIO_PIN_RESET);

  /* Start USART6 line reception from ESP32-CAM (Arduino D0 = PG9 RX). */
  HAL_UART_Receive_IT(&huart6, &cam_rxb, 1);

  enter_state(STATE_IDLE);
  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* Heartbeat for "firmware alive" — blink LD2 (PB7) every 500 ms. */
    static uint32_t last_blink = 0;
    uint32_t now = HAL_GetTick();
    if (now - last_blink >= 500) {
        HAL_GPIO_TogglePin(GPIOB, GPIO_PIN_7);
        last_blink = now;
    }

    /* Button events from EXTI. */
    if (flag_panic) {
        flag_panic = false;
        printf("[STM] PANIC button pressed\r\n");
        send_phone("PANIC\n");
        enter_state(STATE_PANIC);
    }
    if (flag_tara) {
        flag_tara = false;
        if (app_state == STATE_IDLE) {
            printf("[STM] TARA pressed, requesting capture\r\n");
            send_phone("SCANNING\n");
            send_cam("CAPTURE\n");
            enter_state(STATE_SCANNING);
        } else {
            printf("[STM] TARA ignored (state=%d)\r\n", app_state);
        }
    }

    /* ESP32-CAM lines on USART6 (Arduino D0 RX). */
    if (cam_line_ready) {
        process_cam_line(cam_line);
        cam_idx = 0;
        cam_line_ready = false;
    }

    /* Scan timeout: if ESP-CAM doesn't answer in time, drop to NETERR. */
    if (app_state == STATE_SCANNING &&
        (now - state_entered_ms) > SCAN_TIMEOUT_MS) {
        printf("[STM] scan timeout\r\n");
        send_phone("NETERR\n");
        enter_state(STATE_NETERR);
    }

    /* Auto-return to IDLE after hold period for transient states. */
    uint32_t elapsed = now - state_entered_ms;
    if ((app_state == STATE_MATCH   && elapsed > MATCH_HOLD_MS)   ||
        (app_state == STATE_NOMATCH && elapsed > NOMATCH_HOLD_MS) ||
        (app_state == STATE_PANIC   && elapsed > PANIC_HOLD_MS)   ||
        (app_state == STATE_NETERR  && elapsed > NETERR_HOLD_MS)) {
        enter_state(STATE_IDLE);
    }
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
  }
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  /** Configure the main internal regulator output voltage
  */
  __HAL_RCC_PWR_CLK_ENABLE();
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE3);

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_NONE;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_HSI;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV1;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_0) != HAL_OK)
  {
    Error_Handler();
  }
}

/**
  * @brief DCMI Initialization Function
  * @param None
  * @retval None
  */
static void MX_DCMI_Init(void)
{

  /* USER CODE BEGIN DCMI_Init 0 */

  /* USER CODE END DCMI_Init 0 */

  /* USER CODE BEGIN DCMI_Init 1 */

  /* USER CODE END DCMI_Init 1 */
  hdcmi.Instance = DCMI;
  hdcmi.Init.SynchroMode = DCMI_SYNCHRO_HARDWARE;
  hdcmi.Init.PCKPolarity = DCMI_PCKPOLARITY_FALLING;
  hdcmi.Init.VSPolarity = DCMI_VSPOLARITY_LOW;
  hdcmi.Init.HSPolarity = DCMI_HSPOLARITY_LOW;
  hdcmi.Init.CaptureRate = DCMI_CR_ALL_FRAME;
  hdcmi.Init.ExtendedDataMode = DCMI_EXTEND_DATA_8B;
  hdcmi.Init.JPEGMode = DCMI_JPEG_DISABLE;
  hdcmi.Init.ByteSelectMode = DCMI_BSM_ALL;
  hdcmi.Init.ByteSelectStart = DCMI_OEBS_ODD;
  hdcmi.Init.LineSelectMode = DCMI_LSM_ALL;
  hdcmi.Init.LineSelectStart = DCMI_OELS_ODD;
  if (HAL_DCMI_Init(&hdcmi) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN DCMI_Init 2 */

  /* USER CODE END DCMI_Init 2 */

}

/**
  * @brief I2C1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_I2C1_Init(void)
{

  /* USER CODE BEGIN I2C1_Init 0 */

  /* USER CODE END I2C1_Init 0 */

  /* USER CODE BEGIN I2C1_Init 1 */

  /* USER CODE END I2C1_Init 1 */
  hi2c1.Instance = I2C1;
  hi2c1.Init.Timing = 0x00303D5B;
  hi2c1.Init.OwnAddress1 = 0;
  hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c1.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c1.Init.OwnAddress2 = 0;
  hi2c1.Init.OwnAddress2Masks = I2C_OA2_NOMASK;
  hi2c1.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  if (HAL_I2C_Init(&hi2c1) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure Analogue filter
  */
  if (HAL_I2CEx_ConfigAnalogFilter(&hi2c1, I2C_ANALOGFILTER_ENABLE) != HAL_OK)
  {
    Error_Handler();
  }

  /** Configure Digital filter
  */
  if (HAL_I2CEx_ConfigDigitalFilter(&hi2c1, 0) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN I2C1_Init 2 */

  /* USER CODE END I2C1_Init 2 */

}

/**
  * @brief USART1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART1_UART_Init(void)
{

  /* USER CODE BEGIN USART1_Init 0 */

  /* USER CODE END USART1_Init 0 */

  /* USER CODE BEGIN USART1_Init 1 */

  /* USER CODE END USART1_Init 1 */
  huart1.Instance = USART1;
  huart1.Init.BaudRate = 115200;
  huart1.Init.WordLength = UART_WORDLENGTH_8B;
  huart1.Init.StopBits = UART_STOPBITS_1;
  huart1.Init.Parity = UART_PARITY_NONE;
  huart1.Init.Mode = UART_MODE_TX_RX;
  huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart1.Init.OverSampling = UART_OVERSAMPLING_16;
  huart1.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
  huart1.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
  if (HAL_UART_Init(&huart1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN USART1_Init 2 */

  /* USER CODE END USART1_Init 2 */

}

/**
  * @brief USART2 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART2_UART_Init(void)
{

  /* USER CODE BEGIN USART2_Init 0 */

  /* USER CODE END USART2_Init 0 */

  /* USER CODE BEGIN USART2_Init 1 */

  /* USER CODE END USART2_Init 1 */
  huart2.Instance = USART2;
  huart2.Init.BaudRate = 115200;
  huart2.Init.WordLength = UART_WORDLENGTH_8B;
  huart2.Init.StopBits = UART_STOPBITS_1;
  huart2.Init.Parity = UART_PARITY_NONE;
  huart2.Init.Mode = UART_MODE_TX_RX;
  huart2.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart2.Init.OverSampling = UART_OVERSAMPLING_16;
  huart2.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
  huart2.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
  if (HAL_UART_Init(&huart2) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN USART2_Init 2 */

  /* USER CODE END USART2_Init 2 */

}

/**
  * @brief USART3 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART3_UART_Init(void)
{

  /* USER CODE BEGIN USART3_Init 0 */

  /* USER CODE END USART3_Init 0 */

  /* USER CODE BEGIN USART3_Init 1 */

  /* USER CODE END USART3_Init 1 */
  huart3.Instance = USART3;
  huart3.Init.BaudRate = 115200;
  huart3.Init.WordLength = UART_WORDLENGTH_8B;
  huart3.Init.StopBits = UART_STOPBITS_1;
  huart3.Init.Parity = UART_PARITY_NONE;
  huart3.Init.Mode = UART_MODE_TX_RX;
  huart3.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart3.Init.OverSampling = UART_OVERSAMPLING_16;
  huart3.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
  huart3.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
  if (HAL_UART_Init(&huart3) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN USART3_Init 2 */

  /* USER CODE END USART3_Init 2 */

}

/**
  * Enable DMA controller clock
  */
static void MX_DMA_Init(void)
{

  /* DMA controller clock enable */
  __HAL_RCC_DMA2_CLK_ENABLE();

  /* DMA interrupt init */
  /* DMA2_Stream1_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(DMA2_Stream1_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(DMA2_Stream1_IRQn);

}

/**
  * @brief GPIO Initialization Function
  * @param None
  * @retval None
  */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};
  /* USER CODE BEGIN MX_GPIO_Init_1 */

  /* USER CODE END MX_GPIO_Init_1 */

  /* GPIO Ports Clock Enable */
  __HAL_RCC_GPIOE_CLK_ENABLE();
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();
  __HAL_RCC_GPIOD_CLK_ENABLE();
  __HAL_RCC_GPIOG_CLK_ENABLE();

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOB, LED_GREEN_Pin|CAM_PWDN_Pin|CAM_RESET_Pin|LED_RED_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOD, LED_YELLOW_Pin|BUZZER_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pin : BTN_SCAN_Pin */
  GPIO_InitStruct.Pin = BTN_SCAN_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_IT_RISING;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(BTN_SCAN_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pin : BTN_PANIC_Pin */
  GPIO_InitStruct.Pin = BTN_PANIC_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_IT_RISING;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(BTN_PANIC_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pins : LED_GREEN_Pin CAM_PWDN_Pin CAM_RESET_Pin LED_RED_Pin */
  GPIO_InitStruct.Pin = LED_GREEN_Pin|CAM_PWDN_Pin|CAM_RESET_Pin|LED_RED_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOB, &GPIO_InitStruct);

  /*Configure GPIO pins : LED_YELLOW_Pin BUZZER_Pin */
  GPIO_InitStruct.Pin = LED_YELLOW_Pin|BUZZER_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOD, &GPIO_InitStruct);

  /* EXTI interrupt init*/
  HAL_NVIC_SetPriority(EXTI0_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(EXTI0_IRQn);

  HAL_NVIC_SetPriority(EXTI15_10_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(EXTI15_10_IRQn);

  /* USER CODE BEGIN MX_GPIO_Init_2 */

  /* USER CODE END MX_GPIO_Init_2 */
}

/* USER CODE BEGIN 4 */

/* HSI 16 MHz + PLL → 216 MHz HCLK with overdrive.
 *
 * Previous attempt used HSE bypass off NUCLEO's 8 MHz MCO. That worked
 * electrically but HAL's HSE_VALUE macro is hard-coded to 25 MHz in
 * stm32f7xx_hal_conf.h, so HAL_RCC_GetSysClockFreq() returned ~675 MHz and
 * every BRR/timer calculation derived from SystemCoreClock was off by ~3x.
 * Switching to HSI as the PLL source removes that dependency entirely —
 * HSI_VALUE matches the hardware and clock calculations stay correct.
 *
 * HSI = 16 MHz, PLLM = 16 → 1 MHz reference, PLLN = 432 → 432 MHz VCO,
 * PLLP = 2 → SYSCLK = 216 MHz. PLLQ = 9 → 48 MHz (USB OTG, unused).
 * APB1 = HCLK/4 = 54 MHz, APB2 = HCLK/2 = 108 MHz, Flash 7 wait states.
 */
static void SystemClock_Config_216MHz(void) {
    RCC_OscInitTypeDef osc = {0};
    RCC_ClkInitTypeDef clk = {0};

    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);

    osc.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    osc.HSIState = RCC_HSI_ON;
    osc.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
    osc.PLL.PLLState = RCC_PLL_ON;
    osc.PLL.PLLSource = RCC_PLLSOURCE_HSI;
    osc.PLL.PLLM = 16;
    osc.PLL.PLLN = 432;
    osc.PLL.PLLP = RCC_PLLP_DIV2;
    osc.PLL.PLLQ = 9;
    if (HAL_RCC_OscConfig(&osc) != HAL_OK) {
        Error_Handler();
    }
    if (HAL_PWREx_EnableOverDrive() != HAL_OK) {
        Error_Handler();
    }

    clk.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
                    RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    clk.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clk.APB1CLKDivider = RCC_HCLK_DIV4;
    clk.APB2CLKDivider = RCC_HCLK_DIV2;
    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_7) != HAL_OK) {
        Error_Handler();
    }

    SystemCoreClockUpdate();  /* re-derive SystemCoreClock from RCC registers */
}

/* Re-init a UART with a different baud rate without touching anything else.
 * Used to override CubeMX's default 115200 on USART1 (→921600 for ESP32)
 * and USART2 (→9600 for HM-10). */
static void uart_set_baud(UART_HandleTypeDef *huart, uint32_t baud) {
    HAL_UART_DeInit(huart);
    huart->Init.BaudRate = baud;
    HAL_UART_Init(huart);
}

/* printf retarget. Newlib-nano _write goes to USART3 (ST-LINK VCP), so anything
 * printed from firmware shows up on /dev/tty.usbmodemXXXX at 115200 8N1. */
int _write(int fd, char *ptr, int len) {
    (void)fd;
    HAL_UART_Transmit(&huart3, (uint8_t *)ptr, len, 100);
    return len;
}

/* ─── state machine ─── */

static void apply_state_outputs(app_state_t s) {
    /* Reset everything, then set what this state wants on. */
    HAL_GPIO_WritePin(LED_GREEN_GPIO_Port,  LED_GREEN_Pin,  GPIO_PIN_RESET);
    HAL_GPIO_WritePin(LED_RED_GPIO_Port,    LED_RED_Pin,    GPIO_PIN_RESET);
    HAL_GPIO_WritePin(LED_YELLOW_GPIO_Port, LED_YELLOW_Pin, GPIO_PIN_RESET);
    HAL_GPIO_WritePin(BUZZER_GPIO_Port,     BUZZER_Pin,     GPIO_PIN_RESET);

    switch (s) {
    case STATE_IDLE:
        HAL_GPIO_WritePin(LED_GREEN_GPIO_Port, LED_GREEN_Pin, GPIO_PIN_SET);
        break;
    case STATE_SCANNING:
        HAL_GPIO_WritePin(LED_YELLOW_GPIO_Port, LED_YELLOW_Pin, GPIO_PIN_SET);
        break;
    case STATE_MATCH:
    case STATE_PANIC:
        HAL_GPIO_WritePin(LED_RED_GPIO_Port, LED_RED_Pin, GPIO_PIN_SET);
        HAL_GPIO_WritePin(BUZZER_GPIO_Port,  BUZZER_Pin,  GPIO_PIN_SET);
        break;
    case STATE_NOMATCH:
        HAL_GPIO_WritePin(LED_GREEN_GPIO_Port, LED_GREEN_Pin, GPIO_PIN_SET);
        break;
    case STATE_NETERR:
        HAL_GPIO_WritePin(LED_YELLOW_GPIO_Port, LED_YELLOW_Pin, GPIO_PIN_SET);
        HAL_GPIO_WritePin(LED_RED_GPIO_Port,    LED_RED_Pin,    GPIO_PIN_SET);
        break;
    }
}

static void enter_state(app_state_t s) {
    app_state = s;
    state_entered_ms = HAL_GetTick();
    apply_state_outputs(s);
    static const char *names[] = {
        "IDLE","SCANNING","MATCH","NOMATCH","PANIC","NETERR"
    };
    printf("[STM] -> %s\r\n", names[s]);
}

static void send_cam(const char *line) {
    HAL_UART_Transmit(&huart6, (uint8_t*)line, strlen(line), 200);
}

static void send_phone(const char *line) {
    /* Plan B v2: HM-10 is gone. Phone messages now go to ESP32-CAM over the
     * same USART6 link as CAPTURE; ESP-CAM forwards them as BLE notifications
     * on FFE0/FFE1, replacing the HM-10 path. */
    HAL_UART_Transmit(&huart6, (uint8_t*)line, strlen(line), 200);
}

/* Parse a single line received from ESP32-CAM and drive state machine. */
static void process_cam_line(const char *line) {
    printf("[STM] cam: %s\r\n", line);

    if (strncmp(line, "RESULT:", 7) == 0) {
        /* Format: RESULT:<1|0>;<name>;<sim> */
        int matched = 0;
        char name[48] = {0};
        float sim = 0.0f;
        const char *p = line + 7;
        matched = (*p == '1') ? 1 : 0;
        p = strchr(p, ';');
        if (p) {
            p++;
            const char *q = strchr(p, ';');
            if (q) {
                size_t n = (size_t)(q - p);
                if (n >= sizeof(name)) n = sizeof(name) - 1;
                memcpy(name, p, n);
                name[n] = '\0';
                sim = strtof(q + 1, NULL);
            }
        }

        if (matched) {
            strncpy(match_name, name, sizeof(match_name) - 1);
            match_sim = sim;
            char phone_msg[80];
            snprintf(phone_msg, sizeof(phone_msg),
                     "MATCH:%s;%.2f\n", match_name, match_sim);
            send_phone(phone_msg);
            enter_state(STATE_MATCH);
        } else {
            send_phone("NOMATCH\n");
            enter_state(STATE_NOMATCH);
        }
    } else if (strncmp(line, "ERR:", 4) == 0) {
        send_phone("NETERR\n");
        enter_state(STATE_NETERR);
    } else if (strncmp(line, "HB", 2) == 0) {
        /* ESP-CAM heartbeat, no action needed. */
    } else {
        /* Unknown — ignore. */
    }
}

/* HAL callbacks (weak in HAL, overridden here) */

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    if (huart == &huart6) {
        char c = (char)cam_rxb;
        if (c == '\n' || c == '\r') {
            if (cam_idx > 0 && !cam_line_ready) {
                cam_line[cam_idx] = '\0';
                cam_line_ready = true;
            }
        } else if (cam_idx < sizeof(cam_line) - 1) {
            cam_line[cam_idx++] = c;
        } else {
            cam_idx = 0;
        }
        HAL_UART_Receive_IT(&huart6, &cam_rxb, 1);
    }
}

void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart) {
    if (huart == &huart6) {
        cam_idx = 0;
        cam_line_ready = false;
        HAL_UART_Receive_IT(&huart6, &cam_rxb, 1);
    }
}

/* ─── USART6 manual init (Arduino D0=PG9 RX, D1=PG14 TX) ─── */
static void MX_USART6_UART_Init_Manual(void) {
    __HAL_RCC_USART6_CLK_ENABLE();
    __HAL_RCC_GPIOG_CLK_ENABLE();

    GPIO_InitTypeDef g = {0};
    g.Pin = GPIO_PIN_9 | GPIO_PIN_14;
    g.Mode = GPIO_MODE_AF_PP;
    g.Pull = GPIO_NOPULL;
    g.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
    g.Alternate = GPIO_AF8_USART6;
    HAL_GPIO_Init(GPIOG, &g);

    HAL_NVIC_SetPriority(USART6_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(USART6_IRQn);

    huart6.Instance = USART6;
    huart6.Init.BaudRate = 115200;
    huart6.Init.WordLength = UART_WORDLENGTH_8B;
    huart6.Init.StopBits = UART_STOPBITS_1;
    huart6.Init.Parity = UART_PARITY_NONE;
    huart6.Init.Mode = UART_MODE_TX_RX;
    huart6.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart6.Init.OverSampling = UART_OVERSAMPLING_16;
    huart6.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
    huart6.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
    if (HAL_UART_Init(&huart6) != HAL_OK) {
        Error_Handler();
    }
}

/* USART6 ISR — CubeMX didn't generate one because USART6 wasn't in the .ioc.
 * Defining it here overrides the weak default in startup_stm32f767zitx.s. */
void USART6_IRQHandler(void) {
    HAL_UART_IRQHandler(&huart6);
}

void HAL_GPIO_EXTI_Callback(uint16_t pin) {
    if (pin == BTN_SCAN_Pin) {
        flag_tara = true;
    } else if (pin == BTN_PANIC_Pin) {
        flag_panic = true;
    }
}

/* USER CODE END 4 */

 /* MPU Configuration */

void MPU_Config(void)
{
  MPU_Region_InitTypeDef MPU_InitStruct = {0};

  /* Disables the MPU */
  HAL_MPU_Disable();

  /** Initializes and configures the Region and the memory to be protected
  */
  MPU_InitStruct.Enable = MPU_REGION_ENABLE;
  MPU_InitStruct.Number = MPU_REGION_NUMBER0;
  MPU_InitStruct.BaseAddress = 0x0;
  MPU_InitStruct.Size = MPU_REGION_SIZE_4GB;
  MPU_InitStruct.SubRegionDisable = 0x87;
  MPU_InitStruct.TypeExtField = MPU_TEX_LEVEL0;
  MPU_InitStruct.AccessPermission = MPU_REGION_NO_ACCESS;
  MPU_InitStruct.DisableExec = MPU_INSTRUCTION_ACCESS_DISABLE;
  MPU_InitStruct.IsShareable = MPU_ACCESS_SHAREABLE;
  MPU_InitStruct.IsCacheable = MPU_ACCESS_NOT_CACHEABLE;
  MPU_InitStruct.IsBufferable = MPU_ACCESS_NOT_BUFFERABLE;

  HAL_MPU_ConfigRegion(&MPU_InitStruct);
  /* Enables the MPU */
  HAL_MPU_Enable(MPU_PRIVILEGED_DEFAULT);

}

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
  /* User can add his own implementation to report the HAL error return state */
  __disable_irq();
  while (1)
  {
  }
  /* USER CODE END Error_Handler_Debug */
}
#ifdef USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */
