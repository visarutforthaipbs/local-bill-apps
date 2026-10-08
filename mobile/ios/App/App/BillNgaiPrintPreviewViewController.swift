import UIKit
import PDFKit

// The exact generated PDF, with system zoom/text selection; no second document renderer.
final class BillNgaiPrintPreviewViewController: UIViewController {
    private let pdfView = PDFView()
    private let data: Data
    private let fileName: String
    private let closeLabel: String
    private let shareLabel: String
    private let fitLabel: String
    private let shareFailedLabel: String
    private var onClose: (() -> Void)?
    private var observer: NSObjectProtocol?
    private var fittedSize = CGSize.zero
    private var sharing = false

    init(data: Data, fileName: String, closeLabel: String, shareLabel: String, fitLabel: String, shareFailedLabel: String, onClose: @escaping () -> Void) {
        self.data = data; self.fileName = fileName
        self.closeLabel = closeLabel; self.shareLabel = shareLabel; self.fitLabel = fitLabel
        self.shareFailedLabel = shareFailedLabel
        self.onClose = onClose
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) unavailable") }
    deinit { if let observer = observer { NotificationCenter.default.removeObserver(observer) } }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        let canvas = UIColor(named: "BillNgaiCanvas") ?? .systemBackground
        view.backgroundColor = canvas
        view.tintColor = UIColor(named: "BillNgaiAccent") ?? .label
        let appearance = UINavigationBarAppearance(); appearance.configureWithOpaqueBackground(); appearance.backgroundColor = canvas
        navigationController?.navigationBar.standardAppearance = appearance
        navigationController?.navigationBar.scrollEdgeAppearance = appearance
        navigationController?.navigationBar.tintColor = view.tintColor
        pdfView.backgroundColor = canvas
        pdfView.documentView?.backgroundColor = canvas
        pdfView.translatesAutoresizingMaskIntoConstraints = false
        pdfView.document = PDFDocument(data: data)
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.displaysPageBreaks = true
        pdfView.autoScales = true
        view.addSubview(pdfView)
        NSLayoutConstraint.activate([
            pdfView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            pdfView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            pdfView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            pdfView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        let close = UIBarButtonItem(systemItem: .close, primaryAction: UIAction { [weak self] _ in self?.close() })
        close.accessibilityLabel = closeLabel; navigationItem.leftBarButtonItem = close
        let share = UIBarButtonItem(systemItem: .action, primaryAction: UIAction { [weak self] _ in self?.sharePDF() })
        share.accessibilityLabel = shareLabel
        let fit = UIBarButtonItem(image: UIImage(systemName: "arrow.up.left.and.arrow.down.right"), style: .plain, target: self, action: #selector(fitPage))
        fit.accessibilityLabel = fitLabel; navigationItem.rightBarButtonItems = [share, fit]
        observer = NotificationCenter.default.addObserver(forName: .PDFViewPageChanged, object: pdfView, queue: .main) { [weak self] _ in self?.updateTitle() }
        updateTitle()
    }
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let canvas = UIColor(named: "BillNgaiCanvas") ?? .systemBackground
        navigationController?.overrideUserInterfaceStyle = .light
        navigationController?.view.backgroundColor = canvas
        let appearance = UINavigationBarAppearance(); appearance.configureWithOpaqueBackground(); appearance.backgroundColor = canvas
        navigationController?.navigationBar.standardAppearance = appearance
        navigationController?.navigationBar.scrollEdgeAppearance = appearance
        pdfView.backgroundColor = canvas
        updateTitle()
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Refit for rotation; subsequent layout events must preserve a user's zoom.
        if pdfView.bounds.size != fittedSize {
            fittedSize = pdfView.bounds.size; fitPage()
        }
    }
    private func updateTitle() {
        let count = pdfView.document?.pageCount ?? 0
        let index = pdfView.currentPage.flatMap { pdfView.document?.index(for: $0) } ?? 0
        navigationItem.title = "A4 · \(index + 1)/\(count)"
    }
    @objc private func fitPage() {
        pdfView.autoScales = true
        let fit = pdfView.scaleFactorForSizeToFit
        guard fit.isFinite, fit > 0 else { return }
        pdfView.minScaleFactor = fit
        pdfView.maxScaleFactor = max(fit * 8, 4)
        pdfView.scaleFactor = fit
    }
    private func close() {
        guard !sharing else { return }
        let finished = onClose; onClose = nil
        navigationController?.dismiss(animated: true) { finished?() }
    }
    #if DEBUG
    var qaState: [String: Any] {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        pdfView.backgroundColor.getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return ["pages": pdfView.document?.pageCount ?? 0, "title": navigationItem.title ?? "", "scale": pdfView.scaleFactor, "minScale": pdfView.minScaleFactor, "maxScale": pdfView.maxScaleFactor, "canvas": [red, green, blue, alpha], "closeLabel": navigationItem.leftBarButtonItem?.accessibilityLabel ?? "", "shareLabel": navigationItem.rightBarButtonItems?.first?.accessibilityLabel ?? ""]
    }
    #endif
    private func sharePDF() {
        guard !sharing else { return }
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let file = directory.appendingPathComponent(fileName)
            try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.popoverPresentationController?.barButtonItem = navigationItem.rightBarButtonItems?.first
            sharing = true
            sheet.completionWithItemsHandler = { [weak self] _, _, _, error in
                self?.sharing = false
                try? FileManager.default.removeItem(at: directory)
                if error != nil { DispatchQueue.main.async { self?.showShareFailure() } }
            }
            present(sheet, animated: true)
        } catch {
            showShareFailure()
        }
    }
    private func showShareFailure() {
        let alert = UIAlertController(title: shareLabel, message: shareFailedLabel, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: closeLabel, style: .cancel))
        present(alert, animated: true)
    }

}
