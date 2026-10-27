# Tej AI — Android AI Assistant

Created for: Tej Pawar  
Platform: Android (Jetpack Compose, Kotlin, Material3)  
Primary Language: Marathi (मराठी) with natural Indian Female Voice, Hindi & English  
Engine: Google Gemini (Multimodal Vision, Real-Time Voice, Search Grounding)

## How to Build the APK in Android Studio

1. **Open the project in Android Studio**:
   - Open Android Studio -> Select `Open` -> Browse and select this `android/` directory.
   - Let Gradle sync the dependencies.

2. **Configure Gemini API Key**:
   - Add your API key to `local.properties`:
     ```properties
     GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
     ```
   - Or enter it inside the app's Settings screen.

3. **Build Debug APK**:
   ```bash
   ./gradlew assembleDebug
   ```
   The APK will be generated at:
   `app/build/outputs/apk/debug/app-debug.apk`

4. **Install on Device**:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

## Architecture & Permissions
- `android.permission.RECORD_AUDIO`: Voice assistant speech recognition.
- `android.permission.INTERNET`: Gemini API and real-time Search Grounding.
- `android.permission.READ_MEDIA_IMAGES`: Vision screenshot & document understanding.
- Android compliant Call Assistant: Provides in-call voice notes, summaries, and follow-ups without unauthorized cellular tapping.
