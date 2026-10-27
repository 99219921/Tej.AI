package com.tejpawar.tejai.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val NavyPrimary = Color(0xFF0B1329)
val NavySurface = Color(0xFF131E3D)
val TealAccent = Color(0xFF14B8A6)
val TealLight = Color(0xFF2DD4BF)
val EmeraldLight = Color(0xFF10B981)
val TextWhite = Color(0xFFF8FAFC)
val TextMuted = Color(0xFF94A3B8)
val DangerRed = Color(0xFFEF4444)

private val DarkColorScheme = darkColorScheme(
    primary = TealAccent,
    secondary = TealLight,
    tertiary = EmeraldLight,
    background = NavyPrimary,
    surface = NavySurface,
    onPrimary = NavyPrimary,
    onSecondary = NavyPrimary,
    onBackground = TextWhite,
    onSurface = TextWhite
)

@Composable
fun TejAITheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
