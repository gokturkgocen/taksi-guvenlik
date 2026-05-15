import Foundation

enum Constants {
    static let serverBaseURL = URL(string: "http://18.192.45.175:8000")!
    static let plateRegex = #"^\d{2}\s?[A-Z]{1,3}\s?\d{2,4}$"#
}
