package com.tejpawar.tejai.data

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.content
import com.tejpawar.tejai.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class GeminiRepository(private val customApiKey: String? = null) {
    private val key = customApiKey ?: BuildConfig.GEMINI_API_KEY

    private val voiceModel by lazy {
        GenerativeModel(
            modelName = "gemini-1.5-flash",
            apiKey = key,
            systemInstruction = content {
                text("""
                    You are Tej AI, an intelligent, polite, and helpful Android personal voice assistant created by and for Tej Pawar.
                    Primary Language: Marathi (मराठी). Speak fluent, natural Marathi with excellent grammar.
                    Additional Languages: Hindi and English. Understand Marathi-English code switching effortlessly.
                    Keep spoken responses concise (2 to 3 sentences) so they sound natural when spoken aloud.
                """.trimIndent())
            }
        )
    }

    suspend fun queryVoice(prompt: String): String = withContext(Dispatchers.IO) {
        try {
            val response = voiceModel.generateContent(prompt)
            response.text ?: "मी मदत करण्यास तयार आहे."
        } catch (e: Exception) {
            "क्षमस्व, इंटरनेट किंवा सर्व्हरशी संपर्क करताना अडचण आली: ${e.localizedMessage}"
        }
    }
}
