import SwiftUI
import UIKit

struct ProjectCamera: UIViewControllerRepresentable {
    let didCapture: (Data?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(didCapture: didCapture) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let controller = UIImagePickerController()
        controller.sourceType = .camera
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let didCapture: (Data?) -> Void

        init(didCapture: @escaping (Data?) -> Void) {
            self.didCapture = didCapture
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            didCapture(nil)
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            didCapture((info[.originalImage] as? UIImage)?.jpegData(compressionQuality: 0.92))
        }
    }
}
