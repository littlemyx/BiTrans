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
import { ThemeToggle } from "@/components/ThemeToggle";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function HomeScreen() {
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  const [leftLanguage, setLeftLanguage] = useState("en");
  const [rightLanguage, setRightLanguage] = useState("ru");
  const [isRecording, setIsRecording] = useState<"left" | "right" | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  useEffect(() => {
    requestPermission();
    
    return () => {
      cleanupRecording();
    };
  }, [requestPermission]);

  const cleanupRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false
      });
    } catch (error) {
      console.error("Error cleaning up recording:", error);
    }
  };

  async function startRecording() {
    try {
      await cleanupRecording();
      
      if (permissionResponse && permissionResponse.status !== "granted") {
        await requestPermission();
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const { recording: newRecording } = await Audio.Recording.createAsync({
        isMeteringEnabled: true,
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000
        },
        ios: {
          extension: ".wav",
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        },
        web: {}
      });
      setRecording(newRecording);
    } catch (err) {
      console.error("Failed to start recording", err);
      setIsRecording(null);
      Alert.alert("Recording Error", "Failed to start recording");
    }
  }

  async function stopRecording() {
    if (!recording) return;
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false
      });
      
      if (uri) {
        await translateAudio(uri);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setRecording(null);
      setIsRecording(null);
      Alert.alert("Error", "Failed to stop recording");
    }
  }

  async function translateAudio(uri: string) {
    setIsLoading(true);
    const apiKey = "ADD OPENAI-TOKEN-HERE";
    const toLanguage = isRecording === "left" ? rightLanguage : leftLanguage;
    const fromLanguage = isRecording === "left" ? leftLanguage : rightLanguage;

    try {
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
        throw new Error(`Transcription failed: ${transcriptionJson.error.message}`);
      }
      const transcribedText = transcriptionJson.text;

      const translationResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: `Translate ${fromLanguage} to ${toLanguage}:`
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

      if (!ttsResponse.ok) {
        throw new Error(`TTS request failed`);
      }

      const audioBlob = await ttsResponse.blob();
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(",")[1];
        const audioUri = FileSystem.cacheDirectory + "translated.mp3";

        await FileSystem.writeAsStringAsync(audioUri, base64data, {
          encoding: FileSystem.EncodingType.Base64
        });

        const sideToPlay = isRecording === "left" ? "right" : "left";

        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true
          });

          await NativeModules.AudioPanning.playFile(audioUri, sideToPlay);
        } catch (e) {
          Alert.alert("Playback Error", "Could not play the translated audio.");
        } finally {
          setIsLoading(false);
          setIsRecording(null);
        }
      };

    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Translation failed");
      setIsLoading(false);
      setIsRecording(null);
    }
  }

  const handleRecord = async (side: "left" | "right") => {
    if (isRecording === side) {
      await stopRecording();
    } else {
      if (isRecording) {
        await cleanupRecording();
      }
      setIsRecording(side);
      await startRecording();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemeToggle />
      </View>
      
      <View style={styles.translatorContainer}>
        <View style={styles.side}>
          <ThemedText style={styles.languageLabel}>Language 1</ThemedText>
          <Picker
            selectedValue={leftLanguage}
            onValueChange={itemValue => setLeftLanguage(itemValue)}
            enabled={!isRecording && !isLoading}
            style={styles.picker}
            itemStyle={{ color: textColor }}
          >
            <Picker.Item label="English" value="en" />
            <Picker.Item label="Russian" value="ru" />
            <Picker.Item label="German" value="de" />
          </Picker>
          
          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: primaryColor,
                borderColor: borderColor,
              },
              isRecording === "left" && styles.buttonRecording,
              ((isRecording && isRecording !== "left") || isLoading) && styles.buttonDisabled,
              pressed && styles.buttonPressed
            ]}
            onPress={() => handleRecord("left")}
            disabled={(isRecording && isRecording !== "left") || isLoading}
          >
            <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
              {isRecording === "left" ? "Stop" : "Record"}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.separator}>
          <ThemedText style={styles.separatorText}>⇄</ThemedText>
        </View>

        <View style={styles.side}>
          <ThemedText style={styles.languageLabel}>Language 2</ThemedText>
          <Picker
            selectedValue={rightLanguage}
            onValueChange={itemValue => setRightLanguage(itemValue)}
            enabled={!isRecording && !isLoading}
            style={styles.picker}
            itemStyle={{ color: textColor }}
          >
            <Picker.Item label="English" value="en" />
            <Picker.Item label="Russian" value="ru" />
            <Picker.Item label="German" value="de" />
          </Picker>
          
          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: primaryColor,
                borderColor: borderColor,
              },
              isRecording === "right" && styles.buttonRecording,
              ((isRecording && isRecording !== "right") || isLoading) && styles.buttonDisabled,
              pressed && styles.buttonPressed
            ]}
            onPress={() => handleRecord("right")}
            disabled={(isRecording && isRecording !== "right") || isLoading}
          >
            <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>
              {isRecording === "right" ? "Stop" : "Record"}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={styles.loadingText}>Processing translation...</ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  header: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
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
  separator: {
    paddingHorizontal: 20,
    alignItems: "center"
  },
  separatorText: {
    fontSize: 24,
    fontWeight: "bold"
  },
  languageLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10
  },
  picker: {
    width: 200,
    height: 150
  },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonRecording: {
    backgroundColor: "#ff4444",
    borderColor: "#cc0000"
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center"
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: "center"
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16
  }
});