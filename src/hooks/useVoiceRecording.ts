import { useCallback, useRef, useState } from "react";

export type RecordingState =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "transcribing"
  | "error";

interface UseVoiceRecordingOptions {
  onTranscriptionComplete: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecording({
  onTranscriptionComplete,
  onError,
}: UseVoiceRecordingOptions) {
  const [state, setState] = useState<RecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const requestPermission = useCallback(async () => {
    try {
      setState("requesting-permission");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      return true;
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Microphone permission denied"
            : "Failed to access microphone"
          : "Failed to access microphone";
      setState("error");
      onError?.(errorMsg);
      return false;
    }
  }, [onError]);

  const startRecording = useCallback(async () => {
    // Request permission if not already granted
    if (!mediaStreamRef.current) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      const stream = mediaStreamRef.current!;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const duration = Date.now() - startTimeRef.current;

        // Check minimum duration (500ms)
        if (duration < 500) {
          setState("error");
          onError?.("Recording too short. Please speak for at least half a second.");
          setTimeout(() => setState("idle"), 2000);
          return;
        }

        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        // Transcribe
        setState("transcribing");
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Transcription failed");
          }

          const { text } = await response.json();
          onTranscriptionComplete(text);
          setState("idle");
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Transcription failed";
          setState("error");
          onError?.(errorMsg);
          setTimeout(() => setState("idle"), 2000);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setState("recording");
    } catch (err) {
      setState("error");
      onError?.("Failed to start recording");
      setTimeout(() => setState("idle"), 2000);
    }
  }, [requestPermission, onTranscriptionComplete, onError]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cleanup = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    cleanup,
  };
}
