/* USER CODE BEGIN Header */
/**
 ******************************************************************************
 * @file           : main.c
 * @brief          : Taksi Guvenlik - STM32 NUCLEO-F767ZI firmware
 *                   Mac (USART3) -> HM-10 BLE (USART6) bridge
 *                   + State machine + Panic button + LED/buzzer
 ******************************************************************************
 *
 * UART haritasi:
 *   USART3 (PD8/PD9) -> ST-LINK VCP -> Mac
 *   USART6 (PC6/PC7) -> HM-10 BLE
 *
 * GPIO etiketleri (CubeMX'te bunlarla ayarladigini varsayar):
 *   LED_GREEN  -> PB0  (LD1, IDLE)
 *   LED_BLUE   -> PB7  (LD2, ALERT toggle)
 *   LED_RED    -> PB14 (LD3, ALERT toggle anti-phase)
 *   BUZZER     -> PE5  (active buzzer, ALERT'te 300ms on/off)
 *   PANIC_BTN  -> PC13 (B1, EXTI falling edge, aktif-low)
 *
 * Mesaj protokolu (Mac <-> STM32):
 *   Mac -> STM32:  "MATCH:<name>;<sim>\n"  -> ACK + ALERT + BLE forward
 *   Mac -> STM32:  "HEARTBEAT\n"           -> ACK
 *   Mac -> STM32:  "PING\n"                -> PONG
 *   Mac -> STM32:  "CLEAR\n"               -> ALERT iptal -> COOLDOWN
 *   STM32 -> Mac:  "ACK\n", "PONG\n", "STM32 ready\n"
 *
 * BLE'ye giden:
 *   "READY\n"   bootta bir kere
 *   "MATCH:...\n" Mac'ten geldigi gibi forward
 *   "PANIC\n"   panik butonuna basilinca
 *   "HB\n"      her 3 saniyede heartbeat
 *
 ******************************************************************************
 */
/* USER CODE END Header */

/* Includes ------------------------------------------------------------------*/
#include "main.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <string.h>
#include <stdio.h>
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */
typedef enum {
    STATE_IDLE,
    STATE_ALERT,
    STATE_COOLDOWN
} system_state_t;
/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
#define RX_BUF_SIZE        128
#define ALERT_DURATION_MS  10000U
#define COOLDOWN_MS        5000U
#define HEARTBEAT_MS       3000U
#define DEBOUNCE_MS        50U
#define BUZZER_PERIOD_MS   300U
#define COOLDOWN_BLINK_MS  250U
#define MAIN_LOOP_TICK_MS  10U
/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */
/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
UART_HandleTypeDef huart3;
UART_HandleTypeDef huart6;

/* USER CODE BEGIN PV */
/* UART RX (Mac, USART3) - tek byte interrupt + line buffer */
static uint8_t  uart3_rx_byte;
static char     uart3_line[RX_BUF_SIZE];
static uint16_t uart3_idx = 0;
static volatile uint8_t uart3_line_ready = 0;

/* UART RX (HM-10, USART6) - su an pasif, ileride central'dan komut alabilir */
static uint8_t  uart6_rx_byte;

/* State machine */
static system_state_t state = STATE_IDLE;
static uint32_t state_enter_tick = 0;

/* Panic button */
static volatile uint8_t panic_pending = 0;

/* Heartbeat */
static uint32_t last_hb_tick = 0;
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_USART3_UART_Init(void);
static void MX_USART6_UART_Init(void);

