import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// App Store packaging conversion: preserve the approved artwork and source palette.
let args = CommandLine.arguments
guard args.count == 6,
      let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let artwork = CGImageSourceCreateImageAtIndex(source, 0, nil),
      let red = Double(args[3]), let green = Double(args[4]), let blue = Double(args[5]),
      let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8,
                              bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("Invalid icon packaging input") }
context.setFillColor(CGColor(red: red, green: green, blue: blue, alpha: 1))
let bounds = CGRect(x: 0, y: 0, width: 1024, height: 1024)
context.fill(bounds)
context.interpolationQuality = .high
context.draw(artwork, in: bounds)
guard let image = context.makeImage(),
      let output = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Icon packaging failed") }
CGImageDestinationAddImage(output, image, nil)
guard CGImageDestinationFinalize(output) else { fatalError("Icon packaging failed") }
