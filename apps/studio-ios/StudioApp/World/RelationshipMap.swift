import StudioKit
import SwiftUI

struct RelationshipMap: View {
    let kind: ContentKind
    let nodes: [ContentEntry]
    let edges: [WorldRelationship]
    @State private var zoom = 1.0
    @GestureState private var magnification = 1.0

    private var dimension: CGFloat {
        let size = max(280, min(CGFloat(nodes.count) * 40, 1600))
        return size * min(2.5, max(0.65, zoom * magnification))
    }

    var body: some View {
        let points = positions
        VStack(alignment: .leading, spacing: 8) {
            ScrollView([.horizontal, .vertical]) {
                ZStack {
                    Canvas { context, _ in
                        for edge in edges {
                            guard let source = points[edge.source], let target = points[edge.target] else { continue }
                            var line = Path()
                            line.move(to: source)
                            line.addLine(to: target)
                            context.stroke(line, with: .color(.secondary), lineWidth: 1)
                        }
                    }
                    ForEach(nodes) { node in
                        if let point = points[node.path] {
                            NavigationLink(value: ContentRoute.entry(kind, node.path)) {
                                Label(node.name, systemImage: kind.icon)
                                    .labelStyle(.titleOnly)
                                    .lineLimit(1)
                                    .frame(maxWidth: 130)
                                    .padding(6)
                                    .background(.regularMaterial, in: .capsule)
                            }
                            .buttonStyle(.borderless)
                            .position(point)
                        }
                    }
                }
                .frame(width: dimension, height: dimension)
                .accessibilityHidden(true)
            }
            .frame(height: 280)
            .simultaneousGesture(
                MagnifyGesture()
                    .updating($magnification) { value, state, _ in state = value.magnification }
                    .onEnded { value in zoom = min(2.5, max(0.65, zoom * value.magnification)) }
            )
            Slider(value: $zoom, in: 0.65...2.5) { Text("Graph Zoom") }
                .accessibilityIdentifier("world-graph-zoom")
        }
    }

    private var positions: [String: CGPoint] {
        let center = dimension / 2
        let radius = max(0, center - 75)
        let angle = 2 * Double.pi / Double(max(1, nodes.count))
        return Dictionary(uniqueKeysWithValues: nodes.enumerated().map { index, node in
            let distance = nodes.count > 1 ? radius : 0
            let theta = angle * Double(index) - .pi / 2
            return (node.path, CGPoint(x: center + cos(theta) * distance, y: center + sin(theta) * distance))
        })
    }
}