/* USER CODE BEGIN PFP */
static void enter_state(system_state_t s);
static void update_outputs(void);
static void handle_line(const char *line);
static void send_ble(const char *msg);
static void send_pc(const char *msg);
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

    /* MCU init */
    HAL_Init();

    /* Sistem saati: HSE 8MHz -> PLL -> 216 MHz */
    SystemClock_Config();

    /* USER CODE BEGIN SysInit */
    /* USER CODE END SysInit */

    /* Peripheral init */
    MX_GPIO_Init();
    MX_USART3_UART_Init();
    MX_USART6_UART_Init();

    /* USER CODE BEGIN 2 */
    /* IDLE durumu (yesil LED yansin) */
    enter_state(STATE_IDLE);

    /* UART RX interrupt'lari ac */
    HAL_UART_Receive_IT(&huart3, &uart3_rx_byte, 1);
    HAL_UART_Receive_IT(&huart6, &uart6_rx_byte, 1);

    /* Boot mesajlari */
    send_pc("STM32 ready\r\n");
    send_ble("READY\n");
    last_hb_tick = HAL_GetTick();
    /* USER CODE END 2 */

    /* Infinite loop */
    /* USER CODE BEGIN WHILE */
    while (1)
    {
        /* USER CODE END WHILE */

        /* USER CODE BEGIN 3 */
        const uint32_t now = HAL_GetTick();

        /* (1) Mac'ten gelen tam satir */
        if (uart3_line_ready) {
            uart3_line_ready = 0;
            handle_line(uart3_line);
        }

        /* (2) Panik butonu (EXTI -> flag, debounce burada) */
        if (panic_pending) {
            panic_pending = 0;
            HAL_Delay(DEBOUNCE_MS);
            if (HAL_GPIO_ReadPin(PANIC_BTN_GPIO_Port, PANIC_BTN_Pin) == GPIO_PIN_RESET) {
                send_pc("PANIC button pressed\r\n");
                send_ble("PANIC\n");
                enter_state(STATE_ALERT);
            }
        }

        /* (3) State timeout'lari */
        switch (state) {
            case STATE_ALERT:
                if ((now - state_enter_tick) > ALERT_DURATION_MS) {
                    enter_state(STATE_COOLDOWN);
                }
                break;
            case STATE_COOLDOWN:
                if ((now - state_enter_tick) > COOLDOWN_MS) {
                    enter_state(STATE_IDLE);
                }
                break;
            case STATE_IDLE:
            default:
                break;
        }

        /* (4) LED + buzzer guncelle */
        update_outputs();

        /* (5) BLE heartbeat */
        if ((now - last_hb_tick) > HEARTBEAT_MS) {
            last_hb_tick = now;
            send_ble("HB\n");
        }

        HAL_Delay(MAIN_LOOP_TICK_MS);
        /* USER CODE END 3 */
    }
}

/**
  * @brief System Clock Configuration
  * @retval None
  *
  * NUCLEO-F767ZI: HSE = 8 MHz (ST-LINK MCO, BYPASS mode)
  * PLL: /4 *216 /2 -> SYSCLK 216 MHz
  * APB1 = /4 = 54 MHz, APB2 = /2 = 108 MHz
  */
void SystemClock_Config(void)
{
    RCC_OscInitTypeDef RCC_OscInitStruct = {0};
    RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

    /* Voltaj olcek 1 (216 MHz icin sart) */
    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);

    /* HSE BYPASS (ST-LINK MCO 8 MHz) + PLL */
    RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    RCC_OscInitStruct.HSEState = RCC_HSE_BYPASS;
    RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
    RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
    RCC_OscInitStruct.PLL.PLLM = 4;
    RCC_OscInitStruct.PLL.PLLN = 216;
    RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV2;
    RCC_OscInitStruct.PLL.PLLQ = 9;  /* 48 MHz USB icin */
    if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK) {
        Error_Handler();
    }

    /* Overdrive 216 MHz icin */
    if (HAL_PWREx_EnableOverDrive() != HAL_OK) {
        Error_Handler();
    }

    /* SYSCLK = PLLCLK; APB1 /4, APB2 /2 */
    RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
                                   RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
    RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV4;
    RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV2;
    if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_7) != HAL_OK) {
        Error_Handler();
    }
}

/**
  * @brief USART3 (Mac VCP) Init
  */
static void MX_USART3_UART_Init(void)
{
    huart3.Instance = USART3;
    huart3.Init.BaudRate = 9600;
    huart3.Init.WordLength = UART_WORDLENGTH_8B;
    huart3.Init.StopBits = UART_STOPBITS_1;
    huart3.Init.Parity = UART_PARITY_NONE;
    huart3.Init.Mode = UART_MODE_TX_RX;
    huart3.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart3.Init.OverSampling = UART_OVERSAMPLING_16;
    huart3.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
    huart3.AdvancedInit.AdvFeatureInit = UART_ADVFEATURE_NO_INIT;
    if (HAL_UART_Init(&huart3) != HAL_OK) {
        Error_Handler();
    }
}

/**
  * @brief USART6 (HM-10 BLE) Init
  */
