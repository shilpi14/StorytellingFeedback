import Foundation

struct FeedbackSection: Codable, Identifiable {
    var id: String { title }
    let title: String
    let score: Int
    let summary: String
}

struct Feedback: Codable {
    let fileName: String
    let generatedAt: String
    let overallScore: Int
    let sections: [FeedbackSection]
    let strengths: [String]
    let improvements: [String]
}

struct AnalyzeResponse: Codable {
    let id: String
    let feedback: Feedback
}

struct APIError: Codable {
    let error: String
}
