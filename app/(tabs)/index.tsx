import { Picker } from "@react-native-picker/picker";
import Voice, {
  SpeechEndEvent,
  SpeechErrorEvent,
  SpeechResultsEvent,
  SpeechStartEvent,
} from "@react-native-voice/voice";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Pressable,
  StyleSheet,
  View,
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

  const [partialText, setPartialText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // язык -> iOS локаль для SFSpeechRecognizer
  const iosLocaleMap: Record<string, string> = {
    en: "en-US",
    ru: "ru-RU",
    de: "de-DE",
  };

  useEffect(() => {
    Voice.onSpeechStart = (_e: SpeechStartEvent) => {};
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? "";
      setPartialText(text);
    };
    Voice.onSpeechEnd = (_e: SpeechEndEvent) => {};
    Voice.onSpeechError = (_e: SpeechErrorEvent) => {
      setIsRecording(null);
      Alert.alert("ASR Error", "Speech recognition failed");
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const cleanupRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false
      });
    } catch (error) {
      console.error("Error cleaning up recording:", error);
    }
  };

  // ВАЖНО: теперь принимаем сторону, чтобы явно выбрать язык из нужного селектора
  async function startRecording(side: "left" | "right") {
    try {
      await cleanupRecording();

      const fromLanguage = side === "left" ? leftLanguage : rightLanguage;
      const locale = iosLocaleMap[fromLanguage] ?? "en-US";

      setPartialText("");
      await Voice.destroy().catch(() => {});
      await Voice.start(locale);
    } catch (err) {
      console.error("Failed to start ASR", err);
      setIsRecording(null);
      Alert.alert("ASR Error", "Failed to start speech recognition");
    }
  }

  async function stopRecording() {
    try {
      await Voice.stop();
      const text = partialText.trim();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false
      });

      if (text) {
        await translateText(text);
      } else {
        setIsRecording(null);
      }
    } catch (error) {
      console.error("Error stopping ASR:", error);
      setIsRecording(null);
      Alert.alert("Error", "Failed to stop speech recognition");
    }
  }

  async function translateText(inputText: string) {
    setIsLoading(true);
    const apiKey = "ADD OPENAI-TOKEN-HERE";
    const toLanguage = isRecording === "left" ? rightLanguage : leftLanguage;
    const fromLanguage = isRecording === "left" ? leftLanguage : rightLanguage;

    try {
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
                content: `Translate ${fromLanguage} to ${toLanguage} and return result:`
              },
              { role: "user", content: inputText }
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
          setPartialText("");
        }
      };

    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Translation failed");
      setIsLoading(false);
      setIsRecording(null);
      setPartialText("");
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
      await startRecording(side); // <- передаём сторону, чтобы выбрать нужный язык
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