static void MX_USART6_UART_Init(void)
{
    huart6.Instance = USART6;
    huart6.Init.BaudRate = 9600;
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

/**
  * @brief GPIO Init - LED, buzzer, panik butonu
  *
  * NOT: USART3 (PD8/PD9) ve USART6 (PC6/PC7) pinleri HAL_UART_MspInit
  * icinde alternatif fonksiyon olarak ayarlanir, burada degil.
  */
static void MX_GPIO_Init(void)
{
    GPIO_InitTypeDef GPIO_InitStruct = {0};

    __HAL_RCC_GPIOB_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
    __HAL_RCC_GPIOE_CLK_ENABLE();

    /* LED'ler ve buzzer baslangicta low */
    HAL_GPIO_WritePin(LED_GREEN_GPIO_Port, LED_GREEN_Pin, GPIO_PIN_RESET);
    HAL_GPIO_WritePin(LED_BLUE_GPIO_Port,  LED_BLUE_Pin,  GPIO_PIN_RESET);
    HAL_GPIO_WritePin(LED_RED_GPIO_Port,   LED_RED_Pin,   GPIO_PIN_RESET);
    HAL_GPIO_WritePin(BUZZER_GPIO_Port,    BUZZER_Pin,    GPIO_PIN_RESET);

    /* LED_GREEN PB0, LED_BLUE PB7, LED_RED PB14 */
    GPIO_InitStruct.Pin = LED_GREEN_Pin | LED_BLUE_Pin | LED_RED_Pin;
    GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOB, &GPIO_InitStruct);

    /* BUZZER PE5 */
    GPIO_InitStruct.Pin = BUZZER_Pin;
    HAL_GPIO_Init(BUZZER_GPIO_Port, &GPIO_InitStruct);

    /* PANIC_BTN PC13 (EXTI13, falling edge, no pull -- board'da pull-up var) */
    GPIO_InitStruct.Pin = PANIC_BTN_Pin;
    GPIO_InitStruct.Mode = GPIO_MODE_IT_FALLING;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    HAL_GPIO_Init(PANIC_BTN_GPIO_Port, &GPIO_InitStruct);

    /* EXTI line[15:10] interrupt enable */
    HAL_NVIC_SetPriority(EXTI15_10_IRQn, 6, 0);
    HAL_NVIC_EnableIRQ(EXTI15_10_IRQn);
}

/* USER CODE BEGIN 4 */

/**
 * State'e gec, LED'leri ve sayaclari sifirla.
 */
static void enter_state(system_state_t s)
{
    state = s;
    state_enter_tick = HAL_GetTick();

    switch (s) {
        case STATE_IDLE:
            HAL_GPIO_WritePin(LED_GREEN_GPIO_Port, LED_GREEN_Pin, GPIO_PIN_SET);
            HAL_GPIO_WritePin(LED_BLUE_GPIO_Port,  LED_BLUE_Pin,  GPIO_PIN_RESET);
            HAL_GPIO_WritePin(LED_RED_GPIO_Port,   LED_RED_Pin,   GPIO_PIN_RESET);
            HAL_GPIO_WritePin(BUZZER_GPIO_Port,    BUZZER_Pin,    GPIO_PIN_RESET);
            break;

        case STATE_ALERT:
            /* Yesil sondur, mavi+kirmizi ve buzzer update_outputs() icinde toggle */
            HAL_GPIO_WritePin(LED_GREEN_GPIO_Port, LED_GREEN_Pin, GPIO_PIN_RESET);
            break;

        case STATE_COOLDOWN:
            HAL_GPIO_WritePin(LED_BLUE_GPIO_Port, LED_BLUE_Pin, GPIO_PIN_RESET);
            HAL_GPIO_WritePin(LED_RED_GPIO_Port,  LED_RED_Pin,  GPIO_PIN_RESET);
            HAL_GPIO_WritePin(BUZZER_GPIO_Port,   BUZZER_Pin,   GPIO_PIN_RESET);
            /* Yesil yanip soner update_outputs() icinde */
            break;
    }
}

/**
 * Her main loop'ta cagrilir, state'e gore LED ve buzzer'i sruz.
 */
