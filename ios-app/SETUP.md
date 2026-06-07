# iOS app setup

The Swift source files are in `ios-app/VideoAnalyzer/`. Xcode project files can't be
generated reliably from the command line here, so create the project shell in Xcode
(2 minutes) and drop these files in:

1. **Xcode → File → New → Project → iOS → App**
   - Product Name: `VideoAnalyzer`
   - Interface: SwiftUI, Language: Swift
   - Save it anywhere (e.g. next to this `ios-app` folder)

2. **Delete** the auto-generated `ContentView.swift` and `VideoAnalyzerApp.swift` that
   Xcode created in the new project (keep `Assets.xcassets`, `Preview Content`).

3. **Drag the files** from `ios-app/VideoAnalyzer/` into the project navigator
   (check "Copy items if needed" and add to the `VideoAnalyzer` target):
   - `VideoAnalyzerApp.swift`
   - `ContentView.swift`
   - `Models.swift`
   - `AnalysisService.swift`
   - `VideoTransferable.swift`
   - `ShareSheet.swift`

4. **Allow local HTTP** (the backend runs on plain `http://` locally). In the target's
   `Info` tab, add an *App Transport Security Settings* dictionary with
   *Allow Arbitrary Loads* = `YES` (or, more narrowly, *Allow Local Networking* = `YES`).
   This is fine for development; switch the backend to HTTPS before shipping.

5. **Point the app at your backend.** In `AnalysisService.swift`:
   - Simulator → `http://localhost:3000` works as-is (the simulator shares your Mac's network).
   - Physical iPhone → replace `localhost` with your Mac's LAN IP, e.g. `http://192.168.1.23:3000`
     (find it with `ipconfig getifaddr en0`). Your phone and Mac must be on the same Wi-Fi.

6. **Run the backend** from the project root: `npm start` (in `/Users/shilpibhabhra/VideoAnalyzer`).

7. **Build & run** the app (⌘R) on a simulator or your device. Tap "Choose a video from
   Photos", pick a clip, tap "Analyze video", then "Download PDF report" to share/save it.

No `NSPhotoLibraryUsageDescription` is needed — `PhotosPicker` runs out-of-process and
never grants the app direct library access.
