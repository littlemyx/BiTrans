import AVFoundation
import React

@objc(AudioEngine)
public class AudioEngine: NSObject, AVAudioPlayerDelegate {
    
    private var player: AVAudioPlayer?
    private var promiseResolver: RCTPromiseResolveBlock?
    private var promiseRejecter: RCTPromiseRejectBlock?
    
    @objc public class func create() -> AudioEngine {
        return AudioEngine()
    }
    
    override init() {
        super.init()
    }
    
    @objc(playFile:side:resolver:rejecter:)
    public func playFile(atPath path: String, side: NSString, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        self.promiseResolver = resolver
        self.promiseRejecter = rejecter
        
        guard let fileURL = URL(string: path) else {
            let error = NSError(domain: "AudioEngine", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid file URL"])
            rejecter("ERROR_INVALID_URL", "Invalid file URL", error)
            return
        }
        
        do {
            player?.stop()

            // Take control of the audio session for playback
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .default, options: [])
            try audioSession.setActive(true)

            player = try AVAudioPlayer(contentsOf: fileURL)
            player?.delegate = self
            
            if side == "left" {
                player?.pan = -1.0
            } else {
                player?.pan = 1.0
            }
            
            if player?.prepareToPlay() == true {
                player?.play()
            } else {
                let error = NSError(domain: "AudioEngine", code: 4, userInfo: [NSLocalizedDescriptionKey: "Player not prepared"])
                rejecter("ERROR_PLAYER_NOT_PREPARED", "Player not prepared", error)
            }
            
        } catch {
            rejecter("ERROR_PLAYBACK_FAILED", "Failed to initialize player", error)
        }
    }
    
    @objc
    public func stop() {
        if player?.isPlaying == true {
            player?.stop()
            // Manually resolve promise and reset session
            resetAudioSession()
            promiseResolver?(nil)
        }
    }
    
    // MARK: - AVAudioPlayerDelegate
    
    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        resetAudioSession()
        if flag {
            promiseResolver?(nil)
        } else {
            let error = NSError(domain: "AudioEngine", code: 2, userInfo: [NSLocalizedDescriptionKey: "Playback incomplete"])
            promiseRejecter?("ERROR_PLAYBACK_INCOMPLETE", "Playback incomplete", error)
        }
    }
    
    public func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        resetAudioSession()
        let nsError = error as NSError?
        promiseRejecter?(nsError?.domain ?? "ERROR_DECODE", nsError?.localizedDescription ?? "Audio decode error", nsError)
    }

    private func resetAudioSession() {
        do {
            // Return the session to a state that allows recording again
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [])
            // Deactivating lets expo-av take control again when it needs to.
            try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            print("AudioEngine Error: Could not reset audio session: \(error)")
        }
    }
} 