static void update_outputs(void)
{
    const uint32_t now = HAL_GetTick();

    switch (state) {
        case STATE_ALERT: {
            const GPIO_PinState a = ((now / BUZZER_PERIOD_MS) % 2U) ? GPIO_PIN_SET : GPIO_PIN_RESET;
            HAL_GPIO_WritePin(LED_BLUE_GPIO_Port, LED_BLUE_Pin, a);
            /* Anti-phase: kirmizi mavinin tersi -> daha gorunur */
            HAL_GPIO_WritePin(LED_RED_GPIO_Port,  LED_RED_Pin,
                              (a == GPIO_PIN_SET) ? GPIO_PIN_RESET : GPIO_PIN_SET);
            HAL_GPIO_WritePin(BUZZER_GPIO_Port,   BUZZER_Pin,   a);
            break;
        }

        case STATE_COOLDOWN: {
            const GPIO_PinState g = ((now / COOLDOWN_BLINK_MS) % 2U) ? GPIO_PIN_SET : GPIO_PIN_RESET;
            HAL_GPIO_WritePin(LED_GREEN_GPIO_Port, LED_GREEN_Pin, g);
            break;
        }

        case STATE_IDLE:
        default:
            /* Yesil sabit ON, enter_state'te ayarlandi */
            break;
    }
}

/**
 * Mac'ten gelen tek satir mesaji isle.
 */
static void handle_line(const char *line)
{
    if (strncmp(line, "MATCH:", 6) == 0) {
        /* MATCH:<name>;<sim> */
        char fwd[RX_BUF_SIZE + 4];
        snprintf(fwd, sizeof(fwd), "%s\n", line);
        send_ble(fwd);
        send_pc("ACK\r\n");
        enter_state(STATE_ALERT);
    }
    else if (strcmp(line, "HEARTBEAT") == 0) {
        send_pc("ACK\r\n");
    }
    else if (strcmp(line, "PING") == 0) {
        send_pc("PONG\r\n");
    }
    else if (strcmp(line, "CLEAR") == 0) {
        if (state == STATE_ALERT) {
            enter_state(STATE_COOLDOWN);
        }
        send_pc("ACK\r\n");
    }
    else {
        send_pc("UNKNOWN\r\n");
    }
}

static void send_ble(const char *msg)
{
    HAL_UART_Transmit(&huart6, (uint8_t *)msg, (uint16_t)strlen(msg), 200);
}

static void send_pc(const char *msg)
{
    HAL_UART_Transmit(&huart3, (uint8_t *)msg, (uint16_t)strlen(msg), 100);
}

/* ===== HAL Callbacks ===== */

/**
 * UART RX complete - tek byte aldigimizda buraya dusuyor.
 * USART3'te line buffer biriktiriyoruz, '\n' veya '\r' gelince hazir bayragi.
 */
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART3) {
        if (uart3_rx_byte == '\n' || uart3_rx_byte == '\r') {
            if (uart3_idx > 0U) {
                uart3_line[uart3_idx] = '\0';
                uart3_line_ready = 1;
                uart3_idx = 0;
            }
        }
        else if (uart3_idx < (RX_BUF_SIZE - 1U)) {
            uart3_line[uart3_idx++] = (char)uart3_rx_byte;
        }
        else {
            /* Overflow - bufferi reset et */
            uart3_idx = 0;
        }
        HAL_UART_Receive_IT(&huart3, &uart3_rx_byte, 1);
    }
    else if (huart->Instance == USART6) {
        /* HM-10'dan gelen byte - su an isleme yok, sadece interrupt'i devam ettir */
        HAL_UART_Receive_IT(&huart6, &uart6_rx_byte, 1);
    }
}

/**
 * UART hata callback - parity/overrun/framing hatalarinda buffer sifirla.
 */
void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance == USART3) {
        uart3_idx = 0;
        HAL_UART_Receive_IT(&huart3, &uart3_rx_byte, 1);
    }
    else if (huart->Instance == USART6) {
        HAL_UART_Receive_IT(&huart6, &uart6_rx_byte, 1);
    }
}

/**
 * GPIO EXTI callback - PC13 panik butonu (aktif-low, falling edge).
 * Sadece bayrak set ediyoruz, debounce ve sleep main loop'ta.
 */
void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
{
    if (GPIO_Pin == PANIC_BTN_Pin) {
        panic_pending = 1;
    }
}

/* USER CODE END 4 */

/**
  * @brief  Hata fonksiyonu - kirmizi LED hizla yanip soner.
  */
void Error_Handler(void)
{
    __disable_irq();
    while (1) {
        for (volatile uint32_t i = 0; i < 1000000U; i++) { __NOP(); }
        HAL_GPIO_TogglePin(LED_RED_GPIO_Port, LED_RED_Pin);
    }
}

#ifdef USE_FULL_ASSERT
void assert_failed(uint8_t *file, uint32_t line)
{
    /* Kullanici implementasyonu */
    (void)file;
    (void)line;
}
#endif
