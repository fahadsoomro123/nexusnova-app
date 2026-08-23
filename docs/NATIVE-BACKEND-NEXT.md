# Next Native / Backend Connections

1. Android Caller ID: existing CallScreeningService -> connect real provider/contacts lookup.
2. FCM: connect Firebase Messaging + service worker/native receiver for closed-app notifications.
3. Firebase Storage: user-scoped File Vault with Storage Rules.
4. Travel APIs: connect flight/train/bus provider adapters through Cloud Functions.
5. Marketplace/Orders: Firestore + Cloud Functions + payment/courier providers.
6. QR Scanner: Android camera/Barcode Scanner bridge.
7. Document OCR: camera crop/OCR provider and PDF generation.
8. Keep all provider secrets server-side; never place admin/API secrets in browser JS.
