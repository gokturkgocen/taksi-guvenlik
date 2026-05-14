package com.taxiguard

import android.app.Application

/**
 * Single Application class. No DI graph yet — the BLE side is held in the
 * [com.taxiguard.state.EventBus] singleton, which is enough for a thesis
 * prototype. Replace with Hilt or Koin if the app ever grows past two
 * screens.
 */
class TaxiGuardApp : Application()
