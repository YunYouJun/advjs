// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "StudioUI",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v26),
        .macOS(.v26),
    ],
    products: [
        .library(name: "StudioUI", targets: ["StudioUI"]),
    ],
    targets: [
        .target(
            name: "StudioUI",
            swiftSettings: [
                .swiftLanguageMode(.v6),
            ]
        ),
    ]
)
