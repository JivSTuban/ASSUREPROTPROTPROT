# Quick Build Steps - Hackathon Edition

## Overview
GCash-style escrow app: Buyer creates transaction → Seller approves → Money in escrow → Both confirm → Transfer OR auto-refund if window expires.

---

## Step 1: Setup (15 min)
```bash
npm create vite@latest gassure-escrow -- --template react-ts
cd gassure-escrow
npm install
npm install react-router-dom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Configure Tailwind** (`tailwind.config.js`):
```js
content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
```

**Add to `index.css`**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Create routes** (`src/App.tsx`):
```tsx
import { Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Escrow from './components/Escrow'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/escrow" element={<Escrow />} />
    </Routes>
  )
}
```

---

## Step 2: Dashboard UI (30 min)

**Create `src/components/Dashboard.tsx`**:
- Blue header with G logo
- Balance display with toggle
- Service grid (12 icons)
- Bottom nav
- Navigate to /escrow on GAssure click

**Prompt**: "Build a GCash dashboard with blue header, balance display, service icons grid, and bottom navigation. Clicking GAssure goes to /escrow."

---

## Step 3: Context Setup (20 min)

**Create `src/context/DeviceContext.tsx`**:
```tsx
// Device type: 'buyer' | 'seller' | null
// Phone number: string
// Save to localStorage
```

**Create `src/context/WalletContext.tsx`**:
```tsx
// Balance: number (separate for buyer/seller)
// addBalance, subtractBalance functions
// Save to localStorage: wallet_balance_buyer, wallet_balance_seller
```

**Wrap App** (`src/main.tsx`):
```tsx
<DeviceProvider>
  <WalletProvider>
    <App />
  </WalletProvider>
</DeviceProvider>
```

**Prompt**: "Create DeviceContext and WalletContext. DeviceContext tracks buyer/seller mode and phone number. WalletContext tracks separate balances for buyer (₱10k) and seller (₱5k), saved to localStorage."

---

## Step 4: Escrow Page - Buyer Form (30 min)

**Create `src/components/Escrow.tsx`**:
- Form: amount, seller phone, description, expiry date
- Validation: min ₱5k, future date
- Generate transaction ID: `TXN-${Date.now()}-${random}`
- Save to localStorage: `txn_{id}`

**Transaction object**:
```tsx
{
  buyerId: string,
  amount: number,
  createdAt: number,
  description: string,
  sellerPhoneNumber: string,
  buyerPhoneNumber: string,
  protectionWindowExpiryDate: number,
  sellerConnected: false,
  sellerApproved: false,
  amountHeldInEscrow: false,
  buyerConfirmed: false,
  sellerConfirmed: false,
  completed: false
}
```

**Prompt**: "Create escrow page with form: amount (min ₱5k), seller phone, description, expiry date picker. On submit, generate transaction ID and save to localStorage as JSON."

---

## Step 5: Transaction Display (20 min)

**After creation, show**:
- Transaction ID card
- Copy button
- QR code: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={id}`
- Store transactionId in state

**Prompt**: "After creating transaction, display transaction ID, copy button, and QR code. Store transactionId in component state."

---

## Step 6: Seller Pending List (30 min)

**Add pending transactions section**:
- Scan localStorage for `txn_*` keys
- Filter: seller phone matches AND sellerConnected = false
- Show cards with amount, description, date
- Approve button: set sellerApproved = true, deduct ₱100 from buyer wallet
- Reject button: set sellerApproved = false

**Prompt**: "Show pending transactions for seller. Each card has amount, description, approve/reject buttons. On approve, deduct ₱100 from buyer's wallet."

---

## Step 7: Seller Connection (25 min)

**When seller approves**:
- Deduct ₱100 from seller wallet (hold)
- Set sellerConnected = true, sellerAmountOnHold = true
- Show transaction details view
- Display: amount, description, expiry, status

**Prompt**: "When seller approves, deduct ₱100 hold from seller wallet, mark as connected, show transaction details view."

---

## Step 8: Send to Escrow (20 min)

**Buyer view**:
- Poll for sellerConnected = true
- Show "Send Money to Escrow" button
- Deduct (amount + ₱100 fee) from buyer
- Set amountHeldInEscrow = true

**Prompt**: "Add 'Send Money to Escrow' button. When clicked, deduct amount + ₱100 fee from buyer, mark amountHeldInEscrow = true."

---

## Step 9: Confirmation (25 min)

**Add buttons**:
- Buyer: "I Received the Item" → buyerConfirmed = true
- Seller: "I Delivered the Item" → sellerConfirmed = true

**Auto-transfer when both true**:
- Add (amount + ₱100) to seller wallet
- Mark completed = true
- Clear transaction after 1s

**Prompt**: "Add confirmation buttons for buyer and seller. When both confirm, transfer money to seller and mark transaction complete."

---

## Step 10: Protection Window (30 min)

**Countdown display**:
- Calculate: expiryDate - now
- Format: "Xd Xh Xm" or "Xh Xm" or "Xm"
- Update every second
- Show in both views

**Prompt**: "Add protection window countdown timer that updates every second, showing days/hours/minutes remaining."

---

## Step 11: Expiration (25 min)

**Check every minute**:
- If expired AND amountHeldInEscrow:
  - Return (amount + ₱100) to buyer
  - Mark expired = true
  - Seller's ₱100 hold stays deducted

**Prompt**: "Add expiration check. If protection window expires, return money to buyer and mark transaction as expired."

---

## Step 12: URL Connection (20 min)

**Handle `/escrow?id={transactionId}`**:
- Look up in localStorage
- Verify seller phone matches
- Auto-connect seller
- Clean URL

**Prompt**: "Support URL parameter ?id={transactionId} to auto-connect seller to transaction."

---

## Step 13: State Restoration (25 min)

**On page load**:
- Find active transactions (not completed/expired)
- Match by phone number (buyer or seller)
- Restore all state flags
- Show correct view

**Prompt**: "On page refresh, restore active transactions by matching phone number and restoring all state."

---

## Step 14: Notifications (15 min)

**Toast component**:
- Green (success) / Red (error)
- Auto-dismiss 4s
- Show on all actions

**Prompt**: "Add toast notifications for success (green) and errors (red), auto-dismiss after 4 seconds."

---

## Step 15: Polish (30 min)

**UI improvements**:
- Loading states
- Disable buttons when processing
- Hover effects
- Mobile responsive
- Dev button: "Skip Protection Window" (sets expiry to 5s from now)

**Prompt**: "Polish UI: loading states, disabled buttons, hover effects, mobile responsive. Add dev button to skip protection window for testing."

---

## Testing Checklist

- [ ] Buyer creates transaction
- [ ] Seller sees pending transaction
- [ ] Seller approves → ₱100 deducted from buyer
- [ ] Seller connects → ₱100 hold from seller
- [ ] Buyer sends to escrow
- [ ] Both confirm → money transfers
- [ ] Protection window expires → money refunds
- [ ] Page refresh restores state
- [ ] URL connection works
- [ ] Insufficient balance errors work

---

## Time Estimate: ~6-8 hours

1. Setup: 15 min
2. Dashboard: 30 min
3. Context: 20 min
4. Buyer form: 30 min
5. Transaction display: 20 min
6. Seller pending: 30 min
7. Seller connection: 25 min
8. Send escrow: 20 min
9. Confirmation: 25 min
10. Protection window: 30 min
11. Expiration: 25 min
12. URL connection: 20 min
13. State restoration: 25 min
14. Notifications: 15 min
15. Polish: 30 min

**Total: ~6.5 hours** (with buffer for debugging)

