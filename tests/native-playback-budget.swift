import Foundation

@main
struct PlaybackBudgetTests {
  static func main() {
    for (width, height, scale) in [(932.0, 430.0, 3.0), (852, 393, 3), (1024, 768, 2), (667, 375, 2)] {
      let result = PlaybackBudget.renderScale(width: width, height: height, nativeScale: scale)
      precondition(width * result <= 1920.001 && height * result <= 1080.001)
      precondition(result <= scale)
      precondition(result == PlaybackBudget.renderScale(width: height, height: width, nativeScale: scale))
    }
    func reason(_ w: Int = 1280, _ h: Int = 720, _ fps: Double = 24, _ hot: Bool = false, _ low: Bool = false) -> String {
      PlaybackBudget.shaderLimit(width: w, height: h, fps: fps, thermalLimited: hot, lowPower: low)
    }
    precondition(reason() == "")
    precondition(reason(1920, 1080, 30) == "")
    precondition(reason(3840, 2160) == "high-resolution")
    precondition(reason(1280, 720, 60) == "high-frame-rate")
    precondition(reason(1280, 720, 24, true) == "temperature")
    precondition(reason(1280, 720, 24, false, true) == "low-power")
    precondition(reason(0, 0) == "waiting-for-video")
    precondition(PlaybackBudget.shaderLimit(width: 1280, height: 720, fps: 24,
      thermalLimited: false, lowPower: false, softwareDecoded: true) == "software-decoding")
    print("PlaybackBudget: render bounds and shader guardrails passed")
  }
}
