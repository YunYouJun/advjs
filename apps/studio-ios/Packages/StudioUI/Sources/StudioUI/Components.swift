import SwiftUI

/// A count with a label and symbol, for project overviews.
public struct StatTile: View {
    let title: LocalizedStringKey
    let value: Int
    let systemImage: String

    public init(_ title: LocalizedStringKey, value: Int, systemImage: String) {
        self.title = title
        self.value = value
        self.systemImage = systemImage
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: systemImage)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(value, format: .number)
                .font(.title2.weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.background.secondary, in: .rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}

/// A short status pill: a number or word on a tinted capsule.
public struct StatusBadge: View {
    let text: Text
    let tint: Color

    public init(_ text: Text, tint: Color) {
        self.text = text
        self.tint = tint
    }

    public var body: some View {
        text
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .foregroundStyle(tint)
            .background(tint.opacity(0.15), in: .capsule)
    }
}
