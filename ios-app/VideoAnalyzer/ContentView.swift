import SwiftUI
import PhotosUI

private enum Stage {
    case pickVideo
    case analyzing
    case result(reportId: String, feedback: Feedback)
    case error(String)
}

struct ContentView: View {
    @State private var selectedItem: PhotosPickerItem?
    @State private var pickedVideo: VideoTransferable?
    @State private var stage: Stage = .pickVideo
    @State private var pdfURL: URL?
    @State private var isShowingShareSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    header

                    switch stage {
                    case .pickVideo:
                        pickerCard
                    case .analyzing:
                        analyzingCard
                    case .result(let reportId, let feedback):
                        resultCard(reportId: reportId, feedback: feedback)
                    case .error(let message):
                        errorCard(message: message)
                    }
                }
                .padding()
            }
            .navigationTitle("Video Analyzer")
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(isPresented: $isShowingShareSheet) {
            if let pdfURL {
                ShareSheet(items: [pdfURL])
            }
        }
        .onChange(of: selectedItem) { _, newItem in
            guard let newItem else { return }
            Task { await handlePicked(item: newItem) }
        }
    }

    // MARK: - Sections

    private var header: some View {
        Text("Upload a video and get feedback on its content and delivery as a downloadable PDF.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
    }

    private var pickerCard: some View {
        VStack(spacing: 16) {
            PhotosPicker(selection: $selectedItem, matching: .videos) {
                Label(pickedVideo == nil ? "Choose a video from Photos" : "Video selected — tap to change",
                      systemImage: "video.badge.plus")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(.thinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            Button {
                Task { await analyze() }
            } label: {
                Text("Analyze video")
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            .buttonStyle(.borderedProminent)
            .disabled(pickedVideo == nil)
        }
    }

    private var analyzingCard: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Analyzing your video…")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(32)
    }

    private func resultCard(reportId: String, feedback: Feedback) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Overall score: \(feedback.overallScore) / 100")
                .font(.title3.bold())
                .frame(maxWidth: .infinity, alignment: .center)

            ForEach(feedback.sections) { section in
                HStack {
                    Text(section.title)
                    Spacer()
                    Text("\(section.score) / 100")
                        .fontWeight(.semibold)
                }
            }

            Button {
                Task { await downloadPDF(reportId: reportId) }
            } label: {
                Text("Download PDF report")
                    .frame(maxWidth: .infinity)
                    .padding()
            }
            .buttonStyle(.borderedProminent)

            Button("Analyze another video") {
                reset()
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)
        }
        .padding()
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func errorCard(message: String) -> some View {
        VStack(spacing: 16) {
            Text(message)
                .foregroundStyle(.red)
                .multilineTextAlignment(.center)
            Button("Try again") { reset() }
                .buttonStyle(.bordered)
        }
        .padding()
    }

    // MARK: - Actions

    private func handlePicked(item: PhotosPickerItem) async {
        do {
            pickedVideo = try await item.loadTransferable(type: VideoTransferable.self)
        } catch {
            stage = .error("Couldn't load that video. Please try a different one.")
        }
    }

    private func analyze() async {
        guard let pickedVideo else { return }
        stage = .analyzing

        do {
            let data = try Data(contentsOf: pickedVideo.url)
            let fileName = pickedVideo.url.lastPathComponent
            let mimeType = mimeType(forPathExtension: pickedVideo.url.pathExtension)

            let response = try await AnalysisService.analyze(videoData: data, fileName: fileName, mimeType: mimeType)
            stage = .result(reportId: response.id, feedback: response.feedback)
        } catch {
            stage = .error(error.localizedDescription)
        }
    }

    private func downloadPDF(reportId: String) async {
        do {
            pdfURL = try await AnalysisService.downloadReportPDF(reportId: reportId)
            isShowingShareSheet = true
        } catch {
            stage = .error(error.localizedDescription)
        }
    }

    private func reset() {
        selectedItem = nil
        pickedVideo = nil
        pdfURL = nil
        stage = .pickVideo
    }

    private func mimeType(forPathExtension ext: String) -> String {
        switch ext.lowercased() {
        case "mov": return "video/quicktime"
        case "mp4": return "video/mp4"
        case "m4v": return "video/x-m4v"
        default: return "video/mp4"
        }
    }
}

#Preview {
    ContentView()
}
