package com.taxiguard.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Same navy / brass palette as the poster, so the demo feels coherent. */
private val Navy = Color(0xFF0A1F44)
private val NavyDark = Color(0xFF050D1F)
private val Paper = Color(0xFFF1ECE0)
private val Brass = Color(0xFFC2902F)
private val Oxblood = Color(0xFF9C2A21)

private val Light = lightColorScheme(
    primary = Navy,
    onPrimary = Paper,
    secondary = Brass,
    onSecondary = Color.White,
    tertiary = Oxblood,
    background = Paper,
    onBackground = Navy,
    surface = Paper,
    onSurface = Navy,
    error = Oxblood,
)

private val Dark = darkColorScheme(
    primary = Brass,
    onPrimary = NavyDark,
    secondary = Paper,
    onSecondary = Navy,
    tertiary = Oxblood,
    background = NavyDark,
    onBackground = Paper,
    surface = Navy,
    onSurface = Paper,
    error = Oxblood,
)

@Composable
fun TaxiGuardTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) Dark else Light
    MaterialTheme(colorScheme = scheme, content = content)
}
