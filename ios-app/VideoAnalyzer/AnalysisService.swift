import Foundation

enum AnalysisError: LocalizedError {
    case server(String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .server(let message): return message
        case .invalidResponse: return "The server returned an unexpected response."
        }
    }
}

enum AnalysisService {
    /// Simulator can reach your Mac via "localhost". A physical iPhone needs your
    /// Mac's LAN IP instead, e.g. "http://192.168.1.23:3000" (run `ipconfig getifaddr en0`).
    static let baseURL = URL(string: "http://localhost:3000")!

    static func analyze(videoData: Data, fileName: String, mimeType: String) async throws -> AnalyzeResponse {
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/analyze"))
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"video\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(videoData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw AnalysisError.invalidResponse }

        if httpResponse.statusCode == 200 {
            return try JSONDecoder().decode(AnalyzeResponse.self, from: data)
        } else {
            let apiError = try? JSONDecoder().decode(APIError.self, from: data)
            throw AnalysisError.server(apiError?.error ?? "The server could not analyze this video.")
        }
    }

    static func downloadReportPDF(reportId: String) async throws -> URL {
        let url = baseURL.appendingPathComponent("/api/report/\(reportId)/pdf")
        let (tempURL, response) = try await URLSession.shared.download(from: url)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw AnalysisError.server("The PDF report could not be downloaded.")
        }

        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent("feedback-\(reportId)")
            .appendingPathExtension("pdf")
        try? FileManager.default.removeItem(at: destination)
        try FileManager.default.moveItem(at: tempURL, to: destination)
        return destination
    }
}
