import UIKit
import Capacitor

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // ✅ Enable pinch-to-zoom on WKWebView after the bridge loads
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.enablePinchToZoom()
        }
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // MARK: - Pinch-to-Zoom Support
    private func enablePinchToZoom() {
        guard let rootVC = window?.rootViewController else { return }
        
        // Find WKWebView in the view hierarchy
        if let webView = findWebView(in: rootVC.view) {
            webView.scrollView.minimumZoomScale = 0.5
            webView.scrollView.maximumZoomScale = 3.0
            webView.scrollView.bouncesZoom = true
            
            // Also inject meta viewport override via JavaScript
            let js = """
            (function() {
                var meta = document.querySelector('meta[name="viewport"]');
                if (meta) {
                    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=3.0, user-scalable=yes, viewport-fit=cover');
                }
            })();
            """
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func findWebView(in view: UIView) -> WKWebView? {
        if let webView = view as? WKWebView {
            return webView
        }
        for subview in view.subviews {
            if let found = findWebView(in: subview) {
                return found
            }
        }
        return nil
    }
}
