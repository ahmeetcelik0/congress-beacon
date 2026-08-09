import XCTest

final class RunnerUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testAppLaunches() throws {

        let app = XCUIApplication()

        app.launch()

        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 10),
            "Runner uygulaması foreground durumuna geçemedi."
        )
    }
}
