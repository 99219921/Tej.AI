package com.tejpawar.tejai

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.tejpawar.tejai.ui.theme.NavyPrimary
import com.tejpawar.tejai.ui.theme.TejAITheme
import com.tejpawar.tejai.ui.theme.TealAccent

enum class Screen(val title: String, val icon: ImageVector) {
    Voice("Voice", Icons.Default.Mic),
    Chat("Chat", Icons.Default.Chat),
    Vision("Vision", Icons.Default.CameraAlt),
    CallAssistant("Call Assistant", Icons.Default.PhoneCallback),
    Settings("Settings", Icons.Default.Settings)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TejAITheme {
                var currentScreen by remember { mutableStateOf(Screen.Voice) }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    containerColor = NavyPrimary,
                    bottomBar = {
                        NavigationBar(
                            containerColor = MaterialTheme.colorScheme.surface
                        ) {
                            Screen.values().forEach { screen ->
                                NavigationBarItem(
                                    selected = currentScreen == screen,
                                    onClick = { currentScreen = screen },
                                    icon = { Icon(screen.icon, contentDescription = screen.title) },
                                    label = { Text(screen.title) },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = NavyPrimary,
                                        indicatorColor = TealAccent
                                    )
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
                        Text(
                            text = "Tej AI Android Assistant\nRunning screen: ${currentScreen.title}",
                            color = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            }
        }
    }
}
