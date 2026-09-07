import Foundation

/// Pure policy, shared by the renderer and the native regression tests.
enum PlaybackBudget {
  static func renderScale(width: Double, height: Double, nativeScale: Double) -> Double {
    guard width > 0, height > 0 else { return 1 }
    return min(nativeScale, min(1920 / max(width, height), 1080 / min(width, height)))
  }

  static func shaderLimit(width: Int, height: Int, fps: Double,
                          thermalLimited: Bool, lowPower: Bool, softwareDecoded: Bool = false) -> String {
    if thermalLimited { return "temperature" }
    if lowPower { return "low-power" }
    if width <= 0 || height <= 0 { return "waiting-for-video" }
    if softwareDecoded { return "software-decoding" }
    if max(width, height) > 1920 || min(width, height) > 1080 { return "high-resolution" }
    if fps > 30.5 { return "high-frame-rate" }
    return ""
  }
}
