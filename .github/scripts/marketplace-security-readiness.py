from pathlib import Path
import sys

path = Path('firestore.rules')
if not path.exists():
    print('NexusNova Marketplace security readiness: FAIL\n - ERROR: firestore.rules missing')
    sys.exit(1)
rules = path.read_text(encoding='utf-8')
errors = []

markers = [
    # Listing ownership/value bounds.
    "request.resource.data.sellerUid == request.auth.uid",
    "request.resource.data.status == 'active'",
    "data.price is number && data.price >= 0 && data.price <= 1000000000",
    "request.resource.data.createdAt == request.time",
    "request.resource.data.updatedAt == request.time",
    "request.auth.uid == resource.data.sellerUid",
    "request.resource.data.sellerUid == resource.data.sellerUid",
    "request.resource.data.createdAt == resource.data.createdAt",
    # Order binds buyer input to the live listing snapshot.
    "request.resource.data.buyerUid == request.auth.uid",
    "request.resource.data.sellerUid != request.auth.uid",
    "request.resource.data.status == 'requested'",
    "get(/databases/$(database)/documents/marketplaceListings/$(request.resource.data.listingId)).data.status == 'active'",
    "get(/databases/$(database)/documents/marketplaceListings/$(request.resource.data.listingId)).data.sellerUid == request.resource.data.sellerUid",
    "get(/databases/$(database)/documents/marketplaceListings/$(request.resource.data.listingId)).data.title == request.resource.data.title",
    "get(/databases/$(database)/documents/marketplaceListings/$(request.resource.data.listingId)).data.price == request.resource.data.amount",
    "get(/databases/$(database)/documents/marketplaceListings/$(request.resource.data.listingId)).data.currency == request.resource.data.currency",
    # Only status + timestamp can move after order creation.
    "request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','updatedAt'])",
    "sellerOrderTransitionAllowed() || buyerOrderTransitionAllowed()",
    # Public write surfaces are verified-email only.
    "allow create: if signedIn() && request.auth.token.email_verified == true && validListingCreate();",
    "allow update: if signedIn() && request.auth.token.email_verified == true && validListingUpdate();",
    "allow create: if signedIn() && request.auth.token.email_verified == true && validOrderCreate();",
    "allow update: if signedIn() && request.auth.token.email_verified == true && validOrderUpdate();",
    "allow delete: if false;",
]
for marker in markers:
    if marker not in rules:
        errors.append(f'marketplace security marker missing: {marker}')

# Explicit state-machine edges prevent buyers/sellers from jumping straight to
# arbitrary terminal states or editing financial fields after order creation.
for edge in [
    "request.resource.data.status == 'accepted'",
    "request.resource.data.status == 'processing'",
    "request.resource.data.status == 'shipped'",
    "request.resource.data.status == 'out_for_delivery'",
    "request.resource.data.status == 'delivered'",
    "request.resource.data.status == 'return_requested'",
    "request.resource.data.status == 'cancelled'",
]:
    if edge not in rules:
        errors.append(f'marketplace order state missing: {edge}')

if errors:
    print('NexusNova Marketplace security readiness: FAIL')
    for item in errors:
        print(' - ERROR:', item)
    sys.exit(1)

print('NexusNova Marketplace security readiness: PASS')
print(' - listings: seller-owned + bounded price + immutable owner/createdAt')
print(' - orders: buyer-owned request bound to active listing seller/title/price/currency')
print(' - post-create order fields: financial snapshot immutable')
print(' - order status: seller/buyer role transition state machine')
print(' - writes: verified-email only; order deletes denied')
