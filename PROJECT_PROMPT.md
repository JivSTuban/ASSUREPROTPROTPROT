# GAssure Escrow - Hackathon Project

## What It Is (30-second pitch)

A **GCash-style escrow app** where buyers and sellers do secure transactions:
- Buyer creates transaction → sends money to escrow → confirms receipt
- Seller approves → confirms delivery → gets paid
- **Protection window**: If buyer doesn't confirm in time, money auto-refunds
- All stored in localStorage (no backend needed)

## The Flow (Simple)

1. **Buyer**: Creates transaction (amount, seller phone, description, expiry date)
2. **Seller**: Sees pending transaction → Approves → Connects
3. **Buyer**: Sends money to escrow (amount + ₱100 fee)
4. **Both**: Confirm receipt/delivery
5. **Auto**: Money transfers to seller OR refunds to buyer if window expires

## Rules

- Transaction fee: ₱100 (from buyer)
- Seller hold: ₱100 (released on completion)
- Min amount: ₱5,000
- Default balances: Buyer ₱10k, Seller ₱5k

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS (GCash blue: #0066FF)
- React Router
- localStorage only (no backend)

---

## Build It Step-by-Step

### Step 1: Setup & Dashboard UI
**Goal**: Get the basic app running with a GCash-style dashboard

**Prompt**: 
"Create a React + TypeScript + Vite project with Tailwind CSS. Build a GCash-inspired dashboard with:
- Blue header (#0066FF) with 'G' logo
- Balance display (₱10,000) with eye icon to toggle visibility
- 4x3 grid of service icons (Send, Load, Transfer, Bills, Borrow, GSave, Ginsure, GInvest, GLife, A+ Rewards, GForest, GAssure)
- Bottom nav bar (Home, Inbox, QR, Transactions, Profile)
- Clicking 'GAssure' navigates to /escrow
- Add a 'Buyer/Seller' toggle button in header"

### Step 2: Context & State
**Goal**: Add wallet and device state management

**Prompt**:
"Create two React contexts:
1. DeviceContext: tracks deviceType ('buyer'/'seller') and phoneNumber, saves to localStorage
2. WalletContext: tracks balance, separate wallets for buyer (₱10k) and seller (₱5k) in localStorage
Wrap the app with both providers. Update dashboard to use wallet balance from context."

### Step 3: Escrow Page - Buyer Form
**Goal**: Build the transaction creation form

**Prompt**:
"Create /escrow page with a form for buyers:
- Amount input (min ₱5,000)
- Seller phone number input
- Description textarea
- Date picker for protection window expiry (default: tomorrow)
- 'Create Transaction' button
- Show success message when created
- Generate unique transaction ID (TXN-timestamp-random)
- Save to localStorage as `txn_{transactionId}`"

### Step 4: Transaction Display & QR
**Goal**: Show transaction ID and QR code after creation

**Prompt**:
"After creating transaction, show:
- Transaction ID in a card
- Copy button
- QR code (use https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={transactionId})
- 'Back' button to create another
- Store transactionId in state so buyer can see it"

### Step 5: Seller - Pending Transactions
**Goal**: Seller sees list of pending transactions

**Prompt**:
"Add a section on /escrow page that shows pending transactions for seller:
- Scan localStorage for all `txn_*` keys
- Filter by seller phone number matching current seller phone
- Show cards with: amount, description, date
- Each card has 'Approve' and 'Reject' buttons
- Only show transactions where sellerConnected = false
- When seller clicks 'Approve', mark sellerApproved = true and deduct ₱100 from buyer's wallet"

### Step 6: Seller Connection
**Goal**: Seller connects to approved transaction

**Prompt**:
"When seller approves:
- Deduct ₱100 hold from seller's wallet
- Mark sellerConnected = true and sellerAmountOnHold = true
- Show transaction details view
- Display: amount, description, protection window expiry, status
- Show 'Waiting for buyer to send money' message"

### Step 7: Buyer - Send to Escrow
**Goal**: Buyer sends money after seller connects

**Prompt**:
"On buyer's transaction view:
- Show 'Seller Connected!' message when sellerConnected = true
- Add 'Send Money to Escrow' button
- When clicked: deduct (amount + ₱100 fee) from buyer's wallet
- Mark amountHeldInEscrow = true
- Show success message
- Update UI to show 'Money in Escrow' status"

### Step 8: Confirmation System
**Goal**: Both parties confirm receipt/delivery

**Prompt**:
"Add confirmation buttons:
- Buyer view: 'I Received the Item' button (sets buyerConfirmed = true)
- Seller view: 'I Delivered the Item' button (sets sellerConfirmed = true)
- When both are true, automatically transfer money to seller:
  - Add (amount + ₱100 hold release) to seller's wallet
  - Mark transaction as completed
  - Show success messages
  - Clear transaction after 1 second"

### Step 9: Protection Window Countdown
**Goal**: Show countdown timer

**Prompt**:
"Add protection window countdown:
- Calculate expiry time from protectionWindowExpiryDate
- Display as 'Xd Xh Xm remaining' or 'Xh Xm' or 'Xm'
- Update every second
- Show in both buyer and seller views
- If expired: return money to buyer, mark transaction as expired"

### Step 10: Expiration Handling
**Goal**: Auto-refund when window expires

**Prompt**:
"Add expiration check:
- Poll every minute to check if protectionWindowExpiryDate has passed
- If expired and money in escrow:
  - Return (amount + ₱100 fee) to buyer
  - Mark transaction as expired
  - Show message to buyer
  - Seller's ₱100 hold stays deducted
- Clear transaction after handling"

### Step 11: URL Connection
**Goal**: Seller connects via transaction ID in URL

**Prompt**:
"Add URL parameter support:
- Seller can visit /escrow?id={transactionId}
- Look up transaction in localStorage
- Verify seller phone number matches
- Auto-connect seller to transaction
- Show transaction view immediately
- Clean URL after loading"

### Step 12: State Restoration
**Goal**: Restore active transactions on page refresh

**Prompt**:
"On page load:
- Check localStorage for active transactions (not completed, not expired)
- Determine if user is buyer or seller by phone number
- Restore all state (connected, confirmed, escrow status)
- Show appropriate view (buyer or seller)
- Update wallet balances from localStorage"

### Step 13: Polish - Notifications
**Goal**: Better status messages

**Prompt**:
"Add toast notifications:
- Green for success, red for errors
- Auto-dismiss after 4 seconds
- Show at top of page
- Use for all user actions (create, approve, send, confirm, etc.)"

### Step 14: Polish - UI Refinements
**Goal**: Make it look good

**Prompt**:
"Polish the UI:
- Add loading states on buttons
- Disable buttons when processing
- Add hover effects
- Improve spacing and typography
- Add smooth transitions
- Make mobile-responsive
- Add 'Skip Protection Window' dev button (sets expiry to 5 seconds from now)"

### Step 15: Testing & Edge Cases
**Goal**: Handle errors gracefully

**Prompt**:
"Add error handling:
- Insufficient balance checks
- Invalid transaction IDs
- Phone number validation
- Date validation (must be future)
- Show user-friendly error messages
- Test buyer and seller flows end-to-end
- Test expiration flow
- Test page refresh during active transaction"

---

## Quick Reference

**localStorage keys:**
- `wallet_balance_buyer`: "10000.00"
- `wallet_balance_seller`: "5000.00"
- `device_type`: "buyer" | "seller"
- `phone_number`: "+63 912 345 6789"
- `txn_{id}`: JSON transaction object

**Transaction states:**
- Created → Pending → Approved → Connected → Escrow Funded → Confirmed → Completed
- OR: Expired (money returned to buyer)

**Colors:**
- Primary: #0066FF (GCash blue)
- Success: #10B981 (green)
- Error: #EF4444 (red)
