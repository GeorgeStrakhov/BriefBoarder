import Replicate from "replicate";
import { uploadFile } from "../s3";

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY!,
});

export interface TranscribeOptions {
  language?: string; // Language code (default: 'en')
  temperature?: number; // Temperature for transcription (default: 0)
}

/**
 * Transcribe audio to text using Replicate's OpenAI Whisper model
 * @param audioSource Audio file URL, Buffer, or Uint8Array
 * @param options Transcription options
 * @returns Promise resolving to transcribed text
 */
export async function transcribeAudio(
  audioSource: string | Buffer | Uint8Array,
  options: TranscribeOptions = {},
): Promise<string> {
  const { language = "en" } = options;

  let audioUrl: string;

  // If audioSource is a URL, use it directly
  if (typeof audioSource === "string") {
    // Validate URL
    try {
      new URL(audioSource);
      audioUrl = audioSource;
    } catch {
      throw new Error("Invalid URL provided for audio source");
    }
  } else {
    // Upload audio data to S3 first
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `audio-transcribe-${timestamp}.mp3`;

    try {
      const uploadResult = await uploadFile(audioSource, filename, {
        folder: "audio-transcription",
        contentType: "audio/mpeg",
        metadata: {
          purpose: "speech-transcription",
          timestamp: new Date().toISOString(),
        },
      });

      audioUrl = uploadResult.publicUrl;
    } catch (error) {
      throw new Error(
        `Failed to upload audio file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  try {
    // Map language codes for the new model (it expects different format)
    const mappedLanguage = language === "en" ? "None" : language; // 'None' for auto-detection

    const input = {
      task: "transcribe",
      audio: audioUrl,
      language: mappedLanguage,
      timestamp: "chunk",
      batch_size: 64,
      diarise_audio: false,
    };

    // Use the incredibly-fast-whisper model that supports .oga files
    const output = await replicate.run(
      "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
      { input },
    );

    // The new model returns an object with 'text' and 'chunks' fields
    if (output && typeof output === "object" && "text" in output) {
      const transcription = String(output.text).trim();
      return transcription;
    } else {
      // Fallback in case format changes
      return String(output).trim();
    }
  } catch (error) {
    throw new Error(
      `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Transcribe audio from URL (convenience function)
 * @param audioUrl Public URL to audio file
 * @param options Transcription options
 * @returns Promise resolving to transcribed text
 */
export async function transcribeFromUrl(
  audioUrl: string,
  options?: TranscribeOptions,
): Promise<string> {
  return transcribeAudio(audioUrl, options);
}

/**
 * Transcribe audio from Buffer (convenience function)
 * @param audioBuffer Audio file as Buffer
 * @param options Transcription options
 * @returns Promise resolving to transcribed text
 */
export async function transcribeFromBuffer(
  audioBuffer: Buffer,
  options?: TranscribeOptions,
): Promise<string> {
  return transcribeAudio(audioBuffer, options);
}

/**
 * Get supported languages for transcription
 * Common language codes supported by Whisper
 */
export const SupportedLanguages = {
  ENGLISH: "en",
  SPANISH: "es",
  FRENCH: "fr",
  GERMAN: "de",
  ITALIAN: "it",
  PORTUGUESE: "pt",
  RUSSIAN: "ru",
  JAPANESE: "ja",
  CHINESE: "zh",
  KOREAN: "ko",
  ARABIC: "ar",
  HINDI: "hi",
} as const;

export type SupportedLanguage =
  (typeof SupportedLanguages)[keyof typeof SupportedLanguages];
