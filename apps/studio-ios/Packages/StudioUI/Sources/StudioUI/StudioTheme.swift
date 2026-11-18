import SwiftUI

/// Brand values for the native Studio. The interface uses system materials,
/// fonts and controls; the brand shows through these colors only
/// (see docs/about/design/studio-native.md).
public enum StudioTheme {
    /// Royal Purple, `#7c3aed` (light) and `#a78bfa` (dark): the App's tint.
    public static let purple = Color(light: 0x7C3AED, dark: 0xA78BFA)
    /// Adventure Gold, `#f59e0b`: badges and highlights, never body text.
    public static let gold = Color(light: 0xD97706, dark: 0xFBBF24)
    /// Semantic colors follow the Studio design tokens.
    public static let success = Color(light: 0x059669, dark: 0x34D399)
    public static let danger = Color(light: 0xDC2626, dark: 0xF87171)
}

extension Color {
    /// A color with separate light and dark appearances, from 0xRRGGBB values.
    public init(light: UInt32, dark: UInt32) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
        #else
        self.init(nsColor: NSColor(name: nil) { appearance in
            NSColor(rgb: appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light)
        })
        #endif
    }
}

#if canImport(UIKit)
extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}
#else
extension NSColor {
    convenience init(rgb: UInt32) {
        self.init(
            srgbRed: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}
#endif
