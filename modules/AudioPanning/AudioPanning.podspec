require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "AudioPanning"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/your-repo/react-native-audio-panning"
  s.license      = package["license"]
  s.authors      = { "Your Name" => "your-email@example.com" }
  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/your-repo/react-native-audio-panning.git", :tag => "v#{s.version}" }

  s.source_files = "*.{h,m,swift}"
  s.requires_arc = true

  s.dependency "React"
end 