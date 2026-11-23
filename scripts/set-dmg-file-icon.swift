import AppKit

let arguments = CommandLine.arguments.dropFirst()
guard let iconPath = arguments.first, arguments.count >= 2,
      let icon = NSImage(contentsOfFile: iconPath) else {
    FileHandle.standardError.write(Data("Usage: swift set-dmg-file-icon.swift <logo> <dmg>...\n".utf8))
    exit(EXIT_FAILURE)
}

for dmgPath in arguments.dropFirst() {
    guard NSWorkspace.shared.setIcon(icon, forFile: dmgPath) else {
        FileHandle.standardError.write(Data("Could not set the Finder icon for \(dmgPath)\n".utf8))
        exit(EXIT_FAILURE)
    }
    print("Set Finder icon: \(dmgPath)")
}
