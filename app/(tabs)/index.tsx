import { Picker } from "@react-native-picker/picker";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Pressable,
  StyleSheet,
  View
} from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

export default function HomeScreen() {
  const [leftLanguage, setLeftLanguage] = useState("en");
  const [rightLanguage, setRightLanguage] = useState("ru");
  const [isRecording, setIsRecording] = useState<"left" | "right" | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  async function startRecording() {
    try {
      if (permissionResponse && permissionResponse.status !== "granted") {
        console.log("Requesting permission..");
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      console.log("Starting recording..");
      const { recording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: {
          extension: ".m4a", // Note: WAV recording is not well-supported on Android.
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000
        },
        ios: {
          extension: ".wav",
          audioQuality: Audio.IOSAudioQuality.MAX,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        },
        web: {}
      });
      setRecording(recording);
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  async function stopRecording() {
    console.log("Stopping recording..");
    if (!recording) {
      return;
    }
    setRecording(null);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false
    });
    const uri = recording.getURI();
    console.log("Recording stopped and stored at", uri);
    if (uri) {
      await translateAudio(uri);
    }
    setIsLoading(false);
  }

  async function translateAudio(uri: string) {
    console.log("Translating audio...");
    setIsLoading(true);
    const apiKey = "OPENAI_API_KEY"; // IMPORTANT: Replace with your API key
    const toLanguage = isRecording === "left" ? rightLanguage : leftLanguage;
    const fromLanguage = isRecording === "left" ? leftLanguage : rightLanguage;

    try {
      // Step 1: Transcribe audio to text using Whisper
      const transcriptionFormData = new FormData();
      transcriptionFormData.append("file", {
        uri: uri,
        name: "recording.wav",
        type: "audio/wav"
      } as any);
      transcriptionFormData.append("model", "whisper-1");
      transcriptionFormData.append("language", fromLanguage);

      const transcriptionResponse = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          body: transcriptionFormData
        }
      );

      const transcriptionJson = await transcriptionResponse.json();
      if (transcriptionJson.error) {
        throw new Error(
          `Transcription failed: ${transcriptionJson.error.message}`
        );
      }
      const transcribedText = transcriptionJson.text;
      console.log("Transcribed text:", transcribedText);

      // Step 2: Translate text using Chat Completions
      const translationResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are a translator. Translate the following text from ${fromLanguage} to ${toLanguage}.`
              },
              { role: "user", content: transcribedText }
            ]
          })
        }
      );

      const translationJson = await translationResponse.json();
      if (translationJson.error) {
        throw new Error(`Translation failed: ${translationJson.error.message}`);
      }
      const translatedText = translationJson.choices[0].message.content;
      console.log("Translated text:", translatedText);

      // Step 3: Synthesize the translated text into speech
      console.log("Requesting TTS from OpenAI...");
      const ttsResponse = await fetch(
        "https://api.openai.com/v1/audio/speech",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "tts-1",
            input: translatedText,
            voice: "alloy",
            response_format: "mp3"
          })
        }
      );

      console.log("TTS response status:", ttsResponse.status);

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text();
        throw new Error(`TTS request failed: ${errorText}`);
      }

      console.log("Processing TTS response...");
      const audioBlob = await ttsResponse.blob();
      console.log("Audio blob created, size:", audioBlob.size);

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        console.log("FileReader finished reading blob.");
        const base64data = (reader.result as string).split(",")[1];

        if (!base64data || base64data.length === 0) {
          throw new Error("Failed to read base64 data from blob.");
        }

        const audioUri = FileSystem.cacheDirectory + "translated.mp3";
        console.log(`Writing audio to: ${audioUri}`);

        await FileSystem.writeAsStringAsync(audioUri, base64data, {
          encoding: FileSystem.EncodingType.Base64
        });

        console.log("Audio file written successfully.");
        const sideToPlay = isRecording === "left" ? "right" : "left";
        console.log(`Orchestrating playback in ${sideToPlay} ear...`);

        try {
          // Step 1: Explicitly set audio mode for PLAYBACK
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true
          });
          console.log("Audio mode set for playback.");

          // Step 2: Call the native module and WAIT for it to finish
          await NativeModules.AudioPanning.playFile(audioUri, sideToPlay);
          console.log("Native module has finished playing.");
        } catch (e) {
          console.error("Error during playback orchestration:", e);
          Alert.alert("Playback Error", "Could not play the translated audio.");
        } finally {
          // Step 3: GUARANTEED reset of audio mode for RECORDING
          console.log("Resetting audio mode for recording...");
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true // Keep consistent with recording setup
          });
          console.log("Audio mode has been reset for recording.");
          setIsLoading(false);
        }
      };
    } catch (error) {
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      console.error("Error in translation process:", error);
      Alert.alert("Error", errorMessage);
      setIsLoading(false);
    }
  }

  const handleRecord = async (side: "left" | "right") => {
    if (isRecording) {
      setIsRecording(null);
      await stopRecording();
    } else {
      setIsRecording(side);
      await startRecording();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.translatorContainer}>
        <View style={styles.side}>
          <ThemedText>Language 1</ThemedText>
          <Picker
            selectedValue={leftLanguage}
            onValueChange={itemValue => setLeftLanguage(itemValue)}
            enabled={!isRecording}
            style={styles.picker}
            itemStyle={{ color: "white" }}
          >
            <Picker.Item label="English" value="en" />
            <Picker.Item label="Russian" value="ru" />
            <Picker.Item label="German" value="de" />
          </Picker>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              ((isRecording && isRecording !== "left") || isLoading) &&
                styles.buttonDisabled,
              pressed && styles.buttonPressed
            ]}
            onPress={() => handleRecord("left")}
            disabled={(isRecording && isRecording !== "left") || isLoading}
          >
            <ThemedText style={styles.buttonText}>
              {isRecording === "left" ? "Stop" : "Record"}
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.side}>
          <ThemedText>Language 2</ThemedText>
          <Picker
            selectedValue={rightLanguage}
            onValueChange={itemValue => setRightLanguage(itemValue)}
            enabled={!isRecording}
            style={styles.picker}
            itemStyle={{ color: "white" }}
          >
            <Picker.Item label="English" value="en" />
            <Picker.Item label="Russian" value="ru" />
            <Picker.Item label="German" value="de" />
          </Picker>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              ((isRecording && isRecording !== "right") || isLoading) &&
                styles.buttonDisabled,
              pressed && styles.buttonPressed
            ]}
            onPress={() => handleRecord("right")}
            disabled={(isRecording && isRecording !== "right") || isLoading}
          >
            <ThemedText style={styles.buttonText}>
              {isRecording === "right" ? "Stop" : "Record"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
      {isLoading && <ActivityIndicator size="large" color="#0000ff" />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  translatorContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%"
  },
  side: {
    flex: 1,
    alignItems: "center",
    padding: 20
  },
  picker: {
    width: 200,
    height: 150
  },
  button: {
    marginTop: 20,
    backgroundColor: "#2c2c2e",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444"
  },
  buttonPressed: {
    backgroundColor: "#444"
  },
  buttonDisabled: {
    backgroundColor: "#1c1c1e",
    borderColor: "#333"
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center"
  }
});
