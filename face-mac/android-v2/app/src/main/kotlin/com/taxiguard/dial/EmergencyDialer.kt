package com.taxiguard.dial

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Single entry point for triggering the 155 call.
 *
 * `Intent.ACTION_CALL` places the call without showing the dialer UI. This
 * requires the `CALL_PHONE` runtime permission — if it is missing we fall
 * back to `ACTION_DIAL` which only opens the dialer with the number filled
 * in, so the driver can still tap the green button.
 *
 * iOS would not allow either of these without user interaction; that
 * sandbox constraint is the reason Android is the chosen platform.
 */
object EmergencyDialer {

    private const val TAG = "EmergencyDialer"
    const val EMERGENCY_NUMBER = "155"

    fun call(context: Context, number: String = EMERGENCY_NUMBER) {
        val hasPerm = ContextCompat.checkSelfPermission(
            context, Manifest.permission.CALL_PHONE,
        ) == PackageManager.PERMISSION_GRANTED

        val action = if (hasPerm) Intent.ACTION_CALL else Intent.ACTION_DIAL
        val intent = Intent(action, Uri.parse("tel:$number")).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching {
            context.startActivity(intent)
            Log.i(TAG, "dial fired action=$action number=$number permission=$hasPerm")
        }.onFailure {
            Log.e(TAG, "dial failed: ${it.message}", it)
        }
    }
}
