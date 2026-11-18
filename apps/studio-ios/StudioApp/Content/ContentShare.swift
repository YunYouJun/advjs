import Foundation
import SwiftUI
import UIKit

struct ContentShare: Identifiable {
    var id = UUID()
    var items: [Any]
    var directory: URL?

    static func file(name: String, data: Data) throws -> Self {
        let directory = FileManager.default.temporaryDirectory.appending(path: "content-share-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appending(path: name)
        do { try data.write(to: url, options: .atomic) }
        catch {
            try? FileManager.default.removeItem(at: directory)
            throw error
        }
        return Self(items: [url], directory: directory)
    }

    func cleanUp() {
        if let directory { try? FileManager.default.removeItem(at: directory) }
    }
}

/// A share image can be produced offline from the saved character details.
struct CharacterProfileCard: View {
    let name: String
    let details: String
    let avatar: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let avatar {
                Image(uiImage: avatar).resizable().scaledToFill().frame(width: 72, height: 72).clipShape(.circle)
            }
            Text(name).font(.largeTitle.bold())
            if !details.isEmpty { Text(details).font(.body) }
        }
        .padding(28)
        .frame(width: 420, alignment: .leading)
        .background(.background)
    }
}
